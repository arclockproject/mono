//#region Imports
import type { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import type { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import type { Scene } from "@babylonjs/core/scene.js";
import type { MmdAnimation } from "babylon-mmd/esm/Loader/Animation/mmdAnimation.js";
import type { StreamAudioPlayer } from "babylon-mmd/esm/Runtime/Audio/streamAudioPlayer.js";
import type { MmdMesh } from "babylon-mmd/esm/Runtime/mmdMesh.js";
import type { MmdMorphController } from "babylon-mmd/esm/Runtime/mmdMorphController.js";
import type { MmdRuntime } from "babylon-mmd/esm/Runtime/mmdRuntime.js";
import type { RefObject } from "react";

//#endregion

//#region DEFAULTS

/** A 3D position or rotation. Rotations are in radians, around each axis. */
type SimpleVector = {
  /** Left and right. */
  x: number;
  /** Up and down. */
  y: number;
  /** Forward and back. */
  z: number;
};

import type { BaseRuntime } from "./BaseRuntime";

const overlay75 = "#000000bf";
const overlay90 = "rgba(39, 39, 39, 0.9)";
const overlay25 = "rgba(230, 230, 230, 0.5)";

/** The player's size on screen, in CSS pixels. */
type PlayerSize = {
  /** Width in CSS pixels. */
  width: number;
  /** Height in CSS pixels. */
  height: number;
};

/**
 * A render resolution the player can use, shown in the resolution menus.
 * `width` and `height` are the canvas size in pixels for a landscape player.
 * "Swapped AspectRatio" swaps them.
 *
 * @see {@link https://arclockproject.org/docs/mmd-player/component Guide} | {@link https://arclockproject.org/docs/api/mmd-player/component API}
 * @example
 * const eightK: Resolution = { label: "8K", width: () => 7680, height: () => 4320, ratio: 16 / 9 };
 * // <MMD resolutions={[...defaultResolutions, eightK]} … />
 */
type Resolution = {
  /** Name in the resolution menus. */
  label: string;
  /**
   * Canvas width in pixels.
   * @param player The player's size on screen. Multiply by `devicePixelRatio` for device pixels.
   */
  width: (player: PlayerSize) => number;
  /**
   * Canvas height in pixels.
   * @param player The player's size on screen. Multiply by `devicePixelRatio` for device pixels.
   */
  height: (player: PlayerSize) => number;
  /** The player's shape outside fullscreen, as width / height. `"auto"` follows the canvas size. */
  ratio: number | "auto";
};

/**
 * The built-in resolutions. "Container" renders at the player's size on
 * screen in device pixels, so it stays sharp on phones, where a CSS pixel is
 * 2–4 device pixels.
 *
 * @see {@link https://arclockproject.org/docs/mmd-player/component Guide} | {@link https://arclockproject.org/docs/api/mmd-player/component API}
 * @example
 * defaultResolutions.map((r) => r.label); // ["Container", "Screen Size", …, "240p"]
 */
const defaultResolutions: Resolution[] = [
  {
    label: "Container",
    width: (player) => player.width * window.devicePixelRatio,
    height: (player) => player.height * window.devicePixelRatio,
    ratio: 16 / 9,
  },
  {
    label: "Screen Size",
    width: () => window.screen.availWidth,
    height: () => window.screen.availHeight,
    ratio: "auto",
  },
  {
    label: "Screen Size / 1.5",
    width: () => Math.floor(window.screen.availWidth / 1.5),
    height: () => Math.floor(window.screen.availHeight / 1.5),
    ratio: "auto",
  },
  {
    label: "4k",
    width: () => 3840,
    height: () => 2160,
    ratio: 16 / 9,
  },
  {
    label: "1440p",
    width: () => 2560,
    height: () => 1440,
    ratio: 16 / 9,
  },
  {
    label: "1080p",
    width: () => 1920,
    height: () => 1080,
    ratio: 16 / 9,
  },
  {
    label: "SteamDeck",
    width: () => 1280,
    height: () => 800,
    ratio: 16 / 10,
  },
  {
    label: "720p",
    width: () => 1280,
    height: () => 720,
    ratio: 16 / 9,
  },
  {
    label: "480p",
    width: () => 854,
    height: () => 480,
    ratio: 16 / 9,
  },
  {
    label: "360p",
    width: () => 640,
    height: () => 360,
    ratio: 16 / 9,
  },
  {
    label: "240p",
    width: () => 426,
    height: () => 240,
    ratio: 16 / 9,
  },
];

/** Indexes into `defaultResolutions`: "Container" in fullscreen, "720p" otherwise. */
const validResolutionsDefaults = {
  fullscreen: 0,
  normal: 7,
};

type mmdDetails = {
  pmd: string[];
  pmx: string[];
  vmd: string[];
  all: string[];
};
type mmdDetailsProcessed = {
  charaPmx: processedDivision[];
  charaPartVmd: processedDivision[];
  charaPmd: processedDivision[];
  charaCam: processedDivision[];
  stagePmx: processedDivision[];
  stagePmd: processedDivision[];
  charaVmd: processedDivision[];
};
type processingDivision = {
  folder: string;
  children: {
    path: string;
    toCompute: string[];
  }[];
};
type processedDivision = {
  folder: string;
  children: processedDivision[];
  endName: string;
  endNameRomaji: string;
};

//#endregion

/**
 * The live state of one player: what the scene builder and presets have
 * selected and while playing, the running scene. The player's UI reads and
 * writes it directly. Each `MMD` has its own, reachable through its `mmdRef`
 * (see `MMDHandle`).
 *
 * Changing it before pressing play changes what loads.
 *
 * @see {@link https://arclockproject.org/docs/mmd-player/component Guide} | {@link https://arclockproject.org/docs/api/mmd-player/component API}
 */
class MMDLoadDetails {
  /** Text from the debug panel's audio field, or the preset's music URL. */
  music = "";
  /** URL of the music that plays. */
  musicRaw = "";
  /** URL of the camera motion (`.vmd`). */
  vmdCamera = "";
  /** URL of the thumbnail image. */
  thumbnail = "";
  /** URL of the stage's folder, ending with `/`. */
  stageFolder = "";
  /** File name of the stage model, inside `stageFolder`. */
  stagePMX = "";
  /** Place characters side by side automatically, instead of using `entitiesOffset`. */
  offsetCharacters = false;
  /** The characters, by slot. Each has a model and its motion files. */
  entities = [] as {
    /**
     * URLs of the motion (`.vmd`). Expecting a single main motion for body and rest as parts.
     *
     * Expected parts include: lip-sync, eye motion or pre-rendered physics (hair/cloths).
     **/
    movement?: string[];
    /** Location of the model */
    model?: {
      /** URL of the character's folder, ending with `/`. */
      folder: string;
      /** File name of the character model, inside `folder`. */
      file: string;
    };
  }[];
  /** Morph controllers of the loaded characters. Set while playing. Used for debugging only. */
  modelMorph = [] as MmdMorphController[];
  /** The running scene and its parts. Set while playing. */
  controller = {
    /** Shifts the motion of the characters and/or camera against the music. Values in frames. */
    frameOffset: {
      model: 0,
      camera: 0,
    },
    mainRuntime: undefined as MmdRuntime | undefined,
    musicRuntime: undefined as MmdRuntime | undefined,
    cameraRuntime: undefined as MmdRuntime | undefined,
    /** Plays the music. `musicRuntime` follows it. */
    audioPlayer: undefined as StreamAudioPlayer | undefined,
    /** The Babylon.js scene. */
    scene: undefined as Scene | undefined,
    shadowGenerator: undefined as ShadowGenerator | undefined,
    directionalLight: undefined as DirectionalLight | undefined,
    hemisphericLight: undefined as HemisphericLight | undefined,
  };
  /** Index of the character the controls and camera follow. Read live by player. */
  focusedModel = 0;
  /** Number of character slots in the scene builder. */
  maxModelFocus = 5;
  /** Use Bullet physics (Ammo.js), which behaves closer to MMD. `false` uses the lighter Havok engine. */
  useBulletPhysics = true;
  /** Add screen-space reflections and other extra rendering effects. */
  useAdvanceRendering = true;
  /** Start again from 0:00 when the song ends. Set in the Tools panel. */
  loop = false;
  /** Playback speed, `1` is normal. Set by the bottom bar and the `[`, `]` and `0` keys. */
  playbackRate = 1;
  /** Active camera: `0` the camera motion, `1` fly, `2` hooked to the focused character. */
  cameraType = 0;
  /** Light the scene from one direction, with shadows. `false` lights it evenly. Set in the Tools panel. */
  directLight = true;
  /** Which controls to use, set by the start buttons. */
  startMode = "desktop" as "desktop" | "mobile";
  /** Offset of the hooked camera from the focused character. Set in the Tools panel. */
  zCamOffset = { x: 0, y: 10, z: 0 } as SimpleVector;
  /** Position of each character, by slot. */
  entitiesOffset = [] as SimpleVector[];
  /** Rotation of each character, by slot. */
  entitiesAngle = [] as SimpleVector[];
  /** Loaded motion and model of each character. Set while playing. */
  entitiesData = [] as [MmdAnimation | undefined, MmdMesh | undefined][];
  /** Morph weights of each character, by slot and then morph name. */
  actionMemory = [{}, {}, {}, {}, {}] as {
    [key: string]: number;
  }[];
  /** Selected render resolutions, as indexes into the resolution list. */
  resolutions = {
    /** Resolution used in fullscreen. `0` is the screen size. */
    fullscreen: validResolutionsDefaults.fullscreen as number,
    /** Resolution used outside fullscreen. */
    normal: validResolutionsDefaults.normal as number,
    /** Swap width and height, for portrait. */
    swappedAspectRatio: false,
  };
  /** Points the camera at `focusedModel`. Does nothing until playing. */
  refocusModel = (): void => {};
  /** Switches to the next camera type. Does nothing until playing. */
  nextCamera = (): void => {};
}

/** One player's state, passed to its child components. */
type MMDPlayer = {
  MMDLoadDetails: MMDLoadDetails;
  /** The player's root element. Look up elements from here, so players don't find each other's. */
  root: RefObject<HTMLDivElement | null>;
  /** The resolutions to choose from: `MMD`'s `resolutions` prop, or `defaultResolutions`. */
  resolutions: Resolution[];
  runtime?: BaseRuntime;
};

/**
 * A ready-made scene, shown in the presets tab and passed to `MMD`'s
 * `presets` prop. The scene preview dialog (`MMDUpdatePreview`) produces this
 * shape, so a scene built in the player can be copied in as a preset.
 *
 * @see {@link https://arclockproject.org/docs/mmd-player/component Guide} | {@link https://arclockproject.org/docs/api/mmd-player/component API}
 */
type MMDTemplateEntry = {
  /** Your own id for the preset. The player never sets it, only passes it back to `onSavePreset`. */
  id?: string;
  /** Title on the preset card. */
  title: string;
  /** Second line on the preset card. */
  subTitle: string;
  /** URL of the preset card's image. */
  thumbnail: string;
  /** URL of the music. */
  music?: string;
  /** Not used yet. */
  musicYT?: string;
  /** URL of the camera motion (`.vmd`). */
  vmdCamera?: string;
  /** URL of the stage's folder, ending with `/`. */
  stageFolder?: string;
  /** File name of the stage model, inside `stageFolder`. */
  stagePMX?: string;
  /** The characters, by slot. `null` leaves a slot empty. */
  entities?: ({
    /** URLs of the character's motion files (`.vmd`). */
    movement?: string[];
    /** The character's model: its folder URL and the file name inside it. */
    model?: {
      folder: string;
      file: string;
    };
  } | null)[];
  /** Position of each character, by slot. */
  entitiesOffset?: (SimpleVector | null)[];
  /** Rotation of each character, by slot. */
  entitiesAngle?: (SimpleVector | null)[];
  /** Frames to shift the character motion by, to line it up with the music. */
  modelPlayOffset?: number;
  /** Frames to shift the camera motion by, to line it up with the music. */
  cameraPlayOffset?: number;
  /** Camera at the start: `0` the camera motion, `1` fly, `2` hooked to the focused character. */
  cameraType?: number;
  /** Offset of the hooked camera from the focused character. Missing axes use the default. */
  cameraOffset?: Partial<SimpleVector> | null;
  /** Light from one direction, with shadows (`true`), or evenly (`false`). */
  directLight?: boolean;
  /** Start again from 0:00 when the song ends. */
  loop?: boolean;
  /** Playback speed, `1` is normal. */
  playbackRate?: number;
  /** Index of the character the controls and camera follow at the start. */
  focusedModel?: number;
  /** Morph weights of each character, by slot and then morph name. */
  actionMemory?: ({
    [key: string]: number;
  } | null)[];
};
export type {
  PlayerSize,
  Resolution,
  SimpleVector,
  mmdDetails,
  mmdDetailsProcessed,
  processingDivision,
  processedDivision,
  MMDTemplateEntry,
  MMDPlayer,
};

/** Whether the scene is on its last frame. */
const isAtEnd = (runtime: MmdRuntime): boolean =>
  runtime.currentFrameTime >= runtime.animationFrameTimeDuration - 1;

/** Plays the scene, from the start if it stopped at the end. */
const playOrRestart = async (runtime: MmdRuntime): Promise<void> => {
  if (isAtEnd(runtime)) await runtime.seekAnimation(0, true);
  return runtime.playAnimation();
};

export {
  isAtEnd,
  playOrRestart,
  overlay75,
  overlay90,
  overlay25,
  defaultResolutions,
  validResolutionsDefaults,
  MMDLoadDetails,
};
