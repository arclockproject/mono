//#region Imports

import { Engine } from "@babylonjs/core/Engines/engine.js";
import {
  AppBar,
  Box,
  Button,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import InputAdornment from "@mui/material/InputAdornment";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { toRomaji } from "wanakana";
import { BaseRuntime } from "./BaseRuntime";
import { ControlsDrawer } from "./ControlsDrawer";
import {
  MMDLoadDetails,
  type MMDTemplateEntry,
  type mmdDetails,
  type mmdDetailsProcessed,
  overlay25,
  overlay75,
  overlay90,
  type processedDivision,
  type processingDivision,
  ref,
} from "./config";
import { ExplainControlsButton } from "./ExplainControlsButton";
import { MMDLoadDetailsPreviewDialog } from "./MMDLoadDetailsPreviewDialog";
import { MorphDrawer } from "./MorphDrawer";
import { ResolutionSelector, validResolutions } from "./ResolutionSelector";
import { SceneBuilderSplit } from "./SceneBuilderSplit";
import { SimpleTreeViewSearchable } from "./SimpleTreeViewSearchable";
import { loadMMDFileByURL } from "./loadFile";

// import { number } from "zod";
// import { PointLight } from "@babylonjs/core/Lights/pointLight";
// import { Inspector } from "@babylonjs/inspector";
//#endregion

//#region Mmd.tsx
const updateCanvasResolution = (): void => {
  const canvas =
    document.querySelector<HTMLCanvasElement>("canvas#mmd-render")!;
  const resolution =
    validResolutions[
      document.fullscreenElement
        ? MMDLoadDetails.resolutions.fullscreen
        : MMDLoadDetails.resolutions.normal
    ]!;
  const rootElement = document.getElementById("mmd-render-root");
  if (rootElement) {
    rootElement.style.aspectRatio =
      MMDLoadDetails.resolutions.swappedAspectRatio &&
      typeof resolution.ratio === "number"
        ? `${1 / resolution.ratio}`
        : `${resolution.ratio}`;
  }
  if (MMDLoadDetails.resolutions.swappedAspectRatio) {
    canvas.width = resolution.height();
    canvas.height = resolution.width();
  } else {
    canvas.width = resolution.width();
    canvas.height = resolution.height();
  }
};
/**
 * Writes the current scene in `MMDLoadDetails` as `MMDTemplateEntry` JSON into
 * the player's "MMDLoadDetailsPreview" dialog, so it can be copied into
 * `presets`. The player calls this itself whenever it requires.
 *
 * Only call it while `MMD` is mounted, since it writes to the player's element.
 *
 * Generally only used by internal midware components and not end consumers.
 *
 * @see {@link https://arclockproject.org/docs/mmd-player/component Guide} | {@link https://arclockproject.org/docs/api/mmd-player/component API}
 */
const MMDUpdatePreview = (): void => {
  document.querySelector<HTMLDivElement>("#MMDLoadDetailsPreview")!.innerText =
    JSON.stringify(
      {
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
      } as MMDTemplateEntry,
      undefined,
      2,
    );
};

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
 * A full MMD (MikuMikuDance) player, built on Babylon.js. Its start screen
 * lets users pick a preset, build a scene from your files, or browse them.
 * It then loads the characters, motions, camera, stage and music, and plays
 * them in 3D, with controls for desktop and mobile.
 *
 * Browser only. Only one player can be on a page, since it uses fixed element
 * ids and the shared `MMDLoadDetails` state.
 *
 * @see {@link https://arclockproject.org/docs/mmd-player/component Guide} | {@link https://arclockproject.org/docs/api/mmd-player/component API}
 * @example
 * <MMD
 *   basePathMMD="/mmd"
 *   rawMMDDetails={() => fetch("/mmd/files.json").then((r) => r.json())}
 *   presets={() => []}
 *   loadAudioMeta={(id) => [`/music/${id}.mp3`, `/music/${id}.png`]}
 * />
 */
function Mmd(props: {
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
    customAction?: typeof loadMMDFileByURL;
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
}): JSX.Element {
  const presets = useRef<MMDTemplateEntry[]>([]);

  useEffect(() => {
    Promise.resolve(props.presets()).then((res) => {
      presets.current = res;
    });
    Promise.resolve(props.rawMMDDetails()).then((res) => {
      let data: mmdDetails =
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
  }, []);
  const [startingTab, setStartingTab] = useState("play");
  const [MMDLoadDetailsPreviewShow, setMMDLoadDetailsPreviewShow] =
    useState(false);
  const [ready, setReady] = useState(false);
  const [mmdDetails, setMmdDetails] = useState<mmdDetailsProcessed | null>(
    null,
  );
  const [mmdDetailsRaw, setMmdDetailsRaw] = useState<mmdDetails | null>(null);
  const [selected, setSelected] = useState("");
  const [_, setCounter] = useState(0);
  const [selectedTab, setSelectedTab] = useState(0);
  const refreshPage = () =>
    setCounter((counter) => {
      MMDUpdatePreview();
      return counter + 1;
    });
  useEffect(() => {}, []);
  useEffect(() => {
    if (!ready) return;
    const canvas =
      document.querySelector<HTMLCanvasElement>("canvas#mmd-render")!;
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

    BaseRuntime.Create({
      canvas,
      engine,
      sceneBuilder: new SceneBuilderSplit(),
    }).then((runtime) => {
      ref.runtime = runtime;
      runtime.run();
    });
    updateCanvasResolution();
    document.addEventListener("fullscreenchange", updateCanvasResolution);
    return () => {
      document.removeEventListener("fullscreenchange", updateCanvasResolution);
      ref.runtime?.dispose();
    };
  }, [ready]);
  const resolution = validResolutions[MMDLoadDetails.resolutions.normal]!;

  const aspectRatio =
    MMDLoadDetails.resolutions.swappedAspectRatio &&
    typeof resolution.ratio === "number"
      ? 1 / resolution.ratio
      : resolution.ratio;

  const width = MMDLoadDetails.resolutions.swappedAspectRatio
    ? resolution.height()
    : resolution.width();
  const height = MMDLoadDetails.resolutions.swappedAspectRatio
    ? resolution.width()
    : resolution.height();

  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      <div
        role="application"
        id="mmd-render-root"
        style={{
          width: "100%",
          backgroundColor: "green",
          maxWidth: props.maxWidth,
          maxHeight: props.maxHeight,
          aspectRatio: aspectRatio,
          position: "relative",
          overflow: "hidden",
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          event.preventDefault();
        }}
        onScroll={(event) => {
          event.stopPropagation();
          event.preventDefault();
        }}
      >
        <canvas
          id="mmd-render"
          width={width} // width="1280px"
          height={height} // height="720px"
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
          <div style={{ position: "absolute", left: 0, top: 0, zIndex: 100 }}>
            <button type="button" id="flight-speed" style={{ padding: "2px" }}>
              Speed: unknown
            </button>
          </div>
          <ControlsDrawer ready={ready} toggleMobile={() => {}} />
          <MorphDrawer ready={ready} mobile={true} />
          <ExplainControlsButton />
          <div
            style={{
              top: 0,
              left: 0,
              right: 0,
              margin: "auto",
              width: "300px",
              position: "absolute",
            }}
          >
            <Button
              variant="outlined"
              onClick={() => {
                document.removeEventListener(
                  "fullscreenchange",
                  updateCanvasResolution,
                );
                ref.runtime?.dispose();
                setReady(false);
              }}
              sx={{ m: 1, width: "100%" }}
            >
              KILL
            </Button>
          </div>
          <Box
            sx={{
              display: props.noDebug ? "none" : "flex",
              gap: "8px",
              top: "80px",
              right: 0,
              position: "absolute",
              marginTop: "8px",
              flexDirection: "column",
            }}
          >
            <Button
              variant="outlined"
              onClick={() => setMMDLoadDetailsPreviewShow(true)}
            >
              Debug
            </Button>
          </Box>
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
              onChange={(_, i) => setStartingTab(i)}
              indicatorColor="secondary"
              textColor="inherit"
              variant="fullWidth"
              aria-label="full width tabs example"
            >
              <Tab value="play" label="Play" />
              <Tab value="presets" label="Presets" />
              <Tab value="customize" label="Customize" />
              <Tab value="fileBrowser" label="FileBrowser" />
              <Tab value="???" label="???" />
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
                <ResolutionSelector />
                <div>
                  <button
                    type="button"
                    style={{ padding: "16px", margin: "8px" }}
                    onClick={(event) => {
                      MMDLoadDetails.useBulletPhysics =
                        !MMDLoadDetails.useBulletPhysics;
                      event.currentTarget.innerText =
                        MMDLoadDetails.useBulletPhysics
                          ? "Bullet Engine"
                          : "Light Engine";
                    }}
                  >
                    {MMDLoadDetails.useBulletPhysics
                      ? "Bullet Engine"
                      : "Light Engine"}
                  </button>
                  <button
                    type="button"
                    style={{ padding: "16px", margin: "8px" }}
                    onClick={(event) => {
                      MMDLoadDetails.useAdvanceRendering =
                        !MMDLoadDetails.useAdvanceRendering;
                      event.currentTarget.innerText =
                        MMDLoadDetails.useAdvanceRendering
                          ? "Advance Rendering"
                          : "Default Rendering";
                    }}
                  >
                    {MMDLoadDetails.useAdvanceRendering
                      ? "Advance Rendering"
                      : "Default Rendering"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      MMDLoadDetails.offsetCharacters =
                        !MMDLoadDetails.offsetCharacters;
                      MMDUpdatePreview();
                    }}
                    style={{ padding: "16px", margin: "8px" }}
                  >
                    {MMDLoadDetails.offsetCharacters
                      ? "Offsetting Characters"
                      : "Stacking Characters"}
                  </button>
                </div>
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
                        document.querySelector<HTMLInputElement>(
                          "#model-offset-input",
                        )!.value =
                          `${MMDLoadDetails.controller.frameOffset.model}`;
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
                        entity ? (
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
            <Box sx={{ p: 1 }}>
              <div
                style={{
                  display: "flex",
                  width: "100%",
                  gap: "8px",
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <p style={{ textAlign: "center" }}>AUDIO</p>
                  <input
                    type="text"
                    id="musicInput"
                    style={{ padding: "8px" }}
                  />
                  <button
                    type="button"
                    style={{ padding: "8px" }}
                    onClick={() => {
                      const value =
                        document.querySelector<HTMLInputElement>(
                          "input#musicInput",
                        )!.value;
                      MMDLoadDetails.music = value;
                      const [audio, image] = props.loadAudioMeta(value);
                      MMDLoadDetails.musicRaw = audio;
                      MMDLoadDetails.thumbnail = image;
                      MMDUpdatePreview();
                    }}
                  >
                    Audio Fetch
                  </button>
                </div>
                <Button
                  variant="contained"
                  onClick={() => {
                    MMDLoadDetails.music = "";
                    MMDLoadDetails.musicRaw = "";

                    MMDLoadDetails.entities = [];
                    MMDLoadDetails.entitiesData = [];
                    MMDLoadDetails.entitiesOffset = [];
                    MMDLoadDetails.entitiesAngle = [];
                    MMDLoadDetails.focusedModel = 0;
                    MMDLoadDetails.maxModelFocus = 5;
                    MMDLoadDetails.stagePMX = "";
                    MMDLoadDetails.stageFolder = "";
                    MMDLoadDetails.vmdCamera = "";
                    MMDLoadDetails.actionMemory = [];

                    setSelected("");
                    refreshPage();
                  }}
                >
                  Reset
                </Button>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <p>maxModelFocus</p>
                  <Button
                    variant="contained"
                    onClick={() => {
                      MMDLoadDetails.maxModelFocus = Math.max(
                        0,
                        MMDLoadDetails.maxModelFocus - 1,
                      );
                      refreshPage();
                    }}
                  >
                    -1
                  </Button>
                  <br />
                  <Button
                    variant="contained"
                    onClick={() => {
                      MMDLoadDetails.maxModelFocus += 1;
                      refreshPage();
                    }}
                  >
                    +1
                  </Button>
                </Box>
              </div>
              <Box
                sx={() => ({
                  display: ready ? "none" : "flex",
                  width: "100%",
                  padding: "8px",
                  flexDirection: "column",
                })}
              >
                <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                  <Tabs
                    value={selectedTab}
                    onChange={(_, newValue) => {
                      setSelectedTab(newValue);
                    }}
                  >
                    <Tab label="Chara" id="tab-1" />
                    <Tab label="Stage" id="tab-2" />
                    <Tab label="Dance" id="tab-3" />
                    <Tab label="Cam" id="tab-4" />
                    <Tab label="Parts" id="tab-5" />
                  </Tabs>
                </Box>
                <Box
                  sx={(theme) => ({
                    border: `1px solid ${theme.palette.text.primary}`,
                    display: "flex",
                    flexDirection: "column",
                    marginRight: "8px",
                    flex: 1,
                    borderRadius: "16px",
                    padding: "8px 0px",
                    height: 500,
                    overflow: "auto",
                  })}
                >
                  <SimpleTreeViewSearchable
                    mmdDetails={mmdDetails}
                    basePath={props.basePathMMD}
                    updatePreview={MMDUpdatePreview}
                    selectedTab={selectedTab}
                  />
                </Box>
              </Box>
              <div
                style={{
                  display: ready ? "none" : "flex",
                  width: "100%",
                  padding: "8px",
                }}
              >
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => {
                    // update MMD LIST
                  }}
                >
                  Server Refresh
                </Button>
              </div>
            </Box>
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
                    customAction: loadMMDFileByURL,
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
          {startingTab === "???" && <Box sx={{ p: 3 }}>???</Box>}
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
        />
      </div>
    </div>
  );
}
//#endregion

export { MMDUpdatePreview, Mmd, updateCanvasResolution };
