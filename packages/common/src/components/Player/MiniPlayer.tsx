//#region Imports

import AddIcon from "@mui/icons-material/Add";
import FastForwardIcon from "@mui/icons-material/FastForward";
import FastRewindIcon from "@mui/icons-material/FastRewind";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import MusicOffIcon from "@mui/icons-material/MusicOff";
import OndemandVideoIcon from "@mui/icons-material/OndemandVideo";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RemoveIcon from "@mui/icons-material/Remove";
import RepeatIcon from "@mui/icons-material/Repeat";
import RepeatOneIcon from "@mui/icons-material/RepeatOne";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import { Button, Link, Typography } from "@mui/material";
import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import type { PropsWithChildren } from "react";
import { Children, useEffect, useState } from "react";

import type { JSX } from "react/jsx-runtime";
import { DEFAULT_MAX_DURATION, SPEED_MAX, SPEED_MIN } from "./globals";
import { ProgressBar } from "./ProgressBar";
import { usePlayer } from "./usePlayer";

//#endregion

//#region MiniPlayer.tsx

/**
 * Small player bar fixed to the bottom-right of the screen, with playback
 * controls and a progress bar. When `PlayerContextProvider` has a `navigate`
 * prop, it also has a "Resume" button that calls it.
 * Clicking it opens a larger panel, as tall as its content up to 400px.
 * `children` (e.g. a playlist) go at the bottom and scroll once it is full.
 * When they don't fit, an expand button lets the panel grow to the full
 * screen height. Closing the panel collapses it again.
 * Shown while `usePlayer().internal.miniPlayer` is `true`. Must be inside
 * `PlayerContextProvider`.
 *
 * @see {@link https://arclockproject.org/docs/common/components/Player Guide} | {@link https://arclockproject.org/docs/api/common/components/Player API}
 */
function MiniPlayer({ children }: PropsWithChildren): JSX.Element {
  const context = usePlayer();
  const [isOpen, setOpen] = useState(false);
  //   useEffect(() => {
  //     if (
  //       // /**Player ALLOWED */ &&
  //       context.internal.playing.value &&
  //       context.internal.settings.value.allowMiniPlayer
  //     ) {
  //       context.internal.miniPlayer.set(true);
  //       //   } else if (/**Player NOT ALLOWED */) {
  //       //     context.internal.miniPlayer.set(false);
  //     } else if (context.internal.playing.value) {
  //       context.internal.playing.set(false);
  //     }
  //   }, [context.internal.playerData.value?.id, context.internal.playing.value]);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const [childrenBox, setChildrenBox] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);
  useEffect(() => {
    const content = childrenBox?.firstElementChild;
    if (!childrenBox || !content) {
      setOverflowing(false);
      return;
    }
    const measure = () =>
      setOverflowing(content.scrollHeight > childrenBox.clientHeight + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(childrenBox);
    observer.observe(content);
    measure();
    return () => observer.disconnect();
  }, [childrenBox]);
  if (!context.internal.miniPlayer.value) return <div />;
  const isOpenAndAllowed = isOpen && context.internal.miniPlayerVisible.value;
  const isExpanded = isOpenAndAllowed && expanded;
  const hasChildren = Children.toArray(children).length > 0;
  const canResume =
    context.internal.canNavigate && !!context.internal.playerData.value;
  const resume = () => {
    if (!context.internal.playerData.value) return;
    context.internal.navigate(context.internal.playerData.value);
  };
  return (
    <>
      <Backdrop
        sx={{ zIndex: (theme) => theme.zIndex.drawer }}
        open={isOpenAndAllowed}
        onClick={() => {
          setOpen(false);
        }}
      />
      <Box
        sx={(theme) => ({
          position: "fixed",
          bottom: context.internal.miniPlayerVisible.value ? 0 : "-100px",
          right: 0,
          maxWidth: "400px",
          width: "100%",
          maxHeight: isExpanded
            ? "100dvh"
            : isOpenAndAllowed
              ? "400px"
              : "64px",
          transition:
            "max-height 250ms ease-out, background 125ms, bottom 250ms",
          height: "auto",
          overflow: "hidden",
          background: isOpenAndAllowed
            ? theme.palette.background.default
            : theme.palette.background.paper,
          padding: theme.spacing(1, 1, 0, 1),
          borderTopLeftRadius: "16px",
          borderTopRightRadius: "16px",
          display: "flex",
          flexDirection: "column",
          gap: theme.spacing(1),
          zIndex: theme.zIndex.drawer + 1,
        })}
      >
        <Box sx={{ display: "flex" }}>
          <Button onClick={() => setOpen(!isOpen)} fullWidth>
            MiniPlayer
          </Button>
          {isOpenAndAllowed && hasChildren && (overflowing || expanded) ? (
            <IconButton
              aria-label={expanded ? "Collapse" : "Expand"}
              title={expanded ? "Collapse" : "Expand"}
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <UnfoldLessIcon /> : <UnfoldMoreIcon />}
            </IconButton>
          ) : null}
          {canResume ? (
            <Button
              onClick={resume}
              sx={{ width: "140px" }}
              endIcon={<OndemandVideoIcon />}
            >
              Resume
            </Button>
          ) : null}
        </Box>

        <Box>
          <ProgressBar
            current={context.internal.currentPosition.value}
            bufferAudio={
              context.internal.audioControlled
                ? context.internal.audioBuffer.value
                : context.internal.videoBuffer.value
            }
            bufferVideo={null}
            max={context.internal.maxDuration.value}
            onStartDragging={() => {}}
            onEndDragging={(newCurrent) => {
              if (isOpenAndAllowed)
                context.internal.syncAll(
                  newCurrent,
                  context.internal.playing.value,
                );
            }}
          />
        </Box>
        <Box
          sx={(theme) => ({
            width: "100%",
            display: "flex",
            flexDirection: "row",
            gap: theme.spacing(1),
          })}
        >
          {context.internal.playlistContent.value.length > 1 ? (
            <IconButton
              onClick={() => {
                let currentID = 0;
                for (
                  let i = 0;
                  i < context.internal.playlistContent.value.length;
                  i++
                ) {
                  const video = context.internal.playlistContent.value[i]!;
                  if (context.internal.playerData.value?.id === video.id) {
                    currentID = i;
                  }
                }
                const previous =
                  currentID === 0
                    ? context.internal.playlistContent.value.length - 1
                    : currentID - 1;
                const videoData =
                  context.internal.playlistContent.value[previous]!;
                context.internal.playerData.set(videoData);

                context.internal.touchHistory(videoData);
              }}
            >
              <FastRewindIcon />
            </IconButton>
          ) : undefined}
          <IconButton
            onClick={() => {
              context.internal.playing.set(!context.internal.playing.value);
            }}
          >
            {context.internal.playing.value ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>

          {context.internal.playlistContent.value.length > 1 ? (
            <IconButton
              onClick={() => {
                let currentID = 0;
                for (
                  let i = 0;
                  i < context.internal.playlistContent.value.length;
                  i++
                ) {
                  const video = context.internal.playlistContent.value[i]!;
                  if (context.internal.playerData.value?.id === video.id) {
                    currentID = i;
                  }
                }
                const next =
                  currentID ===
                  context.internal.playlistContent.value.length - 1
                    ? 0
                    : currentID + 1;
                const videoData = context.internal.playlistContent.value[next]!;
                context.internal.playerData.set(videoData);
                if (context.internal.playerData.value !== videoData)
                  context.internal.maxDuration.set(DEFAULT_MAX_DURATION);
                context.internal.touchHistory(videoData);
              }}
            >
              <FastForwardIcon />
            </IconButton>
          ) : undefined}
          <div style={{ flex: 1 }} />
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton
              size="small"
              aria-label="Slower"
              title="Slower"
              onClick={() =>
                context.internal.playSpeed.set(
                  Math.max(SPEED_MIN, context.internal.playSpeed.value - 0.06),
                )
              }
            >
              <RemoveIcon fontSize="small" />
            </IconButton>
            <Box
              role="button"
              aria-label="Reset speed"
              title="Reset speed"
              onClick={() => context.internal.playSpeed.set(1)}
              sx={{
                cursor: "pointer",
                fontSize: 14,
                fontVariantNumeric: "tabular-nums",
                minWidth: "44px",
                textAlign: "center",
              }}
            >
              {`${context.internal.playSpeed.value.toFixed(2)}×`}
            </Box>
            <IconButton
              size="small"
              aria-label="Faster"
              title="Faster"
              onClick={() =>
                context.internal.playSpeed.set(
                  Math.min(SPEED_MAX, context.internal.playSpeed.value + 0.06),
                )
              }
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
          <IconButton
            aria-label={
              context.internal.distortAudio.value
                ? "Pitch shift on"
                : "Pitch shift off"
            }
            title={
              context.internal.distortAudio.value
                ? "Pitch shift on"
                : "Pitch shift off"
            }
            aria-pressed={context.internal.distortAudio.value}
            onClick={() =>
              context.internal.distortAudio.set(
                !context.internal.distortAudio.value,
              )
            }
          >
            {context.internal.distortAudio.value ? (
              <MusicNoteIcon />
            ) : (
              <MusicOffIcon />
            )}
          </IconButton>
          <IconButton
            onClick={() => {
              context.internal.muted.set(!context.internal.muted.value);
            }}
          >
            {context.internal.muted.value ? (
              <VolumeOffIcon />
            ) : (
              <VolumeUpIcon />
            )}
          </IconButton>
          <IconButton
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
        </Box>
        {context.internal.playerData.value ? (
          canResume ? (
            <Link
              component="button"
              onClick={resume}
              sx={{
                overflow: "hidden",
                minHeight: "20px",
                textAlign: "left",
              }}
            >
              <Typography noWrap>
                Resume: {context.internal.playerData.value.title}
              </Typography>
            </Link>
          ) : (
            <Typography noWrap sx={{ minHeight: "20px" }}>
              {context.internal.playerData.value.title}
            </Typography>
          )
        ) : undefined}
        {hasChildren ? (
          <Box
            ref={setChildrenBox}
            sx={{ flex: "0 1 auto", minHeight: 0, overflowY: "auto", pb: 1 }}
          >
            <div>{children}</div>
          </Box>
        ) : null}
      </Box>
    </>
  );
}

//#endregion

export { MiniPlayer };
