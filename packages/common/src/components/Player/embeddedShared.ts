//#region Imports

import { parseSubtitles, type subtitleTrack } from "./subtitles";

//#endregion

//#region embeddedShared.ts

/** Subtitle reads fetched at the same time. */
const CONCURRENCY = 6;
/** Minimum time between partial updates while a track loads, in ms. */
const PROGRESS_INTERVAL = 400;
/** Length of a subtitle without a duration, in seconds. */
const FALLBACK_DURATION = 5;

const NO_RANGES =
  "The server doesn't support range requests, so subtitles inside the video can't be read without downloading all of it.";
const NO_INDEX =
  "The video has no index of its subtitles, so they can't be read without downloading all of it.";
const BROKEN = "The video file could not be read.";

/** Format the lines are rebuilt as, for the normal subtitle parser. */
type subtitleCodec = "srt" | "vtt" | "ass";

/** A text subtitle track inside a video file. */
type embeddedTrackSummary = {
  /** Track number (Matroska) or track ID (MP4). */
  number: number;
  /** Track name from the file, or `null`. */
  name: string | null;
  /** BCP 47 or ISO 639-2 language tag, or `null` if not set or undetermined. */
  language: string | null;
  forced: boolean;
};

/** What a reader found in a video file. */
type embeddedContainer = {
  tracks: embeddedTrackSummary[];
  /** Loads track `number`, calling `onProgress` with partial results. */
  load: (
    number: number,
    onProgress?: (track: subtitleTrack) => void,
  ) => Promise<subtitleTrack>;
};

/** One subtitle line read from the file. */
type subtitleBlock = {
  /** Seconds. */
  start: number;
  /** Seconds, or `null` if the file doesn't say. */
  end: number | null;
  text: string;
  /** WebVTT cue settings, like `line:0 align:start`. */
  settings?: string;
};

const decoder: TextDecoder = new TextDecoder("utf-8");

//#region Reading bytes

/** Reads at most `length` bytes of the body, then stops the download. */
const readPrefix = async (
  response: Response,
  length: number,
): Promise<Uint8Array> => {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const out = new Uint8Array(length);
  let filled = 0;
  try {
    while (filled < length) {
      const { done, value } = await reader.read();
      if (done) break;
      const count = Math.min(value.length, length - filled);
      out.set(value.subarray(0, count), filled);
      filled += count;
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
  return out.subarray(0, filled);
};

/**
 * Fetches `length` bytes from `start` with a `Range` request. Never reads more
 * than `length` bytes, even if the server sends the whole file.
 *
 * @returns The bytes, which are fewer at the end of the file, and whether the
 * server answered the range. A server that ignores `Range` only works for
 * `start` `0`.
 */
const readRange = async (
  url: string,
  start: number,
  length: number,
): Promise<{ bytes: Uint8Array; ranged: boolean }> => {
  const response = await fetch(url, {
    headers: { Range: `bytes=${start}-${start + length - 1}` },
  });
  if (response.status === 416) {
    response.body?.cancel().catch(() => undefined);
    return { bytes: new Uint8Array(0), ranged: true };
  }
  if (!response.ok) {
    response.body?.cancel().catch(() => undefined);
    throw new Error(`The server answered ${response.status}.`);
  }
  const ranged = response.status === 206;
  const contentRange = response.headers.get("Content-Range");
  if (
    (!ranged && start > 0) ||
    (ranged && contentRange && !contentRange.startsWith(`bytes ${start}-`))
  ) {
    response.body?.cancel().catch(() => undefined);
    throw new Error(NO_RANGES);
  }
  return { bytes: await readPrefix(response, length), ranged };
};

//#endregion

//#region Building the subtitle file

const pad = (value: number, length: number) =>
  String(value).padStart(length, "0");

/** `H:MM:SS.mmm`, or with a `,` for `.srt`. */
const timestamp = (seconds: number, separator: "." | ",", hourLength = 1) => {
  const ms = Math.max(0, Math.round(seconds * 1000));
  return `${pad(Math.floor(ms / 3_600_000), hourLength)}:${pad(Math.floor(ms / 60_000) % 60, 2)}:${pad(Math.floor(ms / 1000) % 60, 2)}${separator}${pad(ms % 1000, 3)}`;
};

const ASS_EVENT_FORMAT =
  "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text";

/**
 * Turns the blocks into the text of a `.srt`, `.vtt` or `.ass` file, so the
 * normal subtitle parser reads them.
 *
 * @param header For `.ass`, the file's header (styles), from the track.
 */
const buildSource = (
  codec: subtitleCodec,
  header: string,
  blocks: subtitleBlock[],
): string => {
  const sorted = [...blocks].sort((a, b) => a.start - b.start);
  const timed = sorted.map((block, index) => ({
    ...block,
    end:
      block.end ??
      Math.min(
        sorted[index + 1]?.start ?? Number.POSITIVE_INFINITY,
        block.start + FALLBACK_DURATION,
      ),
  }));
  if (codec === "ass") {
    const styles = header.split(/^\[Events\]/im)[0] ?? "";
    const lines = timed.map((block) => {
      const fields = block.text.replace(/\r?\n/g, "\\N");
      const first = fields.indexOf(",");
      const second = fields.indexOf(",", first + 1);
      const layer = first === -1 ? "0" : fields.slice(first + 1, second);
      const rest = second === -1 ? fields : fields.slice(second + 1);
      return `Dialogue: ${layer},${timestamp(block.start, ".")},${timestamp(block.end, ".")},${rest}`;
    });
    return `${styles.trim() || "[Script Info]"}\n\n[Events]\n${ASS_EVENT_FORMAT}\n${lines.join("\n")}\n`;
  }
  const separator = codec === "vtt" ? "." : ",";
  const cues = timed.map((block, index) => {
    const text = block.text
      .replace(/\r\n?/g, "\n")
      .replace(/\n{2,}/g, "\n")
      .replace(/-->/g, "->")
      .trim();
    const settings =
      codec === "vtt" && block.settings
        ? ` ${block.settings.replace(/\s+/g, " ").trim()}`
        : "";
    const timing = `${timestamp(block.start, separator, 2)} --> ${timestamp(block.end, separator, 2)}${settings}`;
    return codec === "vtt"
      ? `${timing}\n${text}`
      : `${index + 1}\n${timing}\n${text}`;
  });
  return `${codec === "vtt" ? "WEBVTT\n\n" : ""}${cues.join("\n\n")}\n`;
};

/**
 * Runs `read` for every job, a few at a time, and parses the lines found.
 * `onProgress` gets the lines loaded so far while it runs. Jobs that fail are
 * skipped, unless all of them fail.
 */
const loadBlocks = async <job>(
  jobs: job[],
  read: (item: job) => Promise<subtitleBlock[]>,
  codec: subtitleCodec,
  header: string,
  onProgress?: (track: subtitleTrack) => void,
): Promise<subtitleTrack> => {
  const blocks: subtitleBlock[] = [];
  let firstError: unknown = null;
  let lastProgress = Date.now();
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const item = jobs[next++] as job;
      try {
        blocks.push(...(await read(item)));
      } catch (error) {
        firstError ??= error;
      }
      if (onProgress && Date.now() - lastProgress > PROGRESS_INTERVAL) {
        lastProgress = Date.now();
        onProgress(parseSubtitles(buildSource(codec, header, blocks)));
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker),
  );
  if (blocks.length === 0) throw firstError ?? new Error(BROKEN);
  return parseSubtitles(buildSource(codec, header, blocks));
};

//#endregion

//#endregion

export { BROKEN, decoder, loadBlocks, NO_INDEX, NO_RANGES, readRange };
export type {
  embeddedContainer,
  embeddedTrackSummary,
  subtitleBlock,
  subtitleCodec,
};
