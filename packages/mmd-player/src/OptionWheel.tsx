//#region Imports

import CameraswitchIcon from "@mui/icons-material/Cameraswitch";
import FaceIcon from "@mui/icons-material/Face";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SwitchAccountIcon from "@mui/icons-material/SwitchAccount";
import TuneIcon from "@mui/icons-material/Tune";
import { Box, IconButton } from "@mui/material";
import { type RefObject, useEffect, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { type MMDLoadDetails, type MMDPlayer, playOrRestart } from "./config";

//#endregion

//#region OptionWheel.tsx

/** Smallest distance from the wheel's centre to each button, in pixels. Grows with more items so buttons don't overlap. */
const minRadius = 64;
const buttonSize = 56;
const buttonGap = 8;
/** How long a touch must be held to open the wheel, in milliseconds. */
const longPressTime = 500;
/** A touch that moves further than this, in pixels, is a drag, not a long press. */
const longPressSlop = 10;

/** One button of the wheel. Without `onClick` it shows as an empty, disabled button. */
type WheelAction = {
  label: string;
  icon?: JSX.Element;
  onClick?: () => void;
  /** Close the wheel after a click. Otherwise it stays open, so the button can be pressed again. */
  selfClosing?: boolean;
};

/** Focuses the next slot with a loaded character, and points the camera at it. */
const focusNextModel = (details: MMDLoadDetails) => {
  const slots = [...Array(details.maxModelFocus).keys()].filter(
    (i) => details.modelMorph[i],
  );
  if (!slots.length) return;
  details.focusedModel =
    slots[(slots.indexOf(details.focusedModel) + 1) % slots.length]!;
  details.refocusModel();
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/**
 * The player's wheel, clockwise from the top: next camera, Morphs panel,
 * play/pause, next character and Tools panel.
 */
function usePlayerWheelActions(
  player: MMDPlayer,
  panels: { onMorphs: () => void; onTools: () => void },
): WheelAction[] {
  const { MMDLoadDetails } = player;
  const runtime = MMDLoadDetails.controller.musicRuntime;
  const [playing, setPlaying] = useState(runtime?.isAnimationPlaying ?? false);

  useEffect(() => {
    if (!runtime) return;
    const onPlay = runtime.onPlayAnimationObservable.add(() =>
      setPlaying(true),
    );
    const onPause = runtime.onPauseAnimationObservable.add(() =>
      setPlaying(false),
    );
    return () => {
      runtime.onPlayAnimationObservable.remove(onPlay);
      runtime.onPauseAnimationObservable.remove(onPause);
    };
  }, [runtime]);

  return [
    {
      label: "Next camera (C)",
      icon: <CameraswitchIcon />,
      onClick: () => MMDLoadDetails.nextCamera(),
    },
    {
      label: "Morphs (M)",
      icon: <FaceIcon />,
      onClick: panels.onMorphs,
      selfClosing: true,
    },
    {
      label: playing ? "Pause (K)" : "Play (K)",
      icon: playing ? <PauseIcon /> : <PlayArrowIcon />,
      onClick: () =>
        runtime?.isAnimationPlaying
          ? runtime.pauseAnimation()
          : runtime && playOrRestart(runtime),
    },
    {
      label: "Next character",
      icon: <SwitchAccountIcon />,
      onClick: () => focusNextModel(MMDLoadDetails),
    },
    {
      label: "Tools (T)",
      icon: <TuneIcon />,
      onClick: panels.onTools,
      selfClosing: true,
    },
  ];
}

/**
 * A wheel of buttons that opens where the scene is right-clicked or
 * long-pressed. The buttons are spread evenly around it, the first at the top
 * and the rest clockwise. It stays open until clicked outside, so a button can
 * be pressed several times. Not while the mouse is locked, as its buttons
 * couldn't be clicked. Render it once the scene is built.
 */
function OptionWheel(props: {
  /** The player's root element, holding `canvas.mmd-render`. */
  root: RefObject<HTMLElement | null>;
  actions: WheelAction[];
}): JSX.Element | null {
  const { root, actions } = props;
  /** Where the wheel opened, and the player's size then. */
  const [opened, setOpened] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    const rootElement = root.current;
    const canvas =
      rootElement?.querySelector<HTMLCanvasElement>("canvas.mmd-render");
    if (!rootElement || !canvas) return;
    const open = (clientX: number, clientY: number) => {
      const rect = rootElement.getBoundingClientRect();
      setOpened({
        x: clientX - rect.left,
        y: clientY - rect.top,
        width: rect.width,
        height: rect.height,
      });
    };
    let timer = 0;
    let touchStart: { x: number; y: number } | null = null;
    /** Ids of the fingers on the screen. A long press only counts with one. */
    const touches = new Set<number>();
    const cancelLongPress = () => {
      window.clearTimeout(timer);
      touchStart = null;
    };
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (!document.pointerLockElement && touches.size <= 1)
        open(event.clientX, event.clientY);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      touches.add(event.pointerId);
      if (touches.size > 1) return cancelLongPress();
      const start = { x: event.clientX, y: event.clientY };
      touchStart = start;
      timer = window.setTimeout(() => open(start.x, start.y), longPressTime);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (
        touchStart &&
        Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) >
          longPressSlop
      )
        cancelLongPress();
    };
    const onPointerUp = (event: PointerEvent) => {
      touches.delete(event.pointerId);
      cancelLongPress();
    };
    const listeners = [
      ["contextmenu", onContextMenu],
      ["pointerdown", onPointerDown],
      ["pointermove", onPointerMove],
      ["pointerup", onPointerUp],
      ["pointercancel", onPointerUp],
    ] as const;
    for (const [type, listener] of listeners)
      canvas.addEventListener(type, listener as EventListener);
    return () => {
      cancelLongPress();
      for (const [type, listener] of listeners)
        canvas.removeEventListener(type, listener as EventListener);
    };
  }, [root]);

  if (!opened) return null;
  const close = () => setOpened(null);
  const radius = Math.max(
    minRadius,
    (actions.length * (buttonSize + buttonGap)) / (2 * Math.PI),
  );
  const margin = radius + buttonSize / 2;
  const centerX = clamp(opened.x, margin, opened.width - margin);
  const centerY = clamp(opened.y, margin, opened.height - margin);

  return (
    <Box
      onPointerDown={close}
      onContextMenu={(event) => {
        event.preventDefault();
        close();
      }}
      sx={{ position: "absolute", inset: 0, zIndex: 130 }}
    >
      {actions.map((action, i) => {
        const angle = (2 * Math.PI * i) / actions.length;
        return (
          <IconButton
            key={i}
            aria-label={action.label}
            title={action.label}
            disabled={!action.onClick}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              action.onClick?.();
              if (action.selfClosing) close();
            }}
            sx={(theme) => ({
              position: "absolute",
              left: centerX + Math.sin(angle) * radius,
              top: centerY - Math.cos(angle) * radius,
              width: buttonSize,
              height: buttonSize,
              transform: "translate(-50%, -50%)",
              color: "common.white",
              bgcolor: "rgba(18, 18, 18, 0.88)",
              border: 1,
              borderColor: "divider",
              animation: `${theme.transitions.duration.shorter}ms ease-out wheel-in`,
              "@keyframes wheel-in": {
                from: { opacity: 0, scale: 0.6 },
              },
              "&:hover": { bgcolor: "rgba(48, 48, 48, 0.95)" },
              "&.Mui-disabled": { bgcolor: "rgba(18, 18, 18, 0.6)" },
            })}
          >
            {action.icon}
          </IconButton>
        );
      })}
    </Box>
  );
}

//#endregion

export type { WheelAction };

export { OptionWheel, usePlayerWheelActions };
