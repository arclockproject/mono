import type {
  ComponentProps,
  MouseEventHandler,
  TouchEventHandler,
} from "react";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { JSX } from "react/jsx-runtime";

const useIsomorphicLayoutEffect: typeof useEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Position and zoom of a `Movable`'s content.
 */
export type MovableTransform = {
  /** Horizontal offset, in pixels before zooming. */
  x: number;
  /** Vertical offset, in pixels before zooming. */
  y: number;
  /** Scale. `1` is the original size. */
  zoom: number;
};

/**
 * A `<div>` whose content can be dragged (mouse or one finger) and zoomed
 * (mouse wheel or pinch). It fills its parent by default and hides overflow.
 *
 * Accepts all `<div>` props. Your `onMouseDown` and `onTouchStart` run before
 * the drag logic, even when dragging is off. Turning a feature off resets its
 * position or zoom.
 *
 * To keep the position and zoom when it remounts, save what `onTransformChange`
 * gives you and pass it back as `defaultTransform`.
 *
 * @see {@link https://arclockproject.org/docs/common/components/Movable Guide} | {@link https://arclockproject.org/docs/api/common/components/Movable API}
 * @example
 * <Movable enableMovement enableZoom style={{ height: 300 }}>
 *   <img src="/map.png" />
 * </Movable>
 */
export default function Movable(
  props: Omit<ComponentProps<"div">, "ref"> & {
    /**
     * Allow dragging the content.
     * @default false
     */
    enableMovement?: boolean;
    /**
     * Allow zooming
     * @default false
     */
    enableZoom?: boolean;
    /**
     * Position and zoom to start with. Only read on mount. Parts whose feature
     * is off are reset, like with any other value.
     * @default { x: 0, y: 0, zoom: 1 }
     */
    defaultTransform?: MovableTransform;
    /**
     * Called after the user drags or zooms, and when turning a feature off
     * resets a value that wasn't already at its default.
     * @param transform The new position and zoom.
     */
    onTransformChange?: (transform: MovableTransform) => void;
  },
): JSX.Element {
  const enableMovement = props.enableMovement ?? false;
  const enableZoom = props.enableZoom ?? false;
  const containerDiv = useRef<HTMLDivElement>(null);
  const transformDiv = useRef<HTMLDivElement>(null);
  const moving = useRef(false);
  const zooming = useRef(false);
  const imageZoom = useRef(props.defaultTransform?.zoom ?? 1);
  const start = useRef({ x: 0, y: 0 });
  const offset = useRef({
    x: props.defaultTransform?.x ?? 0,
    y: props.defaultTransform?.y ?? 0,
  });
  const onTransformChange = useRef(props.onTransformChange);
  onTransformChange.current = props.onTransformChange;
  const pinchDistance = useRef(0);
  const pinchCenter = useRef({ x: 0, y: 0 });

  const {
    style,
    role = "img",
    className,
    onMouseDown: onMouseDownPassed,
    onTouchStart: onTouchStartPassed,
    enableMovement: _enableMovement,
    enableZoom: _enableZoom,
    defaultTransform: _defaultTransform,
    onTransformChange: _onTransformChange,
    ...rest
  } = props;
  const {
    width = "100%",
    height = "100%",
    overflow = "hidden",
    ...styleRest
  } = { ...style };

  useIsomorphicLayoutEffect(() => {
    let changed = false;
    if (!enableMovement) {
      changed ||= offset.current.x !== 0 || offset.current.y !== 0;
      moving.current = false;
      start.current = { x: 0, y: 0 };
      offset.current = { x: 0, y: 0 };
    }
    if (!enableZoom) {
      changed ||= imageZoom.current !== 1;
      zooming.current = false;
      imageZoom.current = 1;
      pinchDistance.current = 0;
    }
    if (changed) commitTransform();
    else updateTransformDiv();
  }, [enableMovement, enableZoom]);
  const updateTransformDiv = () => {
    if (transformDiv.current)
      transformDiv.current.style.transform = `scale(${imageZoom.current}) translateX(${offset.current.x}px) translateY(${offset.current.y}px)`;
  };
  const commitTransform = () => {
    updateTransformDiv();
    onTransformChange.current?.({
      x: offset.current.x,
      y: offset.current.y,
      zoom: imageZoom.current,
    });
  };
  /**
   * Sets the zoom. With movement on, keeps the content under `clientX`/`clientY`
   * in place. Otherwise zooms around the center.
   */
  const zoomAt = (newZoom: number, clientX: number, clientY: number) => {
    if (enableMovement && transformDiv.current) {
      const rect = transformDiv.current.getBoundingClientRect();
      const pointX =
        clientX -
        (rect.left + rect.width / 2) +
        imageZoom.current * offset.current.x;
      const pointY =
        clientY -
        (rect.top + rect.height / 2) +
        imageZoom.current * offset.current.y;
      offset.current.x += pointX / newZoom - pointX / imageZoom.current;
      offset.current.y += pointY / newZoom - pointY / imageZoom.current;
    }
    imageZoom.current = newZoom;
  };
  const onMouseDown = (e: Parameters<MouseEventHandler<HTMLDivElement>>[0]) => {
    if (onMouseDownPassed) onMouseDownPassed(e);
    if (!enableMovement || e.buttons !== 1) return;

    e.preventDefault();

    start.current.x = e.clientX;
    start.current.y = e.clientY;
    moving.current = true;
    const onMouseMove = (e: MouseEvent) => {
      if (!enableMovement || !moving.current) return;
      e.preventDefault();
      offset.current.x += (e.clientX - start.current.x) / imageZoom.current;
      offset.current.y += (e.clientY - start.current.y) / imageZoom.current;
      start.current.x = e.clientX;
      start.current.y = e.clientY;
      commitTransform();
    };
    const onMouseUp = () => {
      moving.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const onTouchStart = (
    e: Parameters<TouchEventHandler<HTMLDivElement>>[0],
  ) => {
    if (onTouchStartPassed) onTouchStartPassed(e);
    if (!enableMovement && !enableZoom) return;
    e.preventDefault();
    if (e.touches.length === 1 && enableMovement) {
      start.current.x = e.touches[0]!.clientX;
      start.current.y = e.touches[0]!.clientY;
      moving.current = true;
    } else if (e.touches.length === 2) {
      pinchDistance.current = Math.sqrt(
        (e.touches[0]!.clientX - e.touches[1]!.clientX) ** 2 +
          (e.touches[0]!.clientY - e.touches[1]!.clientY) ** 2,
      );
      pinchCenter.current = {
        x: (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2,
        y: (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2,
      };
      zooming.current = true;
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!(moving.current || zooming.current)) return;
      e.preventDefault();
      if (e.touches.length === 1 && enableMovement) {
        offset.current.x +=
          (e.touches[0]!.clientX - start.current.x) / imageZoom.current;
        offset.current.y +=
          (e.touches[0]!.clientY - start.current.y) / imageZoom.current;
        start.current.x = e.touches[0]!.clientX;
        start.current.y = e.touches[0]!.clientY;
        moving.current = true;
      } else if (e.touches.length === 2) {
        const currentPinchDistance = Math.sqrt(
          (e.touches[0]!.clientX - e.touches[1]!.clientX) ** 2 +
            (e.touches[0]!.clientY - e.touches[1]!.clientY) ** 2,
        );
        const currentPinchCenter = {
          x: (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2,
          y: (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2,
        };
        if (enableZoom)
          zoomAt(
            imageZoom.current * (currentPinchDistance / pinchDistance.current),
            pinchCenter.current.x,
            pinchCenter.current.y,
          );
        if (enableMovement) {
          offset.current.x +=
            (currentPinchCenter.x - pinchCenter.current.x) / imageZoom.current;
          offset.current.y +=
            (currentPinchCenter.y - pinchCenter.current.y) / imageZoom.current;
        }
        pinchDistance.current = currentPinchDistance;
        pinchCenter.current = currentPinchCenter;
        zooming.current = true;
      }
      commitTransform();
    };
    const onTouchEnd = () => {
      moving.current = false;
      zooming.current = false;
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
    document.addEventListener("touchmove", onTouchMove);
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);
  };
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!enableZoom) return;
      e.preventDefault();
      e.stopPropagation();
      const delta: number = e.deltaY;
      zoomAt(imageZoom.current * (delta > 0 ? 0.9 : 1.1), e.clientX, e.clientY);
      commitTransform();
    };
    containerDiv.current?.addEventListener("wheel", onWheel);
    return () => containerDiv.current?.removeEventListener("wheel", onWheel);
  }, [enableZoom, enableMovement]);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Mouse and touch drag to pan. There is no keyboard equivalent yet.
    <div
      ref={containerDiv}
      style={{
        width,
        height,
        overflow,
        ...styleRest,
      }}
      {...rest}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      // TODO: to keep backwards compatibility for now we keep the name same due to usage in <Image />
      className={`CommonImage ${className}`}
    >
      <div ref={transformDiv} style={{ width: "100%", height: "100%" }}>
        {props.children}
      </div>
    </div>
  );
}
