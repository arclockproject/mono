//#region Imports

import { LimitLines1 } from "@arclockproject/common/components/Text";
import { AudioInstantManagerGlobal } from "@arclockproject/common/library/AudioInstant";
import Time from "@arclockproject/common/library/Time";
import AddIcon from "@mui/icons-material/Add";
import FastForwardIcon from "@mui/icons-material/FastForward";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import HeadphonesIcon from "@mui/icons-material/Headphones";
import InfoIcon from "@mui/icons-material/Info";
import MovieIcon from "@mui/icons-material/Movie";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import MusicOffIcon from "@mui/icons-material/MusicOff";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RemoveIcon from "@mui/icons-material/Remove";
import RepeatIcon from "@mui/icons-material/Repeat";
import RepeatOneIcon from "@mui/icons-material/RepeatOne";
import SubtitlesIcon from "@mui/icons-material/Subtitles";
import SubtitlesOffIcon from "@mui/icons-material/SubtitlesOff";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import {
  Button,
  CircularProgress,
  Paper,
  Popover,
  Skeleton,
  styled,
  type TooltipProps,
  Typography,
} from "@mui/material";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip, { tooltipClasses } from "@mui/material/Tooltip";
import { type Ref, useEffect, useRef, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import {
  DEFAULT_MAX_DURATION,
  type videoChapters,
  type videoData,
  type videoHeatmap,
} from "./globals";
import { ProgressBar } from "./ProgressBar";
import { usePlayer } from "./usePlayer";

//#endregion

//#region VideoPlayer.tsx

const HIDE_INTERFACE_AFTER_MS = 2000;
const HIDE_INTERFACE_AFTER_MS_SHORT = 1400;

const quickEnough: { [key: number]: boolean } = {};
const timeout: ReturnType<typeof setTimeout>[] = [];
function createDoubleClickListener(
  single: () => void,
  double: () => void,
  id: number,
  time: number = 200,
) {
  const clear = (extended = false) => {
    clearTimeout(timeout?.[id]);
    timeout[id] = setTimeout(() => {
      quickEnough[id] = false;
      if (!extended) single();
    }, time);
  };
  return () => {
    clear();
    if (quickEnough[id]) {
      clear(true);
      if (quickEnough[id]) {
        double();
      }
    }
    quickEnough[id] = true;
  };
}
const ERROR_RANGE_SECONDS_RESET = 1;
const ERROR_RANGE_SECONDS_WARNING = 0.5;
const ERROR_RANGE_SECONDS_MESSAGE = 0.25;
// var lastClick = 0;
let lastKnownY = 0;

const ThemedTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} arrow classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.arrow}`]: {
    color: `rgba(${theme.palette.primary.main} / 0.75)`,
  },
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: `rgba(${theme.palette.primary.main} / 0.75)`,
  },
}));
const SPEED_MAX = 2;
const SPEED_MIN = 0.25;
interface position {
  x: number;
  y: number;
}
function VideoPlayer<metaType, listMetaType>(props: {
  videoData?: videoData<metaType>;
  isPlaylist: boolean;
  errorDisplay?: string;
  chapters: videoChapters[];
  heatmap: Required<videoHeatmap>[];
  ScrollTriggerDistance?: number;
  showInlineTitle?: boolean;
}): JSX.Element {
  const context = usePlayer<metaType, listMetaType>();
  const [fullscreen, setFullscreen] = useState(false);
  const [hideControls, setHideControls] = useState(false);
  const [taikoMode, setTaikoMode] = useState(false);
  const [isSubtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [lastAction, setLastAction] = useState(0);
  const [forcedVolumeWidth, setForcedVolumeWidth] = useState("0px");
  const [deSyncMessage, setDeSyncMessage] = useState("");
  const [durationError, setDurationError] = useState("");
  const [hideVideoErrors, setHideVideoErrors] = useState(false);
  const [forcedVolumePadding, setForcedVolumePadding] = useState("0px");
  const [dodgeNav, setDodgeNav] = useState(true);

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<position>({
    x: 0,
    y: 0,
  });

  const canvas = useRef<HTMLCanvasElement>(null);
  const ctx = canvas.current?.getContext("2d");

  const uniqueID = props.videoData?.id;
  const thumbnail = context.internal.playerData.value?.files.thumbnail;
  useEffect(() => {
    if (!uniqueID) return;
    if (uniqueID !== context.internal.playerData.value?.id) {
      context.internal.maxDuration.set(DEFAULT_MAX_DURATION);
      context.internal.currentPosition.set(0);
      context.internal.audioBuffer.set(0);
    }
    context.internal.videoBuffer.set(0);
    context.internal.playerData.set(props.videoData);
    if (context.internal.settings.value.autoPlay) {
      context.internal.playing.set(true);
    }
  }, [uniqueID]);
  useEffect(() => {
    if (
      props.chapters.length === 0 &&
      context.internal.chapters.value.length === 0
    )
      return;
    context.internal.chapters.set(props.chapters);
  }, [props.chapters]);

  useEffect(() => {
    if (
      props.heatmap.length === 0 &&
      context.internal.heatmap.value.length === 0
    )
      return;
    context.internal.heatmap.set(props.heatmap);
  }, [props.heatmap]);
  useEffect(() => {
    if (props.isPlaylist) return;
    context.internal.playlistContent.set([]);
  }, [props.isPlaylist]);
  useEffect(() => {
    const fullScreenChanger = () => {
      if (document.fullscreenElement) {
        setFullscreen(true);
      } else {
        setFullscreen(false);
      }
    };

    document.addEventListener("fullscreenchange", fullScreenChanger);
    return () => {
      document.removeEventListener("fullscreenchange", fullScreenChanger);
    };
  }, []);
  useEffect(() => {
    if (
      !context.internal.playing.value ||
      context.internal.audioOnly.value ||
      !context.internal.settings.value.videoBackgroundBloom
    )
      return;
    const backScreenDrawerInterval = setInterval(() => {
      if (!ctx || !context.internal.refVideo.current) return;
      ctx.globalAlpha = 0.1;
      ctx.drawImage(context.internal.refVideo.current, 0, 0, 110, 75);
    }, 250);
    return () => clearInterval(backScreenDrawerInterval);
  }, [
    context.internal.refVideo.current,
    ctx,
    context.internal.playing.value,
    context.internal.audioOnly.value,
    context.internal.settings.value.videoBackgroundBloom,
  ]);
  useEffect(() => {
    const backdropChanger = () => {
      const scrollPosition = document.scrollingElement?.scrollTop ?? 0;
      if (
        lastKnownY >
        scrollPosition + context.internal.settings.value.stickyTriggerDistance
      ) {
        setDodgeNav(false);
        lastKnownY = scrollPosition;
        return;
      }
      if (
        lastKnownY <
        scrollPosition - context.internal.settings.value.stickyTriggerDistance
      ) {
        setDodgeNav(true);
        lastKnownY = scrollPosition;
        return;
      }
    };
    document.addEventListener("scroll", backdropChanger);
    return () => {
      document.removeEventListener("scroll", backdropChanger);
    };
  }, [dodgeNav]);
  const togglePlay = () => {
    context.internal.playing.set(!context.internal.playing.value);
  };
  const moveVideoPointer = (time: number, expectedPlayState: boolean) => {
    setLastAction(Date.now() - HIDE_INTERFACE_AFTER_MS_SHORT);
    setHideControls(false);
    if (context.internal.audioOnly.value) {
      if (context.internal.refAudio.current)
        context.internal.refAudio.current.currentTime += time;
    } else if (context.internal.targetControllerRef.current) {
      context.internal.playing.set(expectedPlayState);
      context.internal.syncAll(
        context.internal.targetControllerRef.current.currentTime + time,
        expectedPlayState,
      );
    }
  };
  useEffect(() => {
    const onOrientationChange = () => {
      if (screen.orientation.type.match(/\w+/)?.[0] === "landscape") {
        void document.body.requestFullscreen();
      } else {
        void document.exitFullscreen();
      }
    };
    screen.orientation.addEventListener("change", onOrientationChange);
    return () => {
      screen.orientation.removeEventListener("change", onOrientationChange);
    };
  }, [context.internal.playing.value]);
  const subtitleSync = (isSubtitlesEnabledParam: boolean) => {
    if (isSubtitlesEnabledParam) {
      if (!context.internal.playerData.value?.files.subtitles) return;
      const track = document.createElement("track");
      track.kind = "captions";
      track.label = "English";
      track.srclang = "en";
      track.src = context.internal.playerData.value.files.subtitles;
      if (context.internal.refVideo.current)
        context.internal.refVideo.current.innerHTML = "";
      if (context.internal.refVideo.current)
        context.internal.refVideo.current.appendChild(track);
      if (context.internal.refVideo.current)
        context.internal.refVideo.current.textTracks[0]!.mode = "showing";
    } else {
      if (
        context.internal.refVideo.current &&
        context.internal.refVideo.current.textTracks.length > 0
      )
        context.internal.refVideo.current.textTracks[0]!.mode = "hidden";
      if (context.internal.refVideo.current)
        context.internal.refVideo.current.innerHTML = "";
    }
  };
  useEffect(() => {
    subtitleSync(isSubtitlesEnabled);
  }, [context.internal.refVideo.current?.src]);
  const generalClick = (forced: boolean) => {
    if (forced || document.body.offsetWidth > 1200) {
      if (!hideControls) togglePlay();
      setHideControls(false);
    } else {
      setHideControls(!hideControls);
    }
    setLastAction(Date.now());
  };
  const processedSpeed =
    Math.floor(context.internal.playSpeed.value * 100) / 100;
  return (
    <Box
      tabIndex={0}
      sx={(theme) => ({
        width: "100%",
        paddingTop: "56.25%",
        position: "relative",
        gridArea: "video",
        [theme.breakpoints.down("sm")]: context.internal.settings.value.sticky
          ? {
              position: "sticky",
              top: dodgeNav
                ? 0
                : `${context.internal.settings.value.stickySpacing}px`,
              transition: "top 1s",
              zIndex: fullscreen ? 10 : 5,
            }
          : {
              zIndex: fullscreen ? 10 : 5,
            },
        "&::before": {
          backdropFilter: "blur(5px)",
          content: "no-open-quote",
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
        },
      })}
      onContextMenu={(event) => {
        event.preventDefault();
        setShowContextMenu(true);
        setContextMenuPosition({
          x: event.clientX,
          y: event.clientY,
        });
      }}
      onKeyDown={(event) => {
        if (event.altKey || event.ctrlKey || event.shiftKey) return;
        switch (event.code) {
          case "Digit9":
          case "Digit0":
          case "Minus":
          case "Equal":
          case "BracketRight":
          case "BracketLeft":
          case "Space":
          case "ArrowLeft":
          case "ArrowRight":
          case "KeyL":
          case "Period":
          case "Comma":
          case "KeyM":
          case "KeyT":
            break;
          case "KeyK":
            if (taikoMode) {
              AudioInstantManagerGlobal.play("/side.wav");
            }
            break;
          case "KeyJ":
            if (taikoMode) {
              AudioInstantManagerGlobal.play("/center.wav");
            }
            break;
          case "KeyD":
            if (taikoMode) {
              AudioInstantManagerGlobal.play("/side.wav");
            }
            break;
          case "KeyF":
            if (taikoMode) {
              AudioInstantManagerGlobal.play("/center.wav");
            } else {
              return;
            }
            break;
          default:
            return;
        }
        event.preventDefault();
        event.stopPropagation();
      }}
      onKeyUp={(event) => {
        if (event.altKey || event.ctrlKey || event.shiftKey) return;
        switch (event.code) {
          case "KeyT": {
            setTaikoMode(!taikoMode);
            break;
          }
          case "KeyF":
            if (!taikoMode) {
              return;
            }
            break;
          case "Digit9": {
            const lowerVolume = Math.max(
              0,
              context.internal.volume.value * 0.8,
            );
            context.internal.volume.set(lowerVolume);
            setForcedVolumeWidth("100px !important");
            setForcedVolumePadding("0px 8px");
            setLastAction(Date.now() - HIDE_INTERFACE_AFTER_MS_SHORT);
            setHideControls(false);
            if (context.internal.refAudio.current)
              context.internal.refAudio.current.volume = lowerVolume;
            if (context.internal.refVideo.current)
              context.internal.refVideo.current.volume = lowerVolume;
            break;
          }
          case "Digit0": {
            const higherVolume = Math.min(
              1,
              context.internal.volume.value * 1.2,
            );
            context.internal.volume.set(higherVolume);
            setForcedVolumeWidth("100px !important");
            setForcedVolumePadding("0px 8px");
            setLastAction(Date.now() - HIDE_INTERFACE_AFTER_MS_SHORT);
            setHideControls(false);
            if (context.internal.refAudio.current)
              context.internal.refAudio.current.volume = higherVolume;
            if (context.internal.refVideo.current)
              context.internal.refVideo.current.volume = higherVolume;
            break;
          }
          case "BracketLeft":
            context.internal.playSpeed.set(
              Math.max(
                SPEED_MIN,
                Math.round(context.internal.playSpeed.value * 90) / 100,
              ),
            );
            setLastAction(Date.now() - HIDE_INTERFACE_AFTER_MS_SHORT);
            setHideControls(false);
            break;
          case "BracketRight":
            context.internal.playSpeed.set(
              Math.min(
                SPEED_MAX,
                Math.round(context.internal.playSpeed.value * 110) / 100,
              ),
            );
            setLastAction(Date.now() - HIDE_INTERFACE_AFTER_MS_SHORT);
            setHideControls(false);
            break;
          case "Minus":
            context.internal.playSpeed.set(
              Math.max(SPEED_MIN, context.internal.playSpeed.value - 0.06),
            );
            setLastAction(Date.now() - HIDE_INTERFACE_AFTER_MS_SHORT);
            setHideControls(false);
            break;
          case "Equal":
            context.internal.playSpeed.set(
              Math.min(SPEED_MAX, context.internal.playSpeed.value + 0.06),
            );
            setLastAction(Date.now() - HIDE_INTERFACE_AFTER_MS_SHORT);
            setHideControls(false);
            break;
          case "KeyM":
            context.internal.muted.set(!context.internal.muted.value);
            break;
          case "KeyK":
            if (!taikoMode) {
              if (context.internal.playing.value) {
                setLastAction(Date.now());
                setHideControls(false);
              } else {
                setLastAction(0);
                setHideControls(true);
              }
              togglePlay();
            }
            break;
          case "Space":
            if (context.internal.playing.value) {
              setLastAction(Date.now());
              setHideControls(false);
            } else {
              setLastAction(0);
              setHideControls(true);
            }
            togglePlay();
            break;
          case "KeyJ":
            if (!taikoMode) {
              moveVideoPointer(-5, context.internal.playing.value);
            }
            break;
          case "ArrowLeft":
            moveVideoPointer(-5, context.internal.playing.value);
            break;
          case "ArrowRight":
          case "KeyL":
            moveVideoPointer(5, context.internal.playing.value);
            break;
          case "Period":
            moveVideoPointer(1 / 60, false);
            break;
          case "Comma":
            moveVideoPointer(-1 / 60, false);
            break;
          default:
            return;
        }
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div />
      {!context.internal.playerData.value ? (
        <Skeleton
          sx={{
            position: "absolute",
            top: 0,
            borderRadius: "16px",
          }}
          variant="rectangular"
          width="100%"
          height="100%"
        />
      ) : (
        <>
          <div
            style={{
              position: "absolute",
              inset: "-3% -5%",
              backgroundSize: "contain",
              filter: "blur(150px)",
              pointerEvents: "none",
              ...(props.videoData ? { opacity: 0.5, zIndex: -1 } : {}),
            }}
          >
            <canvas
              ref={canvas}
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                opacity: context.internal.audioOnly.value ? 0 : 1,
                transition: "opacity 5s",
              }}
              width="110"
              height="75"
            />
            <img
              alt="Thumbnail"
              src={thumbnail}
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                opacity: context.internal.audioOnly.value ? 1 : 0,
                transition: "opacity 5s",
              }}
            />
          </div>
          <Box
            sx={(theme) =>
              fullscreen
                ? {
                    position: "fixed",
                    inset: 0,
                    background: "black",
                    zIndex: 2147483647,
                    cursor: hideControls ? "none" : "auto",
                  }
                : {
                    position: "absolute",
                    display: "flex",
                    top: 0,
                    background: "rgba(0,0,0,1)",
                    height: "100%",
                    width: "100%",
                    overflow: "hidden",
                    cursor: hideControls ? "none" : "auto",
                    borderRadius: "16px",
                    [theme.breakpoints.down("md")]: {
                      borderRadius: context.internal.settings.value.sticky
                        ? "0px"
                        : "16px",
                    },
                  }
            }
            onMouseMove={() => {
              const now = Date.now();
              if (lastAction + 500 < now) {
                setLastAction(now);
                setHideControls(false);
              }
            }}
            onMouseLeave={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              const leftOut = box.left > event.clientX;
              const rightOut = box.right < event.clientX;
              const topOut = box.top > event.clientY;
              const bottomOut = box.bottom < event.clientY;
              const wasRightClick = event.clientY < 0 || event.clientX < 0;
              if (
                context.internal.playing.value &&
                !wasRightClick &&
                (leftOut || rightOut || bottomOut || topOut)
              ) {
                setLastAction(0);
                setHideControls(true);
              }
            }}
            onTouchMove={() => {
              const now = Date.now();
              if (lastAction + 500 < now) {
                setLastAction(now);
                setHideControls(false);
              }
            }}
          >
            {context.internal.playerData.value ? (
              <>
                <video
                  id="Player"
                  // eslint-disable-next-line
                  ref={context.internal.refVideo as Ref<HTMLVideoElement>}
                  muted={
                    context.internal.audioOnly.value
                      ? true
                      : context.internal.playerData.value.files.audio !== null
                        ? true
                        : context.internal.muted.value
                  }
                  src={
                    context.internal.sourceOverride.value
                      ? context.internal.sourceOverride.value
                      : context.internal.audioOnly.value
                        ? "unload"
                        : context.internal.playerData.value.files.video
                  }
                  poster={
                    context.internal.audioOnly.value ? thumbnail : undefined
                  }
                  style={{
                    height: "100%",
                    width: "100%",
                    objectFit: context.internal.audioOnly.value
                      ? "cover"
                      : undefined,

                    ...(fullscreen
                      ? {
                          position: "fixed",
                          inset: 0,
                          margin: "auto",
                        }
                      : {}),
                  }}
                  width="100%"
                  onEnded={
                    context.internal.audioControlled
                      ? undefined
                      : context.internal.actionOnEnded
                  }
                  onLoadStart={
                    context.internal.audioControlled
                      ? undefined
                      : context.internal.actionOnLoadStart
                  }
                  onDurationChange={
                    context.internal.audioControlled
                      ? (e) => {
                          if (
                            context.internal.maxDuration.value !==
                              DEFAULT_MAX_DURATION &&
                            context.internal.maxDuration.value !== 0 &&
                            Math.floor(context.internal.maxDuration.value) !==
                              Math.floor(e.currentTarget.duration) &&
                            e.currentTarget.duration !== 0
                          ) {
                            setDurationError(
                              `Video seek is unavailable for this video`,
                            );
                          } else {
                            setDurationError("");
                          }
                        }
                      : context.internal.actionOnDurationChange
                  }
                  onTimeUpdate={
                    context.internal.audioControlled
                      ? (e) => {
                          if (
                            document.hidden &&
                            !context.internal.audioOnly.value &&
                            context.internal.settings.value.autoAudioOnly
                          ) {
                            context.internal.audioOnly.set(true);
                          }
                          const bufferedEnd: number =
                            e.currentTarget.buffered.end(
                              e.currentTarget.buffered.length - 1,
                            );
                          context.internal.videoBuffer.set(bufferedEnd);

                          if (lastAction < Date.now() - HIDE_INTERFACE_AFTER_MS)
                            setHideControls(true);

                          if (!context.internal.refAudio.current) return;
                          const deSyncGap = Math.abs(
                            e.currentTarget.currentTime -
                              context.internal.refAudio.current?.currentTime,
                          );
                          //   if (deSyncGap > 2) {}
                          if (deSyncGap > ERROR_RANGE_SECONDS_RESET) {
                            context.internal.syncAll(
                              context.internal.refAudio.current.currentTime,
                              context.internal.playing.value,
                              true,
                            );
                            setDeSyncMessage(
                              `DeSync: ${
                                Math.floor(deSyncGap * 100) / 100
                              }s (Synchronizing...)`,
                            );
                          } else if (deSyncGap > ERROR_RANGE_SECONDS_WARNING) {
                            setDeSyncMessage(
                              `DeSync: ${
                                Math.floor(deSyncGap * 100) / 100
                              }s (Auto Sync at ${ERROR_RANGE_SECONDS_RESET}s)`,
                            );
                          } else if (deSyncGap > ERROR_RANGE_SECONDS_MESSAGE) {
                            setDeSyncMessage(
                              `DeSync: ${Math.floor(deSyncGap * 1000)}ms`,
                            );
                          } else if (deSyncMessage !== "") {
                            setDeSyncMessage("");
                          }
                        }
                      : (e) => {
                          if (lastAction < Date.now() - HIDE_INTERFACE_AFTER_MS)
                            setHideControls(true);

                          context.internal.actionOnTimeUpdate(e, "video");
                        }
                  }
                  onError={
                    context.internal.audioControlled
                      ? undefined
                      : context.internal.actionOnError
                  }
                />
                <Box
                  sx={(theme) => ({
                    position: "absolute",
                    inset: 0,
                    width: "auto",
                    minHeight: "auto",
                    display: "flex",
                    flexDirection: "row",
                    transition: theme.transitions.create("bottom"),
                  })}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    style={{ height: "100%", width: "25%" }}
                    onClick={createDoubleClickListener(
                      () => generalClick(false),
                      () =>
                        moveVideoPointer(-10, context.internal.playing.value),
                      0,
                    )}
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    style={{ height: "100%", width: "50%" }}
                    onClick={createDoubleClickListener(
                      () => generalClick(false),
                      () =>
                        document
                          .exitFullscreen()
                          .catch(() => document.body.requestFullscreen()),
                      1,
                    )}
                  >
                    <Box
                      style={{
                        position: "absolute",
                        margin: "auto",
                        inset: 0,
                        height: "80px",
                        width: "80px",
                        borderRadius: "80px",
                        opacity:
                          hideControls && !context.internal.synchronizing.value
                            ? 0
                            : context.internal.playing.value
                              ? 0.3
                              : 1,
                        transition: "opacity 200ms",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        generalClick(true);
                      }}
                    >
                      <Box
                        style={{
                          position: "absolute",
                          margin: "auto",
                          inset: 0,
                          height: "80px",
                          width: "80px",
                          borderRadius: "80px",
                          background: "#000000bf",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {context.internal.synchronizing.value ? (
                          <CircularProgress />
                        ) : context.internal.playing.value ? (
                          <PauseIcon
                            style={{ fontSize: "46px", color: "white" }}
                          />
                        ) : (
                          <PlayArrowIcon
                            style={{ fontSize: "46px", color: "white" }}
                          />
                        )}
                      </Box>
                    </Box>
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    style={{ height: "100%", width: "25%" }}
                    onClick={createDoubleClickListener(
                      () => generalClick(false),
                      () =>
                        moveVideoPointer(10, context.internal.playing.value),
                      2,
                    )}
                  />
                </Box>
                <Box
                  sx={(theme) => ({
                    position: "absolute",
                    bottom: hideControls ? "-100px" : 0,
                    left: 0,
                    right: 0,
                    width: "100%",
                    pointerEvents: "none",
                    minHeight: "100px",
                    opacity: 0.6,
                    background: `linear-gradient(#00000000, #000000FF)`,
                    display: "flex",
                    transition: theme.transitions.create("bottom"),
                  })}
                />
                <Box
                  sx={(theme) => ({
                    position: "absolute",
                    top: hideControls ? "-100px" : 0,
                    left: 0,
                    right: 0,
                    width: "100%",
                    pointerEvents: "none",
                    minHeight: "100px",
                    opacity: 0.6,
                    background: `linear-gradient(#000000FF, #00000000)`,
                    display: "flex",
                    transition: theme.transitions.create("top"),
                  })}
                />

                <Box
                  sx={(theme) => ({
                    position: "absolute",
                    top:
                      !hideControls && (fullscreen || props.showInlineTitle)
                        ? "40px"
                        : 0,
                    /*
                        hideControls fullscreen 0
                        !hideControls fullscreen 40
                        hideControls !fullscreen 0
                        !hideControls !fullscreen 0
                        */
                    opacity: hideVideoErrors
                      ? 0
                      : hideControls /*||context.internal.audioOnly.value*/
                        ? 0.3
                        : 1,
                    left: 0,
                    right: 0,
                    width: "100%",
                    padding: theme.spacing(1),
                    transition: theme.transitions.create(["top", "opacity"]),
                    pointerEvents: "none",
                  })}
                  onClick={() => setLastAction(Date.now())}
                  onContextMenu={(event) => event.stopPropagation()}
                >
                  <Typography fontSize="12px" margin="auto" color="red">
                    {`${deSyncMessage}${
                      deSyncMessage !== "" && durationError !== "" ? " | " : ""
                    }${durationError}`}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: taikoMode ? "flex" : "none",
                    position: "absolute",
                    inset: 0,
                    justifyContent: "center",
                    alignItems: "center",
                    flexDirection: "column",
                    gap: 1,
                    background: "rgba(0,0,0,0.25)",
                  }}
                >
                  <Typography>You are in Taiko Mode</Typography>
                  <Typography>Play with [D] [F] and [J] [K]</Typography>
                  <Typography>Exit with [T]</Typography>
                </Box>
                <Box
                  sx={(theme) => ({
                    position: "absolute",
                    top: hideControls ? "-72px" : 0,
                    left: 0,
                    right: 0,
                    color: theme.palette.text.primary,
                    // width: "100%",
                    // minHeight: "100%",
                    padding: theme.spacing(1),
                    display: "flex",
                    flexDirection: "column-reverse",
                    gap: theme.spacing(1),
                    transition: theme.transitions.create("top"),
                  })}
                  onClick={() => setLastAction(Date.now())}
                  onContextMenu={(event) => event.stopPropagation()}
                >
                  <Box
                    sx={(theme) => ({
                      width: "100%",
                      display: "flex",
                      flexDirection: "row",
                      gap: theme.spacing(1),
                    })}
                  >
                    <div>
                      {fullscreen || props.showInlineTitle ? (
                        <LimitLines1
                          fontSize="24px"
                          margin="auto"
                          color="white"
                        >
                          {context.internal.playerData.value.title}
                        </LimitLines1>
                      ) : undefined}
                    </div>
                    <div style={{ flex: 1 }} />
                    <IconButton
                      style={{ color: "white" }}
                      onClick={() => {
                        context.internal.playSpeed.set(
                          Math.max(
                            SPEED_MIN,
                            context.internal.playSpeed.value - 0.06,
                          ),
                        );
                      }}
                    >
                      <RemoveIcon />
                    </IconButton>
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                      onClick={() => context.internal.playSpeed.set(1)}
                    >
                      <Typography
                        sx={(theme) => ({
                          color: "white",
                          [theme.breakpoints.down("sm")]: {
                            fontSize: "12px",
                          },
                        })}
                      >
                        {(`${processedSpeed}`.length === 1
                          ? `${processedSpeed}.00`
                          : `${processedSpeed}`.length === 3
                            ? `${processedSpeed}0`
                            : processedSpeed
                        ).toString()}
                      </Typography>
                    </Box>
                    <IconButton
                      style={{ color: "white" }}
                      onClick={() => {
                        context.internal.playSpeed.set(
                          Math.min(
                            SPEED_MAX,
                            context.internal.playSpeed.value + 0.06,
                          ),
                        );
                      }}
                    >
                      <AddIcon />
                    </IconButton>
                    <ThemedTooltip title="Pitch Shift" placement="bottom">
                      <IconButton
                        style={{ color: "white" }}
                        onClick={() => {
                          context.internal.distortAudio.set(
                            !context.internal.distortAudio.value,
                          );
                        }}
                      >
                        {context.internal.distortAudio.value ? (
                          <MusicNoteIcon />
                        ) : (
                          <MusicOffIcon />
                        )}
                      </IconButton>
                    </ThemedTooltip>
                  </Box>
                </Box>
                <Box
                  sx={(theme) => ({
                    position: "absolute",
                    bottom: hideControls ? "-72px" : 0,
                    left: 0,
                    right: 0,
                    color: theme.palette.text.primary,
                    // width: "100%",
                    // minHeight: "100%",
                    padding: theme.spacing(1),
                    display: "flex",
                    flexDirection: "column-reverse",
                    gap: theme.spacing(1),
                    transition: theme.transitions.create("bottom"),
                  })}
                  onClick={() => setLastAction(Date.now())}
                  onContextMenu={(event) => event.stopPropagation()}
                >
                  <Box
                    sx={(theme) => ({
                      width: "100%",
                      display: "flex",
                      flexDirection: "row",
                      gap: theme.spacing(1),
                    })}
                  >
                    <IconButton onClick={togglePlay} style={{ color: "white" }}>
                      {context.internal.playing.value ? (
                        <PauseIcon />
                      ) : (
                        <PlayArrowIcon />
                      )}
                    </IconButton>
                    {context.internal.playlistContent.value.length > 0 ? (
                      <IconButton style={{ color: "white" }}>
                        <FastForwardIcon
                          onClick={() => {
                            let currentID = 0;
                            for (
                              let i = 0;
                              i < context.internal.playlistContent.value.length;
                              i++
                            ) {
                              const video =
                                context.internal.playlistContent.value[i];
                              if (
                                context.internal.playerData.value?.files
                                  .audio === video?.files.audio
                              ) {
                                currentID = i;
                              }
                            }
                            const next =
                              currentID ===
                              context.internal.playlistContent.value.length - 1
                                ? 0
                                : currentID + 1;
                            const videoData =
                              context.internal.playlistContent.value[next]!;
                            context.internal.playerData.set(videoData);
                            if (context.internal.miniPlayer.value) {
                              // Load video without navigate

                              context.internal.touchHistory(videoData);
                            } else {
                              context.internal.navigate(videoData);
                            }
                          }}
                        />
                      </IconButton>
                    ) : undefined}
                    <Box
                      sx={(theme) => ({
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        "&:hover > .VolumeBar": {
                          padding: theme.spacing(0, 1),
                          width: "100px",
                        },
                      })}
                    >
                      <IconButton
                        style={{ color: "white" }}
                        onClick={() => {
                          context.internal.muted.set(
                            !context.internal.muted.value,
                          );
                        }}
                      >
                        {context.internal.muted.value ? (
                          <VolumeOffIcon />
                        ) : (
                          <VolumeUpIcon />
                        )}
                      </IconButton>

                      <Box
                        className="VolumeBar"
                        sx={{
                          padding: forcedVolumePadding,
                          width: forcedVolumeWidth,
                          transition: "width 200ms, padding 200ms",
                        }}
                      >
                        <ProgressBar
                          //Math.log(Math.log((context.internal.refAudio.current?.volume ?? 0) + 1) / Math.log(2) + 1) /
                          current={Math.abs(
                            Math.exp(
                              Math.log(
                                1 -
                                  (context.internal.targetControllerRef.current
                                    ?.volume ?? 0),
                              ) * Math.log(10),
                            ) - 1,
                          )}
                          bufferAudio={1}
                          bufferVideo={1}
                          max={1}
                          onStartDragging={() => {
                            setForcedVolumeWidth("100px !important");
                            setForcedVolumePadding("0px 8px");
                          }}
                          onEndDragging={(newCurrent) => {
                            if (!context.internal.targetControllerRef.current)
                              return;
                            setForcedVolumeWidth("0px");
                            setForcedVolumePadding("0px");
                            context.internal.muted.set(false);
                            //const val = Math.exp(Math.log(2) * (Math.exp(Math.log(2) * newCurrent) - 1)) - 1;
                            const val =
                              1 -
                              Math.exp(
                                Math.log(1 - Math.abs(newCurrent)) /
                                  Math.log(10),
                              );
                            //Math.abs(Math.exp(Math.log(1 - val) * Math.log(10)) - 1);
                            context.internal.volume.set(val);
                            context.internal.targetControllerRef.current.volume =
                              val;
                          }}
                        />
                      </Box>
                    </Box>
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                    >
                      <Typography
                        sx={(theme) => ({
                          color: "white",
                          [theme.breakpoints.down("sm")]: {
                            fontSize: "12px",
                          },
                        })}
                      >
                        {`${Time.parseTimeDuration(
                          context.internal.currentPosition.value /
                            processedSpeed,
                        )} / ${Time.parseTimeDuration(
                          context.internal.maxDuration.value / processedSpeed,
                        )}`}
                      </Typography>
                    </Box>
                    <div style={{ flex: 1 }} />
                    {context.internal.playerData.value.files.subtitles !==
                    null ? (
                      <ThemedTooltip title="Subtitles" placement="top">
                        <IconButton
                          style={{
                            color: "white",
                          }}
                          onClick={() => {
                            subtitleSync(!isSubtitlesEnabled);
                            setSubtitlesEnabled(!isSubtitlesEnabled);
                          }}
                        >
                          {isSubtitlesEnabled ? (
                            <SubtitlesIcon />
                          ) : (
                            <SubtitlesOffIcon />
                          )}
                        </IconButton>
                      </ThemedTooltip>
                    ) : undefined}
                    <ThemedTooltip title="Loop" placement="top">
                      <IconButton
                        style={{ color: "white" }}
                        onClick={() => {
                          context.internal.singleLoop.set(
                            !context.internal.singleLoop.value,
                          );
                        }}
                      >
                        {context.internal.singleLoop.value ? (
                          <RepeatOneIcon />
                        ) : (
                          <RepeatIcon />
                        )}
                      </IconButton>
                    </ThemedTooltip>
                    {context.internal.playerData.value.files.audio !== null ? (
                      <ThemedTooltip title="Toggle video" placement="top">
                        <IconButton
                          style={{ color: "white" }}
                          onClick={() => {
                            context.internal.audioOnly.set(
                              !context.internal.audioOnly.value,
                            );
                          }}
                        >
                          {context.internal.audioOnly.value ? (
                            <MovieIcon />
                          ) : (
                            <HeadphonesIcon />
                          )}
                        </IconButton>
                      </ThemedTooltip>
                    ) : undefined}
                    <IconButton
                      style={{ color: "white" }}
                      onClick={async () => {
                        try {
                          await document.exitFullscreen();
                        } catch {
                          await document.body.requestFullscreen();
                        }
                      }}
                    >
                      {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                    </IconButton>
                  </Box>
                  <Box
                    sx={(theme) => ({
                      // width: "100%",
                      padding:
                        hideControls && !fullscreen ? 0 : theme.spacing(0, 2),
                      marginBottom: hideControls && !fullscreen ? "9px" : 0,
                      opacity: hideControls && !fullscreen ? 0.25 : 1,
                      pointerEvents:
                        hideControls && !fullscreen ? "none" : undefined,
                      transition: theme.transitions.create([
                        "margin-bottom",
                        "padding",
                        "opacity",
                      ]),
                    })}
                  >
                    <ProgressBar
                      current={context.internal.currentPosition.value}
                      bufferAudio={
                        context.internal.audioOnly.value
                          ? context.internal.audioBuffer.value
                          : null
                      }
                      bufferVideo={
                        context.internal.audioOnly.value
                          ? null
                          : context.internal.videoBuffer.value
                      }
                      max={context.internal.maxDuration.value}
                      onStartDragging={() => {}}
                      factor={processedSpeed}
                      main
                      chapters={context.internal.chapters.value}
                      heatmap={context.internal.heatmap.value}
                      minimized={hideControls}
                      onEndDragging={(newCurrent) => {
                        if (context.internal.audioOnly.value) {
                          if (context.internal.refAudio.current)
                            context.internal.refAudio.current.currentTime =
                              newCurrent;
                        } else if (
                          context.internal.targetControllerRef.current
                        ) {
                          context.internal.syncAll(
                            newCurrent,
                            context.internal.playing.value,
                          );
                        }
                      }}
                    />
                  </Box>
                </Box>
              </>
            ) : undefined}
          </Box>
        </>
      )}

      <Popover
        open={showContextMenu}
        onClose={() => {
          setShowContextMenu(false);
        }}
        anchorReference="anchorPosition"
        anchorPosition={{
          top: contextMenuPosition.y,
          left: contextMenuPosition.x,
        }}
        anchorOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        sx={{
          zIndex: 2147483647 + 1,
        }}
        onContextMenu={(event) => event.stopPropagation()}
      >
        <Paper
          sx={(theme) => ({
            padding: theme.spacing(1),
            display: "flex",
            flexDirection: "column",
          })}
        >
          <Typography variant="h5">Video Options</Typography>
          <hr style={{ width: "100%" }} />

          <Button
            startIcon={<InfoIcon />}
            onClick={() => {
              setHideVideoErrors(!hideVideoErrors);
            }}
            sx={{ justifyContent: "left" }}
          >
            {`${hideVideoErrors ? "Show" : "Hide"} Errors`}
          </Button>
          <Button
            startIcon={
              context.internal.singleLoop.value ? (
                <RepeatOneIcon />
              ) : (
                <RepeatIcon />
              )
            }
            onClick={() => {
              context.internal.singleLoop.set(
                !context.internal.singleLoop.value,
              );
            }}
            sx={{ justifyContent: "left" }}
          >
            Toggle Loop
          </Button>
          <Button
            startIcon={
              context.internal.muted.value ? (
                <VolumeOffIcon />
              ) : (
                <VolumeUpIcon />
              )
            }
            onClick={() => {
              context.internal.muted.set(!context.internal.muted.value);
            }}
            sx={{ justifyContent: "left" }}
          >
            Toggle Mute
          </Button>
          {context.internal.playerData.value?.files.audio !== null ? (
            <>
              <hr style={{ width: "100%" }} />
              <Button
                startIcon={
                  context.internal.audioOnly.value ? (
                    <MovieIcon />
                  ) : (
                    <HeadphonesIcon />
                  )
                }
                onClick={() => {
                  context.internal.audioOnly.set(
                    !context.internal.audioOnly.value,
                  );
                }}
                sx={{ justifyContent: "left" }}
              >
                Toggle Audio Only
              </Button>
              <Button
                startIcon={
                  isSubtitlesEnabled ? <SubtitlesIcon /> : <SubtitlesOffIcon />
                }
                onClick={() => {
                  subtitleSync(!isSubtitlesEnabled);
                  setSubtitlesEnabled(!isSubtitlesEnabled);
                }}
                sx={{
                  justifyContent: "left",
                  display:
                    context.internal.playerData.value?.files.subtitles
                      ?.length === undefined
                      ? "none"
                      : undefined,
                }}
              >
                Toggle Subtitles
              </Button>
            </>
          ) : undefined}
          <hr style={{ width: "100%" }} />
          <Button
            startIcon={fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            onClick={async () => {
              try {
                await document.exitFullscreen();
              } catch {
                await document.body.requestFullscreen();
              }
            }}
            sx={{ justifyContent: "left" }}
          >
            Toggle Fullscreen
          </Button>
        </Paper>
      </Popover>
    </Box>
  );
}

//#endregion

export { VideoPlayer };
