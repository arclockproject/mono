import type { JSX } from "react/jsx-runtime";
import { Text, type TextProps } from "../Text";

/**
 * MUI `Typography` that types its text out one character at a time. Typing
 * starts again whenever `children` or `speed` changes.
 *
 * @deprecated Use `<Text speed={100}>` from `@arclockproject/common/components/Text` instead. `AppearingText` will be removed in a later version.
 * @see {@link https://arclockproject.org/docs/common/components/Text#typing Guide} | {@link https://arclockproject.org/docs/api/common/components/Text API}
 * @example
 * <AppearingText speed={30} variant="h5">Hello there!</AppearingText>
 */
function AppearingText(
  props: Omit<TextProps, "ref" | "children" | "lines" | "speed"> & {
    /** Text to type out. Only a plain string is supported. */
    children?: string;
    /**
     * Milliseconds per character. Lower is faster.
     * @default 100
     */
    speed?: number;
  },
): JSX.Element {
  const { speed, ...textProps } = props;
  return <Text {...textProps} speed={speed ?? 100} />;
}

export { AppearingText };
