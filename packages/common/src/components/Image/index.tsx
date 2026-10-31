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
/**
 * A component that can render a PSD file, such as `PSDViewer`.
 */
type validPSDViewer = (
  props: HTMLAttributes<HTMLDivElement> & { src: string },
) => JSX.Element;

/**
 * Shows an image, video or PSD file inside a `Movable`, so it can be dragged
 * and zoomed. Videos play muted and on a loop.
 *
 * PSD support is opt-in through `psdRenderer`, so `PSDViewer` and its
 * dependencies are only bundled when you need them.
 *
 * @see {@link https://arclockproject.org/docs/common/components/Image Guide} | {@link https://arclockproject.org/docs/api/common/components/Image API}
 * @example
 * <Image src="/photos/cat.webp" renderer="auto" enableMovement />
 */
function Image(props: {
  /** URL of the file. */
  src: string;
  /** Alt text. Only used for images. */
  alt?: string;
  /** Ref to the `<img>` element, when rendering an image. Populated on mount/rerender. */
  refPropImage?: React.RefObject<HTMLImageElement>;
  /** Ref to the `<video>` element, when rendering a video. Populated on mount/rerender. */
  refPropVideo?: React.RefObject<HTMLVideoElement>;
  /**
   * How to render `src`. `"auto"` picks from the lowercase file extension:
   * mp4, mov and mkv are videos, anything else is an image. PSD files need `".psd"`.
   */
  renderer: "video" | "psd" | "image" | "auto";
  /**
   * Component used when `renderer` is `"psd"`. Pass `isLazy: true` with a
   * `React.lazy` component to load it only when needed.
   */
  psdRenderer?:
    | {
        isLazy: false;
        component: validPSDViewer;
      }
    | {
        isLazy: true;
        component: LazyExoticComponent<validPSDViewer>;
      };
  /** Start playing videos right away. */
  autoPlay?: boolean;
  /** Show video controls. */
  controls?: boolean;
  /** Called when the file has loaded. */
  onLoad?: ReactEventHandler<HTMLDivElement | HTMLVideoElement>;
  /** Called when the file fails to load. */
  onError?: ReactEventHandler<HTMLDivElement | HTMLVideoElement>;

  /** Style of the outer `Movable` container. */
  styleRoot?: React.CSSProperties;
  /** Style of the image, video or PSD element. */
  styleImage?: React.CSSProperties;
  /** Allow dragging and zooming. */
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
