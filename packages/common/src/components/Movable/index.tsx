import type { JSX } from "react/jsx-runtime";
import type {
  ComponentProps,
  MouseEventHandler,
  TouchEventHandler,
} from "react";
import { useEffect, useRef } from "react";

/**
 * @extends HTMLDivElement
 * passed `onMouseDown` and `onTouchStart` will be called BEFORE the moving logic
 * and also regardless if moving/zoom is enabled or not
 */
export default function Movable(
  props: Omit<ComponentProps<"div">, "ref"> & {
    /**
     * Determines if movement is enabled
     * @default false
     */
    enableMovement?: boolean;
    /**
     * Determines if movement is enabled
     * @default false
     */
    enableZoom?: boolean;
  },
): JSX.Element {
  const enableMovement = props.enableMovement ?? false;
  const enableZoom = props.enableZoom ?? false;
  const containerDiv = useRef<HTMLDivElement>(null);
  const transformDiv = useRef<HTMLDivElement>(null);
  const moving = useRef(false);
  const zooming = useRef(false);
  const imageZoom = useRef(1);
  const start = useRef({ x: 0, y: 0 });
  const offset = useRef({ x: 0, y: 0 });
  const pinchDistance = useRef(0);

  const {
    style,
    role = "img",
    className,
    onMouseDown: onMouseDownPassed,
    onTouchStart: onTouchStartPassed,
    ...rest
  } = props;
  const {
    width = "100%",
    height = "100%",
    overflow = "hidden",
    ...styleRest
  } = { ...style };

  useEffect(() => {
    if (!enableMovement) {
      moving.current = false;
      start.current = { x: 0, y: 0 };
      offset.current = { x: 0, y: 0 };
    }
    if (!enableZoom) {
      zooming.current = false;
      imageZoom.current = 1;
      pinchDistance.current = 0;
    }
    updateTransformDiv();
  }, [enableMovement, enableZoom]);
  const updateTransformDiv = () => {
    if (transformDiv.current)
      transformDiv.current.style.transform = `scale(${imageZoom.current}) translateX(${offset.current.x}px) translateY(${offset.current.y}px)`;
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
      updateTransformDiv();
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
    if (!enableMovement) return;
    e.preventDefault();
    if (e.touches.length === 1) {
      start.current.x = e.touches[0]!.clientX;
      start.current.y = e.touches[0]!.clientY;
      moving.current = true;
    } else if (e.touches.length === 2) {
      pinchDistance.current = Math.sqrt(
        (e.touches[0]!.clientX - e.touches[1]!.clientX) ** 2 +
          (e.touches[0]!.clientY - e.touches[1]!.clientY) ** 2,
      );
      zooming.current = true;
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!enableMovement || !(moving.current || zooming.current)) return;
      e.preventDefault();
      if (e.touches.length === 1) {
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
        imageZoom.current =
          imageZoom.current * (currentPinchDistance / pinchDistance.current);
        pinchDistance.current = currentPinchDistance;
        zooming.current = true;
      }
      updateTransformDiv();
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
      if (delta > 0) {
        imageZoom.current = imageZoom.current * 0.9;
      } else {
        imageZoom.current = imageZoom.current * 1.1;
      }
      updateTransformDiv();
    };
    containerDiv.current?.addEventListener("wheel", onWheel);
    return () => containerDiv.current?.removeEventListener("wheel", onWheel);
  }, [enableZoom]);
  return (
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
