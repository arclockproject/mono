//#region Imports

import KeyboardIcon from "@mui/icons-material/Keyboard";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  Slide,
  Stack,
  Typography,
} from "@mui/material";
import type { TransitionProps } from "@mui/material/transitions";
//#region Imports
import React, { useState } from "react";
import type { JSX } from "react/jsx-runtime";

//#endregion

//#region ExplainControlsButton.tsx

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

function ExplainControlsButton(): JSX.Element {
  const [open, setOpen] = useState(false);

  const handleClickOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return (
    <>
      <Button
        variant="outlined"
        onClick={handleClickOpen}
        sx={{ top: "40px", right: 0, position: "absolute" }}
        startIcon={<KeyboardIcon />}
      >
        Controls
      </Button>
      <Dialog
        open={open}
        slots={{
          transition: Transition,
        }}
        disablePortal
        keepMounted
        onClose={handleClose}
        maxWidth="lg"
      >
        <DialogContent>
          <Typography variant="h5">
            <strong>Controls</strong>
          </Typography>
          <Divider />
          <Stack direction="row">
            <Stack flex={1}>
              <Typography variant="h6">Keyboard</Typography>
              <Typography>
                <code>J</code>: -5s
              </Typography>
              <Typography>
                <code>K</code>: Play/Pause
              </Typography>
              <Typography>
                <code>L</code>: +5s
              </Typography>
              <Typography>
                <code>[</code>: Lower Playback speed
              </Typography>
              <Typography>
                <code>]</code>: Increase Playback speed
              </Typography>
              <Typography>
                <code>0</code>: Reset Playback to 1x
              </Typography>
              <Typography>
                <code>O</code>: Toggle between auto-camera and manual-camera
              </Typography>
              <Typography>
                <code>-</code>: Decrease View Distance
              </Typography>
              <Typography>
                <code>=</code>: Increase View Distance
              </Typography>
              <Typography>
                <code>F</code>: Decrease camera fly speed
              </Typography>
              <Typography>
                <code>R</code>: Increase camera fly speed
              </Typography>
            </Stack>
            <Stack flex={1}>
              <Typography variant="h6">Mouse</Typography>
              <Typography>
                <code>DoubleClick</code>: Control the mouse
              </Typography>
              <Typography>
                <code>Right Click</code>: Toggle between camera types
              </Typography>
              <Typography>
                <code>Scroll</code>: Alter camera fly speed
              </Typography>
              <Typography>
                <code>Scroll (CapsLock ON)</code>: Fly forward/backwards
              </Typography>
              <Typography>
                <code>Scroll + CTRL</code>: Alter Playback speed
              </Typography>
            </Stack>
          </Stack>
          <Divider />
          <Typography variant="h5">
            <Typography variant="h6">Interface</Typography>
            <Typography>
              <code>Left Drawer</code>: Generic Utilities such as
              switching/moving cameras.
            </Typography>
            <Typography>
              <code>Right Drawer</code>: Toggle morphs per model and move/rotate
              individual models.
            </Typography>
            <Typography>
              <code>Bottom Player</code>: Change play speed, volume, video
              progress or just toggle fullscreen.
            </Typography>
            <Typography>
              <code>KILL Button</code>: Stops the player and returns to main
              menu.
            </Typography>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

//#endregion

export { ExplainControlsButton };
