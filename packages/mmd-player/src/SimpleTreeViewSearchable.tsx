//#region Imports

import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";
import { useState } from "react";
import type { JSX } from "react/jsx-runtime";
import type { processedDivision } from "./config";
import { fileLabel } from "./loadFile";

//#endregion

//#region SimpleTreeViewSearchable.tsx

type TreeNode = {
  id: string;
  label: string;
  file?: string;
  children: TreeNode[];
};

/** Turns the file list into tree nodes. A folder with a single subfolder is shown as one `a/b` item. */
const toNodes = (divisions: processedDivision[], parent = ""): TreeNode[] =>
  divisions.map((division) => {
    if (division.children.length === 0)
      return {
        id: `file:${division.endName}`,
        label: division.folder,
        file: division.endName,
        children: [],
      };
    let folder = division;
    let label = folder.folder;
    while (
      folder.children.length === 1 &&
      folder.children[0]!.children.length
    ) {
      folder = folder.children[0]!;
      label += `/${folder.folder}`;
    }
    const id = `${parent}/${label}`;
    return { id, label, children: toNodes(folder.children, id) };
  });

/** Keeps files whose name (or its romaji) contains every word. */
function processedDivisionFilter(
  divisions: processedDivision[],
  words: string[],
): processedDivision[] {
  return divisions.flatMap((division) => {
    if (division.children.length === 0) {
      const name = division.endName.toLowerCase();
      const romaji = division.endNameRomaji.toLowerCase();
      return words.every((w) => name.includes(w) || romaji.includes(w))
        ? [division]
        : [];
    }
    const children = processedDivisionFilter(division.children, words);
    return children.length ? [{ ...division, children }] : [];
  });
}

function renderNodes(nodes: TreeNode[], isPicked: (file: string) => boolean) {
  return nodes.map((node) =>
    node.file ? (
      <TreeItem
        key={node.id}
        itemId={node.id}
        label={`${isPicked(node.file) ? "✓ " : ""}${fileLabel(node.file)}`}
        title={node.label}
        sx={isPicked(node.file) ? { color: "primary.main" } : undefined}
      />
    ) : (
      <TreeItem key={node.id} itemId={node.id} label={node.label}>
        {renderNodes(node.children, isPicked)}
      </TreeItem>
    ),
  );
}

/**
 * A folder tree of MMD files. Tap a file to pick it. Searching hides files
 * that don't match, and folders left without files.
 */
function SimpleTreeViewSearchable(props: {
  files: processedDivision[];
  /** Space-separated words. Kana or romaji. */
  search: string;
  /** Marks a file with ✓. */
  isPicked: (file: string) => boolean;
  onPick: (file: string) => void;
}): JSX.Element {
  const [expanded, setExpanded] = useState<string[]>([]);
  const words = props.search.toLowerCase().split(" ").filter(Boolean);
  const nodes = toNodes(
    words.length ? processedDivisionFilter(props.files, words) : props.files,
  );
  return (
    <SimpleTreeView
      disableSelection
      expandedItems={expanded}
      onExpandedItemsChange={(_, ids) => setExpanded(ids)}
      onItemClick={(_, id) => {
        if (id.startsWith("file:")) props.onPick(id.slice("file:".length));
      }}
    >
      {renderNodes(nodes, props.isPicked)}
    </SimpleTreeView>
  );
}

//#endregion

export { SimpleTreeViewSearchable };
