import React from "react";
import JSXRunTime from "react/jsx-runtime";

import Window from "@arclockproject/common/components/Window";
import Movable from "@arclockproject/common/components/Movable";
import {
  LimitLines1,
  LimitLines2,
} from "@arclockproject/common/components/Text";
import PSDViewer from "@arclockproject/common/components/PSDViewer";
import {
  AudioHolder,
  MiniPlayer,
  PlayerContextProvider,
  usePlayer,
  VideoPlayer,
} from "@arclockproject/common/components/Player";
import Image from "@arclockproject/common/components/Image";
import { AppearingText } from "@arclockproject/common/components/AppearingText";
import FileBrowser from "@arclockproject/common/components/FileBrowser";
import Time from "@arclockproject/common/library/Time";
import Random, { SeededRandom } from "@arclockproject/common/library/Random";
import ArrayUtil from "@arclockproject/common/library/Array";
import { Map2D, Node2D, Vector2D } from "@arclockproject/common/library/AStar";
import {
  AudioManager,
  AudioManagerGlobal,
} from "@arclockproject/common/library/Audio";
import { AudioInstantManager } from "@arclockproject/common/library/AudioInstant";
import EventManager from "@arclockproject/common/library/EventManager";

import MMD from "@arclockproject/mmd-player";

/**
 * Demo helper: returns a URL to a short generated beep, so the audio examples
 * work without any sound files. Results are cached per frequency.
 */
const beepCache: Record<number, string> = {};
function beepUrl(frequency = 440): string {
  if (beepCache[frequency]) return beepCache[frequency];
  const rate = 22050;
  const length = Math.floor(rate * 0.2);
  const view = new DataView(new ArrayBuffer(44 + length * 2));
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };
  // WAV header: mono, 16-bit
  text(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i++) {
    const fade = 1 - i / length;
    const sample = Math.sin((2 * Math.PI * frequency * i) / rate);
    view.setInt16(44 + i * 2, sample * fade * 12000, true);
  }
  beepCache[frequency] = URL.createObjectURL(
    new Blob([view], { type: "audio/wav" }),
  );
  return beepCache[frequency];
}

const ReactLiveScope: unknown = {
  React,
  ...React,
  ...JSXRunTime,
  // Can change to https://example.com/demo-assets if moved offshore.
  REMOTE: {
    base:
      process.env.NODE_ENV === "production"
        ? "https://arclockproject.github.io/demo-assets"
        : "/demo-assets", // git clone assets repo to static
    noname0310:
      "https://noname0310.github.io/web-mmd-viewer/melancholic_night/mmd_public",
  },

  Window,
  LimitLines1,
  LimitLines2,
  PSDViewer,
  AudioHolder,
  MiniPlayer,
  PlayerContextProvider,
  usePlayer,
  VideoPlayer,
  Image,
  AppearingText,
  FileBrowser,
  MMD,
  Movable,
  Time,
  Random,
  SeededRandom,
  // Named ArrayUtil so it doesn't hide the built-in Array.
  ArrayUtil,
  Map2D,
  Node2D,
  Vector2D,
  AudioManager,
  AudioManagerGlobal,
  AudioInstantManager,
  EventManager,
  beepUrl,
};

export default ReactLiveScope;
