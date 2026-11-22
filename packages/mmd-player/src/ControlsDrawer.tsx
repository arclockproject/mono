//#region Imports

import {
  Button,
  ButtonGroup,
  FormControlLabel,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import type { JSX } from "react/jsx-runtime";
import type { MMDPlayer } from "./config";
import { SidePanel } from "./SidePanel";

//#endregion

//#region ControlsDrawer.tsx

/** Camera buttons: the axis they move along, and the labels for − and +. */
const cameraMoves = [
  ["y", "Lower", "Higher"],
  ["x", "Left", "Right"],
  ["z", "Back", "Forward"],
] as const;

/**
 * Toggles fullscreen on the player, so the bars and panels stay visible.
 * Turns it off if anything is fullscreen.
 */
const toggleFullscreen = (root: HTMLElement | null): void => {
  if (document.fullscreenElement) document.exitFullscreen();
  else root?.requestFullscreen();
};

function Section(props: { title: string; children: ReactNode }): JSX.Element {
  return (
    <Stack gap={1} sx={{ px: 2, py: 1.5 }}>
      <Typography variant="overline" color="text.secondary" lineHeight={1.5}>
        {props.title}
      </Typography>
      {props.children}
    </Stack>
  );
}

/** A number field in frames. Ignores input that isn't a number. */
function FrameField(props: {
  label: string;
  value: number;
  onChange: (frames: number) => void;
}): JSX.Element {
  return (
    <TextField
      size="small"
      type="number"
      defaultValue={props.value}
      label={props.label}
      onChange={(e) => {
        const frames = parseInt(e.target.value, 10);
        if (!Number.isNaN(frames)) props.onChange(frames);
      }}
      slotProps={{
        input: {
          endAdornment: <InputAdornment position="end">frames</InputAdornment>,
        },
      }}
    />
  );
}

/** The left "Tools" panel: camera, lighting, sync and display options. */
function ControlsDrawer(props: {
  ready: boolean;
  open: boolean;
  onClose: () => void;
  player: MMDPlayer;
}): JSX.Element {
  const { MMDLoadDetails, root } = props.player;
  const { controller } = MMDLoadDetails;
  const moveCamera = (axis: "x" | "y" | "z", by: number) => {
    MMDLoadDetails.zCamOffset[axis] += by;
  };
  const setDirectLight = (on: boolean) => {
    MMDLoadDetails.directLight = on;
    if (controller.directionalLight)
      controller.directionalLight.intensity = on ? 1 : 0;
    if (controller.hemisphericLight)
      controller.hemisphericLight.intensity = on ? 0 : 1;
  };
  const forceMobileResolution = () => {
    const canvas =
      root.current!.querySelector<HTMLCanvasElement>("canvas.mmd-render")!;
    const landscape = window.screen.orientation.type.startsWith("landscape");
    const { availWidth, availHeight } = window.screen;
    if (root.current!.contains(document.fullscreenElement)) {
      canvas.width = availWidth + (landscape ? -50 : 0);
      canvas.height = availHeight + (landscape ? 0 : -50);
    } else {
      canvas.width = availWidth / 1.5;
      canvas.height = availHeight / 1.5;
    }
  };
  return (
    <SidePanel
      side="left"
      title="Tools"
      maxWidth={300}
      open={props.ready && props.open}
      onClose={props.onClose}
    >
      <Section title="Camera">
        {/* Its text and click handler are set by SceneBuilderSplit. */}
        <Button className="toggle-cameras" variant="contained">
          Toggle Cameras
        </Button>
        <Typography variant="caption" color="text.secondary">
          Position relative to the focused character
        </Typography>
        {cameraMoves.map(([axis, less, more]) => (
          <ButtonGroup key={axis} fullWidth size="small">
            <Button onClick={() => moveCamera(axis, -2)}>{less}</Button>
            <Button onClick={() => moveCamera(axis, 2)}>{more}</Button>
          </ButtonGroup>
        ))}
      </Section>
      <Section title="Lighting">
        <ButtonGroup fullWidth size="small">
          <Button onClick={() => setDirectLight(true)}>Direct light</Button>
          <Button onClick={() => setDirectLight(false)}>Ambient light</Button>
        </ButtonGroup>
      </Section>
      <Section title="Sync">
        <FrameField
          label="Model offset"
          value={controller.frameOffset.model}
          onChange={(frames) => {
            controller.frameOffset.model = frames;
          }}
        />
        <FrameField
          label="Camera offset"
          value={controller.frameOffset.camera}
          onChange={(frames) => {
            controller.frameOffset.camera = frames;
          }}
        />
        <FormControlLabel
          label="Loop"
          control={
            <Switch
              defaultChecked={MMDLoadDetails.loop}
              onChange={(_, on) => {
                MMDLoadDetails.loop = on;
              }}
            />
          }
        />
      </Section>
      <Section title="Display">
        <Button
          variant="outlined"
          size="small"
          onClick={() => toggleFullscreen(root.current)}
        >
          Fullscreen
        </Button>
        <Button variant="outlined" size="small" onClick={forceMobileResolution}>
          Force mobile resolution
        </Button>
        {/* Frame time, written by SceneBuilderSplit. */}
        <Typography
          variant="caption"
          color="text.secondary"
          className="auto-item-tick-time"
        >
          <span></span>
        </Typography>
      </Section>
    </SidePanel>
  );
}

//#endregion

export { ControlsDrawer, toggleFullscreen };
