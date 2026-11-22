//#region Imports

import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import { Box, Button, IconButton, Slider, Typography } from "@mui/material";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { toggleFullscreen } from "./ControlsDrawer";
import { type MMDPlayer, playOrRestart } from "./config";

//#endregion

//#region PlaybackBar.tsx

/** `m:ss`, like babylon-mmd's bar. Frames are 30 per second. */
const formatTime = (frames: number) => {
  if (!Number.isFinite(frames)) return "-:--";
  const seconds = Math.floor(frames / 30);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/**
 * A button with a slider that slides out next to it. The slider shows on mouse
 * hover, on keyboard focus, or while `open` is set.
 */
function Reveal(props: {
  button: ReactNode;
  slider: ReactNode;
  open?: boolean;
}) {
  const shown = { width: 96, opacity: 1, px: 1.5 };
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        "&:hover .reveal, &:has(:focus-visible) .reveal": shown,
      }}
    >
      {props.button}
      <Box
        className="reveal"
        sx={(theme) => ({
          display: "flex",
          overflow: "hidden",
          width: 0,
          opacity: 0,
          transition: theme.transitions.create(["width", "opacity", "padding"]),
          ...(props.open && shown),
        })}
      >
        {props.slider}
      </Box>
    </Box>
  );
}

/**
 * The bottom playback bar: time, play/pause, volume, speed and fullscreen.
 * Replaces babylon-mmd's own bar and changes the scene the same way. Render it
 * once the scene is built, so the runtime and audio player exist.
 */
function PlaybackBar(props: {
  player: MMDPlayer;
  visible: boolean;
}): JSX.Element {
  const { MMDLoadDetails, root } = props.player;
  const runtime = MMDLoadDetails.controller.musicRuntime;
  const audio = MMDLoadDetails.controller.audioPlayer;

  const [frame, setFrame] = useState(runtime?.currentFrameTime ?? 0);
  const [total, setTotal] = useState(runtime?.animationFrameTimeDuration ?? 0);
  const [playing, setPlaying] = useState(runtime?.isAnimationPlaying ?? false);
  const [muted, setMuted] = useState(audio?.muted ?? false);
  const [volume, setVolume] = useState(audio?.volume ?? 1);
  const [speed, setSpeed] = useState(runtime?.timeScale ?? 1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement);

  /** While dragging the time slider, ticks don't move it. */
  const dragging = useRef(false);
  /** Paused by the drag, so play again when it ends. */
  const resumeAfterDrag = useRef(false);
  const visible = useRef(props.visible);
  visible.current = props.visible;
  const shownFrame = useRef(frame);

  useEffect(() => {
    if (!runtime) return;
    /** Redraws only when the slider would visibly move or the shown second changes. */
    const sync = (force = false) => {
      if (dragging.current || (!force && !visible.current)) return;
      const now = runtime.currentFrameTime;
      const last = shownFrame.current;
      const step = Math.max(1, runtime.animationFrameTimeDuration / 500);
      if (
        force ||
        Math.abs(now - last) >= step ||
        Math.floor(now / 30) !== Math.floor(last / 30)
      ) {
        shownFrame.current = now;
        setFrame(now);
      }
    };
    sync(true);
    const observers = [
      [runtime.onAnimationTickObservable, () => sync()],
      [runtime.onPlayAnimationObservable, () => setPlaying(true)],
      [runtime.onPauseAnimationObservable, () => setPlaying(false)],
      [
        runtime.onAnimationDurationChangedObservable,
        () => setTotal(runtime.animationFrameTimeDuration),
      ],
      ...(audio
        ? ([
            [audio.onMuteStateChangedObservable, () => setMuted(audio.muted)],
            [
              audio.onPlaybackRateChangedObservable,
              () => setSpeed(audio.playbackRate),
            ],
          ] as const)
        : []),
    ] as const;
    const added = observers.map(([observable, fn]) => observable.add(fn));
    const onFullscreen = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      observers.forEach(([observable], i) => {
        observable.remove(added[i]!);
      });
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [runtime, audio]);

  useEffect(() => {
    if (props.visible && runtime) {
      shownFrame.current = runtime.currentFrameTime;
      setFrame(runtime.currentFrameTime);
    }
  }, [props.visible]);

  return (
    <Box
      sx={(theme) => ({
        position: "absolute",
        inset: "auto 0 0",
        zIndex: 110,
        px: 1,
        pt: 3,
        color: "common.white",
        background: "linear-gradient(transparent, rgba(0, 0, 0, 0.6))",
        opacity: props.visible ? 1 : 0,
        transform: props.visible ? "none" : "translateY(50%)",
        visibility: props.visible ? "visible" : "hidden",
        transition: theme.transitions.create([
          "opacity",
          "transform",
          "visibility",
        ]),
      })}
    >
      <Slider
        aria-label="Time"
        size="small"
        min={0}
        max={total || 1}
        value={frame}
        onChange={(_, value) => {
          if (!runtime) return;
          if (!dragging.current) {
            dragging.current = true;
            resumeAfterDrag.current = runtime.isAnimationPlaying;
            if (resumeAfterDrag.current) runtime.pauseAnimation();
          }
          runtime.seekAnimation(value, true);
          setFrame(value);
        }}
        onChangeCommitted={() => {
          dragging.current = false;
          shownFrame.current = runtime?.currentFrameTime ?? 0;
          if (resumeAfterDrag.current) runtime?.playAnimation();
          resumeAfterDrag.current = false;
        }}
        sx={{ display: "block", py: 1, color: "common.white" }}
      />
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <IconButton
          color="inherit"
          aria-label={playing ? "Pause" : "Play"}
          onClick={() =>
            runtime?.isAnimationPlaying
              ? runtime.pauseAnimation()
              : runtime && playOrRestart(runtime)
          }
        >
          {playing ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>
        {audio && (
          <Reveal
            button={
              <IconButton
                color="inherit"
                aria-label={muted ? "Unmute" : "Mute"}
                onClick={() => (audio.muted ? audio.unmute() : audio.mute())}
              >
                {muted ? <VolumeOffIcon /> : <VolumeUpIcon />}
              </IconButton>
            }
            slider={
              <Slider
                aria-label="Volume"
                size="small"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(_, value) => {
                  audio.volume = value;
                  setVolume(value);
                }}
                sx={{ color: "common.white" }}
              />
            }
          />
        )}
        <Typography
          variant="body2"
          noWrap
          sx={{
            flex: 1,
            minWidth: 0,
            ml: 0.5,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatTime(frame)} / {formatTime(total)}
        </Typography>
        <Reveal
          open={speedOpen}
          button={
            <Button
              color="inherit"
              aria-label="Speed"
              aria-expanded={speedOpen}
              onClick={() => setSpeedOpen(!speedOpen)}
              sx={{ minWidth: 0, fontVariantNumeric: "tabular-nums" }}
            >
              {speed.toFixed(2)}x
            </Button>
          }
          slider={
            <Slider
              aria-label="Speed"
              size="small"
              min={0.07}
              max={2}
              step={0.01}
              value={speed}
              onChange={(_, value) => {
                if (runtime) runtime.timeScale = value;
                MMDLoadDetails.playbackRate = value;
                setSpeed(value);
              }}
              sx={{ color: "common.white" }}
            />
          }
        />
        <IconButton
          color="inherit"
          aria-label={fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
          onClick={() => toggleFullscreen(root.current)}
        >
          {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
        </IconButton>
      </Box>
    </Box>
  );
}

//#endregion

export { PlaybackBar };
