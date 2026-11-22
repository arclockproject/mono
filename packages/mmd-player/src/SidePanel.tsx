//#region Imports

import CloseIcon from "@mui/icons-material/Close";
import { IconButton, Stack, Typography } from "@mui/material";
import type { PropsWithChildren } from "react";
import type { JSX } from "react/jsx-runtime";

//#endregion

//#region SidePanel.tsx

const background = "rgba(18, 18, 18, 0.88)";

/**
 * A panel that slides in over the player from the left or right edge. When
 * closed it is off screen and hidden, so it doesn't cover the video or take
 * keyboard focus.
 */
function SidePanel(
  props: PropsWithChildren<{
    open: boolean;
    onClose: () => void;
    side: "left" | "right";
    title: string;
    /** Widest the panel gets, in pixels. On narrow players it fills the width. */
    maxWidth: number;
    /** Drop the background below the header, to see the scene behind the panel. */
    transparent?: boolean;
  }>,
): JSX.Element {
  const offScreen = props.side === "left" ? "-100%" : "100%";
  return (
    <Stack
      role="region"
      aria-label={props.title}
      sx={(theme) => ({
        position: "absolute",
        top: 0,
        bottom: 0,
        [props.side]: 0,
        zIndex: 120,
        width: "100%",
        maxWidth: props.maxWidth,
        color: "text.primary",
        bgcolor: props.transparent ? undefined : background,
        backdropFilter: props.transparent ? undefined : "blur(6px)",
        transform: props.open ? "none" : `translateX(${offScreen})`,
        visibility: props.open ? "visible" : "hidden",
        transition: theme.transitions.create(["transform", "visibility"]),
      })}
    >
      <Stack
        direction="row"
        alignItems="center"
        sx={{
          pl: 2,
          pr: 0.5,
          minHeight: 48,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: background,
        }}
      >
        <Typography variant="subtitle1" sx={{ flex: 1 }}>
          {props.title}
        </Typography>
        <IconButton aria-label={`Close ${props.title}`} onClick={props.onClose}>
          <CloseIcon />
        </IconButton>
      </Stack>
      <Stack sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {props.children}
      </Stack>
    </Stack>
  );
}

//#endregion

export { SidePanel };
