import type { SourceFileEntry } from "@site/src/components/SourceFile";

const GITHUB = "https://github.com/ArcLockProject/mono/blob/dev";

/** A file of the repo, loaded when its tab opens. `path` is relative to the repo root. */
const file = (
  label: string,
  path: string,
  load: () => Promise<{ default: string }>,
): SourceFileEntry => ({
  label,
  path,
  source: load,
  href: `${GITHUB}/${path}`,
});

const VIDEOS = file(
  "Demo videos",
  "docs/src/pages/demo/_app/videos.ts",
  () => import("../_app/videos.ts?raw"),
);

/** The files each demo shows in its Source view, main file first. */
const SOURCES = {
  desktop: [
    file(
      "Desktop app",
      "docs/src/pages/demo/_app/Desktop.tsx",
      () => import("../_app/Desktop.tsx?raw"),
    ),
    VIDEOS,
  ],
  media: [
    file(
      "Media library app",
      "docs/src/pages/demo/_app/Media.tsx",
      () => import("../_app/Media.tsx?raw"),
    ),
    VIDEOS,
  ],
  maze: [
    file(
      "Maze app",
      "docs/src/pages/demo/_app/Maze.tsx",
      () => import("../_app/Maze.tsx?raw"),
    ),
  ],
};

export { SOURCES };
