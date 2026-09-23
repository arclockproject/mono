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

import MMD from "@arclockproject/mmd-player";
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
};

export default ReactLiveScope;
