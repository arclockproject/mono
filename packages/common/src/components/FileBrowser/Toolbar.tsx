import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import FolderIcon from "@mui/icons-material/Folder";
import GridViewIcon from "@mui/icons-material/GridView";
import HomeIcon from "@mui/icons-material/Home";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import ViewListIcon from "@mui/icons-material/ViewList";
import {
  Box,
  Breadcrumbs,
  IconButton,
  Link,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { displayName } from "./tree";
import type { FileBrowserView } from "./types";

/** Applies when the FileBrowser itself is at most this wide, whatever the screen size. */
const NARROW = "@container (max-width: 480px)";

const hideWhenNarrow = { [NARROW]: { display: "none" } };
const showWhenNarrow = { display: "none", [NARROW]: { display: "flex" } };

const crumbText = {
  display: "block",
  maxWidth: 200,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  [NARROW]: { maxWidth: 140 },
} as const;

/** A breadcrumb. The current folder is plain text, the others are links. */
function Crumb(props: {
  label: string;
  current: boolean;
  onClick?: () => void;
}): ReactNode {
  if (props.current) {
    return (
      <Typography
        variant="body2"
        title={props.label}
        sx={{ ...crumbText, color: "text.primary" }}
      >
        {props.label}
      </Typography>
    );
  }
  return (
    <Link
      component="button"
      variant="body2"
      underline="hover"
      color="inherit"
      title={props.label}
      onClick={props.onClick}
      sx={crumbText}
    >
      {props.label}
    </Link>
  );
}

/**
 * The bar above the items: up button, breadcrumbs, item count and view switch.
 * Wide: every breadcrumb on one line that scrolls sideways, kept scrolled to the
 * current folder. Narrow: home, a `...` menu with the hidden parents, and the current folder.
 */
function Toolbar(props: {
  /** Folder names from the top of the tree to the current folder. */
  path: string[];
  /** How many leading `path` entries the home icon stands for. */
  root: number;
  /** Opens the folder `depth` levels down `path`. */
  goTo: (depth: number) => void;
  itemCount: number;
  view: FileBrowserView;
  setView: (view: FileBrowserView) => void;
}): ReactNode {
  const { path, root, goTo, view, setView } = props;
  const atRoot = path.length <= root;
  const scroller = useRef<HTMLDivElement>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const pathKey = path.join("/");

  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [pathKey]);

  const crumbs = path
    .map((folder, index) => ({
      depth: index + 1,
      label: displayName(folder, index === 0),
    }))
    .slice(root);
  const current = crumbs.at(-1);
  const parents = crumbs.slice(0, -1);

  const home = atRoot ? (
    <HomeIcon
      aria-label="Root"
      fontSize="small"
      sx={{ display: "flex", color: "text.primary" }}
    />
  ) : (
    <Link
      component="button"
      underline="hover"
      color="inherit"
      aria-label="Root"
      onClick={() => goTo(root)}
      sx={{ display: "flex" }}
    >
      <HomeIcon fontSize="small" />
    </Link>
  );

  const breadcrumbsSx = {
    "& .MuiBreadcrumbs-ol": { flexWrap: "nowrap" },
    "& .MuiBreadcrumbs-li, & .MuiBreadcrumbs-separator": { flexShrink: 0 },
    "& .MuiBreadcrumbs-separator": { mx: 0.25 },
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1,
        py: 0.5,
        borderBottom: 1,
        borderColor: "divider",
        flexShrink: 0,
      }}
    >
      <Tooltip title="Up one folder">
        <span>
          <IconButton
            size="small"
            aria-label="Up one folder"
            disabled={atRoot}
            onClick={() => goTo(path.length - 1)}
          >
            <ArrowUpwardIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Box
        ref={scroller}
        sx={{
          flex: 1,
          minWidth: 0,
          overflowX: "auto",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
          ...hideWhenNarrow,
        }}
      >
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" />}
          sx={{
            ...breadcrumbsSx,
            "& .MuiBreadcrumbs-ol": {
              flexWrap: "nowrap",
              width: "max-content",
            },
          }}
        >
          {home}
          {crumbs.map((crumb) => (
            <Crumb
              key={crumb.depth}
              label={crumb.label}
              current={crumb === current}
              onClick={() => goTo(crumb.depth)}
            />
          ))}
        </Breadcrumbs>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, overflow: "hidden", ...showWhenNarrow }}>
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" />}
          sx={{
            ...breadcrumbsSx,
            minWidth: 0,
            "& .MuiBreadcrumbs-li:last-of-type": { flexShrink: 1, minWidth: 0 },
          }}
        >
          {home}
          {parents.length > 1 ? (
            <IconButton
              size="small"
              aria-label="Show parent folders"
              onClick={(event) => setMenuAnchor(event.currentTarget)}
              sx={{ p: 0.25 }}
            >
              <MoreHorizIcon fontSize="small" />
            </IconButton>
          ) : null}
          {parents.length === 1 && parents[0] ? (
            <Crumb
              label={parents[0].label}
              current={false}
              onClick={() => goTo(parents[0]?.depth ?? root)}
            />
          ) : null}
          {current ? <Crumb label={current.label} current /> : null}
        </Breadcrumbs>
      </Box>
      <Menu
        open={menuAnchor !== null}
        anchorEl={menuAnchor}
        onClose={() => setMenuAnchor(null)}
        slotProps={{ list: { dense: true } }}
      >
        {parents.map((crumb) => (
          <MenuItem
            key={crumb.depth}
            onClick={() => {
              setMenuAnchor(null);
              goTo(crumb.depth);
            }}
          >
            <ListItemIcon>
              <FolderIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{crumb.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
      <Typography
        variant="caption"
        sx={{
          color: "text.secondary",
          whiteSpace: "nowrap",
          ...hideWhenNarrow,
        }}
      >
        {props.itemCount} {props.itemCount === 1 ? "item" : "items"}
      </Typography>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={view}
        onChange={(_, value: FileBrowserView | null) => {
          if (value) setView(value);
        }}
        sx={hideWhenNarrow}
      >
        <ToggleButton value="grid" aria-label="Grid view" sx={{ p: 0.5 }}>
          <GridViewIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton value="list" aria-label="List view" sx={{ p: 0.5 }}>
          <ViewListIcon fontSize="small" />
        </ToggleButton>
      </ToggleButtonGroup>
      <IconButton
        size="small"
        aria-label={view === "grid" ? "List view" : "Grid view"}
        onClick={() => setView(view === "grid" ? "list" : "grid")}
        sx={showWhenNarrow}
      >
        {view === "grid" ? (
          <ViewListIcon fontSize="small" />
        ) : (
          <GridViewIcon fontSize="small" />
        )}
      </IconButton>
    </Box>
  );
}

export default Toolbar;
