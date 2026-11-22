//#region Imports

import BugReportIcon from "@mui/icons-material/BugReport";
import CloseIcon from "@mui/icons-material/Close";
import FaceIcon from "@mui/icons-material/Face";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import TuneIcon from "@mui/icons-material/Tune";
import { Box, IconButton, Typography } from "@mui/material";
import {
  type PointerEvent,
  type PointerEventHandler,
  useEffect,
  useRef,
  useState,
} from "react";
import type { JSX } from "react/jsx-runtime";
import type { MMDPlayer } from "./config";

//#endregion

//#region PlayerOverlay.tsx

/** How long the bars stay after the last mouse move or tap, in milliseconds. */
const hideAfter = 3000;
/** The bars stay while the mouse is this close to the top or bottom, in pixels. */
const topBarHeight = 64;
const bottomBarHeight = 120;
/** A touch that moves less than `tapDistance` pixels within `tapTime` milliseconds is a tap. */
const tapDistance = 10;
const tapTime = 300;

type AutoHide = {
  visible: boolean;
  show: () => void;
  /** Spread on the player's root element. */
  handlers: Record<
    "onPointerMove" | "onPointerLeave" | "onPointerDown" | "onPointerUp",
    PointerEventHandler
  >;
};

const isVideo = (event: PointerEvent) =>
  (event.target as Element).matches("canvas.mmd-render");

/**
 * Shows the top bar and babylon-mmd's bottom bar on mouse move or touch, and
 * hides both after `hideAfter` with no activity. A tap on the video toggles
 * them, so touch screens can hide them too.
 *
 * @param active Only react while the scene is playing.
 * @returns Whether the bars are shown, handlers for the player's root element,
 * and `show()` to show them from code (e.g. a shortcut).
 */
function useAutoHide(player: MMDPlayer, active: boolean): AutoHide {
  const [visible, setVisible] = useState(false);
  const timer = useRef(0);
  /** Last mouse position over the player, `null` when the mouse left it. */
  const mouseY = useRef<number | null>(null);
  const touchStart = useRef<{ x: number; y: number; time: number }>(null);

  const setBars = (show: boolean) => {
    window.clearTimeout(timer.current);
    if (show) timer.current = window.setTimeout(hideIfIdle, hideAfter);
    setVisible(show);
  };
  // Like babylon-mmd's own bar: stay while the mouse rests on a bar.
  const hideIfIdle = () => {
    const rect = player.root.current?.getBoundingClientRect();
    const y = mouseY.current;
    setBars(
      !!rect &&
        y !== null &&
        (y - rect.top < topBarHeight || rect.bottom - y < bottomBarHeight),
    );
  };

  useEffect(() => {
    setBars(active);
    return () => window.clearTimeout(timer.current);
  }, [active]);

  return {
    visible,
    show: () => setBars(true),
    handlers: {
      onPointerMove: (event) => {
        // Looking around with a locked mouse isn't a request for the bars.
        if (!active || event.pointerType !== "mouse") return;
        if (document.pointerLockElement) return;
        mouseY.current = event.clientY;
        setBars(true);
      },
      onPointerLeave: () => {
        mouseY.current = null;
      },
      onPointerDown: (event) => {
        if (!active || event.pointerType === "mouse") return;
        touchStart.current = {
          x: event.clientX,
          y: event.clientY,
          time: event.timeStamp,
        };
        // Touching a control keeps the bars up while it's used.
        if (!isVideo(event)) setBars(true);
      },
      onPointerUp: (event) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (!start || !isVideo(event)) return;
        const moved = Math.hypot(
          event.clientX - start.x,
          event.clientY - start.y,
        );
        if (moved < tapDistance && event.timeStamp - start.time < tapTime)
          setBars(!visible);
      },
    },
  };
}

/**
 * The bar along the top of a playing player. `.flight-speed` holds the camera
 * and playback status, written by SceneBuilderSplit.
 */
function TopBar(props: {
  visible: boolean;
  onTools: () => void;
  onMorphs: () => void;
  onHelp: () => void;
  /** Leave out to hide the Debug button. */
  onDebug?: () => void;
  onExit: () => void;
}): JSX.Element {
  const button = (label: string, onClick: () => void, icon: JSX.Element) => (
    <IconButton
      color="inherit"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {icon}
    </IconButton>
  );
  const rightButtons = props.onDebug ? 4 : 3;
  return (
    <>
      <Box
        sx={(theme) => ({
          position: "absolute",
          inset: "0 0 auto",
          zIndex: 110,
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          pt: 0.5,
          pb: 3,
          color: "common.white",
          background: "linear-gradient(rgba(0, 0, 0, 0.6), transparent)",
          opacity: props.visible ? 1 : 0,
          transform: props.visible ? "none" : "translateY(-50%)",
          visibility: props.visible ? "visible" : "hidden",
          transition: theme.transitions.create([
            "opacity",
            "transform",
            "visibility",
          ]),
        })}
      >
        {button("Tools (T)", props.onTools, <TuneIcon />)}
        <Box sx={{ flex: 1 }} />
        {button("Morphs (M)", props.onMorphs, <FaceIcon />)}
        {button("Controls (H)", props.onHelp, <KeyboardIcon />)}
        {props.onDebug && button("Debug", props.onDebug, <BugReportIcon />)}
        {button("Exit player", props.onExit, <CloseIcon />)}
      </Box>
      <Typography
        variant="body2"
        noWrap
        className="flight-speed"
        sx={(theme) => ({
          position: "absolute",
          top: 4,
          left: 52,
          right: rightButtons * 44 + 8,
          zIndex: 111,
          lineHeight: "40px",
          color: "common.white",
          textShadow: "0 1px 3px rgba(0, 0, 0, 0.8)",
          pointerEvents: "none",
          opacity: props.visible ? 0.85 : 0,
          transition: theme.transitions.create("opacity"),
        })}
      />
    </>
  );
}

//#endregion

export { TopBar, useAutoHide };
