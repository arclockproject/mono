//#region Imports
import type { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import type { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import type { Scene } from "@babylonjs/core/scene.js";
import type { MmdAnimation } from "babylon-mmd/esm/Loader/Animation/mmdAnimation.js";
import type { MmdMesh } from "babylon-mmd/esm/Runtime/mmdMesh.js";
import type { MmdMorphController } from "babylon-mmd/esm/Runtime/mmdMorphController.js";
import type { MmdRuntime } from "babylon-mmd/esm/Runtime/mmdRuntime.js";

//#endregion

//#region DEFAULTS

/** A 3D position or rotation. Rotations are in radians, around each axis. */
type SimpleVector = { x: number; y: number; z: number };

import type { BaseRuntime } from "./BaseRuntime";

const overlay75 = "#000000bf";
const overlay90 = "rgba(39, 39, 39, 0.9)";
const overlay25 = "rgba(230, 230, 230, 0.5)";

const validResolutionsDefaults = {
  fullscreen: 0,
  normal: 6,
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

const ref: { runtime?: BaseRuntime } = { runtime: undefined };
//#endregion

/**
 * The live state of the player: what the scene builder and presets have
 * selected and while playing, the running scene. The player's UI reads and
 * writes it directly, so it is shared by the whole page.
 *
 * Changing it before pressing play changes what loads. It is also available
 * as `window.MMDLoadDetails` for debugging.
 *
 * Currently unable to be rendered with SSR or SSG.
 *
 * @see {@link https://arclockproject.org/docs/mmd-player/component Guide} | {@link https://arclockproject.org/docs/api/mmd-player/component API}
 */
const MMDLoadDetails = {
  /** Text from the debug panel's audio field, or the preset's music URL. */
  music: "",
  /** URL of the music that plays. */
  musicRaw: "",
  /** URL of the camera motion (`.vmd`). */
  vmdCamera: "",
  /** URL of the thumbnail image. */
  thumbnail: "",
  /** URL of the stage's folder, ending with `/`. */
  stageFolder: "",
  /** File name of the stage model, inside `stageFolder`. */
  stagePMX: "",
  /** Place characters side by side automatically, instead of using `entitiesOffset`. */
  offsetCharacters: false,
  /** The characters, by slot. Each has a model and its motion files. */
  entities: [] as {
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
  }[],
  /** Morph controllers of the loaded characters. Set while playing. Used for debugging only. */
  modelMorph: [] as MmdMorphController[],
  /** The running scene and its parts. Set while playing. */
  controller: {
    /** Shifts the motion of the characters and/or camera against the music. Values in frames. */
    frameOffset: {
      model: 0,
      camera: 0,
    },
    mainRuntime: undefined as MmdRuntime | undefined,
    musicRuntime: undefined as MmdRuntime | undefined,
    cameraRuntime: undefined as MmdRuntime | undefined,
    /** The Babylon.js scene. */
    scene: undefined as Scene | undefined,
    shadowGenerator: undefined as ShadowGenerator | undefined,
    directionalLight: undefined as DirectionalLight | undefined,
    hemisphericLight: undefined as HemisphericLight | undefined,
  },
  /** Index of the character the controls and camera follow. Read live by player. */
  focusedModel: 0,
  /** Number of character slots in the scene builder. */
  maxModelFocus: 5,
  /** Use Bullet physics (Ammo.js), which behaves closer to MMD. `false` uses the lighter Havok engine. */
  useBulletPhysics: true,
  /** Add screen-space reflections and other extra rendering effects. */
  useAdvanceRendering: true,
  /** Which controls to use, set by the start buttons. */
  startMode: "desktop" as "desktop" | "mobile",
  /** Offset of the camera from the focused character. */
  zCamOffset: { x: 0, y: 10, z: 0 } as SimpleVector,
  /** Position of each character, by slot. */
  entitiesOffset: [] as SimpleVector[],
  /** Rotation of each character, by slot. */
  entitiesAngle: [] as SimpleVector[],
  /** Loaded motion and model of each character. Set while playing. */
  entitiesData: [] as [MmdAnimation | undefined, MmdMesh | undefined][],
  /** Morph weights of each character, by slot and then morph name. */
  actionMemory: [{}, {}, {}, {}, {}] as {
    [key: string]: number;
  }[],
  /** Selected render resolutions, as indexes into the resolution list. */
  resolutions: {
    /** Resolution used in fullscreen. `0` is the screen size. */
    fullscreen: validResolutionsDefaults.fullscreen as number,
    /** Resolution used outside fullscreen. */
    normal: validResolutionsDefaults.normal as number,
    /** Swap width and height, for portrait. */
    swappedAspectRatio: false,
  },
  /** Points the camera at `focusedModel`. Does nothing until playing. */
  refocusModel: (): void => {},
};

/**
 * A ready-made scene, shown in the presets tab and passed to `MMD`'s
 * `presets` prop. The scene preview dialog (`MMDUpdatePreview`) produces this
 * shape, so a scene built in the player can be copied in as a preset.
 *
 * @see {@link https://arclockproject.org/docs/mmd-player/component Guide} | {@link https://arclockproject.org/docs/api/mmd-player/component API}
 */
type MMDTemplateEntry = {
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
    model: {
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
  /** Index of the character the controls and camera follow at the start. */
  focusedModel?: number;
  /** Morph weights of each character, by slot and then morph name. */
  actionMemory?: ({
    [key: string]: number;
  } | null)[];
};
//@ts-expect-error
window.MMDLoadDetails = MMDLoadDetails;

export type {
  SimpleVector,
  mmdDetails,
  mmdDetailsProcessed,
  processingDivision,
  processedDivision,
  MMDTemplateEntry,
};

export {
  overlay75,
  overlay90,
  overlay25,
  validResolutionsDefaults,
  ref,
  MMDLoadDetails,
};
