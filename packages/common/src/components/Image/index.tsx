import type { ReactEventHandler } from "react";
import type { JSX } from "react/jsx-runtime";
import Movable, { type MovableTransform } from "../Movable";

const extensions: {
  [string: string]: "image" | "video";
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
 * Shows an image or video inside a `Movable`, so it can be dragged and zoomed.
 * Videos play muted and on a loop.
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
  refPropImage?: React.RefObject<HTMLImageElement | null>;
  /** Ref to the `<video>` element, when rendering a video. Populated on mount/rerender. */
  refPropVideo?: React.RefObject<HTMLVideoElement | null>;
  /**
   * How to render `src`. `"auto"` picks from the lowercase file extension:
   * mp4, mov and mkv are videos, anything else is an image.
   */
  renderer: "video" | "image" | "auto";
  /** Start playing videos right away. */
  autoPlay?: boolean;
  /** Show video controls. Ignored while `enableMovement` is on. */
  controls?: boolean;
  /** Called when the file has loaded. For videos, this is when the first frame is ready. */
  onLoad?: ReactEventHandler<HTMLImageElement | HTMLVideoElement>;
  /** Called when the file fails to load. */
  onError?: ReactEventHandler<HTMLImageElement | HTMLVideoElement>;

  /** Style of the outer `Movable` container. */
  styleRoot?: React.CSSProperties;
  /** Style of the image or video element. */
  styleImage?: React.CSSProperties;
  /** Allow dragging and zooming. */
  enableMovement: boolean;
  /**
   * Position and zoom to start with. Only read on mount, and reset while
   * `enableMovement` is off. See `Movable`.
   */
  defaultTransform?: MovableTransform;
  /**
   * Called after the user drags or zooms, and when turning `enableMovement`
   * off resets them. See `Movable`.
   * @param transform The new position and zoom.
   */
  onTransformChange?: (transform: MovableTransform) => void;
}): JSX.Element {
  const renderer =
    props.renderer === "auto" ? guessExtension(props.src) : props.renderer;

  const inner =
    renderer === "video" ? (
      <video
        ref={props.refPropVideo}
        className="CommonImage-video"
        src={props.src}
        onLoadedData={props.onLoad}
        onError={props.onError}
        autoPlay={props.autoPlay}
        loop
        muted
        controls={props.controls && !props.enableMovement}
        style={{
          ...props.styleImage,
          ...{ touchAction: "none" },
        }}
      />
    ) : (
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
  return (
    <Movable
      style={props.styleRoot}
      enableMovement={props.enableMovement}
      enableZoom={props.enableMovement}
      defaultTransform={props.defaultTransform}
      onTransformChange={props.onTransformChange}
    >
      {inner}
    </Movable>
  );
}
export default Image;
