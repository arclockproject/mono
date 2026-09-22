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

const MMDLoadDetails = {
  music: "",
  musicRaw: "",
  vmdCamera: "",
  thumbnail: "",
  stageFolder: "",
  stagePMX: "",
  offsetCharacters: false,
  entities: [] as {
    movement?: string[];
    model?: { folder: string; file: string };
  }[],
  modelMorph: [] as MmdMorphController[],
  controller: {
    frameOffset: {
      model: 0,
      camera: 0,
    },
    mainRuntime: undefined as MmdRuntime | undefined,
    musicRuntime: undefined as MmdRuntime | undefined,
    cameraRuntime: undefined as MmdRuntime | undefined,
    scene: undefined as Scene | undefined,
    shadowGenerator: undefined as ShadowGenerator | undefined,
    directionalLight: undefined as DirectionalLight | undefined,
    hemisphericLight: undefined as HemisphericLight | undefined,
  },
  focusedModel: 0,
  maxModelFocus: 5,
  useBulletPhysics: true,
  useAdvanceRendering: true,
  startMode: "desktop" as "desktop" | "mobile",
  zCamOffset: { x: 0, y: 10, z: 0 } as SimpleVector,
  entitiesOffset: [] as SimpleVector[],
  entitiesAngle: [] as SimpleVector[],
  entitiesData: [] as [MmdAnimation | undefined, MmdMesh | undefined][],
  actionMemory: [{}, {}, {}, {}, {}] as {
    [key: string]: number;
  }[],
  resolutions: {
    fullscreen: validResolutionsDefaults.fullscreen as number,
    normal: validResolutionsDefaults.normal as number,
    swappedAspectRatio: false,
  },
  refocusModel: (): void => {},
};

/**
 * Preview MMD Entry
 */
type MMDTemplateEntry = {
  title: string;
  subTitle: string;
  thumbnail: string;
  music?: string;
  musicYT?: string;
  vmdCamera?: string;
  stageFolder?: string;
  stagePMX?: string;
  entities?: ({
    movement?: string[];
    model: {
      folder: string;
      file: string;
    };
  } | null)[];
  entitiesOffset?: (SimpleVector | null)[];
  entitiesAngle?: (SimpleVector | null)[];
  modelPlayOffset?: number;
  focusedModel?: number;
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
