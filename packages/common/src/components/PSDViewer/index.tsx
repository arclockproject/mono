import { Button } from "@mui/material";
import type { Group, Layer, NodeChild } from "@webtoon/psd";
import Psd from "@webtoon/psd";
import type { LayerFrame } from "@webtoon/psd/dist/sections";
import {
  type HTMLAttributes,
  type PropsWithChildren,
  useRef,
  useState,
} from "react";
import type { JSX } from "react/jsx-runtime";

const clearDraw = (psdContext: psdContext) => {
  psdContext.context.clearRect(
    0,
    0,
    psdContext.canvas.width,
    psdContext.canvas.height,
  );
};
enum BlendMode {
  PassThrough = "pass",
  Normal = "norm",
  Dissolve = "diss",
  Darken = "dark",
  Multiply = "mul ",
  ColorBurn = "idiv",
  LinearBurn = "lbrn",
  DarkerColor = "dkCl",
  Lighten = "lite",
  Screen = "scrn",
  ColorDodge = "div ",
  LinearDodge = "lddg",
  LighterColor = "lgCl",
  Overlay = "over",
  SoftLight = "sLit",
  HardLight = "hLit",
  VividLight = "vLit",
  LinearLight = "lLit",
  PinLight = "pLit",
  HardMix = "hMix",
  Difference = "diff",
  Exclusion = "smud",
  Subtract = "fsub",
  Divide = "fdiv",
  Hue = "hue ",
  Saturation = "sat ",
  Color = "colr",
  Luminosity = "lum ",
}
// class Blender {
//   private constructor(
//     private source: ImageData,
//     private layer: ImageData
//   ) {}
//   static async build(layer: Layer, psdContext: psdContext) {
//     const compositeBuffer = await layer.composite();
//     const imageDataPainted = psdContext.context.getImageData(
//       0,
//       0,
//       psdContext.canvas.width,
//       psdContext.canvas.height
//     );
//     const _imageData = new ImageData(
//       compositeBuffer,
//       layer.width,
//       layer.height
//     );
//     clearDraw(psdContext);
//     psdContext.context.putImageData(_imageData, layer.left, layer.top);
//     const imageData = psdContext.context.getImageData(
//       0,
//       0,
//       psdContext.canvas.width,
//       psdContext.canvas.height
//     );
//     return new Blender(imageDataPainted, imageData);
//   }
// }

/**
 * Wrapper for an internal parameter.
 * For some reason private but has information not present on the public object.
 */
function getLaterFrame(layer: Layer | Group | NodeChild) {
  // biome-ignore lint/suspicious/noExplicitAny: Force extract private internal property
  return (layer as any).layerFrame as LayerFrame;
}
function loadPsdLight(
  src: string,
  onLoaded: (data: ReturnType<typeof Psd.parse>) => void,
  onProgress: (progress: number) => void,
): void {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", src, true);
  xhr.responseType = "arraybuffer";
  xhr.onprogress = function update_progress(e) {
    if (e.lengthComputable) {
      onProgress(Math.round((e.loaded / e.total) * 100));
    } else {
      onProgress(-1);
    }
  };
  xhr.addEventListener(
    "load",
    () => {
      const buffer = xhr.response;
      const psd = Psd.parse(buffer);
      onLoaded(psd);
      // document.body.appendChild(psd.children[0].canvas);
    },
    false,
  );
  xhr.send();
}
type psdContext = {
  file: Psd;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
};

const _fullDraw = async (psdContext: psdContext) => {
  const compositeBuffer = (await psdContext.file.composite()) as ImageDataArray;
  const imageData = new ImageData(
    compositeBuffer,
    psdContext.file.width,
    psdContext.file.height,
  );
  psdContext.context.putImageData(imageData, 0, 0);
};

const layerDraw = async (layer: Layer, psdContext: psdContext) => {
  switch (
    getLaterFrame(layer).layerProperties.blendMode as unknown as BlendMode
  ) {
    case BlendMode.ColorDodge: {
      psdContext.context.globalCompositeOperation = "color-dodge";
      break;
    }
    case BlendMode.LinearBurn: {
      psdContext.context.globalCompositeOperation = "source-over";
      const compositeBuffer = (await layer.composite()) as ImageDataArray;
      const imageDataPainted = psdContext.context.getImageData(
        0,
        0,
        psdContext.canvas.width,
        psdContext.canvas.height,
      );
      const _imageData = new ImageData(
        compositeBuffer,
        layer.width,
        layer.height,
      );
      clearDraw(psdContext);
      psdContext.context.putImageData(_imageData, layer.left, layer.top);
      const imageData = psdContext.context.getImageData(
        0,
        0,
        psdContext.canvas.width,
        psdContext.canvas.height,
      );

      for (let i = 0; i < imageDataPainted.data.length; i++) {
        if (i % 4 === 3) {
          continue;
        }
        const opacity = imageData.data[i + (3 - (i % 4))]! / 255;

        imageDataPainted.data[i] =
          imageDataPainted.data[i]! +
          Math.round((imageData.data[i]! - 255) * opacity);
      }
      psdContext.context.putImageData(imageDataPainted, 0, 0);
      return;
    }
    case BlendMode.Multiply: {
      psdContext.context.globalCompositeOperation = "multiply";
      break;
    }
    // case BlendMode.Normal:
    default: {
      psdContext.context.globalCompositeOperation = "source-over";
    }
  }
  const compositeBuffer = (await layer.composite()) as ImageDataArray;
  const imageData = new ImageData(compositeBuffer, layer.width, layer.height);
  const image = await createImageBitmap(imageData);

  psdContext.context.drawImage(image, layer.left, layer.top);
};
const allLayerDraw = async (
  invertedLayers: (Layer | Group)[],
  psdContext: psdContext,
  nodes: NodeChild[],
) => {
  const todo = [...nodes].reverse();

  for (const node of todo) {
    const skip = invertedLayers.includes(node)
      ? !getLaterFrame(node).layerProperties.hidden
      : getLaterFrame(node).layerProperties.hidden;
    if (skip) continue;
    if (node.type === "Layer") {
      console.log(`Draw: ${node.name}`);
      console.log(
        `blendMode: ${getLaterFrame(node).layerProperties.blendMode}`,
      );
      await layerDraw(node, psdContext);
    } else if (node.type === "Group") {
      await allLayerDraw(invertedLayers, psdContext, node.children);
    }
  }
  return;
};

function PSDViewer(
  props: HTMLAttributes<HTMLDivElement> & {
    src: string;
  },
): JSX.Element {
  const layerRef = useRef<HTMLDivElement>(null);
  const [psdContext, setPsdContext] = useState<psdContext>();
  const [progress, setProgress] = useState<number>();
  const [xorLayers, setXorLayers] = useState<(Layer | Group)[]>([]);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1,
          display: psdContext === undefined ? "flex" : "none",
          justifyContent: "center",
          background: "rgba(0,0,0,0.3)",
        }}
      >
        <Button
          onClick={() => {
            if (progress !== undefined || !layerRef.current) return;
            setProgress(0);
            loadPsdLight(
              props.src,
              (psd) => {
                //@ts-expect-error
                window.psd = psd;
                const visibleUnBuiltLayers = psd.layers;
                if (visibleUnBuiltLayers.length > 0 && layerRef.current) {
                  const canvasElement = document.createElement("canvas");
                  const context = canvasElement.getContext("2d");
                  if (!context) return console.error("cant create 2d context");
                  psd.composite().then((compositeBuffer) => {
                    const imageData = new ImageData(
                      compositeBuffer as ImageDataArray,
                      psd.width,
                      psd.height,
                    );

                    canvasElement.width = psd.width;
                    canvasElement.height = psd.height;
                    canvasElement.style.maxHeight = "100%";
                    canvasElement.style.maxWidth = "100%";
                    context.putImageData(imageData, 0, 0);
                    layerRef.current?.appendChild(canvasElement);
                    setPsdContext({
                      file: psd,
                      canvas: canvasElement,
                      context: context,
                    });
                  });
                }
              },
              setProgress,
            );
          }}
        >
          {progress === undefined
            ? "Load PSD File"
            : progress === -1
              ? "Progress: UnCalculable"
              : `Progress: ${progress}%`}
        </Button>
      </div>

      {psdContext !== undefined && (
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            right: 0,
            width: "300px",
            paddingTop: "36.5px",
            overflow: "scroll",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            background: "rgba(0,0,0,0.3)",
          }}
        >
          {renderLayers(
            psdContext.file.children,
            psdContext,
            xorLayers,
            setXorLayers,
          )}
          <Button
            variant="contained"
            sx={{
              position: "absolute",
              top: 0,
              width: "300px",
              height: "36.5px",
              zIndex: 2,
              right: 0,
            }}
            onClick={async () => {
              clearDraw(psdContext);
              await allLayerDraw(
                xorLayers,
                psdContext,
                psdContext.file.children,
              );
            }}
          >
            Draw All
          </Button>
        </div>
      )}
      <div
        role="img"
        ref={layerRef}
        style={props.style}
        onWheel={props.onWheel}
        onMouseDown={props.onMouseDown}
        onTouchStart={props.onTouchStart}
        onMouseMove={props.onMouseMove}
        onTouchMove={props.onTouchMove}
        onMouseUp={props.onMouseUp}
        onTouchEnd={props.onTouchEnd}
      ></div>
    </div>
  );
}
const renderLayers = (
  children: NodeChild[],
  psdContext: psdContext,
  xorLayers: (Layer | Group)[],
  setXorLayers: React.Dispatch<React.SetStateAction<(Layer | Group)[]>>,
): React.ReactNode[] => {
  return children.map((child) => {
    if (child.type === "Layer") {
      const hidden = xorLayers.includes(child)
        ? !child.isHidden
        : child.isHidden;
      // Do something with Layer
      const action = async () => {
        clearDraw(psdContext);
        await layerDraw(child, psdContext);
        let xorRef = xorLayers;
        if (xorLayers.includes(child)) {
          xorRef = xorLayers.filter((layer) => layer !== child);
        } else {
          xorRef.push(child);
        }
        setXorLayers([...xorRef]);
      };
      return (
        <div>
          <p
            style={{
              height: "48px",
            }}
            onClick={action}
            onKeyDown={action}
          >
            Layer: {child.name}
            {hidden ? " (H)" : ""}
          </p>
        </div>
      );
    } else if (child.type === "Group") {
      // Do something with Group
      return (
        <Collapsible child={child}>
          {renderLayers(child.children, psdContext, xorLayers, setXorLayers)}
        </Collapsible>
      );
    } else {
      return <p>Invalid node type</p>;
    }
  });
};
function Collapsible(props: PropsWithChildren<{ child: Group }>) {
  const [open, setOpen] = useState(false);
  const hidden = getLaterFrame(props.child).layerProperties.hidden;
  return (
    <div>
      <p
        style={{
          height: "48px",
          background: "rgba(255,255,255,0.2)",
          color: "black",
        }}
        onClick={() => setOpen(!open)}
        onKeyDown={() => setOpen(!open)}
      >
        Group: {props.child.name}
        {hidden ? " (H)" : ""}
        {open ? " (x)" : ""}
      </p>
      <div style={{ display: open ? undefined : "none" }}>{props.children}</div>
    </div>
  );
}
export default PSDViewer;
