//#region Imports

import Time from "@arclockproject/common/library/Time";

import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";

import _ from "lodash";
import type React from "react";
import { useMemo, useRef, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import type { videoChapters, videoHeatmap } from "./globals";

//#endregion

//#region ProgressBar.tsx

const DISPLAY_FPS = 24;
const EDGE_HEAT = 0;

const displayFrameInterval = Math.round(1000 / DISPLAY_FPS);
/**
 * After a touch, browsers send emulated mouse events. Mouse moves this many
 * ms after a touch are ignored, so they don't show the hover tooltip again.
 */
const EMULATED_MOUSE_MS = 1000;
const previewStyle: React.CSSProperties = {
  position: "absolute",
  background: "rgba(18, 18, 18, 0.92)",
  borderRadius: "6px",
  textAlign: "center",
  width: "max-content",
  left: "-10000px",
  right: "-10000px",
  margin: "auto",
  padding: "2px 8px",
  color: "white",
  fontSize: "12px",
  lineHeight: "18px",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
};
function ProgressBar(props: {
  main?: boolean;
  current: number;
  bufferAudio: number | null;
  bufferVideo: number | null;
  chapters?: videoChapters[];
  heatmap?: Required<videoHeatmap>[];
  minimized?: boolean;
  factor?: number;
  max: number;
  /**
   * `false` while the length is not known yet: pressing the bar doesn't seek
   * and no hover time is shown.
   * @default true
   */
  seekable?: boolean;
  onStartDragging: () => void;
  onEndDragging: (newCurrent: number) => void;
}): JSX.Element {
  const theme = useTheme();
  const bar = useRef<HTMLDivElement>(null);
  const timeTextRef = useRef<HTMLDivElement>(null);
  const chapterTextRef = useRef<HTMLDivElement>(null);
  const [requiredSpace, setRequiredSpace] = useState(0);

  const [dragging, setDragging] = useState(false);
  const [timeHover, setTimeHover] = useState<number | null>(null);
  const [chapterHover, setChapterHover] = useState<string | null>(null);
  const seekable = props.seekable !== false;
  const setDraggingTrue = (event: unknown) => {
    if (!bar.current || !seekable) return;
    if (
      event &&
      typeof event === "object" &&
      "preventDefault" in event &&
      typeof event.preventDefault === "function"
    )
      event.preventDefault();
    setDragging(true);
    props.onStartDragging();
    const moveEnd = (event: MouseEvent | TouchEvent) => {
      document.removeEventListener("mouseup", moveEnd);
      document.removeEventListener("touchend", moveEnd);
      document.removeEventListener("touchcancel", moveEnd);
      setDragging(false);
      if (!bar.current) return;
      const { width, x } = bar.current.getBoundingClientRect();
      const eventEnd =
        event instanceof MouseEvent
          ? event.clientX
          : event.changedTouches[0]?.clientX;
      if (eventEnd === undefined) return;
      props.onEndDragging(
        Math.min(1, Math.max(0, (eventEnd - x) / width)) * props.max,
      );
    };
    document.addEventListener("mouseup", moveEnd);
    document.addEventListener("touchend", moveEnd);
    document.addEventListener("touchcancel", moveEnd);
  };
  const showHover = useMemo(
    () =>
      _.throttle(
        (clientX: number) => {
          if (!bar.current) return;
          const { width, x } = bar.current.getBoundingClientRect();
          const currentTime =
            Math.min(1, Math.max(0, (clientX - x) / width)) * props.max;
          setTimeHover(currentTime);
          if (props.chapters && props.chapters.length > 0)
            setChapterHover(
              props.chapters.find(
                (value) =>
                  value.start_time < currentTime &&
                  value.end_time > currentTime,
              )?.title ?? null,
            );
        },
        displayFrameInterval,
        { trailing: false },
      ),
    [bar.current, props.max, props.chapters],
  );
  const parsedTimeHover =
    Time.parseTimeDuration((timeHover ?? 0) / (props.factor ?? 1)) ?? "0:00";
  const cancelHover = () => {
    setTimeHover(0);
    setChapterHover(null);
  };
  const lastTouch = useRef(0);
  const mouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (Date.now() - lastTouch.current < EMULATED_MOUSE_MS || !seekable) return;
    showHover(event.clientX);
  };
  const touchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    lastTouch.current = Date.now();
    setDraggingTrue(event);
    const touch = event.touches[0];
    if (props.main && seekable && touch) showHover(touch.clientX);
  };
  const touchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    lastTouch.current = Date.now();
    const touch = event.touches[0];
    if (props.main && seekable && touch) showHover(touch.clientX);
  };
  const touchEnd = () => {
    lastTouch.current = Date.now();
    cancelHover();
  };
  let requiredSpaceToUse = requiredSpace;
  if (timeTextRef.current?.offsetWidth || chapterTextRef.current?.offsetWidth) {
    const space = Math.max(
      (timeTextRef.current?.offsetWidth ?? 0) / 2,
      (chapterTextRef.current?.offsetWidth ?? 0) / 2,
    );
    if (requiredSpace !== space) {
      setRequiredSpace(space);
      requiredSpaceToUse = space; // To use in the current render (frame)
    }
  }
  const heatmap = useMemo(() => {
    return (
      props.heatmap
        ?.map<videoHeatmap>((e) => {
          return {
            id: e.id,
            start_time: e.start_time,
            end_time: e.end_time,
            value_time: parseFloat(`${e.value_time}`), // Because sql decimal returns a string?
          };
        })
        .map((entry, index, all) => {
          const leftPoint =
            index === 0 || all.length === 1
              ? EDGE_HEAT
              : all[index - 1]!.value_time;
          const rightPoint =
            all.length - 1 === index ? EDGE_HEAT : all[index + 1]!.value_time;

          const leftCurveHeight = (entry.value_time - leftPoint) / 2;
          const rightCurveHeight = (entry.value_time - rightPoint) / 2;

          const expectedHeightLeft = Math.max(
            entry.value_time,
            Math.abs(leftPoint + leftCurveHeight),
          );
          const leftCurveHeightScoped = Math.abs(
            leftCurveHeight / expectedHeightLeft,
          );

          const expectedHeightRight = Math.max(
            entry.value_time,
            Math.abs(rightPoint + rightCurveHeight),
          );
          const rightCurveHeightScoped = Math.abs(
            rightCurveHeight / expectedHeightRight,
          );

          return (
            <>
              <div
                className="Left"
                style={{
                  height: `100%`,
                  flex: 1,
                  display: "flex",
                  flexDirection: "column-reverse",
                  marginRight: "-1px",
                }}
              >
                {leftPoint < entry.value_time ? (
                  <div
                    style={{
                      height: `${expectedHeightLeft * 100}%`,
                      width: "100%",
                      clipPath: `polygon(0 ${
                        leftCurveHeightScoped * 100
                      }%,100% 0,100% 100%,0 100%)`,
                      background: "rgba(255, 255, 255, 0.35)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      height: `${expectedHeightLeft * 100}%`,
                      width: "100%",
                      clipPath: `polygon(0 0,100% ${
                        leftCurveHeightScoped * 100
                      }%,100% 100%,0 100%)`,
                      background: "rgba(255, 255, 255, 0.35)",
                    }}
                  />
                )}
              </div>
              <div
                style={{
                  height: `100%`,
                  flex: 1,
                  display: "flex",
                  flexDirection: "column-reverse",
                  marginRight: "-1px",
                }}
              >
                {rightPoint > entry.value_time ? (
                  <div
                    style={{
                      height: `${expectedHeightRight * 100}%`,
                      width: "100%",
                      clipPath: `polygon(0 ${
                        rightCurveHeightScoped * 100
                      }%,100% 0,100% 100%,0 100%)`,
                      background: "rgba(255, 255, 255, 0.35)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      height: `${expectedHeightRight * 100}%`,
                      width: "100%",
                      clipPath: `polygon(0 0,100% ${
                        rightCurveHeightScoped * 100
                      }%,100% 100%,0 100%)`,
                      background: "rgba(255, 255, 255, 0.35)",
                    }}
                  />
                )}
              </div>
            </>
          );
        }) ?? []
    );
  }, [props.heatmap]);
  return (
    <Box
      ref={bar}
      sx={{
        width: "100%",
        position: "relative",
        height: "16px",
        display: "flex",
        cursor: "pointer",
        "& > div": {
          height: dragging ? "6px" : "4px",
        },
        "&:hover > div": {
          height: "6px",
        },
        "& .ProgressKnob": {
          transform: `translate(-50%, -50%) scale(${dragging ? 1 : 0})`,
        },
        "&:hover .ProgressKnob": {
          transform: "translate(-50%, -50%) scale(1)",
        },
      }}
      onMouseDown={setDraggingTrue}
      onTouchStart={touchStart}
      onTouchMove={touchMove}
      onMouseMove={props.main ? mouseMove : undefined}
      onMouseLeave={cancelHover}
      onTouchEnd={touchEnd}
      onTouchCancel={touchEnd}
    >
      <div
        style={{
          position: "relative",
          transition: "height 150ms ease-out",
          width: "100%",
          margin: "auto",
        }}
      >
        <Box
          sx={(theme) => ({
            pointerEvents: "none",
            display: "flex",
            flexDirection: "row",
            flexWrap: "nowrap",
            width: "100%",
            height: "40px",
            position: "absolute",
            bottom: 0,
            opacity: props.minimized ? 0 : 0.75,
            transition: theme.transitions.create(["opacity"]),
            alignItems: "end",
          })}
        >
          {heatmap}
        </Box>
        {timeHover && seekable && bar.current ? (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: `${Math.max(
                requiredSpaceToUse - 20,
                Math.min(
                  bar.current.offsetWidth - (requiredSpaceToUse - 20),
                  (timeHover / props.max) * bar.current.offsetWidth,
                ),
              )}px`,
              pointerEvents: "none",
              zIndex: 10,
              transition: `left ${displayFrameInterval}ms`,
              height: "",
            }}
          >
            <div style={{ position: "relative" }}>
              <div
                ref={timeTextRef}
                style={{
                  ...previewStyle,
                  bottom: chapterHover ? "36px" : "10px",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {parsedTimeHover}
              </div>
              <div
                ref={chapterTextRef}
                style={{
                  ...previewStyle,
                  display: chapterHover ? undefined : "none",
                  bottom: "10px",
                  maxWidth: "240px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {chapterHover}
              </div>
            </div>
          </div>
        ) : undefined}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            background: "rgba(255, 255, 255, 0.2)",
            borderRadius: "999px",
            height: "100%",
            width: "100%",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            background: "rgba(255, 255, 255, 0.4)",
            borderRadius: "999px",
            height: props.bufferAudio === null ? "100%" : "50%",
            width:
              props.bufferVideo === null
                ? 0
                : `${(props.bufferVideo / props.max) * 100}%`,
            transition: "width 0.5s ease-out",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            background: "rgba(255, 255, 255, 0.4)",
            borderRadius: "999px",
            height: props.bufferVideo === null ? "100%" : "50%",
            width:
              props.bufferAudio === null
                ? 0
                : `${(props.bufferAudio / props.max) * 100}%`,
            transition: "width 0.5s ease-out",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            background: theme.palette.primary.main,
            borderRadius: "999px",
            height: "100%",
            // props.max can be rounded up as it is in seconds causing 1-2 px gap on right side
            width: `${(props.current / props.max) * 100}%`,
            transition: "width 0.5s ease-out",
          }}
        />
        {props.main && props.chapters && props.chapters.length > 1
          ? props.chapters.map((chapter, index) => {
              if (index === 0) return undefined;
              return (
                <div
                  key={index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: `${(chapter.start_time / props.max) * 100}%`,
                    background: "rgba(0, 0, 0, 0.6)",
                    height: "100%",
                    width: "2px",
                    transition: "width 0.5s ease-out",
                  }}
                />
              );
            })
          : undefined}
        <div
          className="ProgressKnob"
          style={{
            position: "absolute",
            top: "50%",
            left: `${Math.min(100, Math.max(0, (props.current / props.max) * 100))}%`,
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            background: theme.palette.primary.main,
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.6)",
            pointerEvents: "none",
            transition: "transform 150ms ease-out, left 0.5s ease-out",
          }}
        />
      </div>
    </Box>
  );
}

//#endregion

export { ProgressBar };
