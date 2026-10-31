import { Typography, type TypographyProps } from "@mui/material";
import { useEffect, useRef } from "react";
import type { JSX } from "react/jsx-runtime";

/**
 * MUI `Typography` that types its text out one character at a time. Typing
 * starts again whenever `children` or `speed` changes.
 *
 * @see {@link https://arclockproject.org/docs/common/components/AppearingText Guide} | {@link https://arclockproject.org/docs/api/common/components/AppearingText API}
 * @example
 * <AppearingText speed={30} variant="h5">Hello there!</AppearingText>
 */
function AppearingText(
  props: Omit<TypographyProps, "ref" | "children"> & {
    /** Text to type out. Only a plain string is supported. */
    children?: string;
    /**
     * Milliseconds per character. Lower is faster.
     * @default 100
     */
    speed?: number;
  },
): JSX.Element {
  const paragraphElement = useRef<HTMLParagraphElement>(null);
  const currentLength = useRef(0);
  const { speed, children: _children, ...spreadProps } = props;
  const children = _children ?? "";
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    const stopInterval = () => {
      clearInterval(interval);
    };
    interval = setInterval(() => {
      if (
        !paragraphElement.current ||
        currentLength.current > children.length
      ) {
        return stopInterval();
      }

      paragraphElement.current.innerText = children.slice(
        0,
        currentLength.current,
      );
      currentLength.current++;
    }, props.speed ?? 100);
    return stopInterval;
  }, [children, props.speed]);
  return (
    <Typography ref={paragraphElement} {...spreadProps}>
      {children}
    </Typography>
  );
}

export { AppearingText };
