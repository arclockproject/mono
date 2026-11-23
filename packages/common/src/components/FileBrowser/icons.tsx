import AudioFileOutlinedIcon from "@mui/icons-material/AudioFileOutlined";
import CodeOutlinedIcon from "@mui/icons-material/CodeOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import FolderIcon from "@mui/icons-material/Folder";
import FolderZipOutlinedIcon from "@mui/icons-material/FolderZipOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import MovieOutlinedIcon from "@mui/icons-material/MovieOutlined";
import ViewInArOutlinedIcon from "@mui/icons-material/ViewInArOutlined";
import type { ReactNode } from "react";
import type { FileBrowserItem } from "./types";

const GROUPS: [string[], ReactNode][] = [
  [
    [
      "png",
      "jpg",
      "jpeg",
      "gif",
      "webp",
      "avif",
      "svg",
      "bmp",
      "ico",
      "tga",
      "dds",
    ],
    <ImageOutlinedIcon key="image" />,
  ],
  [
    ["mp4", "mkv", "webm", "mov", "avi", "m4v"],
    <MovieOutlinedIcon key="video" />,
  ],
  [
    ["mp3", "wav", "m4a", "ogg", "flac", "aac", "opus"],
    <AudioFileOutlinedIcon key="audio" />,
  ],
  [
    ["pmx", "pmd", "vmd", "obj", "fbx", "glb", "gltf"],
    <ViewInArOutlinedIcon key="3d" />,
  ],
  [["zip", "rar", "7z", "tar", "gz"], <FolderZipOutlinedIcon key="archive" />],
  [
    [
      "ts",
      "tsx",
      "js",
      "jsx",
      "mjs",
      "cjs",
      "json",
      "html",
      "css",
      "scss",
      "xml",
      "yml",
      "yaml",
    ],
    <CodeOutlinedIcon key="code" />,
  ],
  [
    ["txt", "md", "log", "csv", "srt", "vtt", "ass", "pdf"],
    <DescriptionOutlinedIcon key="text" />,
  ],
];

const BY_EXTENSION = new Map(
  GROUPS.flatMap(([extensions, icon]) =>
    extensions.map((extension) => [extension, icon] as const),
  ),
);

/** The built-in icon for an item, picked by its extension. */
function defaultIcon(item: FileBrowserItem): ReactNode {
  if (item.isFolder) return <FolderIcon color="primary" />;
  return (
    (item.extension && BY_EXTENSION.get(item.extension)) ?? (
      <InsertDriveFileOutlinedIcon />
    )
  );
}

export { defaultIcon };
