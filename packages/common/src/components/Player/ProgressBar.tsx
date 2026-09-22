//#region Imports

import Time from "@arclockproject/common/library/Time";

import Box from "@mui/material/Box";

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
  onStartDragging: () => void;
  onEndDragging: (newCurrent: number) => void;
}): JSX.Element {
  const bar = useRef<HTMLDivElement>(null);
  const timeTextRef = useRef<HTMLDivElement>(null);
  const chapterTextRef = useRef<HTMLDivElement>(null);
  const [requiredSpace, setRequiredSpace] = useState(0);

  const [dragging, setDragging] = useState(false);
  const [timeHover, setTimeHover] = useState<number | null>(null);
  const [chapterHover, setChapterHover] = useState<string | null>(null);
  const setDraggingTrue = (event: unknown) => {
    if (!bar.current) return;
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
      if (!bar.current) return;
      const { width, x } = bar.current.getBoundingClientRect();
      const eventEnd =
        event instanceof MouseEvent ? event.clientX : event.touches[0]!.clientX;
      props.onEndDragging(
        Math.min(1, Math.max(0, (eventEnd - x) / width)) * props.max,
      );
      setDragging(false);
      document.removeEventListener("mouseup", moveEnd);
      document.removeEventListener("touchend", moveEnd);
      document.removeEventListener("touchcancel", moveEnd);
    };
    document.addEventListener("mouseup", moveEnd);
    document.addEventListener("touchend", moveEnd);
    document.addEventListener("touchcancel", moveEnd);
  };
  const mouseMove = useMemo(
    () =>
      _.throttle(
        (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
          if (!bar.current) return;
          const { width, x } = bar.current.getBoundingClientRect();
          const currentTime =
            Math.min(1, Math.max(0, (event.clientX - x) / width)) * props.max;
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
                      background: "rgba(168, 168, 168)",
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
                      background: "rgba(168, 168, 168)",
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
                      background: "rgba(168, 168, 168)",
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
                      background: "rgba(168, 168, 168)",
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
          height: dragging ? "8px" : "4px",
        },
        "&:hover > div": {
          height: "8px",
        },
      }}
      onMouseDown={setDraggingTrue}
      onTouchStart={setDraggingTrue}
      onMouseMove={props.main ? mouseMove : undefined}
      onMouseLeave={cancelHover}
      onTouchEnd={cancelHover}
      onTouchCancel={cancelHover}
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
        {timeHover && bar.current ? (
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
                  position: "absolute",
                  background: "rgba(0, 0, 0, 0.8)",
                  borderRadius: "16px",
                  bottom: chapterHover ? "32px" : "4px",
                  textAlign: "center",
                  width: "max-content",
                  left: "-10000px",
                  right: "-10000px",
                  margin: "auto",
                  padding: "0px 8px",
                  color: "white",
                }}
              >
                {parsedTimeHover}
              </div>
              <div
                ref={chapterTextRef}
                style={{
                  display: chapterHover ? undefined : "none",
                  position: "absolute",
                  background: "rgba(0, 0, 0, 0.8)",
                  borderRadius: "16px",
                  bottom: "4px",
                  textAlign: "center",
                  width: "max-content",
                  left: "-10000px",
                  right: "-10000px",
                  margin: "auto",
                  padding: "0px 8px",
                  color: "white",
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
            background: "rgba(168, 168, 168, 0.25)",
            height: "100%",
            width: "100%",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            background: "rgba(168, 168, 168, 0.8)",
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
            background: "rgba(168, 168, 168, 0.8)",
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
            background: "red",
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
                    background: "rgba(43, 43, 43, 0.5)",
                    height: "100%",
                    width: "2px",
                    transition: "width 0.5s ease-out",
                  }}
                />
              );
            })
          : undefined}
      </div>
    </Box>
  );
}

//#endregion

export { ProgressBar };
