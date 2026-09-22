//#region Imports

import { Box, Button, InputAdornment, TextField } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { MMDLoadDetails, overlay90 } from "./config";

//#endregion

//#region ControlsDrawer.tsx

function ControlsDrawer(props: {
  ready: boolean;
  toggleMobile: () => void;
}): JSX.Element {
  const [isHidden, setHidden] = useState(true);
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: props.ready ? "flex" : "none",
        position: "absolute",
        left: isHidden ? "-300px" : 0,
        transition: theme.transitions.create(["left"]),
        top: "50px",
        bottom: 0,
        margin: "auto",
        height: "calc(100% - 50px)",
        zIndex: 100,
        gap: "8px",
        maxHeight: "600px",
        width: "300px",
        flexDirection: "column",
        background: overlay90,
      }}
    >
      <Button
        variant="contained"
        color="info"
        sx={{
          right: isHidden ? "-60px" : 0,
          justifyContent: isHidden ? "right" : undefined,
          transition: theme.transitions.create(["right"]),
        }}
        onClick={() => {
          setHidden(!isHidden);
        }}
      >
        {isHidden ? `>` : "Hide panel"}
      </Button>
      <div
        style={{
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* <Button
        onClick={() => {
          const scene = MMDLoadDetails.controller.scene;
          if (scene) scene.gravity.y = scene.gravity.y === 0 ? -98 : 0;
        }}
      >
        Toggle Gravity
      </Button> */}
        <Button id="toggle-cameras" style={{ padding: "8px", margin: "8px" }}>
          Toggle Cameras
        </Button>

        <Button
          onClick={() => {
            //   const canvasRoot = document.querySelector<HTMLCanvasElement>(
            //     "div#mmd-render-root"
            //   )!;
            const canvas =
              document.querySelector<HTMLCanvasElement>("canvas#mmd-render")!;
            const widthOffset = window.screen.orientation.type.startsWith(
              "landscape",
            )
              ? -50
              : 0;
            const heightOffset = window.screen.orientation.type.startsWith(
              "landscape",
            )
              ? 0
              : -50;
            if (document.fullscreenElement) {
              canvas.width = window.screen.availWidth + widthOffset;
              canvas.height = window.screen.availHeight + heightOffset;
            } else {
              canvas.width = window.screen.availWidth / 1.5;
              canvas.height = window.screen.availHeight / 1.5;
            }
          }}
          style={{ padding: "8px", margin: "8px" }}
        >
          Force Mobile
        </Button>
        <Button
          onClick={() => {
            document
              .querySelectorAll<HTMLSpanElement>(
                "#mmd-render-root > div:nth-child(1) > div:nth-child(5) > div:nth-child(1) > div:nth-child(2) > div:nth-child(1) > span",
              )
              .forEach((e) => {
                e.style.display = "none";
              });
            // const canvasRoot = document.querySelector<HTMLCanvasElement>("div#mmd-render-root")!;
            // const canvas = document.querySelector<HTMLCanvasElement>("canvas#mmd-render")!;
            // const widthOffset = window.screen.orientation.type.startsWith("landscape") ? -400 : 0;
            // const heightOffset = window.screen.orientation.type.startsWith("landscape") ? 0 : -400;
            // if (document.fullscreenElement) {
            //   canvasRoot.style.width = window.screen.availWidth * 4 + widthOffset + "px";
            //   canvasRoot.style.height = window.screen.availHeight * 4 + heightOffset + "px";
            //   canvas.width = window.screen.availWidth * 4 + widthOffset;
            //   canvas.height = window.screen.availHeight * 4 + heightOffset;
            // } else {
            //   canvasRoot.style.width = (window.screen.availWidth * 4) / 1.5 + widthOffset + "px";
            //   canvasRoot.style.height = (window.screen.availHeight * 4) / 1.5 + heightOffset + "px";
            //   canvas.width = (window.screen.availWidth * 4) / 1.5 + widthOffset;
            //   canvas.height = (window.screen.availHeight * 4) / 1.5 + heightOffset;
            // }
          }}
          style={{ padding: "8px", margin: "8px" }}
        >
          Hide Time
        </Button>
        <Button
          onClick={() => {
            document
              .querySelector<HTMLButtonElement>(
                "#mmd-render-root > div:nth-child(1) > div:nth-child(5) > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > button:nth-child(3)",
              )
              ?.click();
          }}
          style={{ padding: "8px", margin: "8px" }}
        >
          Go FullScreen
        </Button>
        <div style={{ display: "flex" }}>
          <Button
            sx={{ flex: 1, padding: "16px" }}
            fullWidth
            onClick={() => {
              MMDLoadDetails.zCamOffset.y -= 2;
            }}
          >
            Lower
          </Button>
          <Button
            sx={{ flex: 1, padding: "16px" }}
            fullWidth
            onClick={() => {
              MMDLoadDetails.zCamOffset.y += 2;
            }}
          >
            Higher
          </Button>
        </div>
        <div style={{ display: "flex" }}>
          <Button
            sx={{ flex: 1, padding: "16px" }}
            fullWidth
            onClick={() => {
              MMDLoadDetails.zCamOffset.x -= 2;
            }}
          >
            Left
          </Button>
          <Button
            sx={{ flex: 1, padding: "16px" }}
            fullWidth
            onClick={() => {
              MMDLoadDetails.zCamOffset.x += 2;
            }}
          >
            right
          </Button>
        </div>
        <div style={{ display: "flex" }}>
          <Button
            sx={{ flex: 1, padding: "16px" }}
            fullWidth
            onClick={() => {
              MMDLoadDetails.zCamOffset.z -= 2;
            }}
          >
            Back
          </Button>
          <Button
            sx={{ flex: 1, padding: "16px" }}
            fullWidth
            onClick={() => {
              MMDLoadDetails.zCamOffset.z += 2;
            }}
          >
            Forward
          </Button>
        </div>
        <div style={{ display: "flex" }}>
          <Button
            sx={{ flex: 1, padding: "16px" }}
            fullWidth
            onClick={() => {
              if (MMDLoadDetails.controller.directionalLight)
                MMDLoadDetails.controller.directionalLight.intensity = 1;
              if (MMDLoadDetails.controller.hemisphericLight)
                MMDLoadDetails.controller.hemisphericLight.intensity = 0;
            }}
          >
            Enable DirectLight
          </Button>
          <Button
            sx={{ flex: 1, padding: "16px" }}
            fullWidth
            onClick={() => {
              if (MMDLoadDetails.controller.directionalLight)
                MMDLoadDetails.controller.directionalLight.intensity = 0;
              if (MMDLoadDetails.controller.hemisphericLight)
                MMDLoadDetails.controller.hemisphericLight.intensity = 1;
            }}
          >
            Disable DirectLight
          </Button>
        </div>

        <TextField
          sx={{ minWidth: "150px", background: "white", mt: 1 }}
          variant="outlined"
          id="model-offset-input"
          label="Model Offset"
          defaultValue={0}
          type="number"
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!Number.isNaN(val))
              MMDLoadDetails.controller.frameOffset.model = val;
          }}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">frame</InputAdornment>
              ),
            },
          }}
        />
        <TextField
          sx={{ minWidth: "150px", background: "white", mt: 1 }}
          variant="outlined"
          id="camera-offset-input"
          label="Camera Offset"
          defaultValue={0}
          type="number"
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!Number.isNaN(val))
              MMDLoadDetails.controller.frameOffset.camera = val;
          }}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">frame</InputAdornment>
              ),
            },
          }}
        />
        <div style={{ display: "flex" }} className="auto-item-tick-time">
          <span></span>
        </div>
      </div>
    </Box>
  );
}

//#endregion

export { ControlsDrawer };
