//#region Imports

import FastForwardIcon from "@mui/icons-material/FastForward";
import FastRewindIcon from "@mui/icons-material/FastRewind";

import OndemandVideoIcon from "@mui/icons-material/OndemandVideo";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RepeatIcon from "@mui/icons-material/Repeat";
import RepeatOneIcon from "@mui/icons-material/RepeatOne";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import { Button, Link, Typography } from "@mui/material";
import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import type { PropsWithChildren } from "react";
import { useState } from "react";

import type { JSX } from "react/jsx-runtime";
import { DEFAULT_MAX_DURATION } from "./globals";
import { ProgressBar } from "./ProgressBar";
import { usePlayer } from "./usePlayer";

//#endregion

//#region MiniPlayer.tsx

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
  if (!context.internal.miniPlayer.value) return <div />;
  const isOpenAndAllowed = isOpen && context.internal.miniPlayerVisible.value;
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
          maxHeight: isOpenAndAllowed ? "400px" : "64px",
          transition:
            "max-height 250ms ease-out, background 125ms, bottom 250ms",
          height: "100%",
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
          <Button
            onClick={() => {
              if (!context.internal.playerData.value) return;
              context.internal.navigate(context.internal.playerData.value);
            }}
            sx={{ width: "140px" }}
            endIcon={<OndemandVideoIcon />}
          >
            Resume
          </Button>
        </Box>

        <Box>
          <ProgressBar
            current={context.internal.currentPosition.value}
            bufferAudio={context.internal.audioBuffer.value}
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
                  if (
                    context.internal.playerData.value?.files.audio ===
                    video.files.audio
                  ) {
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
                  if (
                    context.internal.playerData.value?.files.audio ===
                    video.files.audio
                  ) {
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
          <Link
            sx={{
              overflow: "hidden",
              minHeight: "20px",
            }}
            // href={context.internal.playerData.value, playlistMeta}
          >
            <Typography>
              Resume: {context.internal.playerData.value.title}
            </Typography>
          </Link>
        ) : undefined}
        {children}
      </Box>
    </>
  );
}

//#endregion

export { MiniPlayer };
