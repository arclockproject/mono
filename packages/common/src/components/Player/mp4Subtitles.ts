//#region Imports

import {
  BROKEN,
  decoder,
  type embeddedContainer,
  type embeddedTrackSummary,
  loadBlocks,
  readRange,
  type subtitleBlock,
} from "./embeddedShared";

//#endregion

//#region mp4Subtitles.ts

/** Largest `moov` box read. It holds the index of every track. */
const MAX_MOOV_SIZE = 64 * 1024 * 1024;
/** Most top-level boxes walked to find `moov`. */
const MAX_TOP_LEVEL_BOXES = 64;
/** Largest single read of subtitle samples. */
const MAX_READ = 256 * 1024;
/** Largest single subtitle sample. */
const MAX_SAMPLE_SIZE = 1024 * 1024;

const FRAGMENTED =
  "Subtitles in fragmented MP4 files can't be read yet without downloading most of the file.";

type box = {
  type: string;
  start: number;
  dataStart: number;
  /** `Infinity` for a box that runs to the end of the file. */
  end: number;
};

/** `tx3g` (and QuickTime `text`) or WebVTT (`wvtt`) samples. */
type mp4Format = "tx3g" | "wvtt";

type mp4Sample = {
  offset: number;
  size: number;
  /** Seconds. */
  start: number;
  /** Seconds. */
  end: number;
};

type mp4Track = embeddedTrackSummary & {
  format: mp4Format;
  samples: mp4Sample[];
};

//#region Boxes

const u32 = (bytes: Uint8Array, at: number) =>
  ((bytes[at] ?? 0) * 0x1000000 +
    ((bytes[at + 1] ?? 0) << 16) +
    ((bytes[at + 2] ?? 0) << 8) +
    (bytes[at + 3] ?? 0)) >>>
  0;

const u64 = (bytes: Uint8Array, at: number) =>
  u32(bytes, at) * 0x100000000 + u32(bytes, at + 4);

const i32 = (bytes: Uint8Array, at: number) => u32(bytes, at) | 0;

const i64 = (bytes: Uint8Array, at: number) => {
  const high = i32(bytes, at);
  return high * 0x100000000 + u32(bytes, at + 4);
};

const u16 = (bytes: Uint8Array, at: number) =>
  ((bytes[at] ?? 0) << 8) + (bytes[at + 1] ?? 0);

const fourCC = (bytes: Uint8Array, at: number) =>
  String.fromCharCode(
    bytes[at] ?? 0,
    bytes[at + 1] ?? 0,
    bytes[at + 2] ?? 0,
    bytes[at + 3] ?? 0,
  );

/** Reads the box header at `at`, or `null` if it is cut off or invalid. */
const readBox = (bytes: Uint8Array, at: number): box | null => {
  if (at + 8 > bytes.length) return null;
  let size = u32(bytes, at);
  const type = fourCC(bytes, at + 4);
  let header = 8;
  if (size === 1) {
    if (at + 16 > bytes.length) return null;
    size = u64(bytes, at + 8);
    header = 16;
  }
  if (size !== 0 && size < header) return null;
  return {
    type,
    start: at,
    dataStart: at + header,
    end: size === 0 ? Number.POSITIVE_INFINITY : at + size,
  };
};

/** The child boxes between `start` and `end` that fit in `bytes`. */
function* boxes(bytes: Uint8Array, start: number, end: number): Generator<box> {
  const limit = Math.min(end, bytes.length);
  let at = start;
  while (at < limit) {
    const child = readBox(bytes, at);
    if (!child || child.end > limit) return;
    yield child;
    at = child.end;
  }
}

const child = (bytes: Uint8Array, parent: box, type: string) => {
  for (const item of boxes(bytes, parent.dataStart, parent.end))
    if (item.type === type) return item;
  return null;
};

/** Follows a path of box types, like `["mdia", "minf", "stbl"]`. */
const path = (bytes: Uint8Array, parent: box, types: string[]) => {
  let current: box | null = parent;
  for (const type of types) {
    if (!current) return null;
    current = child(bytes, current, type);
  }
  return current;
};

const TOP_LEVEL = new Set([
  "ftyp",
  "styp",
  "moov",
  "mdat",
  "free",
  "skip",
  "wide",
  "pnot",
  "uuid",
]);

/** Whether `head`, the start of a file, looks like MP4 / QuickTime. */
const isMp4 = (head: Uint8Array): boolean => {
  const first = readBox(head, 0);
  return !!first && TOP_LEVEL.has(first.type);
};

//#endregion

//#region Tracks

const SUBTITLE_HANDLERS = new Set(["text", "sbtl", "subt"]);
const FORMATS: { [type: string]: mp4Format } = {
  tx3g: "tx3g",
  text: "tx3g",
  wvtt: "wvtt",
};

const languageFromMdhd = (code: number) => {
  if (code === 0 || code === 0x7fff) return null;
  const tag = String.fromCharCode(
    ((code >> 10) & 31) + 0x60,
    ((code >> 5) & 31) + 0x60,
    (code & 31) + 0x60,
  );
  return /^[a-z]{3}$/.test(tag) && tag !== "und" ? tag : null;
};

/** The `hdlr` name, unless it is a generic one like "SubtitleHandler". */
const handlerName = (bytes: Uint8Array, hdlr: box) => {
  let name = bytes.subarray(hdlr.dataStart + 24, hdlr.end);
  if ((name[0] ?? 0) > 0 && (name[0] ?? 0) === name.length - 1)
    name = name.subarray(1);
  const raw = decoder.decode(name).replace(/\0+/g, "").trim();
  if (!raw || /handler|core media|^text$|^subtitle$/i.test(raw)) return null;
  return raw;
};

/** Seconds to add to every sample time, from the edit list. */
const editShift = (
  bytes: Uint8Array,
  trak: box,
  movieScale: number,
  mediaScale: number,
) => {
  const elst = path(bytes, trak, ["edts", "elst"]);
  if (!elst) return 0;
  const version = bytes[elst.dataStart] ?? 0;
  const count = u32(bytes, elst.dataStart + 4);
  const entrySize = version === 1 ? 20 : 12;
  let shift = 0;
  for (let index = 0; index < count; index++) {
    const at = elst.dataStart + 8 + index * entrySize;
    if (at + entrySize > elst.end) break;
    const duration = version === 1 ? u64(bytes, at) : u32(bytes, at);
    const mediaTime = version === 1 ? i64(bytes, at + 8) : i32(bytes, at + 4);
    if (mediaTime === -1) {
      shift += duration / movieScale;
      continue;
    }
    shift -= mediaTime / mediaScale;
    break;
  }
  return shift;
};

/** Every sample of the track, from its sample tables. */
const readSamples = (
  bytes: Uint8Array,
  stbl: box,
  timescale: number,
  shift: number,
): mp4Sample[] | null => {
  const stts = child(bytes, stbl, "stts");
  const stsc = child(bytes, stbl, "stsc");
  const stsz = child(bytes, stbl, "stsz") ?? child(bytes, stbl, "stz2");
  const stco = child(bytes, stbl, "stco") ?? child(bytes, stbl, "co64");
  if (!stts || !stsc || !stsz || !stco) return null;

  const sizes: number[] = [];
  if (stsz.type === "stsz") {
    const fixed = u32(bytes, stsz.dataStart + 4);
    const count = u32(bytes, stsz.dataStart + 8);
    for (let index = 0; index < count; index++)
      sizes.push(fixed || u32(bytes, stsz.dataStart + 12 + index * 4));
  } else {
    const field = bytes[stsz.dataStart + 7] ?? 0;
    const count = u32(bytes, stsz.dataStart + 8);
    for (let index = 0; index < count; index++) {
      const at = stsz.dataStart + 12;
      if (field === 4) {
        const byte = bytes[at + (index >> 1)] ?? 0;
        sizes.push(index % 2 === 0 ? byte >> 4 : byte & 15);
      } else if (field === 8) sizes.push(bytes[at + index] ?? 0);
      else sizes.push(u16(bytes, at + index * 2));
    }
  }

  const chunkCount = u32(bytes, stco.dataStart + 4);
  const chunkOffsets: number[] = [];
  for (let index = 0; index < chunkCount; index++)
    chunkOffsets.push(
      stco.type === "co64"
        ? u64(bytes, stco.dataStart + 8 + index * 8)
        : u32(bytes, stco.dataStart + 8 + index * 4),
    );

  const runs: { firstChunk: number; perChunk: number }[] = [];
  const runCount = u32(bytes, stsc.dataStart + 4);
  for (let index = 0; index < runCount; index++)
    runs.push({
      firstChunk: u32(bytes, stsc.dataStart + 8 + index * 12),
      perChunk: u32(bytes, stsc.dataStart + 12 + index * 12),
    });

  const durations: number[] = [];
  const timeCount = u32(bytes, stts.dataStart + 4);
  for (let index = 0; index < timeCount; index++) {
    const count = u32(bytes, stts.dataStart + 8 + index * 8);
    const delta = u32(bytes, stts.dataStart + 12 + index * 8);
    for (
      let repeat = 0;
      repeat < count && durations.length < sizes.length;
      repeat++
    )
      durations.push(delta);
  }

  const samples: mp4Sample[] = [];
  let sample = 0;
  let time = 0;
  for (let chunk = 0; chunk < chunkOffsets.length; chunk++) {
    let run = runs[0];
    for (const item of runs) if (item.firstChunk <= chunk + 1) run = item;
    let offset = chunkOffsets[chunk] ?? 0;
    for (let index = 0; index < (run?.perChunk ?? 0); index++) {
      if (sample >= sizes.length) break;
      const size = sizes[sample] ?? 0;
      const duration = durations[sample] ?? 0;
      samples.push({
        offset,
        size,
        start: time / timescale + shift,
        end: (time + duration) / timescale + shift,
      });
      offset += size;
      time += duration;
      sample++;
    }
  }
  return samples;
};

const readTracks = (bytes: Uint8Array, moov: box) => {
  const mvhd = child(bytes, moov, "mvhd");
  const movieScale = mvhd
    ? u32(
        bytes,
        mvhd.dataStart + ((bytes[mvhd.dataStart] ?? 0) === 1 ? 20 : 12),
      )
    : 1000;
  const fragmented = !!child(bytes, moov, "mvex");
  const tracks: mp4Track[] = [];
  for (const trak of boxes(bytes, moov.dataStart, moov.end)) {
    if (trak.type !== "trak") continue;
    const tkhd = child(bytes, trak, "tkhd");
    const mdhd = path(bytes, trak, ["mdia", "mdhd"]);
    const hdlr = path(bytes, trak, ["mdia", "hdlr"]);
    const stbl = path(bytes, trak, ["mdia", "minf", "stbl"]);
    if (!tkhd || !mdhd || !hdlr || !stbl) continue;
    if (!SUBTITLE_HANDLERS.has(fourCC(bytes, hdlr.dataStart + 8))) continue;
    const stsd = child(bytes, stbl, "stsd");
    const entry = stsd ? readBox(bytes, stsd.dataStart + 8) : null;
    const format = entry ? FORMATS[entry.type] : undefined;
    if (!format) continue;

    const tkhdVersion = bytes[tkhd.dataStart] ?? 0;
    const number = u32(bytes, tkhd.dataStart + (tkhdVersion === 1 ? 20 : 12));
    const mdhdVersion = bytes[mdhd.dataStart] ?? 0;
    const timescale =
      u32(bytes, mdhd.dataStart + (mdhdVersion === 1 ? 20 : 12)) || 1000;
    const languageCode = u16(
      bytes,
      mdhd.dataStart + (mdhdVersion === 1 ? 32 : 20),
    );
    const elng = path(bytes, trak, ["mdia", "elng"]);
    const extended = elng
      ? decoder
          .decode(bytes.subarray(elng.dataStart + 4, elng.end))
          .replace(/\0+$/, "")
      : "";
    const samples = fragmented
      ? []
      : (readSamples(
          bytes,
          stbl,
          timescale,
          editShift(bytes, trak, movieScale, timescale),
        ) ?? []);
    tracks.push({
      number,
      name: handlerName(bytes, hdlr),
      language:
        (extended && extended !== "und" ? extended : null) ??
        languageFromMdhd(languageCode),
      forced: false,
      format,
      samples,
    });
  }
  return { tracks, fragmented };
};

//#endregion

//#region Samples

/** `tx3g`: a 16-bit length, then UTF-8 or UTF-16 text, then style boxes. */
const readTx3g = (bytes: Uint8Array): string => {
  const length = u16(bytes, 0);
  const text = bytes.subarray(2, 2 + length);
  if (text[0] === 0xfe && text[1] === 0xff)
    return new TextDecoder("utf-16be").decode(text.subarray(2));
  return decoder.decode(text);
};

/** `wvtt`: `vttc` boxes with the cue text (`payl`) and settings (`sttg`). */
const readWvtt = (bytes: Uint8Array, sample: mp4Sample): subtitleBlock[] => {
  const blocks: subtitleBlock[] = [];
  for (const cue of boxes(bytes, 0, bytes.length)) {
    if (cue.type !== "vttc") continue;
    let text = "";
    let settings = "";
    for (const field of boxes(bytes, cue.dataStart, cue.end)) {
      const value = decoder.decode(bytes.subarray(field.dataStart, field.end));
      if (field.type === "payl") text = value;
      if (field.type === "sttg") settings = value;
    }
    if (text.trim())
      blocks.push({ start: sample.start, end: sample.end, text, settings });
  }
  return blocks;
};

/** Smallest sample with text: a `tx3g` length, or a `wvtt` `vtte` box. */
const EMPTY_SIZE: { [format in mp4Format]: number } = { tx3g: 2, wvtt: 8 };

type sampleRead = { offset: number; length: number; samples: mp4Sample[] };

/**
 * Groups samples that sit next to each other in the file into one read, and
 * leaves out empty ones, which only mark gaps between lines.
 */
const groupReads = (track: mp4Track): sampleRead[] => {
  const samples = track.samples
    .filter(
      (sample) =>
        sample.size > EMPTY_SIZE[track.format] &&
        sample.size <= MAX_SAMPLE_SIZE,
    )
    .sort((a, b) => a.offset - b.offset);
  const reads: sampleRead[] = [];
  for (const sample of samples) {
    const last = reads[reads.length - 1];
    if (
      last &&
      sample.offset === last.offset + last.length &&
      last.length + sample.size <= MAX_READ
    ) {
      last.length += sample.size;
      last.samples.push(sample);
    } else {
      reads.push({
        offset: sample.offset,
        length: sample.size,
        samples: [sample],
      });
    }
  }
  return reads;
};

//#endregion

/**
 * Reads the subtitle tracks of an MP4 / QuickTime file: walks the top-level
 * boxes with small reads until it finds `moov`, which holds every track's
 * index, and reads only that.
 *
 * @param head The first bytes of the file, already read.
 * @returns `null` if the file is not MP4.
 */
const readMp4Container = async (
  url: string,
  head: Uint8Array,
): Promise<embeddedContainer | null> => {
  if (!isMp4(head)) return null;
  let position = 0;
  let moov: { bytes: Uint8Array; box: box } | null = null;
  for (let index = 0; index < MAX_TOP_LEVEL_BOXES; index++) {
    const header =
      position + 16 <= head.length
        ? head.subarray(position)
        : (await readRange(url, position, 16)).bytes;
    const item = readBox(header, 0);
    if (!item) break;
    if (item.type === "moov") {
      const size = item.end - item.start;
      if (!Number.isFinite(size) || size > MAX_MOOV_SIZE)
        throw new Error(BROKEN);
      const bytes =
        position + size <= head.length
          ? head.subarray(position, position + size)
          : (await readRange(url, position, size)).bytes;
      const moovBox = readBox(bytes, 0);
      if (!moovBox || moovBox.end > bytes.length) throw new Error(BROKEN);
      moov = { bytes, box: moovBox };
      break;
    }
    if (!Number.isFinite(item.end)) break;
    position += item.end - item.start;
  }
  if (!moov) return null;
  const { tracks, fragmented } = readTracks(moov.bytes, moov.box);
  return {
    tracks,
    load: async (number, onProgress) => {
      const track = tracks.find((item) => item.number === number);
      if (!track)
        throw new Error(`The video has no text subtitle track ${number}.`);
      if (fragmented) throw new Error(FRAGMENTED);
      const reads = groupReads(track);
      if (reads.length === 0) throw new Error("This subtitle track is empty.");
      return loadBlocks(
        reads,
        async (read) => {
          const { bytes } = await readRange(url, read.offset, read.length);
          const blocks: subtitleBlock[] = [];
          for (const sample of read.samples) {
            const data = bytes.subarray(
              sample.offset - read.offset,
              sample.offset - read.offset + sample.size,
            );
            if (data.length < sample.size) continue;
            if (track.format === "wvtt") blocks.push(...readWvtt(data, sample));
            else {
              const text = readTx3g(data);
              if (text.trim())
                blocks.push({ start: sample.start, end: sample.end, text });
            }
          }
          return blocks;
        },
        track.format === "wvtt" ? "vtt" : "srt",
        "",
        onProgress,
      );
    },
  };
};

//#endregion

export { isMp4, readMp4Container };
