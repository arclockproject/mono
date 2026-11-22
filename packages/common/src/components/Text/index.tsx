import { Typography, type TypographyProps } from "@mui/material";
import { type ReactNode, useEffect, useState } from "react";
import type { JSX } from "react/jsx-runtime";

/** Props of {@link Text}: every MUI `Typography` prop, plus these. */
export type TextProps = TypographyProps & {
  /**
   * Content to show. Typing with `speed` only works on a plain string. Any
   * other content is shown at once.
   */
  children?: ReactNode;
  /**
   * Cuts the text off after this many lines. Leave it out to show every line.
   */
  lines?: number;
  /**
   * Types the text out one character at a time, this many milliseconds per
   * character. Lower is faster. Leave it out to show the text at once. Typing
   * starts again whenever `children` or `speed` changes.
   */
  speed?: number;
};

/**
 * MUI `Typography` that can cut its text off after a number of lines, and can
 * type its text out one character at a time.
 *
 * @see {@link https://arclockproject.org/docs/common/components/Text Guide} | {@link https://arclockproject.org/docs/api/common/components/Text API}
 * @example
 * <Text lines={2}>{description}</Text>
 * <Text speed={30} variant="h5">Hello there!</Text>
 * <Text lines={1} speed={50}>{title}</Text>
 */
export function Text(props: TextProps): JSX.Element {
  const { children, lines, speed, sx, ...typographyProps } = props;
  const typed = typeof children === "string" && speed !== undefined;
  const fullLength = typeof children === "string" ? children.length : 0;

  const [length, setLength] = useState(0);
  const [source, setSource] = useState({ children, speed });
  if (source.children !== children || source.speed !== speed) {
    setSource({ children, speed });
    setLength(0);
  }

  useEffect(() => {
    if (!typed || length >= fullLength) return;
    const timeout = setTimeout(
      () => setLength((current) => current + 1),
      speed,
    );
    return () => clearTimeout(timeout);
  }, [typed, length, fullLength, speed]);

  return (
    <Typography
      {...typographyProps}
      sx={
        lines === undefined
          ? sx
          : [
              {
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: lines,
                overflowY: "hidden",
              },
              ...(sx === undefined ? [] : Array.isArray(sx) ? sx : [sx]),
            ]
      }
    >
      {typed ? children.slice(0, length) : children}
    </Typography>
  );
}

/**
 * MUI `Typography` cut off after 2 lines.
 *
 * @deprecated Use `<Text lines={2}>` instead. `LimitLines2` will be removed in a later version.
 * @example
 * <LimitLines2>{description}</LimitLines2>
 */
export function LimitLines2(
  props: Omit<TextProps, "lines" | "speed">,
): JSX.Element {
  return <Text {...props} lines={2} />;
}

/**
 * MUI `Typography` cut off after 1 line.
 *
 * @deprecated Use `<Text lines={1}>` instead. `LimitLines1` will be removed in a later version.
 * @example
 * <LimitLines1>{title}</LimitLines1>
 */
export function LimitLines1(
  props: Omit<TextProps, "lines" | "speed">,
): JSX.Element {
  return <Text {...props} lines={1} />;
}
