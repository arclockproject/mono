import type { Entry, FileBrowserItem } from "./types";

type ProcessingDivision = {
  folder: string;
  children: {
    path: string;
    toCompute: string[];
  }[];
};

const URL_ORIGIN = /^([a-z][a-z\d+.-]*:\/\/[^/]*)(\/.*)?$/i;

/** Splits a path on `/`, keeping a URL origin like `https://example.com` as one segment. */
function splitPath(path: string): string[] {
  const origin = URL_ORIGIN.exec(path);
  if (!origin) return path.split("/");
  return [origin[1]!, ...(origin[2]?.split("/").slice(1) ?? [])];
}

function prepareProcessingEntry(
  segments: string[],
  root: string,
): ProcessingDivision {
  const [folder = "", ...rest] = segments;
  return {
    folder,
    children: [
      {
        path: root,
        toCompute: rest,
      },
    ],
  };
}

function processor(processingDivision: ProcessingDivision[]): Entry[] {
  const groups = new Map<string, ProcessingDivision>();
  for (const current of processingDivision) {
    const existingFolder = groups.get(current.folder);
    if (existingFolder) {
      existingFolder.children.push(...current.children);
    } else {
      groups.set(current.folder, current);
    }
  }

  return [...groups.values()].map<Entry>((row) => {
    if (row.children.length === 1 && row.children[0]?.toCompute.length === 0) {
      return {
        folder: row.folder,
        endName: row.children[0]?.path,
        children: [],
      };
    }
    return {
      folder: row.folder,
      children: processor(
        row.children.map((child) =>
          prepareProcessingEntry(child.toCompute, child.path),
        ),
      ),
    };
  });
}

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

/** Folders first, then natural A-Z order (`file2` before `file10`). */
function sortTree(entries: Entry[]): Entry[] {
  return entries
    .map((entry) =>
      entry.endName === undefined
        ? { ...entry, children: sortTree(entry.children) }
        : entry,
    )
    .sort((a, b) => {
      const aFile = a.endName !== undefined;
      const bFile = b.endName !== undefined;
      if (aFile !== bFile) return aFile ? 1 : -1;
      return collator.compare(a.folder, b.folder);
    });
}

/** Builds the folder tree from full paths. */
function buildTree(paths: string[], sort: boolean): Entry[] {
  const tree = processor(
    paths.map((raw) => prepareProcessingEntry(splitPath(raw), raw)),
  );
  return sort ? sortTree(tree) : tree;
}

/**
 * How many levels the home button opens. Absolute paths all start with an
 * empty segment, so that `/` folder is skipped and the home icon stands for it.
 */
function rootDepth(entries: Entry[]): number {
  const only = entries.length === 1 ? entries[0] : undefined;
  return only && only.endName === undefined && only.folder === "" ? 1 : 0;
}

/** How many single-folder levels to open at the start. Stops before a file. */
function autoOpenDepth(entries: Entry[]): number {
  const only = entries.length === 1 ? entries[0] : undefined;
  if (!only || only.endName !== undefined) return 0;
  return 1 + autoOpenDepth(only.children);
}

/** A path ending in `/` only marks a folder. It is not shown as a file. */
function isFolderMarker(entry: Entry): boolean {
  return entry.endName?.endsWith("/") ?? false;
}

/** Name shown for a folder or breadcrumb. */
function displayName(folder: string, isRoot: boolean): string {
  if (folder !== "") return folder;
  return isRoot ? "/" : "//";
}

/** Turns a tree node into the public item shape. */
function toItem(entry: Entry, parentPath: string[]): FileBrowserItem {
  if (entry.endName !== undefined) {
    const dot = entry.folder.lastIndexOf(".");
    return {
      name: entry.folder,
      path: entry.endName,
      isFolder: false,
      extension:
        dot > 0 ? entry.folder.slice(dot + 1).toLowerCase() : undefined,
    };
  }
  const segments = [...parentPath, entry.folder];
  return {
    name: displayName(entry.folder, parentPath.length === 0),
    path: segments.join("/") || "/",
    isFolder: true,
  };
}

export {
  autoOpenDepth,
  buildTree,
  displayName,
  isFolderMarker,
  rootDepth,
  toItem,
};
