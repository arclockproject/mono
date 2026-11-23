//#region Imports

import { useEffect, useState } from "react";
import {
  BROKEN,
  decoder,
  type embeddedContainer,
  loadBlocks,
  NO_INDEX,
  NO_RANGES,
  readRange,
  type subtitleBlock,
  type subtitleCodec,
} from "./embeddedShared";
import type { subtitleFile } from "./globals";
import { readMp4Container } from "./mp4Subtitles";
import type { subtitleTrack } from "./subtitles";

//#endregion

//#region embeddedSubtitles.ts

const ID = {
  EBML: 0x1a45dfa3,
  DocType: 0x4282,
  Segment: 0x18538067,
  SeekHead: 0x114d9b74,
  Seek: 0x4dbb,
  SeekID: 0x53ab,
  SeekPosition: 0x53ac,
  Info: 0x1549a966,
  TimestampScale: 0x2ad7b1,
  Tracks: 0x1654ae6b,
  TrackEntry: 0xae,
  TrackNumber: 0xd7,
  TrackType: 0x83,
  CodecID: 0x86,
  CodecPrivate: 0x63a2,
  Language: 0x22b59c,
  LanguageBCP47: 0x22b59d,
  Name: 0x536e,
  FlagForced: 0x55aa,
  ContentEncodings: 0x6d80,
  ContentEncoding: 0x6240,
  ContentEncodingScope: 0x5032,
  ContentEncodingType: 0x5033,
  ContentCompression: 0x5034,
  ContentCompAlgo: 0x4254,
  ContentCompSettings: 0x4255,
  Cues: 0x1c53bb6b,
  CuePoint: 0xbb,
  CueTime: 0xb3,
  CueTrackPositions: 0xb7,
  CueTrack: 0xf7,
  CueClusterPosition: 0xf1,
  CueRelativePosition: 0xf0,
  CueDuration: 0xb2,
  Cluster: 0x1f43b675,
  BlockGroup: 0xa0,
  Block: 0xa1,
  BlockDuration: 0x9b,
  SimpleBlock: 0xa3,
} as const;

/** Bytes read first: the file header, and often the track list too. */
const HEAD_SIZE = 64 * 1024;
/** Bytes read first for one element, before its full size is known. */
const ELEMENT_PROBE = 4096;
/** Largest track list or index read. Anything bigger is treated as broken. */
const MAX_INDEX_SIZE = 16 * 1024 * 1024;
/** Bytes read first for one subtitle block. Most fit, bigger ones take a second read. */
const BLOCK_PROBE = 1024;
/** Largest single subtitle block read. */
const MAX_BLOCK_SIZE = 1024 * 1024;

type ebmlElement = {
  id: number;
  dataStart: number;
  /** `Infinity` for an element of unknown size. */
  dataEnd: number;
};

type contentEncoding =
  | { kind: "none" }
  | { kind: "zlib"; scope: number }
  | { kind: "strip"; scope: number; prefix: Uint8Array };

/** A text subtitle track inside a Matroska file. */
type embeddedTrack = {
  number: number;
  codec: subtitleCodec;
  /** Track name from the file, or `null`. */
  name: string | null;
  /** BCP 47 language tag, or `null` if not set or undetermined. */
  language: string | null;
  forced: boolean;
  codecPrivate: Uint8Array | null;
  encoding: contentEncoding;
};

type cuePosition = {
  time: number;
  track: number;
  cluster: number;
  relative: number | null;
  duration: number | null;
};

type matroskaInfo = {
  url: string;
  segmentStart: number;
  /** Nanoseconds per timestamp tick. */
  timestampScale: number;
  cuesPosition: number | null;
  tracks: embeddedTrack[];
  cues?: Promise<cuePosition[]>;
};

const CODECS: { [codecId: string]: subtitleCodec } = {
  "S_TEXT/UTF8": "srt",
  "S_TEXT/ASCII": "srt",
  "S_TEXT/ASS": "ass",
  "S_TEXT/SSA": "ass",
  S_ASS: "ass",
  S_SSA: "ass",
  "S_TEXT/WEBVTT": "vtt",
  "D_WEBVTT/SUBTITLES": "vtt",
  "D_WEBVTT/CAPTIONS": "vtt",
  "D_WEBVTT/DESCRIPTIONS": "vtt",
};

//#region EBML

const readVint = (bytes: Uint8Array, at: number, keepMarker: boolean) => {
  const first = bytes[at];
  if (first === undefined || first === 0) return null;
  let length = 1;
  let mask = 0x80;
  while (!(first & mask)) {
    length++;
    mask >>= 1;
  }
  if (at + length > bytes.length) return null;
  let value = keepMarker ? first : first & (mask - 1);
  let allOnes = value === mask - 1;
  for (let index = 1; index < length; index++) {
    const byte = bytes[at + index] ?? 0;
    value = value * 256 + byte;
    if (byte !== 0xff) allOnes = false;
  }
  return { value, length, unknown: !keepMarker && allOnes };
};

/** Reads the element header at `at`, or `null` if it is cut off or invalid. */
const readElement = (bytes: Uint8Array, at: number): ebmlElement | null => {
  const id = readVint(bytes, at, true);
  if (!id || id.length > 4) return null;
  const size = readVint(bytes, at + id.length, false);
  if (!size) return null;
  const dataStart = at + id.length + size.length;
  return {
    id: id.value,
    dataStart,
    dataEnd: size.unknown ? Number.POSITIVE_INFINITY : dataStart + size.value,
  };
};

/** The child elements between `start` and `end` that fit in `bytes`. */
function* children(
  bytes: Uint8Array,
  start: number,
  end: number,
): Generator<ebmlElement> {
  const limit = Math.min(end, bytes.length);
  let at = start;
  while (at < limit) {
    const element = readElement(bytes, at);
    if (!element) return;
    yield element;
    if (element.dataEnd === Number.POSITIVE_INFINITY) return;
    at = element.dataEnd;
  }
}

const complete = (bytes: Uint8Array, element: ebmlElement) =>
  element.dataEnd <= bytes.length;

const readData = (bytes: Uint8Array, element: ebmlElement) =>
  bytes.subarray(element.dataStart, Math.min(element.dataEnd, bytes.length));

const readUint = (bytes: Uint8Array, element: ebmlElement) => {
  let value = 0;
  for (const byte of readData(bytes, element)) value = value * 256 + byte;
  return value;
};

const readText = (bytes: Uint8Array, element: ebmlElement) =>
  decoder.decode(readData(bytes, element)).replace(/\0+$/, "");

/**
 * Reads the whole element at `position` of the file, in one request when it
 * is small.
 */
const loadElement = async (
  url: string,
  position: number,
  id: number,
  maxSize: number,
): Promise<{ bytes: Uint8Array; element: ebmlElement }> => {
  const first = (await readRange(url, position, ELEMENT_PROBE)).bytes;
  const element = readElement(first, 0);
  if (!element || element.id !== id || element.dataEnd > maxSize)
    throw new Error(BROKEN);
  if (complete(first, element)) return { bytes: first, element };
  const bytes = (await readRange(url, position, element.dataEnd)).bytes;
  if (!complete(bytes, element)) throw new Error(BROKEN);
  return { bytes, element };
};

//#endregion

//#region Header and tracks

const readSeekHead = (
  bytes: Uint8Array,
  element: ebmlElement,
  segmentStart: number,
  into: Map<number, number>,
) => {
  for (const seek of children(bytes, element.dataStart, element.dataEnd)) {
    if (seek.id !== ID.Seek) continue;
    let id: number | null = null;
    let position: number | null = null;
    for (const field of children(bytes, seek.dataStart, seek.dataEnd)) {
      if (field.id === ID.SeekID) id = readUint(bytes, field);
      if (field.id === ID.SeekPosition) position = readUint(bytes, field);
    }
    if (id !== null && position !== null && !into.has(id))
      into.set(id, segmentStart + position);
  }
};

const readEncoding = (
  bytes: Uint8Array,
  element: ebmlElement,
): contentEncoding | null => {
  const encodings = [
    ...children(bytes, element.dataStart, element.dataEnd),
  ].filter((child) => child.id === ID.ContentEncoding);
  if (encodings.length === 0) return { kind: "none" };
  if (encodings.length > 1) return null;
  const encoding = encodings[0] as ebmlElement;
  let scope = 1;
  let type = 0;
  let algorithm = 0;
  let settings: Uint8Array = new Uint8Array(0);
  for (const field of children(bytes, encoding.dataStart, encoding.dataEnd)) {
    if (field.id === ID.ContentEncodingScope) scope = readUint(bytes, field);
    if (field.id === ID.ContentEncodingType) type = readUint(bytes, field);
    if (field.id === ID.ContentCompression) {
      for (const option of children(bytes, field.dataStart, field.dataEnd)) {
        if (option.id === ID.ContentCompAlgo)
          algorithm = readUint(bytes, option);
        if (option.id === ID.ContentCompSettings)
          settings = readData(bytes, option).slice();
      }
    }
  }
  if (type !== 0) return null;
  if (algorithm === 0) return { kind: "zlib", scope };
  if (algorithm === 3) return { kind: "strip", scope, prefix: settings };
  return null;
};

const readTracks = (
  bytes: Uint8Array,
  element: ebmlElement,
): embeddedTrack[] => {
  const tracks: embeddedTrack[] = [];
  for (const entry of children(bytes, element.dataStart, element.dataEnd)) {
    if (entry.id !== ID.TrackEntry) continue;
    let number = 0;
    let type = 0;
    let codec: subtitleCodec | undefined;
    let name: string | null = null;
    let language = "eng";
    let bcp47: string | null = null;
    let forced = false;
    let codecPrivate: Uint8Array | null = null;
    let encoding: contentEncoding | null = { kind: "none" };
    for (const field of children(bytes, entry.dataStart, entry.dataEnd)) {
      if (field.id === ID.TrackNumber) number = readUint(bytes, field);
      else if (field.id === ID.TrackType) type = readUint(bytes, field);
      else if (field.id === ID.CodecID) codec = CODECS[readText(bytes, field)];
      else if (field.id === ID.Name) name = readText(bytes, field) || null;
      else if (field.id === ID.Language) language = readText(bytes, field);
      else if (field.id === ID.LanguageBCP47) bcp47 = readText(bytes, field);
      else if (field.id === ID.FlagForced)
        forced = readUint(bytes, field) === 1;
      else if (field.id === ID.CodecPrivate)
        codecPrivate = readData(bytes, field).slice();
      else if (field.id === ID.ContentEncodings)
        encoding = readEncoding(bytes, field);
    }
    if (type !== 17 || !codec || !encoding || number === 0) continue;
    const tag = bcp47 || language;
    tracks.push({
      number,
      codec,
      name,
      language: tag && tag !== "und" ? tag : null,
      forced,
      codecPrivate,
      encoding,
    });
  }
  return tracks;
};

/**
 * Reads the header of a Matroska (`.mkv`, `.webm`) file: its text subtitle
 * tracks and where its index is. Reads only the start of the file, plus the
 * track list if it isn't there.
 *
 * @param head The first `HEAD_SIZE` bytes of the file, already read.
 * @returns `null` if the file is not Matroska.
 */
const readMatroskaInfo = async (
  url: string,
  head: Uint8Array,
): Promise<matroskaInfo | null> => {
  const header = readElement(head, 0);
  if (!header || header.id !== ID.EBML || !complete(head, header)) return null;
  let docType = "matroska";
  for (const field of children(head, header.dataStart, header.dataEnd))
    if (field.id === ID.DocType) docType = readText(head, field);
  if (docType !== "matroska" && docType !== "webm") return null;
  const segment = readElement(head, header.dataEnd);
  if (!segment || segment.id !== ID.Segment) return null;
  const segmentStart = segment.dataStart;

  const positions = new Map<number, number>();
  const seekHeads: number[] = [];
  let timestampScale = 1_000_000;
  let tracks: embeddedTrack[] | null = null;
  for (const element of children(head, segmentStart, segment.dataEnd)) {
    if (element.id === ID.Cluster) break;
    if (!complete(head, element)) continue;
    if (element.id === ID.SeekHead) {
      seekHeads.push(element.dataStart);
      readSeekHead(head, element, segmentStart, positions);
    } else if (element.id === ID.Info) {
      for (const field of children(head, element.dataStart, element.dataEnd))
        if (field.id === ID.TimestampScale)
          timestampScale = readUint(head, field);
    } else if (element.id === ID.Tracks) {
      tracks = readTracks(head, element);
    }
  }

  const nextSeekHead = positions.get(ID.SeekHead);
  if (nextSeekHead !== undefined && nextSeekHead >= HEAD_SIZE) {
    const more = await loadElement(
      url,
      nextSeekHead,
      ID.SeekHead,
      MAX_INDEX_SIZE,
    );
    readSeekHead(more.bytes, more.element, segmentStart, positions);
  }
  const infoPosition = positions.get(ID.Info);
  if (infoPosition !== undefined && infoPosition >= HEAD_SIZE) {
    const info = await loadElement(url, infoPosition, ID.Info, MAX_INDEX_SIZE);
    for (const field of children(
      info.bytes,
      info.element.dataStart,
      info.element.dataEnd,
    ))
      if (field.id === ID.TimestampScale)
        timestampScale = readUint(info.bytes, field);
  }
  if (!tracks) {
    const tracksPosition = positions.get(ID.Tracks);
    if (tracksPosition === undefined) return null;
    const list = await loadElement(
      url,
      tracksPosition,
      ID.Tracks,
      MAX_INDEX_SIZE,
    );
    tracks = readTracks(list.bytes, list.element);
  }
  return {
    url,
    segmentStart,
    timestampScale,
    cuesPosition: positions.get(ID.Cues) ?? null,
    tracks,
  };
};

//#endregion

//#region Index and blocks

const readCues = async (info: matroskaInfo): Promise<cuePosition[]> => {
  if (info.cuesPosition === null) throw new Error(NO_INDEX);
  const { bytes, element } = await loadElement(
    info.url,
    info.cuesPosition,
    ID.Cues,
    MAX_INDEX_SIZE,
  );
  const cues: cuePosition[] = [];
  for (const point of children(bytes, element.dataStart, element.dataEnd)) {
    if (point.id !== ID.CuePoint) continue;
    let time = 0;
    const positions: Omit<cuePosition, "time">[] = [];
    for (const field of children(bytes, point.dataStart, point.dataEnd)) {
      if (field.id === ID.CueTime) time = readUint(bytes, field);
      if (field.id !== ID.CueTrackPositions) continue;
      const position: Omit<cuePosition, "time"> = {
        track: 0,
        cluster: 0,
        relative: null,
        duration: null,
      };
      for (const value of children(bytes, field.dataStart, field.dataEnd)) {
        if (value.id === ID.CueTrack) position.track = readUint(bytes, value);
        if (value.id === ID.CueClusterPosition)
          position.cluster = readUint(bytes, value);
        if (value.id === ID.CueRelativePosition)
          position.relative = readUint(bytes, value);
        if (value.id === ID.CueDuration)
          position.duration = readUint(bytes, value);
      }
      positions.push(position);
    }
    for (const position of positions) cues.push({ time, ...position });
  }
  return cues;
};

const getCues = (info: matroskaInfo) => {
  if (!info.cues) {
    info.cues = readCues(info);
    info.cues.catch(() => {
      info.cues = undefined;
    });
  }
  return info.cues;
};

const inflate = async (data: Uint8Array): Promise<Uint8Array> =>
  new Uint8Array(
    await new Response(
      new Blob([data.slice()])
        .stream()
        .pipeThrough(new DecompressionStream("deflate")),
    ).arrayBuffer(),
  );

const decode = async (
  data: Uint8Array,
  encoding: contentEncoding,
  scope: 1 | 2,
): Promise<Uint8Array> => {
  if (encoding.kind === "none" || !(encoding.scope & scope)) return data;
  if (encoding.kind === "zlib") return inflate(data);
  const out = new Uint8Array(encoding.prefix.length + data.length);
  out.set(encoding.prefix);
  out.set(data, encoding.prefix.length);
  return out;
};

/** Smallest and largest size of a cluster's header (ID and size). */
const CLUSTER_HEADER_MIN = 5;
const CLUSTER_HEADER_MAX = 12;

/**
 * Finds the block of `track` at `at`: a block group or simple block whose
 * block belongs to the track and isn't laced.
 */
const findBlock = (bytes: Uint8Array, at: number, track: number) => {
  const outer = readElement(bytes, at);
  if (
    !outer ||
    (outer.id !== ID.BlockGroup && outer.id !== ID.SimpleBlock) ||
    outer.dataEnd - at > MAX_BLOCK_SIZE
  )
    return null;
  if (!complete(bytes, outer)) return { outer, block: null, duration: null };
  let block: ebmlElement | null = outer.id === ID.SimpleBlock ? outer : null;
  let duration: number | null = null;
  if (outer.id === ID.BlockGroup) {
    for (const field of children(bytes, outer.dataStart, outer.dataEnd)) {
      if (field.id === ID.Block) block = field;
      if (field.id === ID.BlockDuration) duration = readUint(bytes, field);
    }
  }
  if (!block || !complete(bytes, block)) return null;
  const trackNumber = readVint(bytes, block.dataStart, false);
  if (!trackNumber || trackNumber.value !== track) return null;
  const flags = bytes[block.dataStart + trackNumber.length + 2];
  if (flags === undefined || flags & 0x06) return null;
  return {
    outer,
    block: {
      payloadStart: block.dataStart + trackNumber.length + 3,
      dataEnd: block.dataEnd,
    },
    duration,
  };
};

/**
 * Reads the subtitle block that `cue` points to. The index gives its place
 * from the start of the cluster's data, and the cluster header is 5 to 12
 * bytes, so one read from just after the shortest header covers every case.
 */
const readBlock = async (
  info: matroskaInfo,
  track: embeddedTrack,
  cue: cuePosition,
): Promise<subtitleBlock[]> => {
  if (cue.relative === null) return [];
  const base =
    info.segmentStart + cue.cluster + cue.relative + CLUSTER_HEADER_MIN;
  const slack = CLUSTER_HEADER_MAX - CLUSTER_HEADER_MIN;
  let bytes = (await readRange(info.url, base, BLOCK_PROBE + slack)).bytes;
  let found: ReturnType<typeof findBlock> = null;
  let offset = 0;
  for (const candidate of [
    slack,
    ...Array.from({ length: slack }, (_, i) => i),
  ]) {
    found = findBlock(bytes, candidate, track.number);
    if (found) {
      offset = candidate;
      break;
    }
  }
  if (!found) return [];
  if (!found.block) {
    bytes = (await readRange(info.url, base, found.outer.dataEnd)).bytes;
    found = findBlock(bytes, offset, track.number);
    if (!found?.block) return [];
  }
  const duration = found.duration ?? cue.duration;
  const payload = bytes.subarray(found.block.payloadStart, found.block.dataEnd);
  const text = decoder.decode(await decode(payload, track.encoding, 1));
  const scale = info.timestampScale / 1e9;
  const start = cue.time * scale;
  return [{ start, end: duration ? start + duration * scale : null, text }];
};

//#endregion

//#region Public helpers

/**
 * Loads text subtitle track `number` of a Matroska file. Only the file's
 * index and the subtitle blocks are fetched, never the video.
 *
 * Needs an index (`Cues`) that lists the subtitle blocks, which `mkvmerge`
 * and `ffmpeg` write.
 */
const loadMatroskaTrack = async (
  info: matroskaInfo,
  number: number,
  onProgress?: (track: subtitleTrack) => void,
): Promise<subtitleTrack> => {
  const track = info.tracks.find((item) => item.number === number);
  if (!track)
    throw new Error(`The video has no text subtitle track ${number}.`);
  const codecPrivate = track.codecPrivate
    ? decoder.decode(await decode(track.codecPrivate, track.encoding, 2))
    : "";
  const seen = new Set<number>();
  const cues = (await getCues(info))
    .filter((cue) => cue.track === number && cue.relative !== null)
    .filter((cue) => {
      const key = cue.cluster + (cue.relative ?? 0);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.time - b.time);
  if (cues.length === 0) throw new Error(NO_INDEX);
  return loadBlocks(
    cues,
    (cue) => readBlock(info, track, cue),
    track.codec,
    codecPrivate,
    onProgress,
  );
};

//#endregion

//#region Containers

/**
 * Reads the start of the video and the track list of a Matroska or MP4 file.
 *
 * @returns `null` for other files, or if the server doesn't answer range
 * requests.
 */
const readContainer = async (
  url: string,
): Promise<embeddedContainer | null> => {
  const { bytes: head, ranged } = await readRange(url, 0, HEAD_SIZE);
  if (!ranged) return null;
  const matroska = await readMatroskaInfo(url, head);
  if (matroska)
    return {
      tracks: matroska.tracks,
      load: (number, onProgress) =>
        loadMatroskaTrack(matroska, number, onProgress),
    };
  return readMp4Container(url, head);
};

const containerCache = new Map<string, Promise<embeddedContainer | null>>();

const getContainer = (url: string) => {
  let request = containerCache.get(url);
  if (!request) {
    request = readContainer(url);
    containerCache.set(url, request);
    request.catch(() => containerCache.delete(url));
  }
  return request;
};

//#endregion

/**
 * Loads text subtitle track `number` of the `.mkv`/`.webm` or `.mp4`/`.mov`
 * file at `url`. Only the file's index and the subtitle lines are fetched,
 * with range requests, never the video. `onProgress` gets the lines loaded so
 * far while it loads.
 */
const loadEmbeddedTrack = async (
  url: string,
  number: number,
  onProgress?: (track: subtitleTrack) => void,
): Promise<subtitleTrack> => {
  const container = await getContainer(url);
  if (!container) throw new Error(NO_RANGES);
  return container.load(number, onProgress);
};

const VIDEO_PATH = /\.(mkv|mka|mks|mk3d|webm|mp4|m4v|mov)$/i;

const looksLikeContainer = (url: string) => {
  try {
    return VIDEO_PATH.test(new URL(url, window.location.href).pathname);
  } catch {
    return false;
  }
};

const languageName = (tag: string) => {
  try {
    const name = new Intl.DisplayNames(undefined, { type: "language" }).of(
      Intl.getCanonicalLocales(tag)[0] ?? tag,
    );
    return name && name !== tag ? name : tag;
  } catch {
    return tag;
  }
};

const NO_FILES: subtitleFile[] = [];

/**
 * Lists the text subtitle tracks inside the video at `url`, as subtitle files
 * with `track` set. Only URLs ending in `.mkv`, `.mka`, `.mks`, `.mk3d`,
 * `.webm`, `.mp4`, `.m4v` or `.mov` are read, and only the start of the file
 * and its track list are fetched.
 *
 * @returns The tracks, or an empty list while loading, when off, for other
 * files, or on error.
 */
function useEmbeddedSubtitleFiles(
  url: string | null | undefined,
  enabled: boolean,
): subtitleFile[] {
  const [state, setState] = useState<{
    url: string | null;
    files: subtitleFile[];
  }>({ url: null, files: NO_FILES });
  useEffect(() => {
    if (!url || !enabled || !looksLikeContainer(url)) return;
    let cancelled = false;
    getContainer(url).then(
      (info) => {
        if (cancelled) return;
        const used = new Set<string>();
        const files = (info?.tracks ?? []).map((track) => {
          let label =
            track.name ??
            (track.language ? languageName(track.language) : "Subtitles");
          if (track.forced && !/forced/i.test(label)) label += " (forced)";
          if (used.has(label)) label += ` (${track.number})`;
          used.add(label);
          return { label, url, track: track.number };
        });
        setState({ url, files: files.length ? files : NO_FILES });
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [url, enabled]);
  return enabled && state.url === url ? state.files : NO_FILES;
}

/**
 * The entry's subtitle files followed by the video's own tracks. Tracks the
 * entry already lists are left out, and a track whose name is taken gets
 * ` (in video)` added.
 */
const withEmbeddedSubtitles = (
  files: subtitleFile[],
  embedded: subtitleFile[],
): subtitleFile[] => {
  if (embedded.length === 0) return files;
  const labels = new Set(files.map((file) => file.label));
  const listed = new Set(
    files
      .filter((file) => file.track !== undefined)
      .map((file) => `${file.track}:${file.url}`),
  );
  const extra = embedded
    .filter((file) => !listed.has(`${file.track}:${file.url}`))
    .map((file) =>
      labels.has(file.label)
        ? { ...file, label: `${file.label} (in video)` }
        : file,
    );
  return extra.length ? [...files, ...extra] : files;
};

//#endregion

//#endregion

export { loadEmbeddedTrack, useEmbeddedSubtitleFiles, withEmbeddedSubtitles };
