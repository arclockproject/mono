//#region Imports

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Slide,
  Stack,
  Typography,
} from "@mui/material";
import type { TransitionProps } from "@mui/material/transitions";
import React from "react";
import type { JSX } from "react/jsx-runtime";

//#endregion

//#region ExplainControlsDialog.tsx

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

/** Input → what it does, per section. */
const controls: { title: string; rows: [string, string][] }[] = [
  {
    title: "Panels",
    rows: [
      ["T", "Tools panel"],
      ["M", "Morphs panel"],
      ["/", "Search morphs (↑ ↓ to pick, Enter to toggle)"],
      ["H", "This help"],
      ["Esc", "Close panels"],
      ["F", "Fullscreen"],
      ["Move mouse / tap", "Show the top and bottom bars"],
    ],
  },
  {
    title: "Playback",
    rows: [
      ["K", "Play / pause"],
      ["J / L", "Back / forward 5s"],
      ["[ / ]", "Slower / faster"],
      ["0", "Normal speed"],
      ["Ctrl + Scroll", "Change speed"],
    ],
  },
  {
    title: "Camera",
    rows: [
      ["C / Middle click", "Next camera type"],
      ["Right click / long press", "Option wheel"],
      ["Double click", "Look around with the mouse"],
      ["W A S D", "Fly"],
      ["Space / E", "Fly up"],
      ["Shift / Q", "Fly down"],
      ["Scroll", "Change fly speed"],
      ["Scroll (Caps Lock)", "Fly forward / back"],
      ["- / =", "Shorter / longer view distance"],
    ],
  },
];

/** The player's keyboard, mouse and touch controls. */
function ExplainControlsDialog(props: {
  open: boolean;
  onClose: () => void;
}): JSX.Element {
  return (
    <Dialog
      open={props.open}
      slots={{
        transition: Transition,
      }}
      disablePortal
      keepMounted
      onClose={props.onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Controls</DialogTitle>
      <DialogContent dividers>
        <Stack direction={{ xs: "column", sm: "row" }} gap={3}>
          {controls.map((section) => (
            <Stack key={section.title} flex={1} gap={0.5}>
              <Typography variant="overline" color="text.secondary">
                {section.title}
              </Typography>
              {section.rows.map(([input, action]) => (
                <Stack
                  key={input}
                  direction="row"
                  gap={1}
                  alignItems="baseline"
                >
                  <Box
                    sx={{
                      flexShrink: 0,
                      px: 0.75,
                      borderRadius: 1,
                      border: 1,
                      borderColor: "currentColor",
                      fontFamily: "monospace",
                      fontSize: "0.8rem",
                    }}
                  >
                    {input}
                  </Box>
                  <Typography variant="body2">{action}</Typography>
                </Stack>
              ))}
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

//#endregion

export { ExplainControlsDialog };
