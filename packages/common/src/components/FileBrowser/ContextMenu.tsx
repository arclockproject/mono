import {
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useState,
} from "react";
import type { FileBrowserItem, FileBrowserMenuItem } from "./types";

/** An open right-click menu: what was clicked, where, and the entries to show. */
type OpenMenu = {
  item: FileBrowserItem;
  x: number;
  y: number;
  entries: FileBrowserMenuItem[];
};

/** Opens and closes the menu without re-rendering the FileBrowser. */
type ContextMenuControl = {
  open: (menu: OpenMenu) => void;
  close: () => void;
};

/**
 * The right-click menu, shown at the cursor. It keeps its own state, so
 * opening it does not re-render every item in the browser.
 */
function ContextMenu(props: {
  control: RefObject<ContextMenuControl | null>;
}): ReactNode {
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    props.control.current = {
      open: (next) => {
        setMenu(next);
        setOpen(true);
      },
      close,
    };
  }, [props.control, close]);

  return (
    <Menu
      open={open}
      onClose={close}
      anchorReference="anchorPosition"
      anchorPosition={menu ? { top: menu.y, left: menu.x } : undefined}
      onContextMenu={(event) => {
        event.preventDefault();
        close();
      }}
      slotProps={{ list: { dense: true, sx: { minWidth: 180 } } }}
    >
      {menu?.entries.map((entry, index) =>
        entry === "divider" ? (
          <Divider key={index} />
        ) : (
          <MenuItem
            key={index}
            disabled={entry.disabled}
            onClick={() => {
              close();
              entry.onClick(menu.item);
            }}
          >
            {entry.icon ? <ListItemIcon>{entry.icon}</ListItemIcon> : null}
            <ListItemText
              inset={
                !entry.icon &&
                menu.entries.some((e) => e !== "divider" && e.icon)
              }
            >
              {entry.label}
            </ListItemText>
          </MenuItem>
        ),
      )}
    </Menu>
  );
}

export type { ContextMenuControl };
export default ContextMenu;
