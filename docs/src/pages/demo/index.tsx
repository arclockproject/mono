import Link from "@docusaurus/Link";
import { REMOTE } from "@site/src/components/DemoAssets";
import Heading from "@theme/Heading";
import Layout from "@theme/Layout";
import clsx from "clsx";
import styles from "./_layout/DemoIndex.module.css";

/** Guide page for each name in a demo's `uses` list. */
const GUIDES: Record<string, string> = {
  Window: "/docs/common/components/Window",
  FileBrowser: "/docs/common/components/FileBrowser",
  Player: "/docs/common/components/Player",
  Image: "/docs/common/components/Image",
  PSDViewer: "/docs/common/components/PSDViewer",
  AudioMixer: "/docs/common/components/AudioMixer",
  GalleryBrowser: "/docs/common/components/GalleryBrowser",
  Reader: "/docs/common/components/Reader",
  MMDPlayer: "/docs/mmd-player/component",
  LocalStorage: "/docs/common/library/LocalStorage",
  Time: "/docs/common/library/Time",
  AStar: "/docs/common/library/AStar",
  SeededRandom: "/docs/common/library/Random#seeded-vs-unseeded",
  AudioInstant: "/docs/common/library/AudioInstant",
};

const DEMOS = [
  {
    to: "/demo/desktop",
    source: "Desktop.tsx",
    title: "Desktop",
    image: `${REMOTE.base}/demo/desktop-preview.png`,
    text: "Windows you can drag and resize, a file browser that opens videos, pictures, PSDs and songs in their own apps, and MMDPlayer.",
    uses: [
      "Window",
      "FileBrowser",
      "Player",
      "Image",
      "PSDViewer",
      "AudioMixer",
      "MMDPlayer",
    ],
  },
  {
    to: "/demo/media",
    source: "Media.tsx",
    title: "Media library",
    image: `${REMOTE.base}/demo/media-preview.png`,
    text: "Watch, browse a gallery and read an artbook. The music keeps playing in the mini player while you switch tabs.",
    uses: [
      "Player",
      "GalleryBrowser",
      "Reader",
      "Image",
      "LocalStorage",
      "Time",
    ],
  },
  {
    to: "/demo/maze",
    source: "Maze.tsx",
    title: "Gem maze",
    image: `${REMOTE.base}/demo/maze-preview.png`,
    text: "A small game: collect every gem in a seeded maze, with the cheapest route found for you.",
    uses: ["AStar", "SeededRandom", "AudioInstant", "LocalStorage"],
  },
];

export default function DemoIndex() {
  return (
    <Layout
      title="Demos"
      description="Full pages built from ArcLock Project components and libraries."
    >
      <main className="container margin-vert--xl">
        <div className="row">
          {DEMOS.map((demo) => (
            <div key={demo.to} className="col col--4 margin-bottom--lg">
              <div className={clsx("card", styles.card)}>
                <Link to={demo.to} className="card__image">
                  <img
                    src={demo.image}
                    alt=""
                    style={{
                      aspectRatio: "16 / 9",
                      objectFit: "cover",
                      width: "100%",
                    }}
                  />
                </Link>
                <div className="card__body">
                  <Heading as="h3">
                    <Link to={demo.to}>{demo.title}</Link>
                  </Heading>
                  <p>{demo.text}</p>
                  {demo.uses.map((name) => (
                    <Link
                      key={name}
                      to={GUIDES[name]}
                      className={clsx(
                        "badge badge--secondary margin-right--xs margin-bottom--xs",
                        styles.tag,
                      )}
                    >
                      {name}
                    </Link>
                  ))}
                </div>
                <div className="card__footer">
                  <Link
                    to={demo.to}
                    className="button button--primary button--sm margin-right--sm"
                  >
                    Open demo
                  </Link>
                  <Link
                    to={`${demo.to}#source`}
                    className="button button--secondary button--sm"
                  >
                    Source: <code>{demo.source}</code>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </Layout>
  );
}
