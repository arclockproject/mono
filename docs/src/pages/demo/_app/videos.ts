import type { VideoPlayer } from "@arclockproject/common/components/Player";
import { REMOTE } from "@site/src/components/DemoAssets";
import type { ComponentProps } from "react";

/** One entry the Player can load. */
type Video = NonNullable<ComponentProps<typeof VideoPlayer>["videoData"]>;

/** Builds a Player entry from a file name in the demo-assets repo. */
const video = (name: string, title: string): Video => ({
  id: name,
  title,
  files: {
    video: `${REMOTE.base}/${name}.mp4`,
    audio: `${REMOTE.base}/${name}.m4a`,
    subtitles: null,
    thumbnail: `${REMOTE.base}/${name}.webp`,
  },
  meta: null,
});

/** The two demo videos, used by every demo. */
const VIDEOS: Video[] = [
  video("PXQZNGjZIFo", "Original Piece #2 by Eis3"),
  video("jkZ53T1Pu7k", "Original Piece #3 by Eis3"),
];

export { VIDEOS };
export type { Video };
