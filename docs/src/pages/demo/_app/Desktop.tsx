import AudioMixer, {
  AudioMixerProvider,
  useAudioMixer,
} from "@arclockproject/common/components/AudioMixer";
import FileBrowser from "@arclockproject/common/components/FileBrowser";
import Image from "@arclockproject/common/components/Image";
import {
  AudioHolder,
  MiniPlayer,
  PlayerContextProvider,
  usePlayer,
  VideoPlayer,
} from "@arclockproject/common/components/Player";
import PSDViewer from "@arclockproject/common/components/PSDViewer";
import { Text } from "@arclockproject/common/components/Text";
import Window from "@arclockproject/common/components/Window";
import MMD from "@arclockproject/mmd-player";
import { placeholder, REMOTE } from "@site/src/components/DemoAssets";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { VIDEOS } from "./videos";

type App = "welcome" | "files" | "video" | "photos" | "psd" | "mixer" | "mmd";

const APPS: Record<
  App,
  {
    title: string;
    icon: string;
    size: { width: number; height: number };
    onDesktop: boolean;
  }
> = {
  welcome: {
    title: "Welcome",
    icon: "👋",
    size: { width: 420, height: 260 },
    onDesktop: false,
  },
  files: {
    title: "Files",
    icon: "🗂️",
    size: { width: 560, height: 400 },
    onDesktop: true,
  },
  video: {
    title: "Video",
    icon: "🎬",
    size: { width: 680, height: 470 },
    onDesktop: true,
  },
  photos: {
    title: "Photos",
    icon: "🖼️",
    size: { width: 520, height: 400 },
    onDesktop: true,
  },
  psd: {
    title: "Layers",
    icon: "🎨",
    size: { width: 760, height: 520 },
    onDesktop: true,
  },
  mixer: {
    title: "Mixer",
    icon: "🎚️",
    size: { width: 600, height: 440 },
    onDesktop: true,
  },
  mmd: {
    title: "MMD",
    icon: "✨",
    size: { width: 820, height: 540 },
    onDesktop: true,
  },
};

/** What each file in the Files app opens, and with which app. */
type FileTarget =
  | { app: "video"; index: number }
  | { app: "photos" | "psd"; src: string }
  | { app: "mixer"; id: string; title: string; src: string }
  | { app: "mmd" };

const PICTURE_1 = placeholder(1280, 720, {
  background: "1e1b4b",
  color: "c7d2fe",
  text: "Picture 1",
});
const PICTURE_2 = placeholder(1280, 720, {
  background: "042f2e",
  color: "99f6e4",
  text: "Picture 2",
});
const FILES: Record<string, FileTarget> = {
  "/Videos/Original Piece 2.mp4": { app: "video", index: 0 },
  "/Videos/Original Piece 3.mp4": { app: "video", index: 1 },
  "/Music/Original Piece 2.m4a": {
    app: "mixer",
    id: "piece-2",
    title: "Original Piece #2",
    src: `${REMOTE.base}/PXQZNGjZIFo.m4a`,
  },
  "/Music/Original Piece 3.m4a": {
    app: "mixer",
    id: "piece-3",
    title: "Original Piece #3",
    src: `${REMOTE.base}/jkZ53T1Pu7k.m4a`,
  },
  "/Pictures/Picture 1.webp": { app: "photos", src: PICTURE_1 },
  "/Pictures/Picture 2.webp": { app: "photos", src: PICTURE_2 },
  "/Pictures/Layers render.png": {
    app: "photos",
    src: `${REMOTE.base}/psd-demo.png`,
  },
  "/Pictures/Placeholders/Wide 1920x1080.webp": {
    app: "photos",
    src: placeholder(1920, 1080, { background: "0f172a", color: "38bdf8" }),
  },
  "/Pictures/Placeholders/Tall 1080x1920.webp": {
    app: "photos",
    src: placeholder(1080, 1920, { background: "3b0764", color: "f0abfc" }),
  },
  "/Pictures/Placeholders/Huge 4000x4000.webp": {
    app: "photos",
    src: placeholder(4000, 4000, {
      background: "14532d",
      color: "86efac",
      text: "Zoom in",
    }),
  },
  "/Artwork/Layers.psd": { app: "psd", src: `${REMOTE.base}/psd-demo.psd` },
  "/MMD/Melancholy Night.vmd": { app: "mmd" },
};

const MMD_PRESETS = () => [
  {
    title: "メランコリ・ナイト",
    subTitle: "(Miku Cover)",
    thumbnail: placeholder(1280, 720, {
      background: "4a044e",
      color: "f5d0fe",
      text: "Melancholy Night",
    }),
    music: `${REMOTE.noname0310}/motion/melancholy_night/melancholy_night.mp3`,
    vmdCamera: `${REMOTE.base}/メランコリ・ナイト_カメラ.cam.vmd`,
    entities: [
      {
        movement: [`${REMOTE.base}/メランコリ・ナイト.chara.vmd`],
        model: {
          file: "yyb_hatsune_miku_10th_v1.02.pmx",
          folder: `${REMOTE.noname0310}/model/yyb_hatsune_miku_10th_ff/`,
        },
      },
    ],
    stageFolder: "",
    stagePMX: "",
    entitiesOffset: [],
    entitiesAngle: [],
    actionMemory: [],
  },
];

const MMD_DETAILS = () => ({
  pmd: [],
  pmx: [
    `${REMOTE.noname0310}/model/yyb_hatsune_miku_10th_ff/yyb_hatsune_miku_10th_v1.02.pmx`,
  ],
  vmd: [
    `${REMOTE.base}/メランコリ・ナイト_カメラ.cam.vmd`,
    `${REMOTE.base}/メランコリ・ナイト.chara.vmd`,
  ],
});

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span>
      {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

function Desktop() {
  const player = usePlayer();
  const mixer = useAudioMixer();
  const [open, setOpen] = useState<App[]>(["welcome"]);
  const [order, setOrder] = useState<App[]>(["welcome"]);
  const [photo, setPhoto] = useState(PICTURE_1);
  const [psd, setPsd] = useState(`${REMOTE.base}/psd-demo.psd`);
  const files = useMemo(() => Object.keys(FILES), []);

  const focus = (app: App) =>
    setOrder((list) => [...list.filter((other) => other !== app), app]);
  const launch = (app: App) => {
    setOpen((list) => (list.includes(app) ? list : [...list, app]));
    focus(app);
  };
  const close = (app: App) =>
    setOpen((list) => list.filter((other) => other !== app));

  const videoOpen = open.includes("video");
  const hasVideo = !!player.internal.playerData.value;
  useEffect(() => {
    player.internal.miniPlayer.set(!videoOpen && hasVideo);
  }, [videoOpen, hasVideo]);

  const openFile = (path: string) => {
    const target = FILES[path];
    if (!target) return;
    if (target.app === "video")
      player.internal.playerData.set(VIDEOS[target.index]!);
    if (target.app === "photos") setPhoto(target.src);
    if (target.app === "psd") setPsd(target.src);
    if (target.app === "mixer")
      mixer?.add({ id: target.id, title: target.title, url: target.src });
    launch(target.app);
  };

  const content: Record<App, () => ReactNode> = {
    welcome: () => (
      <div style={{ padding: 16 }}>
        <Text speed={25} variant="body1">
          Every window here is a Window component. Open Files and click a video,
          song, picture or PSD to open it in its own app. Close the video and
          the music keeps playing in the mini player.
        </Text>
      </div>
    ),
    files: () => (
      <FileBrowser fileSystemRaw={files} base="" sort customAction={openFile} />
    ),
    video: () => (
      <div
        style={{
          height: "100%",
          overflow: "hidden",
          borderRadius: 8,
          background: "#000",
        }}
      >
        <VideoPlayer
          isPlaylist={false}
          chapters={[]}
          heatmap={[]}
          showInlineTitle
        />
        {!hasVideo && <p style={{ padding: 8 }}>Open a video from Files.</p>}
      </div>
    ),
    photos: () => (
      <div
        style={{
          position: "relative",
          height: "100%",
          overflow: "hidden",
          borderRadius: 8,
          background: "#111",
        }}
      >
        <Image
          key={photo}
          src={photo}
          renderer="image"
          enableMovement
          styleImage={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>
    ),
    psd: () => (
      <div style={{ position: "relative", height: "100%" }}>
        <PSDViewer src={psd} />
      </div>
    ),
    mixer: () => (
      <div style={{ padding: 8 }}>
        {mixer?.tracks.length === 0 && (
          <p>Open a song from Files to add it here.</p>
        )}
        <AudioMixer corsMedia />
      </div>
    ),
    mmd: () => (
      <MMD
        maxWidth="100%"
        maxHeight="100%"
        presets={MMD_PRESETS}
        rawMMDDetails={MMD_DETAILS}
        getFileBrowser={(data) => <FileBrowser {...data} />}
        basePathMMD=""
        loadAudioMeta={(value) => [
          `${REMOTE.base}/${value}.m4a`,
          `${REMOTE.base}/${value}.webp`,
        ]}
        noDebug
      />
    ),
  };

  return (
    <div
      style={{
        position: "relative",
        height: "calc(100vh - var(--ifm-navbar-height))",
        overflow: "hidden",
        background:
          "radial-gradient(ellipse at 15% 10%, #3d2457 0%, transparent 55%), radial-gradient(ellipse at 85% 90%, #1e3a5f 0%, transparent 55%), #0f172a",
        color: "#fff",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, 88px)",
          gap: 8,
          padding: 16,
          maxWidth: 200,
        }}
      >
        {(Object.keys(APPS) as App[])
          .filter((app) => APPS[app].onDesktop)
          .map((app) => (
            <button
              key={app}
              type="button"
              onClick={() => launch(app)}
              style={{
                background: "transparent",
                border: "none",
                color: "inherit",
                cursor: "pointer",
                padding: 8,
                borderRadius: 8,
                textShadow: "0 1px 3px #000",
              }}
            >
              <div style={{ fontSize: 36 }}>{APPS[app].icon}</div>
              <div style={{ fontSize: 13 }}>{APPS[app].title}</div>
            </button>
          ))}
      </div>

      {(Object.keys(APPS) as App[]).map((app, i) => (
        <div
          key={app}
          style={{
            position: "relative",
            zIndex: `calc(var(--ifm-z-index-fixed) + ${2 + order.indexOf(app)})`,
          }}
        >
          <Window
            title={`${APPS[app].icon} ${APPS[app].title}`}
            open={open.includes(app)}
            onClose={() => close(app)}
            onFocus={() => focus(app)}
            spawnCoordinate={{ x: 140 + i * 36, y: 90 + i * 28 }}
            spawnSize={APPS[app].size}
          >
            {open.includes(app) && content[app]()}
          </Window>
        </div>
      ))}

      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "6px 12px",
          background: "rgba(0, 0, 0, 0.6)",
          borderTopRightRadius: 12,
          zIndex: "calc(var(--ifm-z-index-fixed) + 100)",
        }}
      >
        {open.map((app) => (
          <button
            key={app}
            type="button"
            className="button button--sm button--secondary"
            onClick={() => focus(app)}
          >
            {APPS[app].icon} {APPS[app].title}
          </button>
        ))}
        <span style={{ marginLeft: 8, fontVariantNumeric: "tabular-nums" }}>
          <Clock />
        </span>
      </div>

      <MiniPlayer />
      <AudioHolder />
    </div>
  );
}

export default function DesktopApp() {
  return (
    <PlayerContextProvider>
      <AudioMixerProvider storageKey="demo-desktop-mixer">
        <Desktop />
      </AudioMixerProvider>
    </PlayerContextProvider>
  );
}
