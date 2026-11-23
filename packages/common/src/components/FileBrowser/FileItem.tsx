import { Box, ButtonBase, Typography } from "@mui/material";
import { type MouseEvent, memo, type ReactNode } from "react";
import type { FileBrowserItem, FileBrowserView } from "./types";

/** Click handler shared by every item. Must be stable so `memo` can skip unchanged items. */
type ItemClickHandler = (
  index: number,
  item: FileBrowserItem,
  event: MouseEvent<HTMLElement>,
) => void;

/**
 * One file or folder, as a tile in grid view or a row in list view.
 * Re-renders only when its own props change. Off-screen items skip layout
 * and paint with `content-visibility`.
 */
function FileItem(props: {
  item: FileBrowserItem;
  /** Position in the current folder, passed back to the handlers. */
  index: number;
  icon: ReactNode;
  view: FileBrowserView;
  onItemClick: ItemClickHandler;
  onItemContextMenu: ItemClickHandler;
}): ReactNode {
  const { item, index, icon, view } = props;
  const grid = view === "grid";
  return (
    <ButtonBase
      title={item.name}
      onClick={(event) => props.onItemClick(index, item, event)}
      onContextMenu={(event) => props.onItemContextMenu(index, item, event)}
      sx={{
        contentVisibility: "auto",
        containIntrinsicSize: grid ? "auto 112px" : "auto 36px",
        display: "flex",
        flexDirection: grid ? "column" : "row",
        justifyContent: "flex-start",
        alignItems: "center",
        gap: grid ? 0.5 : 1.5,
        py: grid ? 1 : 0.75,
        px: grid ? 1 : 1.5,
        borderRadius: 2,
        textAlign: grid ? "center" : "left",
        color: "text.primary",
        minWidth: 0,
        "&:hover": { bgcolor: "action.hover" },
        "&.Mui-focusVisible": {
          bgcolor: "action.selected",
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: -2,
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexShrink: 0,
          fontSize: grid ? 48 : 24,
          color: item.isFolder ? undefined : "text.secondary",
          "& .MuiSvgIcon-root": { fontSize: "inherit" },
          "& img": { width: "1em", height: "1em", objectFit: "contain" },
        }}
      >
        {icon}
      </Box>
      <Typography
        variant="body2"
        sx={{
          flex: grid ? undefined : 1,
          width: grid ? "100%" : undefined,
          minWidth: 0,
          overflow: "hidden",
          wordBreak: "break-word",
          ...(grid
            ? {
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }
            : { textOverflow: "ellipsis", whiteSpace: "nowrap" }),
        }}
      >
        {item.name}
      </Typography>
      {grid ? null : (
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", flexShrink: 0 }}
        >
          {item.isFolder ? "Folder" : (item.extension?.toUpperCase() ?? "File")}
        </Typography>
      )}
    </ButtonBase>
  );
}

const MemoFileItem: typeof FileItem = memo(FileItem);

export type { ItemClickHandler };
export default MemoFileItem;
