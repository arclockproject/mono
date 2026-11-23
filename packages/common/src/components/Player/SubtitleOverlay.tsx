//#region Imports

import type { CSSProperties } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { loadEmbeddedTrack } from "./embeddedSubtitles";
import type { subtitleSettings } from "./globals";
import {
  activeCues,
  parseSubtitles,
  type subtitleCue,
  type subtitleSpanStyle,
  type subtitleTrack,
} from "./subtitles";

//#endregion

//#region SubtitleOverlay.tsx

const useIsomorphicLayoutEffect: typeof useEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

type trackLoad = {
  track: subtitleTrack | null;
  error: string | null;
  loading: boolean;
  listeners: Set<() => void>;
};

const trackCache = new Map<string, trackLoad>();

const trackKey = (url: string, track: number | undefined) =>
  track === undefined ? url : `${track}:${url}`;

/**
 * Starts loading a subtitle file, or a track inside the video when `track` is
 * set, unless it is cached. A failed load is removed from the cache, so the
 * next call tries again.
 */
const startTrackLoad = (url: string, track: number | undefined) => {
  const key = trackKey(url, track);
  const cached = trackCache.get(key);
  if (cached) return cached;
  const load: trackLoad = {
    track: null,
    error: null,
    loading: true,
    listeners: new Set(),
  };
  trackCache.set(key, load);
  const update = (value: Partial<trackLoad>) => {
    Object.assign(load, value);
    for (const listener of load.listeners) listener();
  };
  const request =
    track === undefined
      ? fetch(url)
          .then((response) => {
            if (!response.ok)
              throw new Error(`The server answered ${response.status}.`);
            return response.text();
          })
          .then(parseSubtitles)
      : loadEmbeddedTrack(url, track, (partial) => update({ track: partial }));
  request.then(
    (value) => update({ track: value, loading: false }),
    (error: unknown) => {
      trackCache.delete(key);
      update({
        track: null,
        loading: false,
        error:
          error instanceof Error && error.message
            ? error.message
            : "The file could not be read.",
      });
    },
  );
  return load;
};

/**
 * Fetches and parses the subtitle file at `url`, or text subtitle track
 * `track` inside the video at `url`. Results are cached, so remounting the
 * player doesn't fetch them again. Nothing is fetched while `enabled` is
 * `false`. A track inside a video shows its lines as they arrive.
 *
 * @returns The parsed track, or `null` while nothing is loaded yet, when off,
 * or on error. `loading` stays `true` until the whole track is in.
 */
function useSubtitleTrack(
  url: string | null | undefined,
  track: number | undefined,
  enabled: boolean,
): { track: subtitleTrack | null; error: string | null; loading: boolean } {
  const [state, setState] = useState<{
    key: string | null;
    track: subtitleTrack | null;
    error: string | null;
    loading: boolean;
  }>({ key: null, track: null, error: null, loading: false });
  useEffect(() => {
    if (!url || !enabled) return;
    const key = trackKey(url, track);
    const load = startTrackLoad(url, track);
    const sync = () =>
      setState({
        key,
        track: load.track,
        error: load.error,
        loading: load.loading,
      });
    load.listeners.add(sync);
    sync();
    return () => {
      load.listeners.delete(sync);
    };
  }, [url, track, enabled]);
  if (!url || !enabled || state.key !== trackKey(url, track))
    return { track: null, error: null, loading: !!url && enabled };
  return { track: state.track, error: state.error, loading: state.loading };
}

type rect = { left: number; top: number; width: number; height: number };

const fitRect = (
  container: { width: number; height: number },
  aspect: number | null,
): rect => {
  if (!aspect || container.width <= 0 || container.height <= 0)
    return { left: 0, top: 0, ...container };
  const width = Math.min(container.width, container.height * aspect);
  const height = width / aspect;
  return {
    left: (container.width - width) / 2,
    top: (container.height - height) / 2,
    width,
    height,
  };
};

const OUTLINE_STEPS = 16;
const outlineShadow = (width: number, color: string) => {
  if (width <= 0) return [];
  const shadows: string[] = [];
  for (let step = 0; step < OUTLINE_STEPS; step++) {
    const angle = (step / OUTLINE_STEPS) * Math.PI * 2;
    shadows.push(
      `${(Math.cos(angle) * width).toFixed(2)}px ${(Math.sin(angle) * width).toFixed(2)}px 0 ${color}`,
    );
  }
  return shadows;
};

const cleanFontName = (name: string) => name.replace(/["\\;{}<>]/g, "");

const FONT_STACK = `Roboto, "Helvetica Neue", Arial, sans-serif`;

/**
 * Draws the subtitles that are active at the media time `getTime()` returns.
 * It sits over the player, ignores the pointer, and doesn't move with
 * "Move and zoom".
 */
function SubtitleOverlay(props: {
  /** The parsed file, or `null` to draw nothing. */
  track: subtitleTrack | null;
  /** Current media time, in seconds. Read every frame. */
  getTime: () => number;
  settings: subtitleSettings;
  /**
   * Width / height of the picture as shown, used to place `.ass` positions on
   * the video instead of on the black bars. `null` uses the whole player.
   */
  aspect: number | null;
  /** Pixels to keep free at the bottom, e.g. for the controls. */
  bottomInset: number;
}): JSX.Element | null {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [cues, setCues] = useState<subtitleCue[]>([]);
  const getTime = useRef(props.getTime);
  getTime.current = props.getTime;
  const delay = props.settings.delay;

  useIsomorphicLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    const update = () =>
      setSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [props.track !== null]);

  useEffect(() => {
    const track = props.track;
    if (!track) {
      setCues([]);
      return;
    }
    let frame = 0;
    let lastKey = "";
    const tick = () => {
      const active = activeCues(track, getTime.current() - delay);
      const key = active.map((cue) => track.cues.indexOf(cue)).join(",");
      if (key !== lastKey) {
        lastKey = key;
        setCues(active);
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [props.track, delay]);

  if (!props.track) return null;

  const track = props.track;
  const settings = props.settings;
  const fileStyles = settings.fileStyles && track.kind === "ass";
  const box = fitRect(
    size,
    props.aspect ??
      (track.width && track.height ? track.width / track.height : null),
  );
  const scaleX = track.width ? box.width / track.width : 1;
  const scaleY = track.height ? box.height / track.height : 1;
  const sizeFactor = settings.size / 100;
  const plainFontSize = Math.max(12, box.height * 0.05) * sizeFactor;
  const plainBackground =
    settings.background > 0
      ? `rgba(8, 8, 8, ${settings.background / 100})`
      : null;

  const spanCss = (style: subtitleSpanStyle): CSSProperties => {
    const useFile = fileStyles;
    const fontSize =
      useFile && style.fontSize !== null
        ? style.fontSize * scaleY * sizeFactor
        : plainFontSize;
    const color = (settings.fileStyles && style.color) || settings.color;
    const shadows: string[] = [];
    if (useFile) {
      shadows.push(
        ...outlineShadow(
          (style.outline ?? 0) * scaleY * sizeFactor,
          style.outlineColor ?? "black",
        ),
      );
      const shadow = (style.shadow ?? 0) * scaleY * sizeFactor;
      if (shadow > 0)
        shadows.push(
          `${shadow.toFixed(2)}px ${shadow.toFixed(2)}px 0 ${style.shadowColor ?? "black"}`,
        );
    } else if (!plainBackground || settings.background < 40) {
      shadows.push(
        ...outlineShadow(Math.max(1, fontSize * 0.06), "rgba(0, 0, 0, 0.9)"),
      );
    }
    return {
      fontFamily:
        useFile && style.fontName
          ? `"${cleanFontName(style.fontName)}", ${FONT_STACK}`
          : FONT_STACK,
      fontSize: `${fontSize}px`,
      fontWeight: style.bold ? 700 : 400,
      fontStyle: style.italic ? "italic" : undefined,
      textDecoration:
        [style.underline ? "underline" : "", style.strike ? "line-through" : ""]
          .join(" ")
          .trim() || undefined,
      color,
      textShadow: shadows.length > 0 ? shadows.join(", ") : undefined,
    };
  };

  const renderLines = (cue: subtitleCue) => {
    const firstStyle = cue.lines.find((line) => line.length > 0)?.[0]?.style;
    const boxed = fileStyles && cue.boxed;
    const lineBackground: CSSProperties | undefined = boxed
      ? {
          background: firstStyle?.outlineColor ?? "black",
          padding: `0 ${((firstStyle?.outline ?? 0) * scaleY).toFixed(2)}px`,
        }
      : !fileStyles && plainBackground
        ? {
            background: plainBackground,
            padding: "0.05em 0.3em",
            borderRadius: "0.15em",
          }
        : undefined;
    return cue.lines.map((line, index) => (
      <div key={index}>
        <span
          style={{
            ...lineBackground,
            boxDecorationBreak: "clone",
            WebkitBoxDecorationBreak: "clone",
            lineHeight: 1.25,
            ...(settings.selectable
              ? {
                  pointerEvents: "auto",
                  userSelect: "text",
                  WebkitUserSelect: "text",
                  cursor: "text",
                }
              : undefined),
          }}
        >
          {line.length === 0
            ? "\u00a0"
            : line.map((span, spanIndex) => (
                <span key={spanIndex} style={spanCss(span.style)}>
                  {span.text}
                </span>
              ))}
        </span>
      </div>
    ));
  };

  const column = (alignment: number) => (alignment - 1) % 3;
  const row = (alignment: number) =>
    alignment >= 7 ? "top" : alignment >= 4 ? "middle" : "bottom";
  const textAlign = (alignment: number) =>
    (["left", "center", "right"] as const)[column(alignment)];

  const raise = (settings.raise / 100) * box.height;
  const plainMarginX = box.width * 0.04;
  const plainMarginV = box.height * 0.04;

  const groups = new Map<
    string,
    { alignment: number; style: CSSProperties; cues: subtitleCue[] }
  >();
  const positioned: { cue: subtitleCue; style: CSSProperties }[] = [];
  for (const cue of cues) {
    const alignment = cue.alignment;
    if (cue.position && (fileStyles || cue.position.unit === "percent")) {
      const x =
        cue.position.unit === "script"
          ? box.left + cue.position.x * scaleX
          : box.left + (cue.position.x / 100) * box.width;
      const y =
        cue.position.unit === "script"
          ? box.top + cue.position.y * scaleY
          : box.top + (cue.position.y / 100) * box.height;
      const translateX = ["0%", "-50%", "-100%"][column(alignment)];
      const translateY =
        row(alignment) === "top"
          ? "0%"
          : row(alignment) === "middle"
            ? "-50%"
            : "-100%";
      positioned.push({
        cue,
        style: {
          position: "absolute",
          left: x,
          top: y,
          transform: `translate(${translateX}, ${translateY})`,
          textAlign: textAlign(alignment),
          whiteSpace: "pre",
        },
      });
      continue;
    }
    const marginL =
      fileStyles && cue.marginL !== null ? cue.marginL * scaleX : plainMarginX;
    const marginR =
      fileStyles && cue.marginR !== null ? cue.marginR * scaleX : plainMarginX;
    const marginV =
      fileStyles && cue.marginV !== null ? cue.marginV * scaleY : plainMarginV;
    const key = `${alignment}|${marginL}|${marginR}|${marginV}`;
    let group = groups.get(key);
    if (!group) {
      const vertical: CSSProperties =
        row(alignment) === "top"
          ? { top: box.top + marginV, flexDirection: "column" }
          : row(alignment) === "middle"
            ? {
                top: box.top,
                height: box.height,
                flexDirection: "column",
                justifyContent: "center",
              }
            : {
                bottom:
                  size.height -
                  (box.top + box.height) +
                  Math.max(marginV + raise, props.bottomInset),
                flexDirection: "column-reverse",
                transition: "bottom 200ms",
              };
      group = {
        alignment,
        cues: [],
        style: {
          position: "absolute",
          left: box.left + marginL,
          width: Math.max(0, box.width - marginL - marginR),
          display: "flex",
          alignItems: ["flex-start", "center", "flex-end"][column(alignment)],
          textAlign: textAlign(alignment),
          whiteSpace: "pre-wrap",
          overflowWrap: "break-word",
          ...vertical,
        },
      };
      groups.set(key, group);
    }
    group.cues.push(cue);
  }

  const stop = settings.selectable
    ? (event: { stopPropagation: () => void }) => event.stopPropagation()
    : undefined;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: only keeps clicks on selectable text from reaching the player
    <div
      ref={container}
      aria-live="polite"
      onPointerDown={stop}
      onClick={stop}
      onDoubleClick={stop}
      onContextMenu={stop}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {[...groups.entries()].map(([key, group]) => (
        <div key={key} style={group.style}>
          {group.cues.map((cue) => (
            <div key={track.cues.indexOf(cue)}>{renderLines(cue)}</div>
          ))}
        </div>
      ))}
      {positioned.map(({ cue, style }) => (
        <div key={track.cues.indexOf(cue)} style={style}>
          {renderLines(cue)}
        </div>
      ))}
    </div>
  );
}

//#endregion

export { SubtitleOverlay, useSubtitleTrack };
