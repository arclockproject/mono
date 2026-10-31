import type { StyledComponent } from "@emotion/styled";
import { styled, Typography, type TypographyOwnProps } from "@mui/material";
import type { CommonProps } from "@mui/material/OverridableComponent";

/**
 * MUI `Typography` cut off after 2 lines.
 *
 * @see {@link https://arclockproject.org/docs/common/components/Text Guide} | {@link https://arclockproject.org/docs/api/common/components/Text API}
 * @example
 * <LimitLines2>{description}</LimitLines2>
 */
export const LimitLines2: StyledComponent<TypographyOwnProps & CommonProps> =
  styled(Typography)(() => ({
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    overflowY: "hidden",
  }));

/**
 * MUI `Typography` cut off after 1 line.
 *
 * @see {@link https://arclockproject.org/docs/common/components/Text Guide} | {@link https://arclockproject.org/docs/api/common/components/Text API}
 * @example
 * <LimitLines1>{title}</LimitLines1>
 */
export const LimitLines1: StyledComponent<TypographyOwnProps & CommonProps> =
  styled(Typography)(() => ({
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 1,
    overflowY: "hidden",
  }));
