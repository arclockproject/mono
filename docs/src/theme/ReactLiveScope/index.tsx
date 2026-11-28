import { AppearingText } from "@arclockproject/common/components/AppearingText";
import AudioMixer, {
  AudioMixerProvider,
  useAudioMixer,
} from "@arclockproject/common/components/AudioMixer";
import FileBrowser from "@arclockproject/common/components/FileBrowser";
import { GalleryBrowser } from "@arclockproject/common/components/GalleryBrowser";
import Image from "@arclockproject/common/components/Image";
import Movable from "@arclockproject/common/components/Movable";
import {
  AudioHolder,
  MiniPlayer,
  PlayerContextProvider,
  usePlayer,
  VideoPlayer,
} from "@arclockproject/common/components/Player";
import PSDViewer from "@arclockproject/common/components/PSDViewer";
import { Reader } from "@arclockproject/common/components/Reader";
import {
  LimitLines1,
  LimitLines2,
  Text,
} from "@arclockproject/common/components/Text";
import Window from "@arclockproject/common/components/Window";
import ArrayUtil from "@arclockproject/common/library/Array";
import { Map2D, Node2D, Vector2D } from "@arclockproject/common/library/AStar";
import {
  AudioManager,
  AudioManagerGlobal,
} from "@arclockproject/common/library/Audio";
import { AudioInstantManager } from "@arclockproject/common/library/AudioInstant";
import EventManager from "@arclockproject/common/library/EventManager";
import Extension from "@arclockproject/common/library/Extension";
import Firewall from "@arclockproject/common/library/Firewall";
import LocalStorage, {
  useLocalStorageState,
} from "@arclockproject/common/library/LocalStorage";
import Random, { SeededRandom } from "@arclockproject/common/library/Random";
import Search from "@arclockproject/common/library/Search";
import Time from "@arclockproject/common/library/Time";
import TaskWorker from "@arclockproject/common/library/Worker";
import MMD from "@arclockproject/mmd-player";
import { beepUrl, REMOTE } from "@site/src/components/DemoAssets";
import React from "react";
import JSXRunTime from "react/jsx-runtime";

const ReactLiveScope: unknown = {
  React,
  ...React,
  ...JSXRunTime,
  REMOTE,

  Window,
  LimitLines1,
  Text,
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
  GalleryBrowser,
  Reader,
  AudioMixer,
  AudioMixerProvider,
  useAudioMixer,
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
  Extension,
  LocalStorage,
  useLocalStorageState,
  TaskWorker,
  Firewall,
  Search,
  beepUrl,
};

export default ReactLiveScope;
