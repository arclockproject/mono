import { Typography, type TypographyProps } from "@mui/material";
import { useEffect, useRef } from "react";
import type { JSX } from "react/jsx-runtime";

function AppearingText(
  props: Omit<TypographyProps, "ref" | "children"> & {
    children?: string;
    /**
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
