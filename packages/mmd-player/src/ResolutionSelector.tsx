//#region Imports

import {
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
} from "@mui/material";
import { useEffect, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { MMDLoadDetails } from "./config";
import { updateCanvasResolution } from "./Mmd";

//#endregion

//#region ResolutionSelector.tsx

/**
 * @private
 */
type validResolution = {
  label: string;
  height: () => number;
  width: () => number;
  ratio: number | "auto";
};

const validResolutions: validResolution[] = [
  {
    label: "Screen Size",
    width: () => window.screen.availWidth,
    height: () => window.screen.availHeight,
    ratio: "auto",
  },
  {
    label: "Screen Size / 1.5",
    width: () => Math.floor(window.screen.availWidth / 1.5),
    height: () => Math.floor(window.screen.availHeight / 1.5),
    ratio: "auto",
  },
  {
    label: "4k",
    width: () => 3840,
    height: () => 2160,
    ratio: 16 / 9,
  },
  {
    label: "1440p",
    width: () => 2560,
    height: () => 1440,
    ratio: 16 / 9,
  },
  {
    label: "1080p",
    width: () => 1920,
    height: () => 1080,
    ratio: 16 / 9,
  },
  {
    label: "SteamDeck",
    width: () => 1280,
    height: () => 800,
    ratio: 16 / 10,
  },
  {
    label: "720p",
    width: () => 1280,
    height: () => 720,
    ratio: 16 / 9,
  },
  {
    label: "480p",
    width: () => 854,
    height: () => 480,
    ratio: 16 / 9,
  },
  {
    label: "360p",
    width: () => 640,
    height: () => 360,
    ratio: 16 / 9,
  },
  {
    label: "240p",
    width: () => 426,
    height: () => 240,
    ratio: 16 / 9,
  },
];
const ResolutionSelector = (): JSX.Element => {
  const [minimizedResolution, setMinimizedResolution] = useState(
    MMDLoadDetails.resolutions.normal,
  );
  const [fullscreenResolution, setFullscreenResolution] = useState(
    MMDLoadDetails.resolutions.fullscreen,
  );
  return (
    <Box>
      <FormControlLabel
        control={
          <Switch
            defaultChecked={MMDLoadDetails.resolutions.swappedAspectRatio}
          />
        }
        label="Swapped AspectRatio"
        onChange={() => {
          MMDLoadDetails.resolutions.swappedAspectRatio =
            !MMDLoadDetails.resolutions.swappedAspectRatio;
          updateCanvasResolution();
        }}
      />
      <br />
      <FormControl sx={{ m: 1, minWidth: 250 }}>
        <InputLabel id="resolution-selector-min-label">
          Minimized Resolution
        </InputLabel>
        <Select
          labelId="resolution-selector-min-label"
          id="resolution-selector-min"
          value={minimizedResolution}
          label="Minimized Resolution"
          onChange={({ target: { value } }) => {
            setMinimizedResolution(value);
            MMDLoadDetails.resolutions.normal = value;
            updateCanvasResolution();
          }}
        >
          {validResolutions.map((resolution, i) => (
            <MenuItem value={i} key={resolution.label}>
              {resolution.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <br />
      <FormControl sx={{ m: 1, minWidth: 250 }}>
        <InputLabel id="resolution-selector-max-label">
          Fullscreen Resolution
        </InputLabel>
        <Select
          labelId="resolution-selector-max-label"
          id="resolution-selector-max"
          value={fullscreenResolution}
          label="Fullscreen Resolution"
          onChange={({ target: { value } }) => {
            setFullscreenResolution(value);
            MMDLoadDetails.resolutions.fullscreen = value;
            updateCanvasResolution();
          }}
        >
          {validResolutions.map((resolution, i) => (
            <MenuItem value={i} key={resolution.label}>
              {resolution.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

//#endregion

export type { validResolution };

export { ResolutionSelector, validResolutions };
