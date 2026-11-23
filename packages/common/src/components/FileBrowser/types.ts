import type { MouseEvent, ReactNode } from "react";

/** How the items are laid out. Switched with the buttons in the top right. */
type FileBrowserView = "grid" | "list";

/** A file or folder in the browser, as passed to `onItemClick`, `contextMenu` and `getIcon`. */
type FileBrowserItem = {
  /** The last part of the path, e.g. `logo.png` or `images`. The root folder is `/`. */
  name: string;
  /** Full path including `base`. For files this is the same string `customAction` gets. */
  path: string;
  isFolder: boolean;
  /** Lowercase extension without the dot, e.g. `png`. `undefined` for folders and files without one. */
  extension?: string;
};

/** What `renderItem` gets for each file or folder. */
type FileBrowserItemProps = {
  item: FileBrowserItem;
  /** The current layout, so a tile or a row can be drawn. */
  view: FileBrowserView;
  /** The icon the built-in item would show, including the result of `getIcon`. */
  icon: ReactNode;
  /** The built-in click: calls `onItemClick`, then opens the folder or calls `customAction`. */
  onClick: (event: MouseEvent<HTMLElement>) => void;
  /** Opens the `contextMenu` entries at the cursor. Does nothing if there are none. */
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
  /** Opens the folder or calls `customAction`, without calling `onItemClick`. */
  open: () => void;
  /** The built-in tile or row, for wrapping it in your own element. */
  defaultItem: ReactNode;
};

/** A clickable entry in the right-click menu. */
type FileBrowserMenuAction = {
  label: ReactNode;
  /** Shown before the label, e.g. an MUI icon with `fontSize="small"`. */
  icon?: ReactNode;
  /** Called after the menu closes. */
  onClick: (item: FileBrowserItem) => void;
  /** Greys the entry out so it can't be clicked. */
  disabled?: boolean;
};

/** One entry in the right-click menu. `"divider"` draws a line. */
type FileBrowserMenuItem = FileBrowserMenuAction | "divider";

/** A node of the folder tree. Files have `endName` set to their full path. */
type Entry = {
  folder: string;
  children: Entry[];
  endName?: string;
};

export type {
  Entry,
  FileBrowserItem,
  FileBrowserItemProps,
  FileBrowserMenuItem,
  FileBrowserView,
};
