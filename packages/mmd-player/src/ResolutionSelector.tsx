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
import { useId, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import type { MMDPlayer } from "./config";
import { updateCanvasResolution } from "./Mmd";

//#endregion

//#region ResolutionSelector.tsx

const ResolutionSelector = ({ player }: { player: MMDPlayer }): JSX.Element => {
  const { MMDLoadDetails } = player;
  const id = useId();
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
          updateCanvasResolution(player);
        }}
      />
      <br />
      <FormControl sx={{ m: 1, minWidth: 250 }}>
        <InputLabel id={`${id}-resolution-selector-min-label`}>
          Minimized Resolution
        </InputLabel>
        <Select
          labelId={`${id}-resolution-selector-min-label`}
          id={`${id}-resolution-selector-min`}
          value={minimizedResolution}
          label="Minimized Resolution"
          onChange={({ target: { value } }) => {
            setMinimizedResolution(value);
            MMDLoadDetails.resolutions.normal = value;
            updateCanvasResolution(player);
          }}
        >
          {player.resolutions.map((resolution, i) => (
            <MenuItem value={i} key={resolution.label}>
              {resolution.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <br />
      <FormControl sx={{ m: 1, minWidth: 250 }}>
        <InputLabel id={`${id}-resolution-selector-max-label`}>
          Fullscreen Resolution
        </InputLabel>
        <Select
          labelId={`${id}-resolution-selector-max-label`}
          id={`${id}-resolution-selector-max`}
          value={fullscreenResolution}
          label="Fullscreen Resolution"
          onChange={({ target: { value } }) => {
            setFullscreenResolution(value);
            MMDLoadDetails.resolutions.fullscreen = value;
            updateCanvasResolution(player);
          }}
        >
          {player.resolutions.map((resolution, i) => (
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

export { ResolutionSelector };
