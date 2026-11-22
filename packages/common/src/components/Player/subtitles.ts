//#region subtitles.ts

/**
 * Text style of one run of subtitle text. `null` means "not set by the file",
 * so the player's subtitle settings decide.
 */
type subtitleSpanStyle = {
  /** Font family name. */
  fontName: string | null;
  /** Font size, in script pixels (`.ass`), or `null`. */
  fontSize: number | null;
  /** Text colour, as a CSS colour. */
  color: string | null;
  /** Outline colour, as a CSS colour. Also the box colour for boxed text. */
  outlineColor: string | null;
  /** Shadow colour, as a CSS colour. */
  shadowColor: string | null;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  /** Outline width, in script pixels. */
  outline: number | null;
  /** Shadow offset, in script pixels. */
  shadow: number | null;
};

/** A run of text with one style. */
type subtitleSpan = {
  text: string;
  style: subtitleSpanStyle;
};

/**
 * Where a cue is placed.
 *
 * - `"script"`: `x`/`y` are in script pixels (`.ass` `\pos`).
 * - `"percent"`: `x`/`y` are percentages of the video (`.vtt` cue settings).
 */
type subtitlePosition = {
  x: number;
  y: number;
  unit: "script" | "percent";
};

/** One subtitle line or block, shown from `start` to `end`. */
type subtitleCue = {
  /** Seconds. */
  start: number;
  /** Seconds. */
  end: number;
  /** Higher layers are drawn on top. */
  layer: number;
  /** Numpad layout: `1` bottom left, `5` middle, `9` top right. */
  alignment: number;
  /** Margins in script pixels, or `null` for the player's defaults. */
  marginL: number | null;
  marginR: number | null;
  marginV: number | null;
  /** Fixed position, or `null` to stack with other cues at `alignment`. */
  position: subtitlePosition | null;
  /** Draw a box behind the text in `outlineColor` (`.ass` `BorderStyle=3`). */
  boxed: boolean;
  /** Lines of text, each a list of styled runs. */
  lines: subtitleSpan[][];
};

/** A parsed subtitle file. */
type subtitleTrack = {
  kind: "ass" | "vtt" | "srt";
  /** `.ass` `PlayResX`/`PlayResY`, the size the positions are written for. */
  width: number | null;
  height: number | null;
  /** Sorted by `start`. */
  cues: subtitleCue[];
};

const PLAIN_STYLE: subtitleSpanStyle = {
  fontName: null,
  fontSize: null,
  color: null,
  outlineColor: null,
  shadowColor: null,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  outline: null,
  shadow: null,
};

const decodeEntities = (text: string) =>
  text
    .replace(/&nbsp;/g, " ")
    .replace(/&lrm;/g, "‎")
    .replace(/&rlm;/g, "‏")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_match, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&amp;/g, "&");

/** `01:02:03.456`, `02:03.456`, `01:02:03,456` or `1:02:03.45`. */
const parseTimestamp = (value: string): number | null => {
  const match = /^\s*(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d+))?\s*$/.exec(
    value,
  );
  if (!match) return null;
  const fraction = match[4] ? Number(`0.${match[4]}`) : 0;
  return (
    Number(match[1] ?? 0) * 3600 +
    Number(match[2]) * 60 +
    Number(match[3]) +
    fraction
  );
};

const isCssColor = (value: string) =>
  /^#?[0-9a-f]{3,8}$/i.test(value) || /^[a-z]+$/i.test(value);

//#region Plain markup (.vtt, .srt)

/**
 * Turns `.vtt`/`.srt` text with `<b>`, `<i>`, `<u>`, `<s>`, `<font color>`
 * and `<c.colour>` tags into lines of styled runs. Other tags are dropped.
 */
const parsePlainMarkup = (text: string): subtitleSpan[][] => {
  const lines: subtitleSpan[][] = [];
  const stack: subtitleSpanStyle[] = [PLAIN_STYLE];
  const names: string[] = [""];
  for (const rawLine of text.split("\n")) {
    const line: subtitleSpan[] = [];
    for (const part of rawLine.split(/(<[^>]*>)/)) {
      if (part === "") continue;
      const tag = /^<\s*(\/)?\s*([a-z0-9]+)([^>]*)>$/i.exec(part);
      if (!tag) {
        if (/^<\d/.test(part)) continue;
        line.push({
          text: decodeEntities(part),
          style: stack[stack.length - 1]!,
        });
        continue;
      }
      const closing = !!tag[1];
      const name = tag[2]!.toLowerCase();
      if (closing) {
        const open = names.lastIndexOf(name);
        if (open > 0) {
          stack.length = open;
          names.length = open;
        }
        continue;
      }
      const current = stack[stack.length - 1]!;
      const next = { ...current };
      if (name === "b") next.bold = true;
      else if (name === "i") next.italic = true;
      else if (name === "u") next.underline = true;
      else if (name === "s") next.strike = true;
      else if (name === "font") {
        const color = /color\s*=\s*["']?([^"'\s>]+)/i.exec(tag[3] ?? "")?.[1];
        if (color && isCssColor(color))
          next.color = /^[0-9a-f]{3,8}$/i.test(color) ? `#${color}` : color;
      } else if (name === "c") {
        const color = (tag[3] ?? "")
          .split(".")
          .map((name) => name.trim())
          .find((name) => VTT_COLORS[name]);
        if (color) next.color = VTT_COLORS[color]!;
      } else if (!["v", "lang", "ruby", "rt"].includes(name)) continue;
      stack.push(next);
      names.push(name);
    }
    lines.push(line);
  }
  return lines;
};

const VTT_COLORS: { [name: string]: string } = {
  white: "#ffffff",
  lime: "#00ff00",
  cyan: "#00ffff",
  red: "#ff0000",
  yellow: "#ffff00",
  magenta: "#ff00ff",
  blue: "#0000ff",
  black: "#000000",
};

/** Reads a leading `{\anN}` tag, which many `.srt` files use, and strips other `{\…}` blocks. */
const stripSrtOverrides = (text: string) => {
  let alignment = 2;
  const stripped = text.replace(/\{\\[^}]*\}/g, (block) => {
    const an = /\\an([1-9])/.exec(block);
    if (an) alignment = Number(an[1]);
    return "";
  });
  return { text: stripped, alignment };
};

const plainCue = (
  start: number,
  end: number,
  text: string,
  alignment = 2,
  position: subtitlePosition | null = null,
): subtitleCue => ({
  start,
  end,
  layer: 0,
  alignment,
  marginL: null,
  marginR: null,
  marginV: null,
  position,
  boxed: false,
  lines: parsePlainMarkup(text.replace(/\n+$/, "")),
});

const parseVtt = (source: string): subtitleTrack => {
  const cues: subtitleCue[] = [];
  const blocks = source.split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n");
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex === -1) continue;
    const [startText, rest] = lines[timingIndex]!.split("-->");
    const [endText, ...settingParts] = (rest ?? "").trim().split(/\s+/);
    const start = parseTimestamp(startText ?? "");
    const end = parseTimestamp(endText ?? "");
    if (start === null || end === null) continue;
    const settings: { [key: string]: string } = {};
    for (const setting of settingParts) {
      const [key, value] = setting.split(":");
      if (key && value) settings[key] = value;
    }
    const lineSetting = /^(-?\d+(?:\.\d+)?)%/.exec(settings.line ?? "");
    const positionSetting = /^(\d+(?:\.\d+)?)%/.exec(settings.position ?? "");
    const align = settings.align;
    const column =
      align === "start" || align === "left"
        ? 0
        : align === "end" || align === "right"
          ? 2
          : 1;
    const text = lines.slice(timingIndex + 1).join("\n");
    if (lineSetting) {
      const y = Number(lineSetting[1]);
      const row = y >= 50 ? 0 : 2;
      cues.push(
        plainCue(start, end, text, row * 3 + column + 1, {
          x: positionSetting
            ? Number(positionSetting[1])
            : [0, 50, 100][column]!,
          y,
          unit: "percent",
        }),
      );
    } else {
      cues.push(plainCue(start, end, text, column + 1));
    }
  }
  return { kind: "vtt", width: null, height: null, cues: sortCues(cues) };
};

const parseSrt = (source: string): subtitleTrack => {
  const cues: subtitleCue[] = [];
  for (const block of source.split(/\n{2,}/)) {
    const lines = block.split("\n");
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex === -1) continue;
    const [startText, endText] = lines[timingIndex]!.split("-->");
    const start = parseTimestamp(startText ?? "");
    const end = parseTimestamp((endText ?? "").trim().split(/\s+/)[0] ?? "");
    if (start === null || end === null) continue;
    const { text, alignment } = stripSrtOverrides(
      lines.slice(timingIndex + 1).join("\n"),
    );
    cues.push(plainCue(start, end, text, alignment));
  }
  return { kind: "srt", width: null, height: null, cues: sortCues(cues) };
};

//#endregion

//#region Advanced SubStation Alpha (.ass, .ssa)

type assStyle = {
  span: subtitleSpanStyle;
  alignment: number;
  marginL: number;
  marginR: number;
  marginV: number;
  boxed: boolean;
};

const DEFAULT_ASS_STYLE: assStyle = {
  span: {
    fontName: "Arial",
    fontSize: 20,
    color: "rgba(255, 255, 255, 1)",
    outlineColor: "rgba(0, 0, 0, 1)",
    shadowColor: "rgba(0, 0, 0, 1)",
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    outline: 2,
    shadow: 2,
  },
  alignment: 2,
  marginL: 10,
  marginR: 10,
  marginV: 10,
  boxed: false,
};

/** `&HAABBGGRR`, `&HBBGGRR&` or a decimal number. Alpha `00` is opaque. */
const parseAssColor = (
  value: string,
): { r: number; g: number; b: number; a: number } | null => {
  const trimmed = value.trim();
  let number: number;
  if (/^&H/i.test(trimmed)) {
    const hex = trimmed.replace(/^&H/i, "").replace(/&$/, "");
    if (!/^[0-9a-f]+$/i.test(hex)) return null;
    number = Number.parseInt(hex, 16);
  } else if (/^-?\d+$/.test(trimmed)) {
    number = Number(trimmed) >>> 0;
  } else return null;
  return {
    r: number & 0xff,
    g: (number >>> 8) & 0xff,
    b: (number >>> 16) & 0xff,
    a: (number >>> 24) & 0xff,
  };
};

const parseAssAlpha = (value: string): number | null => {
  const hex = value.trim().replace(/^&H/i, "").replace(/&$/, "");
  return /^[0-9a-f]{1,2}$/i.test(hex) ? Number.parseInt(hex, 16) : null;
};

const toCss = (color: { r: number; g: number; b: number }, alpha: number) =>
  `rgba(${color.r}, ${color.g}, ${color.b}, ${Math.round(((255 - alpha) / 255) * 1000) / 1000})`;

const fromCss = (css: string | null) => {
  const match = /rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/.exec(css ?? "");
  if (!match) return { r: 255, g: 255, b: 255, a: 0 };
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: Math.round((1 - Number(match[4])) * 255),
  };
};

/** SSA (`[V4 Styles]`) alignment: 1–3 bottom, 5–7 top, 9–11 middle. */
const legacyAlignment = (value: number) => {
  const column = value & 3 || 2;
  if (value & 4) return 6 + column;
  if (value & 8) return 3 + column;
  return column;
};

const assBool = (value: string | undefined) =>
  value !== undefined && value.trim() !== "0" && value.trim() !== "";

const ASS_TAGS = [
  "alpha",
  "iclip",
  "xbord",
  "ybord",
  "xshad",
  "yshad",
  "fscx",
  "fscy",
  "bord",
  "blur",
  "clip",
  "fade",
  "move",
  "shad",
  "pbo",
  "pos",
  "org",
  "fad",
  "frx",
  "fry",
  "frz",
  "fax",
  "fay",
  "fsp",
  "1c",
  "2c",
  "3c",
  "4c",
  "1a",
  "2a",
  "3a",
  "4a",
  "an",
  "be",
  "fn",
  "fs",
  "fr",
  "fe",
  "kf",
  "ko",
  "a",
  "b",
  "c",
  "i",
  "k",
  "K",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
];

/** Splits an override block like `\b1\pos(10,20)\t(\fs40)` into tags. */
const readOverrideTags = (block: string): { name: string; arg: string }[] => {
  const tags: { name: string; arg: string }[] = [];
  let index = 0;
  while (index < block.length) {
    if (block[index] !== "\\") {
      index++;
      continue;
    }
    index++;
    const name = ASS_TAGS.find((tag) => block.startsWith(tag, index));
    if (!name) continue;
    index += name.length;
    let arg = "";
    if (block[index] === "(") {
      let depth = 0;
      const start = index;
      for (; index < block.length; index++) {
        if (block[index] === "(") depth++;
        else if (block[index] === ")" && --depth === 0) break;
      }
      arg = block.slice(start, index + 1);
      index++;
    } else {
      const next = block.indexOf("\\", index);
      const end = next === -1 ? block.length : next;
      arg = block.slice(index, end);
      index = end;
    }
    tags.push({ name, arg: arg.trim() });
  }
  return tags;
};

const parenArgs = (arg: string) =>
  arg
    .replace(/^\(|\)$/g, "")
    .split(",")
    .map((value) => Number(value.trim()));

const parseAssText = (
  text: string,
  style: assStyle,
  styles: Map<string, assStyle>,
): Pick<subtitleCue, "alignment" | "position" | "lines"> => {
  let alignment: number | null = null;
  let position: subtitlePosition | null = null;
  let span = { ...style.span };
  let drawing = false;
  const lines: subtitleSpan[][] = [[]];
  const pushText = (value: string) => {
    if (drawing || value === "") return;
    const parts = value.replace(/\\h/g, " ").replace(/\\n/g, " ").split("\\N");
    parts.forEach((part, partIndex) => {
      if (partIndex > 0) lines.push([]);
      if (part !== "")
        lines[lines.length - 1]!.push({ text: part, style: span });
    });
  };
  for (const part of text.split(/(\{[^}]*\})/)) {
    if (!part.startsWith("{")) {
      pushText(part);
      continue;
    }
    const tags = readOverrideTags(part.slice(1, -1));
    if (tags.length === 0) continue;
    span = { ...span };
    for (const { name, arg } of tags) {
      const number = Number.parseFloat(arg);
      const hasNumber = !Number.isNaN(number);
      switch (name) {
        case "b":
          span.bold = hasNumber
            ? number === 1 || number >= 600
            : style.span.bold;
          break;
        case "i":
          span.italic = hasNumber ? number === 1 : style.span.italic;
          break;
        case "u":
          span.underline = hasNumber ? number === 1 : style.span.underline;
          break;
        case "s":
          span.strike = hasNumber ? number === 1 : style.span.strike;
          break;
        case "fn":
          span.fontName = arg || style.span.fontName;
          break;
        case "fs":
          span.fontSize = !hasNumber
            ? style.span.fontSize
            : /^[+-]/.test(arg)
              ? (span.fontSize ?? 20) + number
              : number;
          break;
        case "c":
        case "1c":
        case "3c":
        case "4c": {
          const key =
            name === "3c"
              ? "outlineColor"
              : name === "4c"
                ? "shadowColor"
                : "color";
          const color = arg ? parseAssColor(arg) : null;
          span[key] = color
            ? toCss(color, fromCss(span[key]).a)
            : style.span[key];
          break;
        }
        case "alpha":
        case "1a":
        case "3a":
        case "4a": {
          const alpha = parseAssAlpha(arg);
          if (alpha === null) break;
          const keys: ("color" | "outlineColor" | "shadowColor")[] =
            name === "alpha"
              ? ["color", "outlineColor", "shadowColor"]
              : name === "1a"
                ? ["color"]
                : name === "3a"
                  ? ["outlineColor"]
                  : ["shadowColor"];
          for (const key of keys) span[key] = toCss(fromCss(span[key]), alpha);
          break;
        }
        case "bord":
          span.outline = hasNumber ? number : style.span.outline;
          break;
        case "shad":
          span.shadow = hasNumber ? number : style.span.shadow;
          break;
        case "an":
          if (alignment === null && number >= 1 && number <= 9)
            alignment = number;
          break;
        case "a":
          if (alignment === null && hasNumber)
            alignment = legacyAlignment(number);
          break;
        case "pos":
        case "move": {
          const [x, y] = parenArgs(arg);
          if (
            position === null &&
            x !== undefined &&
            y !== undefined &&
            !Number.isNaN(x) &&
            !Number.isNaN(y)
          )
            position = { x, y, unit: "script" };
          break;
        }
        case "r": {
          const reset = (arg && styles.get(arg)) || style;
          span = { ...reset.span };
          break;
        }
        case "p":
          drawing = hasNumber && number > 0;
          break;
      }
    }
  }
  return {
    alignment: alignment ?? style.alignment,
    position,
    lines: lines.filter(
      (line, index) => line.length > 0 || index < lines.length - 1,
    ),
  };
};

const splitFields = (value: string, count: number) => {
  const fields: string[] = [];
  let rest = value;
  for (let index = 0; index < count - 1; index++) {
    const comma = rest.indexOf(",");
    if (comma === -1) break;
    fields.push(rest.slice(0, comma));
    rest = rest.slice(comma + 1);
  }
  fields.push(rest);
  return fields;
};

const parseAss = (source: string): subtitleTrack => {
  const info: { [key: string]: string } = {};
  const styles = new Map<string, assStyle>();
  const cues: subtitleCue[] = [];
  let section = "";
  let styleFormat: string[] = [];
  let eventFormat: string[] = [];
  let legacy = false;
  const pendingEvents: string[] = [];

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith(";")) continue;
    const header = /^\[(.+)\]$/.exec(line);
    if (header) {
      section = header[1]!.toLowerCase();
      if (section === "v4 styles") legacy = true;
      continue;
    }
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (section === "script info") {
      info[key.toLowerCase()] = value;
    } else if (section.endsWith("styles")) {
      if (key === "Format") {
        styleFormat = value
          .split(",")
          .map((field) => field.trim().toLowerCase());
      } else if (key === "Style") {
        const fields = splitFields(value, styleFormat.length);
        const get = (name: string) => {
          const index = styleFormat.indexOf(name);
          return index === -1 ? undefined : fields[index]?.trim();
        };
        const color = (name: string, fallback: string) => {
          const parsed = parseAssColor(get(name) ?? "");
          return parsed ? toCss(parsed, parsed.a) : fallback;
        };
        const number = (name: string, fallback: number) => {
          const parsed = Number.parseFloat(get(name) ?? "");
          return Number.isNaN(parsed) ? fallback : parsed;
        };
        const rawAlignment = number("alignment", 2);
        const fallback = DEFAULT_ASS_STYLE;
        styles.set(get("name") ?? "Default", {
          span: {
            fontName: get("fontname") || fallback.span.fontName,
            fontSize: number("fontsize", fallback.span.fontSize ?? 20),
            color: color("primarycolour", fallback.span.color!),
            outlineColor: color(
              legacy ? "tertiarycolour" : "outlinecolour",
              fallback.span.outlineColor!,
            ),
            shadowColor: color("backcolour", fallback.span.shadowColor!),
            bold: assBool(get("bold")),
            italic: assBool(get("italic")),
            underline: assBool(get("underline")),
            strike: assBool(get("strikeout")),
            outline: number("outline", fallback.span.outline ?? 2),
            shadow: number("shadow", fallback.span.shadow ?? 2),
          },
          alignment: legacy ? legacyAlignment(rawAlignment) : rawAlignment,
          marginL: number("marginl", fallback.marginL),
          marginR: number("marginr", fallback.marginR),
          marginV: number("marginv", fallback.marginV),
          boxed: number("borderstyle", 1) === 3,
        });
      }
    } else if (section === "events") {
      if (key === "Format") {
        eventFormat = value
          .split(",")
          .map((field) => field.trim().toLowerCase());
      } else if (key === "Dialogue") {
        pendingEvents.push(value);
      }
    }
  }

  if (eventFormat.length === 0)
    eventFormat = [
      "layer",
      "start",
      "end",
      "style",
      "name",
      "marginl",
      "marginr",
      "marginv",
      "effect",
      "text",
    ];
  for (const value of pendingEvents) {
    const fields = splitFields(value, eventFormat.length);
    const get = (name: string) => {
      const index = eventFormat.indexOf(name);
      return index === -1 ? undefined : fields[index];
    };
    const start = parseTimestamp(get("start") ?? "");
    const end = parseTimestamp(get("end") ?? "");
    if (start === null || end === null || end <= start) continue;
    const styleName = (get("style") ?? "").trim().replace(/^\*/, "");
    const style =
      styles.get(styleName) ?? styles.get("Default") ?? DEFAULT_ASS_STYLE;
    const margin = (name: string, fallback: number) => {
      const parsed = Number.parseInt(get(name) ?? "", 10);
      return Number.isNaN(parsed) || parsed === 0 ? fallback : parsed;
    };
    const parsed = parseAssText(get("text") ?? "", style, styles);
    if (parsed.lines.every((line) => line.length === 0)) continue;
    cues.push({
      start,
      end,
      layer: Number.parseInt(get("layer") ?? "0", 10) || 0,
      alignment: parsed.alignment,
      marginL: margin("marginl", style.marginL),
      marginR: margin("marginr", style.marginR),
      marginV: margin("marginv", style.marginV),
      position: parsed.position,
      boxed: style.boxed,
      lines: parsed.lines,
    });
  }

  let width = Number(info.playresx) || 0;
  let height = Number(info.playresy) || 0;
  if (!width && !height) {
    width = 384;
    height = 288;
  } else if (!height) height = width === 1280 ? 1024 : (width * 3) / 4;
  else if (!width) width = height === 1024 ? 1280 : (height * 4) / 3;

  return { kind: "ass", width, height, cues: sortCues(cues) };
};

//#endregion

const sortCues = (cues: subtitleCue[]) =>
  cues.sort((a, b) => a.start - b.start || a.layer - b.layer);

/**
 * Parses a subtitle file. The format is read from the content, not the file
 * name: `WEBVTT` at the start is `.vtt`, a `[Script Info]` or `[Events]`
 * section is `.ass`/`.ssa`, anything else is read as `.srt`.
 *
 * `.ass` styles and these override tags are kept: `\b \i \u \s \fn \fs \c \1c
 * \3c \4c \alpha \1a \3a \4a \bord \shad \an \a \pos \r \p`. `\move` is shown
 * at its start point. Animations (`\t`, `\fad`, karaoke) are not played.
 */
const parseSubtitles = (source: string): subtitleTrack => {
  const text = source.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (/^WEBVTT/.test(text)) return parseVtt(text);
  if (/^\s*\[(Script Info|Events|V4\+? Styles)\]/im.test(text))
    return parseAss(text);
  return parseSrt(text);
};

/** Cues that are shown at `time` (seconds), lowest layer first. */
const activeCues = (track: subtitleTrack, time: number): subtitleCue[] => {
  const result: subtitleCue[] = [];
  for (const cue of track.cues) {
    if (cue.start > time) break;
    if (cue.end > time) result.push(cue);
  }
  return result.sort((a, b) => a.layer - b.layer);
};

//#endregion

export { activeCues, parseSubtitles };
export type {
  subtitleCue,
  subtitlePosition,
  subtitleSpan,
  subtitleSpanStyle,
  subtitleTrack,
};
