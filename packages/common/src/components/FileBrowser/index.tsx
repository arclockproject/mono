import { Box, Paper } from "@mui/material";
import { useEffect, useState } from "react";
import type { JSX } from "react/jsx-runtime";

type processingDivision = {
  folder: string;
  children: {
    path: string;
    toCompute: string[];
  }[];
};
function prepareProcessingEntry(
  current: string,
  root: string,
): processingDivision {
  const currentSplit = current.split("/");
  return {
    folder: currentSplit.shift() ?? "ERROR",
    children: [
      {
        path: root,
        toCompute: currentSplit,
      },
    ],
  };
}
type Entry = {
  folder: string;
  children: Entry[];
  endName?: string;
};
function processor(processingDivision: processingDivision[]): Entry[] {
  const prepared = processingDivision?.reduce((prev, current) => {
    // if (current.children[0].toCompute.length === 0) return prev;
    const existingFolder = prev.find((item) => item.folder === current.folder);
    if (existingFolder) {
      existingFolder.children.push(...current.children);
    } else {
      prev.push(current);
    }
    return prev;
  }, [] as processingDivision[]);

  return prepared?.map<Entry>((row) => {
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
          prepareProcessingEntry(child.toCompute.join("/"), child.path),
        ),
      ),
    };
  });
}

function fileSystemFactory(raw: string[]): Entry[] {
  return processor(raw.map((raw) => prepareProcessingEntry(raw, raw)));
}
function depthUntilNotLengthZero<k extends { children: k[] }>(
  array?: k[],
): number {
  if (array?.length === 1) {
    return 1 + depthUntilNotLengthZero(array[0]?.children);
  } else {
    return 0;
  }
}
function FileBrowser(props: {
  fileSystemRaw: string[];
  base?: string;
  /**
   * @default true
   */
  fillContainer?: boolean;
  customAction?: (file: string) => void;
}): JSX.Element {
  const [fileSystem, setFileSystem] = useState<Entry[]>([]);
  const [depthHistory, setDepthHistory] = useState<number[]>([]);
  useEffect(() => {
    const system = fileSystemFactory(
      props.fileSystemRaw.map((file) => `${props.base ?? ""}${file}`),
    );
    setFileSystem(system);
    setDepthHistory(new Array(depthUntilNotLengthZero(system)).fill(0));
  }, [props.fileSystemRaw, props.base]);
  const { target, path } = depthHistory.reduce(
    (currentFileSystem, nextStep) => ({
      target: currentFileSystem.target[nextStep]!.children,
      path: [
        ...currentFileSystem.path,
        currentFileSystem.target[nextStep]!.folder,
      ],
    }),
    { target: fileSystem, path: [] as string[] },
  );
  const fillContainer = props.fillContainer ?? true;
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: fillContainer ? "100%" : `${8 * 9 + 900}px`,
        height: fillContainer ? "100%" : "700px",
        p: 1,
        overflow: "auto",
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: "8px",
        alignContent: "flex-start",
        wordWrap: "anywhere",
      }}
    >
      <Box
        sx={{
          height: "50px",
          minWidth: "100%",
          overflowX: "auto",
          textWrap: "nowrap",
        }}
      >
        <Paper
          sx={{
            px: 1,
            minWidth: "20px",
            height: "50px",
            display: "inline-flex",
            borderRadius: "8px",
            cursor: "pointer",
            justifyContent: "center",
            alignItems: "center",
          }}
          onClick={() => {
            setDepthHistory([]);
          }}
        >
          ^
        </Paper>
        {path.map((file, index) => (
          <Paper
            key={file}
            sx={{
              px: 1,
              ml: 1,
              minWidth: "50px",
              height: "50px",
              borderRadius: "8px",
              cursor: "pointer",
              display: "inline-flex",
              textWrap: "nowrap",
              justifyContent: "center",
              alignItems: "center",
            }}
            onClick={() => {
              setDepthHistory(depthHistory.slice(0, index + 1));
            }}
          >
            {file === "" ? (index === 0 ? "/" : "//") : file}
          </Paper>
        ))}
      </Box>
      {target.map((item, index) => {
        const name = item.endName;
        const isFolder = name === undefined;
        // if (item.folder === "") return undefined;
        return (
          <Paper
            key={`${item.folder}-${depthHistory.length}`}
            variant={isFolder ? "elevation" : "outlined"}
            sx={{
              width: "150px",
              height: "150px",
              borderRadius: "8px",
              cursor: "pointer",
              padding: "8px",
              overflowY: "auto",
              border: isFolder ? undefined : "none",
            }}
            onClick={() => {
              if (props.customAction && name && !name.endsWith("/")) {
                props.customAction(name);
              }
              if (isFolder) setDepthHistory([...depthHistory, index]);
            }}
          >
            {item.endName ? `${item.folder}` : item.folder ? item.folder : "/"}
          </Paper>
        );
      })}
    </Box>
  );
}
export default FileBrowser;
