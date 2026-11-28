//#region Imports

import { Engine } from "@babylonjs/core/Engines/engine.js";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import {
  AppBar,
  Box,
  Button,
  FormControlLabel,
  Stack,
  Switch,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import {
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { JSX } from "react/jsx-runtime";
import { toRomaji } from "wanakana";
import { BaseRuntime } from "./BaseRuntime";
import { ControlsDrawer, toggleFullscreen } from "./ControlsDrawer";
import {
  defaultResolutions,
  type MMDLoadDetails,
  MMDLoadDetails as MMDLoadDetailsClass,
  type MMDPlayer,
  type MMDTemplateEntry,
  type mmdDetails,
  type mmdDetailsProcessed,
  overlay25,
  overlay75,
  overlay90,
  type processedDivision,
  type processingDivision,
  type Resolution,
} from "./config";
import { ExplainControlsDialog } from "./ExplainControlsDialog";
import { loadMMDFileByURL } from "./loadFile";
import { MMDLoadDetailsPreviewDialog } from "./MMDLoadDetailsPreviewDialog";
import { MorphDrawer } from "./MorphDrawer";
import { OptionWheel, usePlayerWheelActions } from "./OptionWheel";
import { PlaybackBar } from "./PlaybackBar";
import { TopBar, useAutoHide } from "./PlayerOverlay";
import { ResolutionSelector } from "./ResolutionSelector";
import { SavePresetDialog } from "./SavePresetDialog";
import { SceneBuilderSplit } from "./SceneBuilderSplit";
import { SceneCustomizer } from "./SceneCustomizer";

// import { number } from "zod";
// import { PointLight } from "@babylonjs/core/Lights/pointLight";
// import { Inspector } from "@babylonjs/inspector";
//#endregion

//#region Mmd.tsx

/** The player's UI is dark, so it reads well over the video on any page. */
/** Where popups (menus, tooltips, dialogs) go: only the fullscreen element's contents show while fullscreen. */
const popupContainer = () => document.fullscreenElement ?? document.body;
const playerTheme = createTheme({
  palette: { mode: "dark" },
  components: {
    MuiPopover: { defaultProps: { container: popupContainer } },
    MuiPopper: { defaultProps: { container: popupContainer } },
    MuiModal: { defaultProps: { container: popupContainer } },
  },
});
const closedPanels = { tools: false, morphs: false, help: false };
/** On/off options on the Play tab. */
const startOptions = [
  ["useBulletPhysics", "Bullet physics (closer to MMD, heavier)"],
  ["useAdvanceRendering", "Advanced rendering (reflections and effects)"],
  ["offsetCharacters", "Place characters side by side"],
] as const;
/** Shortcut key → the panel it toggles. */
const panelKeys: Record<string, keyof typeof closedPanels | undefined> = {
  t: "tools",
  m: "morphs",
  h: "help",
};

/**
 * Sizes the canvas and the player's shape to the selected resolution: the
 * fullscreen one while fullscreen, the normal one otherwise. An index the list
 * doesn't have uses its first resolution.
 */
const updateCanvasResolution = ({
  MMDLoadDetails,
  root,
  resolutions,
}: MMDPlayer): void => {
  const rootElement = root.current;
  const canvas =
    rootElement?.querySelector<HTMLCanvasElement>("canvas.mmd-render");
  const { fullscreen, normal, swappedAspectRatio } = MMDLoadDetails.resolutions;
  const resolution =
    resolutions[
      rootElement?.contains(document.fullscreenElement) ? fullscreen : normal
    ] ?? resolutions[0];
  if (!rootElement || !canvas || !resolution) return;
  rootElement.style.aspectRatio =
    swappedAspectRatio && typeof resolution.ratio === "number"
      ? `${1 / resolution.ratio}`
      : `${resolution.ratio}`;
  const { clientWidth, clientHeight } = rootElement;
  const landscape = swappedAspectRatio
    ? { width: clientHeight, height: clientWidth }
    : { width: clientWidth, height: clientHeight };
  const width = Math.round(resolution.width(landscape));
  const height = Math.round(resolution.height(landscape));
  const [canvasWidth, canvasHeight] = swappedAspectRatio
    ? [height, width]
    : [width, height];
  if (canvas.width !== canvasWidth) canvas.width = canvasWidth;
  if (canvas.height !== canvasHeight) canvas.height = canvasHeight;
};
/**
 * Writes the player's scene as `MMDTemplateEntry` JSON into its debug dialog,
 * so it can be copied into `presets`. Does nothing while the player isn't mounted.
 */
const updatePreview = ({ MMDLoadDetails, root }: MMDPlayer): void => {
  const preview = root.current?.querySelector<HTMLElement>(
    ".mmd-load-details-preview",
  );
  if (preview)
    preview.innerText = JSON.stringify(
      buildPreset(MMDLoadDetails),
      undefined,
      2,
    );
};

/** The current scene as a preset. A copy, so later changes to the scene don't change it. */
const buildPreset = (MMDLoadDetails: MMDLoadDetails): MMDTemplateEntry =>
  JSON.parse(
    JSON.stringify({
      title: "Untitled",
      subTitle: "(Unnamed Cover)",
      thumbnail: MMDLoadDetails.thumbnail,
      music: MMDLoadDetails.musicRaw,
      vmdCamera: MMDLoadDetails.vmdCamera,
      stageFolder: MMDLoadDetails.stageFolder,
      stagePMX: MMDLoadDetails.stagePMX,
      entities: MMDLoadDetails.entities,
      entitiesOffset: MMDLoadDetails.entitiesOffset,
      entitiesAngle: MMDLoadDetails.entitiesAngle,
      modelPlayOffset: MMDLoadDetails.controller.frameOffset.model,
      cameraPlayOffset: MMDLoadDetails.controller.frameOffset.camera,
      cameraType: MMDLoadDetails.cameraType,
      cameraOffset: MMDLoadDetails.zCamOffset,
      directLight: MMDLoadDetails.directLight,
      loop: MMDLoadDetails.loop,
      playbackRate: MMDLoadDetails.playbackRate,
      focusedModel: MMDLoadDetails.focusedModel,
      actionMemory: MMDLoadDetails.actionMemory.map((e) => {
        const copy: typeof e = JSON.parse(JSON.stringify(e));
        for (const key in e) {
          if (copy[key] === 0) {
            delete copy[key];
          }
        }
        return copy;
      }),
    } as MMDTemplateEntry),
  );

function createDivisions(current: string, root: string): processingDivision {
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
function processor(
  processingDivision: processingDivision[],
): processedDivision[] {
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

  return prepared?.map<processedDivision>((row) => {
    const file = row.children[0]!.path;

    const fileRomaji = toRomaji(file);
    if (row.children.length === 1 && row.children[0]!.toCompute.length === 0) {
      return {
        folder: row.folder,
        endName: file,
        endNameRomaji: fileRomaji,
        children: [],
      };
    }
    return {
      folder: row.folder,
      endName: file,
      endNameRomaji: fileRomaji,
      children: processor(
        row.children.map((child) =>
          createDivisions(child.toCompute.join("/"), child.path),
        ),
      ),
    };
  });
}
const processMmdDetails = (raw: mmdDetails): mmdDetailsProcessed => {
  const ending = (end: string) => (item: string) => item.endsWith(end);
  const construct = () => (path: string) => createDivisions(path, path);
  return {
    charaPmx: processor(
      raw?.pmx.filter(ending(".chara.pmx")).map(construct()) ?? [],
    ),
    charaPmd: processor(
      raw?.pmd.filter(ending(".chara.pmd")).map(construct()) ?? [],
    ),
    charaCam: processor(
      raw?.vmd.filter(ending(".cam.vmd")).map(construct()) ?? [],
    ),
    stagePmx: processor(
      raw?.pmx.filter(ending(".stage.pmx")).map(construct()) ?? [],
    ),
    stagePmd: processor(
      raw?.pmd.filter(ending(".stage.pmd")).map(construct()) ?? [],
    ),
    charaVmd: processor(
      raw?.vmd.filter(ending(".chara.vmd")).map(construct()) ?? [],
    ),
    charaPartVmd: processor(
      raw?.vmd.filter(ending(".chara.part.vmd")).map(construct()) ?? [],
    ),
  };
};
/**
 * The MMD files the scene builder can choose from, as full paths.
 *
 * Files only show up in the scene builder when named by role: `.chara.pmx` or
 * `.chara.pmd` (characters), `.stage.pmx` or `.stage.pmd` (stages),
 * `.chara.vmd` (character motion), `.chara.part.vmd` (partial character
 * motion, E.g. lip-sync) and `.cam.vmd` (camera motion).
 *
 * In case you want non-mmd files to also show up, you will need to manually
 * combine the mmd file types and the remaining file types into the `all` property.
 *
 * @example
 * const files = {
 *   pmd: [],
 *   pmx: ["/group/folder/Miku.chara.pmx", "/group/folder2/Room.stage.pmx"],
 *   vmd: ["/group2/folder/Dance.chara.vmd", "/group2/folder/Dance.cam.vmd"],
 * }; // <MMD basePathMMD="/mmd" rawMMDDetails={() => files} … />
 */
type rawMMDDetails = {
  /** Model files (`.pmd`). */
  pmd: string[];
  /** Model files (`.pmx`). */
  pmx: string[];
  /** Motion files (`.vmd`). */
  vmd: string[];
  /**
   * Every file, for the file browser tab.
   * Defaults to `pmd`, `pmx` and `vmd` combined if undefined.
   *
   * May included non-mmd file types. Those won't be handled with onclick, so manual
   * on click event will need to be provided.
   */
  all?: string[];
};
/** A function that returns a value, or a promise of one. */
type returnPromiseMaybe<k> = (() => k) | (() => Promise<k>);

/**
 * What `MMD`'s `mmdRef` points to: that player's state, and a way to refresh its
 * debug preview.
 *
 * @see {@link https://arclockproject.org/docs/mmd-player/component Guide} | {@link https://arclockproject.org/docs/api/mmd-player/component API}
 * @example
 * const mmd = useRef<MMDHandle>(null);
 * // <MMD mmdRef={mmd} basePathMMD="/mmd" … />
 * mmd.current?.MMDLoadDetails.focusedModel; // 0
 */
type MMDHandle = {
  /** This player's live state. */
  MMDLoadDetails: MMDLoadDetails;
  /**
   * Writes this player's scene as `MMDTemplateEntry` JSON into its debug
   * dialog, so it can be copied into `presets` manually. The player calls
   * this itself when its scene changes, so you only need it after changing
   * `MMDLoadDetails` yourself.
   */
  MMDUpdatePreview: () => void;
};

/**
 * A full MMD (MikuMikuDance) player, built on Babylon.js. Its start screen
 * lets users pick a preset, build a scene from your files, or browse them.
 * It then loads the characters, motions, camera, stage and music, and plays
 * them in 3D, with controls for desktop and mobile.
 *
 * Browser only. Each player has its own state obtainable with `mmdRef`.
 *
 * @see {@link https://arclockproject.org/docs/mmd-player/component Guide} | {@link https://arclockproject.org/docs/api/mmd-player/component API}
 * @example
 * const mmd = useRef<MMDHandle>(null); // mmd.current?.MMDLoadDetails
 * <MMD
 *   mmdRef={mmd}
 *   basePathMMD="/mmd"
 *   rawMMDDetails={() => fetch("/mmd/files.json").then((r) => r.json())}
 *   presets={() => []}
 *   loadAudioMeta={(id) => [`/music/${id}.mp3`, `/music/${id}.png`]}
 * />
 */
function Mmd(props: {
  /**
   * Gets this player's state and preview, e.g. `mmd.current.MMDLoadDetails`.
   */
  mmdRef?: Ref<MMDHandle>;
  /** Largest width of the player, as a CSS value. */
  maxWidth?: string | number;
  /** Largest height of the player, as a CSS value. */
  maxHeight?: string | number;
  /** Returns the files the scene builder can choose from. Called once, on mount. */
  rawMMDDetails: returnPromiseMaybe<rawMMDDetails>;
  /** Returns the ready-made scenes shown in the presets tab. Called once, on mount. */
  presets: returnPromiseMaybe<MMDTemplateEntry[]>;
  /** Hide the debug panel and the scene preview button. */
  noDebug?: boolean;
  /**
   * Renders the file browser tab, e.g. with `FileBrowser` from
   * `@arclockproject/common`. Without it, that tab stays display
   * a harmless text error message.
   *
   * Keep in mind that if creating a gallery browser from scratch,
   * you will need to implement a custom handler for `customAction` to parse
   * the url and decide how to write into `MMDLoadDetails` fields such as
   * `MMDLoadDetails.stagePMX` or `MMDLoadDetails.entities`
   *
   * Currently, there is no documentation to help in creating a custom FileBrowser.
   * Manual reading of source code is required.
   * Please reference to `mmd-player/src/loadFile.tsx`
   */
  getFileBrowser?: (data: {
    /** Every file, from `rawMMDDetails`. in their full paths form. */
    fileSystemRaw: string[];
    /** The `basePathMMD` prop as reference. */
    base: string;
    /** Loads a clicked file into the scene, picking its role from the file name. */
    customAction?: (file: string) => void;
  }) => ReactNode;
  /**
   * Base prefix path. Expecting all mmd files to sit at this location.
   *
   * Must not have a trailing `/`
   */
  basePathMMD: string;
  /**
   * Turns the text typed into the debug panel's audio field into file URLs.
   * Called by its "Audio Fetch" button.
   *
   * Used primarly for assisting in manually generating presets if value is an id,
   * and audio/thumbnails are in a format for `{id}.png` and `{id}.mp3`
   *
   * @param value Input Field value from UI
   * @returns [`/some/path/{value}.mp3`, `/other/path/{value}.png`]
   */
  loadAudioMeta: (value: string) => [string, string];
  /**
   * The resolutions to choose from in the resolution menus. To add your own,
   * pass `[...defaultResolutions, yours]`. The default picks are list indexes
   * (0 in fullscreen, 7 otherwise); if your list is shorter, its first is used.
   *
   * @default defaultResolutions
   */
  resolutions?: Resolution[];
  /**
   * Called by the presets tab's "Save to current preset" and "Save as new preset"
   * buttons with the current scene, after the user confirms its id, title and
   * subtitle in a dialog. Not called if they cancel. Without it, the buttons are hidden.
   * Only when it returns `true` is the player's preset list updated and the dialog
   * closed. Throwing counts as `false`.
   * "Save to current preset" keeps the loaded preset's `id`. A new preset gets
   * the `id` typed in the dialog; checking that it's unique is up to you.
   *
   * @param preset A copy of the scene.
   * @param isNew `true` for "Save as new preset".
   * @returns Whether it was saved.
   */
  onSavePreset?: (
    preset: MMDTemplateEntry,
    isNew: boolean,
  ) => boolean | Promise<boolean>;
}): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const [player] = useState(
    (): MMDPlayer => ({
      MMDLoadDetails: new MMDLoadDetailsClass(),
      root: rootRef,
      resolutions: defaultResolutions,
    }),
  );
  player.resolutions = props.resolutions ?? defaultResolutions;
  useLayoutEffect(() => {
    const rootElement = rootRef.current;
    if (!rootElement) return;
    updateCanvasResolution(player);
    const observer = new ResizeObserver(() => updateCanvasResolution(player));
    observer.observe(rootElement);
    return () => observer.disconnect();
  }, [player]);
  const { MMDLoadDetails } = player;
  const MMDUpdatePreview = () => updatePreview(player);
  const [onFullscreenChange] = useState(
    () => () => updateCanvasResolution(player),
  );

  useImperativeHandle(
    props.mmdRef,
    () => ({ MMDLoadDetails, MMDUpdatePreview: () => updatePreview(player) }),
    [player],
  );
  const presets = useRef<MMDTemplateEntry[]>([]);

  useEffect(() => {
    Promise.resolve(props.presets()).then((res) => {
      presets.current = res;
    });
    loadFiles();
  }, []);
  /** Loads the MMD file list for the scene builder. Also used by its "Refresh" button. */
  const loadFiles = () =>
    Promise.resolve(props.rawMMDDetails()).then((res) => {
      const data: mmdDetails =
        res.all !== undefined
          ? (res as mmdDetails)
          : {
              pmd: res.pmd,
              pmx: res.pmx,
              vmd: res.vmd,
              all: [...res.pmd, ...res.pmx, ...res.vmd],
            };
      setMmdDetails(processMmdDetails(data));
      setMmdDetailsRaw(data);
    });
  const [startingTab, setStartingTab] = useState("play");
  const [MMDLoadDetailsPreviewShow, setMMDLoadDetailsPreviewShow] =
    useState(false);
  const [ready, setReady] = useState(false);
  const [mmdDetails, setMmdDetails] = useState<mmdDetailsProcessed | null>(
    null,
  );
  const [mmdDetailsRaw, setMmdDetailsRaw] = useState<mmdDetails | null>(null);
  const [selected, setSelected] = useState("");
  /** The preset waiting for its title in the save dialog. `index` is `null` for a new preset. */
  const [saving, setSaving] = useState<{
    preset: MMDTemplateEntry;
    index: number | null;
  } | null>(null);
  const [_, setCounter] = useState(0);
  const refreshPage = () =>
    setCounter((counter) => {
      MMDUpdatePreview();
      return counter + 1;
    });
  const [panels, setPanels] = useState(closedPanels);
  /** The scene is built, so the playback bar can attach to its runtime. */
  const [sceneLoaded, setSceneLoaded] = useState(false);
  /** Bumped by the "/" key to focus the morph filter. */
  const [morphSearch, setMorphSearch] = useState(0);
  const togglePanel = (panel: keyof typeof closedPanels, open?: boolean) =>
    setPanels((p) => ({ ...p, [panel]: open ?? !p[panel] }));
  const autoHide = useAutoHide(player, ready);
  const wheelActions = usePlayerWheelActions(player, {
    onMorphs: () => togglePanel("morphs"),
    onTools: () => togglePanel("tools"),
  });
  /** Stopping the scene is done by the cleanup of the effect below, when `ready` turns false. */
  const exitPlayer = () => {
    setPanels(closedPanels);
    setSceneLoaded(false);
    setReady(false);
  };
  /** Panel shortcuts. Only work while focus is inside this player. */
  const onKeyDown = (event: KeyboardEvent) => {
    if (!ready || event.ctrlKey || event.metaKey || event.altKey) return;
    if ((event.target as Element).closest("input, textarea, select")) return;
    const key = event.key.toLowerCase();
    const panel = panelKeys[key];
    if (panel) togglePanel(panel);
    else if (key === "escape") setPanels(closedPanels);
    else if (key === "f") toggleFullscreen(rootRef.current);
    else if (key === "/") {
      event.preventDefault();
      togglePanel("morphs", true);
      setMorphSearch((n) => n + 1);
    } else return;
    autoHide.show();
  };
  useEffect(() => {
    if (!ready) return;
    const canvas =
      rootRef.current!.querySelector<HTMLCanvasElement>("canvas.mmd-render")!;
    const engine = new Engine(
      canvas,
      false,
      {
        preserveDrawingBuffer: false,
        stencil: false,
        antialias: false,
        alpha: true,
        premultipliedAlpha: false,
        powerPreference: "high-performance",
        doNotHandleTouchAction: false,
        doNotHandleContextLost: true,
        audioEngine: false,
      },
      true,
    );

    /** Set when the player is closed, possibly while the scene is still loading. */
    let closed = false;
    BaseRuntime.Create({
      canvas,
      engine,
      sceneBuilder: new SceneBuilderSplit(player),
    })
      .then((runtime) => {
        if (closed) return;
        player.runtime = runtime;
        runtime.run();
        setSceneLoaded(true);
      })
      .catch((error) => {
        if (!closed) throw error;
      });
    onFullscreenChange();
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      closed = true;
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      engine.dispose();
      player.runtime = undefined;
    };
  }, [ready]);
  // Built first and wrapped below, so the JSX keeps its indentation.
  const content = (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      <div
        role="application"
        ref={rootRef}
        style={{
          width: "100%",
          backgroundColor: "#000",
          color: playerTheme.palette.text.primary,
          fontFamily: playerTheme.typography.fontFamily,
          maxWidth: props.maxWidth,
          maxHeight: props.maxHeight,
          position: "relative",
          overflow: "hidden",
        }}
        onKeyDown={onKeyDown}
        onPointerDownCapture={(event) => {
          if (
            event.pointerType === "touch" &&
            (event.target as Element).matches("canvas.mmd-render")
          )
            setPanels((p) =>
              p.tools || p.morphs ? { ...p, tools: false, morphs: false } : p,
            );
        }}
        {...autoHide.handlers}
      >
        <canvas
          className="mmd-render"
          style={{
            display: "block",
            pointerEvents: ready ? undefined : "none",
            opacity: ready ? 1 : 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            transition: "opacity 1s ease-in-out",
          }}
        />
        <div style={{ display: ready ? undefined : "none" }}>
          <TopBar
            visible={autoHide.visible}
            onTools={() => togglePanel("tools")}
            onMorphs={() => togglePanel("morphs")}
            onHelp={() => togglePanel("help", true)}
            onDebug={
              props.noDebug
                ? undefined
                : () => setMMDLoadDetailsPreviewShow(true)
            }
            onExit={exitPlayer}
          />
          {sceneLoaded && <OptionWheel root={rootRef} actions={wheelActions} />}
          {sceneLoaded && (
            <PlaybackBar player={player} visible={autoHide.visible} />
          )}
          {ready && (
            <ControlsDrawer
              ready={ready}
              open={panels.tools}
              onClose={() => togglePanel("tools", false)}
              player={player}
            />
          )}
          <MorphDrawer
            ready={ready}
            open={panels.morphs}
            onClose={() => togglePanel("morphs", false)}
            player={player}
            focusFilter={morphSearch}
          />
          <ExplainControlsDialog
            open={panels.help}
            onClose={() => togglePanel("help", false)}
          />
        </div>
        <div
          style={{
            display: ready ? "none" : undefined,
            position: "absolute",
            inset: 0,
            marginBottom: "50px",
            overflowY: "auto",
          }}
        >
          <AppBar position="static">
            <Tabs
              value={startingTab}
              onChange={(_, tab) =>
                tab === "fullscreen"
                  ? toggleFullscreen(rootRef.current)
                  : setStartingTab(tab)
              }
              indicatorColor="secondary"
              textColor="inherit"
              variant="fullWidth"
              aria-label="full width tabs example"
            >
              <Tab value="play" label="Play" />
              <Tab value="presets" label="Presets" />
              <Tab value="customize" label="Scene" />
              <Tab value="fileBrowser" label="Files" />
              {/* <Tab value="???" label="???" /> */}
              <Tab
                value="fullscreen"
                icon={<FullscreenIcon />}
                aria-label="Fullscreen"
                title="Fullscreen"
                sx={{ flex: "none", minWidth: 56 }}
              />
            </Tabs>
          </AppBar>
          {startingTab === "play" && (
            <Box sx={{ p: 1 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  marginTop: "8px",
                }}
              >
                <ResolutionSelector player={player} />
                <Stack sx={{ m: 1 }}>
                  {startOptions.map(([option, label]) => (
                    <FormControlLabel
                      key={option}
                      label={label}
                      control={
                        <Switch
                          defaultChecked={MMDLoadDetails[option]}
                          onChange={(_, checked) => {
                            MMDLoadDetails[option] = checked;
                            MMDUpdatePreview();
                          }}
                        />
                      }
                    />
                  ))}
                </Stack>
              </div>
            </Box>
          )}
          {startingTab === "presets" && (
            <Box sx={{ p: 1 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: "8px",
                  margin: "8px",
                  justifyContent: "center",
                }}
              >
                <Box sx={{ width: "100%" }}>
                  <Typography sx={{ textAlign: "center" }}>
                    Preset Loaded: {selected ? selected : "None"}
                  </Typography>
                </Box>
                {props.onSavePreset && (
                  <Stack
                    direction="row"
                    gap={1}
                    justifyContent="center"
                    sx={{ width: "100%" }}
                  >
                    <Button
                      variant="outlined"
                      disabled={!selected}
                      onClick={() => {
                        const index = Number(selected);
                        const current = presets.current[index];
                        if (!current) return;
                        setSaving({
                          index,
                          preset: {
                            ...buildPreset(MMDLoadDetails),
                            id: current.id,
                            title: current.title,
                            subTitle: current.subTitle,
                          },
                        });
                      }}
                    >
                      Save to current preset
                    </Button>
                    <Button
                      variant="contained"
                      onClick={() =>
                        setSaving({
                          index: null,
                          preset: buildPreset(MMDLoadDetails),
                        })
                      }
                    >
                      Save as new preset
                    </Button>
                  </Stack>
                )}
                {presets.current.map((preset, index) => {
                  return (
                    <Box
                      key={index}
                      sx={(theme) => ({
                        width: "180px",
                        cursor: "pointer",
                        padding: "4px",
                        borderRadius: "8px",
                        border: `1px solid ${theme.palette.text.primary}`,
                        background:
                          selected === String(index) ? overlay90 : overlay75,
                        transition: theme.transitions.create(["background"]),
                        "&:hover": {
                          background: overlay25,
                        },
                      })}
                      onClick={() => {
                        if (preset.music) {
                          MMDLoadDetails.music = preset.music;
                          MMDLoadDetails.musicRaw = preset.music;
                        } else {
                          MMDLoadDetails.music = "";
                          MMDLoadDetails.musicRaw = "";
                        }

                        MMDLoadDetails.maxModelFocus = Math.max(
                          MMDLoadDetails.maxModelFocus,
                          preset.entities?.length ?? 0,
                        );

                        if (preset.thumbnail)
                          MMDLoadDetails.thumbnail = preset.thumbnail;
                        else MMDLoadDetails.thumbnail = "";
                        if (preset.vmdCamera)
                          MMDLoadDetails.vmdCamera = preset.vmdCamera;
                        else MMDLoadDetails.vmdCamera = "";

                        if (preset.stageFolder)
                          MMDLoadDetails.stageFolder = preset.stageFolder;
                        else MMDLoadDetails.stageFolder = "";
                        if (preset.stagePMX)
                          MMDLoadDetails.stagePMX = preset.stagePMX;
                        else MMDLoadDetails.stagePMX = "";

                        if (preset.modelPlayOffset)
                          MMDLoadDetails.controller.frameOffset.model =
                            preset.modelPlayOffset;
                        else MMDLoadDetails.controller.frameOffset.model = 0;

                        if (preset.focusedModel)
                          MMDLoadDetails.focusedModel = preset.focusedModel;
                        else MMDLoadDetails.focusedModel = 0;

                        const defaults = new MMDLoadDetailsClass();
                        MMDLoadDetails.controller.frameOffset.camera =
                          preset.cameraPlayOffset ?? 0;
                        MMDLoadDetails.cameraType =
                          preset.cameraType ?? defaults.cameraType;
                        MMDLoadDetails.zCamOffset = {
                          ...defaults.zCamOffset,
                          ...preset.cameraOffset,
                        };
                        MMDLoadDetails.directLight =
                          preset.directLight ?? defaults.directLight;
                        MMDLoadDetails.loop = preset.loop ?? defaults.loop;
                        MMDLoadDetails.playbackRate =
                          preset.playbackRate ?? defaults.playbackRate;

                        if (preset.entities)
                          MMDLoadDetails.entities = JSON.parse(
                            JSON.stringify(preset.entities),
                          );
                        else MMDLoadDetails.entities = [];

                        if (preset.entitiesOffset)
                          MMDLoadDetails.entitiesOffset = JSON.parse(
                            JSON.stringify(preset.entitiesOffset),
                          );
                        else MMDLoadDetails.entitiesOffset = [];

                        if (preset.entitiesAngle)
                          MMDLoadDetails.entitiesAngle = JSON.parse(
                            JSON.stringify(preset.entitiesAngle),
                          );
                        else MMDLoadDetails.entitiesAngle = [];
                        if (preset.actionMemory)
                          MMDLoadDetails.actionMemory = JSON.parse(
                            JSON.stringify(preset.actionMemory),
                          );
                        else MMDLoadDetails.actionMemory = [];
                        MMDUpdatePreview();
                        setSelected(String(index));
                      }}
                    >
                      <img
                        alt="Thumbnail"
                        src={preset.thumbnail}
                        width={"100%"}
                      />
                      <Typography sx={{ textAlign: "center" }}>
                        {preset.title}
                      </Typography>
                      <Typography sx={{ textAlign: "center" }}>
                        {preset.subTitle}
                      </Typography>
                      {preset.entities?.map((entity, i) =>
                        entity?.model ? (
                          <Typography
                            key={i}
                            sx={{ textAlign: "center", fontSize: "0.5rem" }}
                          >
                            {entity.model.file}
                          </Typography>
                        ) : (
                          <Typography
                            key={i}
                            sx={{ textAlign: "center", fontSize: "0.5rem" }}
                          >
                            Empty
                          </Typography>
                        ),
                      )}
                    </Box>
                  );
                })}
              </div>
            </Box>
          )}
          {startingTab === "customize" && (
            <SceneCustomizer
              player={player}
              files={mmdDetails}
              basePath={props.basePathMMD}
              loadAudioMeta={props.loadAudioMeta}
              onChange={refreshPage}
              onReset={() => setSelected("")}
              onRefreshFiles={loadFiles}
            />
          )}
          {startingTab === "fileBrowser" && (
            <Box
              sx={{
                m: 1,
                // 48px heading AND 8px twice from { m: 1 }
                height: "calc(100% - 48px - 8px - 8px)",
              }}
            >
              <Box sx={{ height: "100%" }}>
                {props.getFileBrowser ? (
                  props.getFileBrowser({
                    fileSystemRaw: mmdDetailsRaw?.all ?? [],
                    base: props.basePathMMD,
                    customAction: (file) => loadMMDFileByURL(player, file),
                  })
                ) : (
                  <p>
                    Error! FileBrowser Tab selected but no FileBrowser was
                    passed!
                  </p>
                )}{" "}
              </Box>
            </Box>
          )}
          {/* {startingTab === "???" && <Box sx={{ p: 3 }}>???</Box>} */}
        </div>

        <div
          style={{
            display: ready ? "none" : undefined,
          }}
        >
          <Button
            sx={{
              position: "absolute",
              left: "8px",
              bottom: "8px",
              display: props.noDebug ? "none" : undefined,
            }}
            size="large"
            onClick={() => setMMDLoadDetailsPreviewShow(true)}
            variant="contained"
          >
            Debug
          </Button>
          <div
            style={{
              position: "absolute",
              right: "8px",
              bottom: "8px",
              gap: "8px",
              display: "flex",
            }}
          >
            <Button
              variant="contained"
              size="large"
              onClick={() => {
                MMDLoadDetails.startMode = "mobile";
                setReady(true);
              }}
            >
              Mobile
            </Button>
            <Button
              variant="contained"
              size="large"
              onClick={() => {
                MMDLoadDetails.startMode = "desktop";
                setReady(true);
              }}
            >
              PLAY Desktop
            </Button>
          </div>
        </div>
        <MMDLoadDetailsPreviewDialog
          onClose={() => setMMDLoadDetailsPreviewShow(false)}
          open={MMDLoadDetailsPreviewShow}
          updatePreview={MMDUpdatePreview}
        />
        {saving && (
          <SavePresetDialog
            preset={saving.preset}
            isNew={saving.index === null}
            onCancel={() => setSaving(null)}
            onSave={async (preset) => {
              const isNew = saving.index === null;
              if (!(await props.onSavePreset?.(preset, isNew))) return false;
              if (saving.index === null) {
                presets.current.push(preset);
                setSelected(String(presets.current.length - 1));
              } else presets.current[saving.index] = preset;
              setSaving(null);
              refreshPage();
              return true;
            }}
          />
        )}
      </div>
    </div>
  );
  return <ThemeProvider theme={playerTheme}>{content}</ThemeProvider>;
}
//#endregion

export type { MMDHandle };

export { updatePreview, Mmd, updateCanvasResolution };
