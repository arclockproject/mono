import { Box, Typography } from "@mui/material";
import {
  Fragment,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { JSX } from "react/jsx-runtime";
import ContextMenu, { type ContextMenuControl } from "./ContextMenu";
import FileItem, { type ItemClickHandler } from "./FileItem";
import { defaultIcon } from "./icons";
import Toolbar from "./Toolbar";
import {
  autoOpenDepth,
  buildTree,
  isFolderMarker,
  rootDepth,
  toItem,
} from "./tree";
import type {
  Entry,
  FileBrowserItem,
  FileBrowserItemProps,
  FileBrowserMenuItem,
  FileBrowserView,
} from "./types";

function startHistory(tree: Entry[]): number[] {
  return new Array(autoOpenDepth(tree)).fill(0);
}

/**
 * Shows a list of file paths as folders and files that can be browsed by
 * clicking. The bar at the top has breadcrumbs, an up button and a grid/list
 * view switch. Backspace goes up one folder. When the browser is 480px wide or
 * less, parent folders move into a `...` menu so the bar stays on one line.
 *
 * Single-child folders at the top are opened automatically, so a shared prefix
 * like `/home/user` does not need clicking through.
 *
 * Pass the same `fileSystemRaw` array on every render. A new array resets the
 * browser to its starting folder.
 *
 * @see {@link https://arclockproject.org/docs/common/components/FileBrowser Guide} | {@link https://arclockproject.org/docs/api/common/components/FileBrowser API}
 * @example
 * <FileBrowser
 *   fileSystemRaw={["/docs/readme.md", "/images/logo.png"]}
 *   customAction={(file) => console.log(file)}
 * />
 */
function FileBrowser(props: {
  /** Full file paths, separated by `/`. Folders are built from them. A path ending in `/` adds an empty folder. */
  fileSystemRaw: string[];
  /** Prefix added to every path, e.g. a base URL. */
  base?: string;
  /**
   * Fill the parent element. When `false`, the browser is at most 972px wide and 700px tall.
   * @default true
   */
  fillContainer?: boolean;
  /**
   * Show folders first, then files, each in A-Z order with numbers compared
   * by value (`2` before `10`). When `false`, items keep the order of `fileSystemRaw`.
   * @default false
   */
  sort?: boolean;
  /**
   * Called with the full path (including `base`) when a file is clicked.
   *
   * Not called for folders.
   */
  customAction?: (file: string) => void;
  /**
   * Called when any file or folder is clicked, before `customAction` runs or
   * the folder opens. Call `event.preventDefault()` to stop both.
   * @param item The clicked file or folder.
   * @param event The click event.
   */
  onItemClick?: (item: FileBrowserItem, event: MouseEvent<HTMLElement>) => void;
  /**
   * Entries for the right-click menu of a file or folder. Called each time the menu opens.
   * @param item The right-clicked file or folder.
   * @returns The menu entries. With `null`, `undefined` or an empty list, the browser's own menu opens instead.
   */
  contextMenu?: (
    item: FileBrowserItem,
  ) => FileBrowserMenuItem[] | null | undefined;
  /**
   * Picks the icon of a file or folder. Shown at 48px in grid view and 24px
   * in list view. MUI icons and `<img>` are sized to fit.
   *
   * Items only re-render when their icon changes. Pass a stable function
   * (defined outside the component, or with `useCallback`) for large lists.
   * @param item The file or folder.
   * @returns The icon, or `null`/`undefined` for the built-in one.
   */
  getIcon?: (item: FileBrowserItem) => ReactNode;
  /**
   * Draws a file or folder yourself. Attach `onClick` and `onContextMenu` to
   * keep the built-in behaviour, or leave them out to handle events your own way.
   * The grid columns and list rows stay the same.
   *
   * It is called once per item, so it can't use hooks. Return a component,
   * e.g. `(props) => <MyTile {...props} />`, to use hooks inside it.
   * @param props The item, its icon, the built-in handlers and the built-in tile.
   * @returns Your element, or `null`/`undefined` for the built-in one.
   */
  renderItem?: (props: FileBrowserItemProps) => ReactNode;
}): JSX.Element {
  const sort = props.sort ?? false;
  const tree = useMemo(
    () =>
      buildTree(
        props.fileSystemRaw.map((file) => `${props.base ?? ""}${file}`),
        sort,
      ),
    [props.fileSystemRaw, props.base, sort],
  );
  const [history, setHistory] = useState(() => startHistory(tree));
  const [historyTree, setHistoryTree] = useState(tree);
  const [view, setView] = useState<FileBrowserView>("grid");
  const menu = useRef<ContextMenuControl | null>(null);

  if (historyTree !== tree) {
    setHistoryTree(tree);
    setHistory(startHistory(tree));
  }

  useEffect(() => {
    menu.current?.close();
  }, [tree]);

  const { path, items } = useMemo(() => {
    let target = tree;
    const path: string[] = [];
    for (const step of history) {
      const entry = target[step];
      if (!entry || entry.endName !== undefined) break;
      path.push(entry.folder);
      target = entry.children;
    }
    const items = target
      .map((entry, index) => ({ entry, index, item: toItem(entry, path) }))
      .filter(({ entry }) => !isFolderMarker(entry));
    return { path, items };
  }, [tree, history]);

  const getIcon = props.getIcon;
  const icons = useMemo(
    () => items.map(({ item }) => getIcon?.(item) ?? defaultIcon(item)),
    [items, getIcon],
  );

  const latest = useRef({ props, history, path });
  useLayoutEffect(() => {
    latest.current = { props, history, path };
  });

  const openItem = useCallback((index: number, item: FileBrowserItem) => {
    const current = latest.current;
    if (item.isFolder)
      setHistory([...current.history.slice(0, current.path.length), index]);
    else current.props.customAction?.(item.path);
  }, []);

  const onItemClick = useCallback<ItemClickHandler>(
    (index, item, event) => {
      latest.current.props.onItemClick?.(item, event);
      if (!event.defaultPrevented) openItem(index, item);
    },
    [openItem],
  );

  const onItemContextMenu = useCallback<ItemClickHandler>(
    (_index, item, event) => {
      const entries = latest.current.props.contextMenu?.(item);
      if (!entries?.length) return;
      event.preventDefault();
      let { clientX: x, clientY: y } = event;
      if (x === 0 && y === 0) {
        const rect = event.currentTarget.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      }
      menu.current?.open({ item, x, y, entries });
    },
    [],
  );

  const root = rootDepth(tree);
  const atRoot = path.length <= root;
  const goUp = () => setHistory(history.slice(0, path.length - 1));
  const fillContainer = props.fillContainer ?? true;

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: fillContainer ? "100%" : `${8 * 9 + 900}px`,
        height: fillContainer ? "100%" : "700px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        containerType: "inline-size",
      }}
      onKeyDown={(event) => {
        if (event.key !== "Backspace" || atRoot) return;
        const element = event.target as HTMLElement;
        if (
          element.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName)
        )
          return;
        event.preventDefault();
        goUp();
      }}
    >
      <Toolbar
        path={path}
        root={root}
        goTo={(depth) => setHistory(history.slice(0, depth))}
        itemCount={items.length}
        view={view}
        setView={setView}
      />
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          p: 1,
          display: view === "grid" ? "grid" : "flex",
          flexDirection: "column",
          gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))",
          alignContent: "start",
          gap: view === "grid" ? 1 : 0.25,
        }}
      >
        {items.length === 0 ? (
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", p: 2, gridColumn: "1 / -1" }}
          >
            This folder is empty.
          </Typography>
        ) : null}
        {items.map(({ index, item }, position) => {
          const icon = icons[position];
          const defaultItem = (
            <FileItem
              item={item}
              index={index}
              icon={icon}
              view={view}
              onItemClick={onItemClick}
              onItemContextMenu={onItemContextMenu}
            />
          );
          return (
            <Fragment key={`${history.length}-${index}`}>
              {props.renderItem?.({
                item,
                view,
                icon,
                onClick: (event) => onItemClick(index, item, event),
                onContextMenu: (event) => onItemContextMenu(index, item, event),
                open: () => openItem(index, item),
                defaultItem,
              }) ?? defaultItem}
            </Fragment>
          );
        })}
      </Box>
      <ContextMenu control={menu} />
    </Box>
  );
}
export type { FileBrowserItem, FileBrowserItemProps };
export default FileBrowser;
