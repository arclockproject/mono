import type { StyledComponent } from "@emotion/styled";
import { styled, Typography, type TypographyOwnProps } from "@mui/material";
import type { CommonProps } from "@mui/material/OverridableComponent";

export const LimitLines2: StyledComponent<TypographyOwnProps & CommonProps> =
  styled(Typography)(() => ({
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    overflowY: "hidden",
  }));

export const LimitLines1: StyledComponent<TypographyOwnProps & CommonProps> =
  styled(Typography)(() => ({
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 1,
    overflowY: "hidden",
  }));
