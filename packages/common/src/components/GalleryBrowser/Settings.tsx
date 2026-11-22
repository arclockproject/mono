import CloseIcon from "@mui/icons-material/Close";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import type React from "react";
import type { JSX } from "react/jsx-runtime";

/**
 * Where content sits when it doesn't fill its box.
 */
export type Alignment = {
  /** `1` left, `0` center, `-1` right. */
  x: number;
  /** `1` top, `0` center, `-1` bottom. */
  y: number;
};

const isStep = (value: unknown): value is number =>
  value === -1 || value === 0 || value === 1;

/** Reads a stored `Alignment`, or `undefined` if it isn't one. */
export const parseAlignment = (value: unknown): Alignment | undefined => {
  if (typeof value !== "object" || value === null) return undefined;
  const { x, y } = value as { x?: unknown; y?: unknown };
  return isStep(x) && isStep(y) ? { x, y } : undefined;
};

/** `Alignment.x` as a CSS position keyword. */
export const horizontal = (x: number): "left" | "right" | "center" =>
  x === 1 ? "left" : x === -1 ? "right" : "center";
/** `Alignment.y` as a CSS position keyword. */
export const vertical = (y: number): "top" | "bottom" | "center" =>
  y === 1 ? "top" : y === -1 ? "bottom" : "center";

/**
 * A settings panel that slides in from the right edge of its positioned
 * parent. Taps on it don't count as taps on a `Reader` or `GalleryBrowser`.
 */
export function SettingsPanel(props: {
  open: boolean;
  onClose: () => void;
  /** Stacking order, so it sits above the parent's bars. */
  zIndex: number;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <Stack
      role="region"
      aria-label="Settings"
      data-reader-no-tap
      data-gallery-no-tap
      sx={(theme) => ({
        position: "absolute",
        top: 0,
        bottom: 0,
        right: 0,
        zIndex: props.zIndex,
        width: "100%",
        maxWidth: 340,
        color: "text.primary",
        bgcolor: "rgba(18, 18, 18, 0.88)",
        backdropFilter: "blur(6px)",
        transform: props.open ? "none" : "translateX(100%)",
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
        }}
      >
        <Typography variant="subtitle1" sx={{ flex: 1 }}>
          Settings
        </Typography>
        <IconButton aria-label="Close settings" onClick={props.onClose}>
          <CloseIcon />
        </IconButton>
      </Stack>
      <Stack sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {props.children}
      </Stack>
    </Stack>
  );
}

/**
 * A titled group of settings in a `SettingsPanel`.
 */
export function Section(props: {
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <Stack gap={1} sx={{ px: 2, py: 1.5 }}>
      <Typography variant="overline" color="text.secondary" lineHeight={1.5}>
        {props.title}
      </Typography>
      {props.children}
    </Stack>
  );
}

/**
 * A 3×3 grid of buttons to pick an `Alignment`.
 */
export function AlignmentPicker(props: {
  align: Alignment;
  setAlign: (alignment: Alignment) => void;
  /** Accessible name of the grid. */
  label: string;
}): JSX.Element {
  const name = (x: number, y: number) =>
    x === 0 && y === 0
      ? "Center"
      : `${vertical(y) === "center" ? "" : vertical(y)} ${horizontal(x) === "center" ? "" : horizontal(x)}`.trim();
  return (
    <Box
      role="radiogroup"
      aria-label={props.label}
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 36px)",
        gap: 0.5,
        p: 0.5,
        width: "fit-content",
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
      }}
    >
      {[1, 0, -1].flatMap((y) =>
        [1, 0, -1].map((x) => {
          const selected = props.align.x === x && props.align.y === y;
          return (
            <Box
              key={`${x},${y}`}
              component="button"
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={name(x, y)}
              title={name(x, y)}
              onClick={() => props.setAlign({ x, y })}
              sx={(theme) => ({
                width: 36,
                height: 36,
                p: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                borderRadius: 0.5,
                cursor: "pointer",
                background: selected
                  ? theme.palette.primary.main
                  : "transparent",
                "&:hover": {
                  background: selected
                    ? theme.palette.primary.main
                    : theme.palette.action.hover,
                },
                "&::after": {
                  content: '""',
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: selected
                    ? theme.palette.primary.contrastText
                    : theme.palette.text.disabled,
                },
              })}
            />
          );
        }),
      )}
    </Box>
  );
}
