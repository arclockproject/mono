import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { type PropsWithChildren, useRef } from "react";
import type { JSX } from "react/jsx-runtime";

const overlay90 = "rgba(39, 39, 39, 0.9)";
const overlayFull = "rgba(39, 39, 39, 1)";

export default function Window(
  props: PropsWithChildren<{
    title?: string;
    open?: boolean;
    onClose?: () => void;
    onFocus?: () => void;
    onContextMenu?: (
      event: React.MouseEvent<HTMLDivElement, MouseEvent>,
    ) => void;
    noClose?: boolean;
    minWidth?: number;
    minHeight?: number;
    spawnCoordinate?: {
      x: number;
      y: number;
    };
    spawnSize?: {
      width: number;
      height: number;
    };
  }>,
): JSX.Element {
  const windowRef = useRef<HTMLDivElement>(null);
  const minWidth = props.minWidth ?? 200;
  const minHeight = props.minHeight ?? 200;
  const spawnCoordinate = props.spawnCoordinate ?? {
    x: 100,
    y: 100,
  };
  const spawnSize = props.spawnSize ?? {
    width: 300,
    height: 300,
  };
  const locationMemory = useRef({
    x: spawnCoordinate.x,
    y: spawnCoordinate.y,
  });
  const expandArea = 30;
  const expandInnerArea = 10;

  return (
    <Box
      ref={windowRef}
      sx={{
        display: props.open ? undefined : "none",
        height: `${spawnSize.height}px`,
        width: `${spawnSize.width}px`,
        position: "fixed",
        top: `${spawnCoordinate.y}px`,
        left: `${spawnCoordinate.x}px`,
        zIndex: 10,
        borderRadius: "16px",
        backdropFilter: "blur(20px)",
        background: overlay90,
      }}
      onTouchStart={props.onFocus}
      onMouseDown={props.onFocus}
    >
      <Box
        sx={{
          position: "relative",
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          sx={{
            height: "50px",
            display: "flex",
            flexDirection: "row",
            gap: 1,
            background: overlayFull,
            justifyContent: "center",
            alignItems: "center",
            p: 1,
            borderTopLeftRadius: "16px",
            borderTopRightRadius: "16px",
            cursor: "move",
          }}
          onContextMenu={props.onContextMenu}
          onMouseDown={(initialEvent) => {
            if (initialEvent.button !== 0) return;
            initialEvent.preventDefault();
            const windowHolder = (
              initialEvent.currentTarget.parentElement as HTMLDivElement
            ).parentElement as HTMLDivElement;
            const mousemove = (event: MouseEvent) => {
              const plannedY = event.clientY - initialEvent.nativeEvent.layerY;
              const plannedX = event.clientX - initialEvent.nativeEvent.layerX;
              const clappedY = Math.max(
                0,
                Math.min(
                  plannedY,
                  window.innerHeight - windowHolder.clientHeight,
                ),
              );
              const clappedX = Math.max(
                0,
                Math.min(
                  plannedX,
                  window.innerWidth - windowHolder.clientWidth,
                ),
              );
              windowHolder.style.top = `${clappedY}px`;
              windowHolder.style.left = `${clappedX}px`;
              locationMemory.current.y = clappedY;
              locationMemory.current.x = clappedX;
            };
            const mouseup = () => {
              document.removeEventListener("mousemove", mousemove);
              document.removeEventListener("mouseup", mouseup);
            };
            document.addEventListener("mousemove", mousemove);
            document.addEventListener("mouseup", mouseup);
          }}
          onTouchStart={(initialEvent) => {
            initialEvent.preventDefault();
            initialEvent.stopPropagation();
            const windowHolder = (
              initialEvent.currentTarget.parentElement as HTMLDivElement
            ).parentElement as HTMLDivElement;
            console.log(initialEvent.nativeEvent.touches);
            const offsetY =
              initialEvent.nativeEvent.touches[0]!.clientY -
              windowHolder.offsetTop;
            const offsetX =
              initialEvent.nativeEvent.touches[0]!.clientX -
              windowHolder.offsetLeft;
            const mousemove = (event: TouchEvent) => {
              event.preventDefault();
              const plannedY = event.touches[0]!.clientY - offsetY;
              const plannedX = event.touches[0]!.clientX - offsetX;
              const clappedY = Math.max(
                0,
                Math.min(
                  plannedY,
                  window.innerHeight - windowHolder.clientHeight,
                ),
              );
              const clappedX = Math.max(
                0,
                Math.min(
                  plannedX,
                  window.innerWidth - windowHolder.clientWidth,
                ),
              );
              windowHolder.style.top = `${clappedY}px`;
              windowHolder.style.left = `${clappedX}px`;
              locationMemory.current.y = clappedY;
              locationMemory.current.x = clappedX;
            };
            const mouseup = () => {
              document.removeEventListener("touchmove", mousemove);
              document.removeEventListener("touchend", mouseup);
            };
            document.addEventListener("touchmove", mousemove);
            document.addEventListener("touchend", mouseup);
          }}
        >
          <Typography sx={{ flex: 1 }}>{props.title}</Typography>
          <Button
            onMouseDown={(initialEvent) => {
              if (initialEvent.button !== 0) return;
              initialEvent.stopPropagation();
            }}
            onClick={(event) => {
              if (!windowRef.current) return;
              const isMaximized = windowRef.current.style.inset === "0px";
              if (!isMaximized) {
                windowRef.current.style.inset = "0px";
                windowRef.current.style.minWidth = "100%";
                windowRef.current.style.minHeight = "100%";
                event.currentTarget.innerText = "_";
              } else {
                windowRef.current.style.inset = "";
                windowRef.current.style.minWidth = "";
                windowRef.current.style.minHeight = "";
                windowRef.current.style.left = `${locationMemory.current.x}px`;
                windowRef.current.style.top = `${locationMemory.current.y}px`;
                event.currentTarget.innerText = "[ ]";
              }
            }}
            sx={{ p: 1 }}
            variant="outlined"
          >
            {`[ ]`}
          </Button>
          <Button
            onMouseDown={(initialEvent) => {
              if (initialEvent.button !== 0) return;
              initialEvent.stopPropagation();
            }}
            onClick={props.onClose}
            sx={{
              p: 1,
              display: props.noClose ? "none" : undefined,
            }}
            color="error"
            variant="contained"
          >
            X
          </Button>
        </Box>
        <Box
          sx={{
            p: 1,
            flex: 1,
            overflow: "auto",
            overscrollBehavior: "contain",
          }}
        >
          {props.children}
        </Box>
        <Box
          sx={{
            height: `${expandArea}px`,
            left: 0,
            right: 0,
            bottom: `-${expandArea - expandInnerArea}px`,
            position: "absolute",
            cursor: "n-resize",
          }}
          onMouseDown={(initialEvent) => {
            if (initialEvent.button !== 0) return;
            initialEvent.preventDefault();
            const windowHolder = (
              initialEvent.currentTarget.parentElement as HTMLDivElement
            ).parentElement as HTMLDivElement;
            const mousemove = (event: MouseEvent) => {
              windowHolder.style.height = `${Math.max(minHeight, event.clientY - windowHolder.offsetTop)}px`;
            };
            const mouseup = () => {
              document.removeEventListener("mousemove", mousemove);
              document.removeEventListener("mouseup", mouseup);
            };
            document.addEventListener("mousemove", mousemove);
            document.addEventListener("mouseup", mouseup);
          }}
        />
        <Box
          sx={{
            width: `${expandArea}px`,
            top: 0,
            right: `-${expandArea - expandInnerArea}px`,
            bottom: 0,
            position: "absolute",
            cursor: "w-resize",
          }}
          onMouseDown={(initialEvent) => {
            if (initialEvent.button !== 0) return;
            initialEvent.preventDefault();
            const windowHolder = (
              initialEvent.currentTarget.parentElement as HTMLDivElement
            ).parentElement as HTMLDivElement;
            const mousemove = (event: MouseEvent) => {
              windowHolder.style.width = `${Math.max(minWidth, event.clientX - windowHolder.offsetLeft)}px`;
            };
            const mouseup = () => {
              document.removeEventListener("mousemove", mousemove);
              document.removeEventListener("mouseup", mouseup);
            };
            document.addEventListener("mousemove", mousemove);
            document.addEventListener("mouseup", mouseup);
          }}
        />
        <Box
          sx={{
            width: `${expandArea}px`,
            height: `${expandArea}px`,
            bottom: `-${expandArea - expandInnerArea}px`,
            right: `-${expandArea - expandInnerArea}px`,
            position: "absolute",
            cursor: "nw-resize",
          }}
          onMouseDown={(initialEvent) => {
            if (initialEvent.button !== 0) return;
            initialEvent.preventDefault();
            const windowHolder = (
              initialEvent.currentTarget.parentElement as HTMLDivElement
            ).parentElement as HTMLDivElement;
            const mousemove = (event: MouseEvent) => {
              windowHolder.style.width = `${Math.max(minWidth, event.clientX - windowHolder.offsetLeft)}px`;
              windowHolder.style.height = `${Math.max(minHeight, event.clientY - windowHolder.offsetTop)}px`;
            };
            const mouseup = () => {
              document.removeEventListener("mousemove", mousemove);
              document.removeEventListener("mouseup", mouseup);
            };
            document.addEventListener("mousemove", mousemove);
            document.addEventListener("mouseup", mouseup);
          }}
        />
      </Box>
    </Box>
  );
}
