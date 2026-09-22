import type {
  HTMLAttributes,
  LazyExoticComponent,
  ReactEventHandler,
  ReactNode,
} from "react";
import { Fragment, Suspense } from "react";
import type { JSX } from "react/jsx-runtime";
import Movable from "../Movable";

const extensions: {
  [string: string]: "image" | "video" | "psd";
} = {
  webp: "image",
  mov: "video",
  mkv: "video",
  mp4: "video",
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
};
const guessExtension = (file: string) => {
  const extension = file.split(".").pop() ?? "png";
  const type = extensions[extension];
  return type ?? "image";
};
type validPSDViewer = (
  props: HTMLAttributes<HTMLDivElement> & { src: string },
) => JSX.Element;

function Image(props: {
  src: string;
  alt?: string;
  refPropImage?: React.RefObject<HTMLImageElement>;
  refPropVideo?: React.RefObject<HTMLVideoElement>;
  renderer: "video" | "psd" | "image" | "auto";
  psdRenderer?:
    | {
        isLazy: false;
        component: validPSDViewer;
      }
    | {
        isLazy: true;
        component: LazyExoticComponent<validPSDViewer>;
      };
  autoPlay?: boolean;
  controls?: boolean;
  onLoad?: ReactEventHandler<HTMLDivElement | HTMLVideoElement>;
  onError?: ReactEventHandler<HTMLDivElement | HTMLVideoElement>;

  styleRoot?: React.CSSProperties;
  styleImage?: React.CSSProperties;
  enableMovement: boolean;
}): JSX.Element {
  const renderer =
    props.renderer === "auto" ? guessExtension(props.src) : props.renderer;

  let inner: ReactNode = "Error props.psdRenderer.component is undefined";
  if (renderer === "psd" && props.psdRenderer) {
    const Parent: typeof Suspense | typeof Fragment = props.psdRenderer.isLazy
      ? Suspense
      : Fragment;
    inner = (
      <Parent>
        <props.psdRenderer.component
          className="CommonImage CommonImage-psd"
          src={props.src}
          onLoad={props.onLoad}
          onError={props.onError}
          style={{
            ...props.styleImage,
            ...{
              touchAction: "none",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            },
          }}
        />
      </Parent>
    );
  } else if (renderer === "video") {
    inner = (
      <video
        ref={props.refPropVideo}
        className="CommonImage-video"
        src={props.src}
        onLoad={props.onLoad}
        onError={props.onError}
        autoPlay={props.autoPlay}
        loop
        muted
        controls={props.enableMovement && props.controls}
        style={{
          ...props.styleImage,
          ...{ touchAction: "none" },
        }}
      />
    );
  } else {
    inner = (
      <img
        alt={props.alt}
        ref={props.refPropImage}
        className="CommonImage-image"
        src={props.src}
        onLoad={props.onLoad}
        onError={props.onError}
        style={{
          ...props.styleImage,
          ...{ touchAction: "none" },
        }}
      />
    );
  }
  return (
    <Movable
      style={props.styleRoot}
      enableMovement={props.enableMovement}
      enableZoom={props.enableMovement}
    >
      {inner}
    </Movable>
  );
}
export default Image;
