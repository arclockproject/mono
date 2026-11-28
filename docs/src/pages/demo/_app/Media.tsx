import { GalleryBrowser } from "@arclockproject/common/components/GalleryBrowser";
import Image from "@arclockproject/common/components/Image";
import {
  AudioHolder,
  MiniPlayer,
  PlayerContextProvider,
  usePlayer,
  VideoPlayer,
} from "@arclockproject/common/components/Player";
import { Reader } from "@arclockproject/common/components/Reader";
import { useLocalStorageState } from "@arclockproject/common/library/LocalStorage";
import Time from "@arclockproject/common/library/Time";
import { placeholder, REMOTE } from "@site/src/components/DemoAssets";
import clsx from "clsx";
import { useEffect, useMemo } from "react";
import { VIDEOS, type Video } from "./videos";

const TABS = ["watch", "gallery", "read"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = {
  watch: "Watch",
  gallery: "Gallery",
  read: "Read",
};

/** Unix seconds of the last time each video was opened, by video id. */
type History = Record<string, number>;

const isTab = (value: unknown) =>
  TABS.includes(value as Tab) ? (value as Tab) : undefined;
const isHistory = (value: unknown) =>
  typeof value === "object" &&
  value !== null &&
  Object.values(value).every((time) => typeof time === "number")
    ? (value as History)
    : undefined;

function lastWatched(history: History, id: string): string {
  const time = history[id];
  if (time === undefined) return "Not watched yet";
  if (Date.now() / 1000 - time < 60) return "Watched just now";
  return `Watched ${Time.timeSince(time)} ago`;
}

function WatchTab(props: { history: History }) {
  const player = usePlayer();
  const current = player.internal.playerData.value;

  useEffect(() => {
    if (!current) player.internal.playerData.set(VIDEOS[0]!);
  }, []);

  return (
    <div className="row">
      <div className="col col--8 margin-bottom--md">
        <VideoPlayer
          isPlaylist={false}
          chapters={[]}
          heatmap={[]}
          showInlineTitle
        />
      </div>
      <div className="col col--4">
        <h3>Up next</h3>
        {VIDEOS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={clsx(
              "card margin-bottom--sm",
              current?.id === entry.id && "shadow--md",
            )}
            onClick={() => player.internal.playerData.set(entry)}
            style={{
              display: "flex",
              gap: 12,
              width: "100%",
              padding: 8,
              textAlign: "left",
              cursor: "pointer",
              border:
                current?.id === entry.id
                  ? "2px solid var(--ifm-color-primary)"
                  : "2px solid transparent",
            }}
          >
            <div
              style={{
                width: 120,
                height: 68,
                flexShrink: 0,
                overflow: "hidden",
                borderRadius: 4,
              }}
            >
              <Image
                src={entry.files.thumbnail}
                renderer="image"
                enableMovement={false}
                styleImage={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>
            <div>
              <strong>{entry.title}</strong>
              <div style={{ fontSize: 13, opacity: 0.7 }}>
                {lastWatched(props.history, entry.id)}
              </div>
            </div>
          </button>
        ))}
        <button
          type="button"
          className="button button--primary button--block"
          onClick={() => player.internal.playlistContent.set(VIDEOS)}
        >
          Play all as a playlist
        </button>
      </div>
    </div>
  );
}

function GalleryTab() {
  const items = useMemo(
    () => [
      { url: `${REMOTE.base}/psd-demo.png` },
      {
        url: placeholder(1600, 900, {
          background: "0f172a",
          color: "38bdf8",
          text: "Landscape 16:9",
        }),
      },
      {
        url: placeholder(900, 1600, {
          background: "3b0764",
          color: "f0abfc",
          text: "Portrait 9:16",
        }),
      },
      {
        url: placeholder(1200, 1200, {
          background: "14532d",
          color: "86efac",
          text: "Square",
        }),
      },
      {
        url: placeholder(3000, 1000, {
          background: "7c2d12",
          color: "fdba74",
          text: "Panorama 3:1",
        }),
      },
      { url: VIDEOS[0]!.files.video, type: "video" as const },
    ],
    [],
  );
  return (
    <div style={{ overflow: "hidden", borderRadius: 16 }}>
      <GalleryBrowser
        id="demo-media-gallery"
        backgroundBloom
        useTwoResolutions={false}
        cache={{ range: 2, clearOnIDChange: true }}
        data={{ items }}
      />
    </div>
  );
}

function ReadTab() {
  const [page, setPage] = useLocalStorageState("demo-media-page", 0, (value) =>
    typeof value === "number" ? value : undefined,
  );
  const items = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        url: placeholder(800, 1200, {
          background: i % 2 ? "1e293b" : "334155",
          color: "f8fafc",
          text: `Page ${i + 1}`,
        }),
      })),
    [],
  );
  return (
    <div>
      <p>
        The reader remembers your page. Leave this tab or reload, and it opens
        where you stopped.
      </p>
      <Reader
        id="demo-media-book"
        title="Artbook"
        data={{ items }}
        defaultPage={page}
        onPageChange={setPage}
        cache={{ range: 2, clearOnIDChange: true }}
        style={{ root: { sx: { height: 560 } } }}
      />
    </div>
  );
}

function MediaLibrary(props: {
  tab: Tab;
  setTab: (tab: Tab) => void;
  history: History;
}) {
  const player = usePlayer();
  const playing = !!player.internal.playerData.value;

  useEffect(() => {
    player.internal.miniPlayer.set(props.tab !== "watch" && playing);
  }, [props.tab, playing]);

  return (
    <div className="container margin-bottom--xl">
      <div className="button-group margin-bottom--md">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={clsx(
              "button",
              props.tab === tab ? "button--primary" : "button--secondary",
            )}
            onClick={() => props.setTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>
      {props.tab === "watch" && <WatchTab history={props.history} />}
      {props.tab === "gallery" && <GalleryTab />}
      {props.tab === "read" && <ReadTab />}
      <MiniPlayer />
      <AudioHolder />
    </div>
  );
}

export default function MediaApp() {
  const [tab, setTab] = useLocalStorageState<Tab>(
    "demo-media-tab",
    "watch",
    isTab,
  );
  const [history, setHistory] = useLocalStorageState<History>(
    "demo-media-history",
    {},
    isHistory,
  );

  const remember = (entry: Video) =>
    setHistory({ ...history, [entry.id]: Math.floor(Date.now() / 1000) });

  return (
    <PlayerContextProvider navigate={() => setTab("watch")}>
      <HistoryRecorder onOpen={remember} />
      <MediaLibrary tab={tab} setTab={setTab} history={history} />
    </PlayerContextProvider>
  );
}

/** Saves the time whenever the player opens another video. */
function HistoryRecorder(props: { onOpen: (entry: Video) => void }) {
  const player = usePlayer();
  const current = player.internal.playerData.value;
  useEffect(() => {
    if (current) props.onOpen(current as Video);
  }, [current?.id]);
  return null;
}
