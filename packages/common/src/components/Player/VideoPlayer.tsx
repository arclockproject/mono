//#region Imports

import Movable from "@arclockproject/common/components/Movable";
import { Text } from "@arclockproject/common/components/Text";
import { AudioInstantManagerGlobal } from "@arclockproject/common/library/AudioInstant";
import Time from "@arclockproject/common/library/Time";
import AddIcon from "@mui/icons-material/Add";
import BugReportIcon from "@mui/icons-material/BugReport";
import CheckIcon from "@mui/icons-material/Check";
import ClosedCaptionIcon from "@mui/icons-material/ClosedCaption";
import ClosedCaptionOffIcon from "@mui/icons-material/ClosedCaptionOff";
import ControlCameraIcon from "@mui/icons-material/ControlCamera";
import FastForwardIcon from "@mui/icons-material/FastForward";
import FastRewindIcon from "@mui/icons-material/FastRewind";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import GraphicEqIcon from "@mui/icons-material/GraphicEq";
import HeadphonesIcon from "@mui/icons-material/Headphones";
import InfoIcon from "@mui/icons-material/Info";
import MovieIcon from "@mui/icons-material/Movie";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import MusicOffIcon from "@mui/icons-material/MusicOff";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RemoveIcon from "@mui/icons-material/Remove";
import RepeatIcon from "@mui/icons-material/Repeat";
import RepeatOneIcon from "@mui/icons-material/RepeatOne";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SettingsIcon from "@mui/icons-material/Settings";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import SubtitlesIcon from "@mui/icons-material/Subtitles";
import ThreeSixtyIcon from "@mui/icons-material/ThreeSixty";
import TuneIcon from "@mui/icons-material/Tune";
import ViewInArIcon from "@mui/icons-material/ViewInAr";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import {
  CircularProgress,
  Divider,
  ListItemIcon,
  ListItemText,
  MenuItem,
  MenuList,
  Popover,
  Skeleton,
  styled,
  type TooltipProps,
  Typography,
} from "@mui/material";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip, { tooltipClasses } from "@mui/material/Tooltip";
import {
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { JSX } from "react/jsx-runtime";
import {
  AudioEffectsPanel,
  SubtitlesPanel,
  VideoFiltersPanel,
  VideoFormatPanel,
} from "./EffectsPanels";
import {
  useEmbeddedSubtitleFiles,
  withEmbeddedSubtitles,
} from "./embeddedSubtitles";
import {
  DEFAULT_MAX_DURATION,
  getBufferedEnd,
  isDurationKnown,
  pickSubtitleFile,
  SPEED_MAX,
  SPEED_MIN,
  stereoAspect,
  stereoEyeRect,
  subtitleFiles,
  type videoChapters,
  type videoData,
  videoFilterCss,
  type videoHeatmap,
} from "./globals";
import { ProgressBar } from "./ProgressBar";
import {
  DEFAULT_SPHERE_VIEW,
  requestVrSession,
  SphereRenderer,
  type sphereView,
  useVrSupported,
  type XRSessionLike,
} from "./SphereRenderer";
import { SubtitleOverlay, useSubtitleTrack } from "./SubtitleOverlay";
import { usePlayer } from "./usePlayer";

//#endregion

//#region VideoPlayer.tsx

const HIDE_INTERFACE_AFTER_MS = 2000;
const HIDE_INTERFACE_AFTER_MS_SHORT = 1400;

const quickEnough: { [key: number]: boolean } = {};
const timeout: ReturnType<typeof setTimeout>[] = [];
function createDoubleClickListener(
  single: () => void,
  double: () => void,
  id: number,
  time: number = 200,
) {
  const clear = (extended = false) => {
    clearTimeout(timeout?.[id]);
    timeout[id] = setTimeout(() => {
      quickEnough[id] = false;
      if (!extended) single();
    }, time);
  };
  return () => {
    clear();
    if (quickEnough[id]) {
      clear(true);
      if (quickEnough[id]) {
        double();
      }
    }
    quickEnough[id] = true;
  };
}
const READY_STATES = ["nothing", "metadata", "current", "future", "enough"];
const ERROR_RANGE_SECONDS_RESET = 1;
const ERROR_RANGE_SECONDS_NUDGE = 0.02;
const MAX_NUDGE_RATE = 0.1;
// var lastClick = 0;
let lastKnownY = 0;

let fullscreenOwner: symbol | null = null;
let activePlayer: symbol | null = null;

const OVERLAY_Z_INDEX = 2147483647;
const overlayContainer = (): Element =>
  document.fullscreenElement ?? document.body;
const PlayerTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip
    {...props}
    arrow
    classes={{ popper: className }}
    slotProps={{ popper: { container: overlayContainer } }}
  />
))({
  zIndex: OVERLAY_Z_INDEX,
  [`& .${tooltipClasses.arrow}`]: {
    color: "rgba(18, 18, 18, 0.92)",
  },
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: "rgba(18, 18, 18, 0.92)",
    color: "#fff",
    fontSize: 12,
  },
});
const SEEK_FEEDBACK_MS = 700;
interface position {
  x: number;
  y: number;
}
/**
 * The main video player: 16:9 video with controls, progress bar, chapters,
 * heatmap, subtitles, speed, fullscreen and audio-only mode. It plays whatever
 * is loaded in the player state, so it can be unmounted and mounted again
 * without stopping (keep `AudioHolder` mounted for that). Must be inside
 * `PlayerContextProvider`.
 *
 * Changes to `videoData.id`  will make the player restart from 0 and play that instead.
 *
 * The settings button and right-click open the same menu with loop, subtitles,
 * filters, effects, 180°/360°/3D and debug. Pick "Move and zoom" there to
 * drag, scroll-zoom or pinch the video. Playback is not touched. While it is
 * on, taps on the video don't play, pause or seek. "Done" or `Esc` keeps the
 * position and zoom, and "Reset" puts the video back.
 *
 * Subtitles (`.vtt`, `.srt`, `.ass`) are drawn by the player, so they also
 * show in audio only mode. `C` or the subtitles button turns them on and
 * off. Text subtitle tracks inside `.mkv`, `.webm`, `.mp4` and `.mov` videos
 * are listed too. For 180°, 360° and 3D videos, set `videoData.format`. 180°
 * and 360° are dragged to look around.
 *
 * @see {@link https://arclockproject.org/docs/common/components/Player Guide} | {@link https://arclockproject.org/docs/api/common/components/Player API}
 * @example
 * <VideoPlayer videoData={{
 *   id: "my-id-300";
 *   title: "Cat video";
 *   files: {
 *     video: "/videos/cat-300.mp4";
 *     audio: "/videos/cat-300.mp3";
 *     subtitles: [{ label: "English", url: "/videos/cat-300-en.vtt" }];
 *     thumbnail: "/videos/cat-300.png";
 *   };
 *   meta: { ... }; // Your data or null
 * }} isPlaylist={false} chapters={[]} heatmap={[]} />
 */
function VideoPlayer<metaType, listMetaType>(props: {
  /**
   * Entry to load when this player mounts or the `id` changes. Leave it out to
   * show whatever is already loaded.
   */
  videoData?: videoData<metaType>;
  /** `false` clears the current playlist, so only this entry plays. */
  isPlaylist: boolean;
  /** Not used yet. */
  errorDisplay?: string;
  /** Chapters to mark on the progress bar. */
  chapters: videoChapters[];
  /** "Most watched" graph to draw above the progress bar. */
  heatmap: Required<videoHeatmap>[];
  /** Not used yet. Use `settings.stickyTriggerDistance` instead. */
  ScrollTriggerDistance?: number;
  /** Show the title over the video. It is always shown in fullscreen. */
  showInlineTitle?: boolean;
}): JSX.Element {
  const context = usePlayer<metaType, listMetaType>();
  const [playerId] = useState(() => Symbol("VideoPlayer"));
  const [fullscreen, setFullscreen] = useState(false);
  const [hideControls, setHideControls] = useState(false);
  const [taikoMode, setTaikoMode] = useState(false);
  const [lastAction, setLastAction] = useState(0);
  const [forcedVolumeWidth, setForcedVolumeWidth] = useState("0px");
  const [durationError, setDurationError] = useState("");
  const [hideVideoErrors, setHideVideoErrors] = useState(false);
  const [forcedVolumePadding, setForcedVolumePadding] = useState("0px");
  const [dodgeNav, setDodgeNav] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const resyncCount = useRef(0);
  const offsetRef = useRef(context.internal.audioOffset.value);
  offsetRef.current = context.internal.audioOffset.value;
  const lastResync = useRef<{ time: number; gap: number } | null>(null);
  const [debugInfo, setDebugInfo] = useState({
    desync: "—",
    clock: "—",
    rate: "—",
    lastResync: "",
    buffer: "—",
    ready: "—",
    resolution: "—",
    framerate: "—",
  });

  const [transformMode, setTransformMode] = useState(false);
  const [transformed, setTransformed] = useState(false);
  const [transformResetting, setTransformResetting] = useState(false);
  useEffect(() => {
    if (transformResetting) setTransformResetting(false);
  }, [transformResetting]);
  const transformEnabled =
    (transformMode || transformed) && !transformResetting;
  const resetTransform = () => setTransformResetting(true);

  const loadedId = context.internal.playerData.value?.id;
  const audioOnly = context.internal.audioOnly.value;
  const format = context.internal.videoFormat.value;
  const [sphereFailure, setSphereFailure] = useState<{
    id: string | undefined;
    message: string;
  } | null>(null);
  const sphereError =
    sphereFailure && sphereFailure.id === loadedId
      ? sphereFailure.message
      : null;
  const sphereActive =
    format.projection !== "flat" &&
    context.internal.videoPixelsAvailable &&
    !sphereError &&
    !audioOnly;
  const view = useRef<sphereView>({ ...DEFAULT_SPHERE_VIEW });
  const resetView = () => Object.assign(view.current, DEFAULT_SPHERE_VIEW);
  const vrSupported = useVrSupported();
  const [xrSession, setXrSession] = useState<XRSessionLike | null>(null);
  const [vrError, setVrError] = useState<string | null>(null);
  const enterVr = () => {
    setVrError(null);
    requestVrSession().then(setXrSession, (error: unknown) =>
      setVrError(
        error instanceof Error ? error.message : "VR could not start.",
      ),
    );
  };
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const playerBox = useRef<HTMLDivElement>(null);
  const [playerBoxSize, setPlayerBoxSize] = useState({ width: 0, height: 0 });
  const eyeAspect =
    !sphereActive && !audioOnly && format.stereo !== "mono"
      ? stereoAspect(format, videoSize.width, videoSize.height)
      : null;
  const eyeRect = stereoEyeRect(format, 0);
  const eyeBox = (() => {
    if (!eyeAspect || playerBoxSize.width <= 0 || playerBoxSize.height <= 0)
      return null;
    const width = Math.min(
      playerBoxSize.width,
      playerBoxSize.height * eyeAspect,
    );
    const height = width / eyeAspect;
    return {
      left: (playerBoxSize.width - width) / 2,
      top: (playerBoxSize.height - height) / 2,
      width,
      height,
    };
  })();
  const pictureAspect = sphereActive
    ? null
    : (eyeAspect ??
      (!audioOnly && videoSize.width > 0
        ? videoSize.width / videoSize.height
        : null));

  const subtitleSettings = context.internal.subtitleSettings.value;
  const embeddedSubtitleList = useEmbeddedSubtitleFiles(
    context.internal.playerData.value?.files.video,
    context.internal.settings.value.embeddedSubtitles !== false,
  );
  const subtitleList = useMemo(
    () =>
      withEmbeddedSubtitles(
        subtitleFiles(context.internal.playerData.value?.files.subtitles),
        embeddedSubtitleList,
      ),
    [context.internal.playerData.value?.files.subtitles, embeddedSubtitleList],
  );
  const hasSubtitles = subtitleList.length > 0;
  const subtitleFile = pickSubtitleFile(subtitleList, subtitleSettings.track);
  const {
    track: subtitleTrack,
    error: subtitleError,
    loading: subtitleLoading,
  } = useSubtitleTrack(
    subtitleFile?.url,
    subtitleFile?.track,
    subtitleSettings.enabled,
  );
  const subtitleOverlay = (
    <SubtitleOverlay
      track={subtitleTrack}
      getTime={() =>
        (context.internal.audioOnly.value
          ? undefined
          : context.internal.refVideo.current?.currentTime) ??
        context.internal.targetControllerRef.current?.currentTime ??
        context.internal.currentPosition.value
      }
      settings={subtitleSettings}
      aspect={pictureAspect}
      bottomInset={hideControls ? 0 : 72}
    />
  );
  const toggleSubtitles = () =>
    context.internal.subtitleSettings.set({
      ...subtitleSettings,
      enabled: !subtitleSettings.enabled,
    });

  const drag = useRef<{
    pointers: Map<number, { x: number; y: number }>;
    start: { x: number; y: number };
    moved: boolean;
    pinch: number | null;
  }>({ pointers: new Map(), start: { x: 0, y: 0 }, moved: false, pinch: null });
  const overlayBox = useRef<HTMLDivElement>(null);
  const wasDrag = () => {
    if (!drag.current.moved) return false;
    drag.current.moved = false;
    return true;
  };
  const onLookPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!sphereActive) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const state = drag.current;
    if (state.pointers.size === 0) {
      state.moved = false;
      state.start = { x: event.clientX, y: event.clientY };
    }
    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (state.pointers.size > 1) return;
    const element = overlayBox.current;
    const onMove = (move: PointerEvent) => {
      const last = state.pointers.get(move.pointerId);
      if (!last) return;
      state.pointers.set(move.pointerId, { x: move.clientX, y: move.clientY });
      if (state.pointers.size >= 2) {
        const [a, b] = [...state.pointers.values()];
        const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (state.pinch !== null && distance > 0)
          view.current.fov *= state.pinch / distance;
        state.pinch = distance;
        state.moved = true;
        return;
      }
      if (
        !state.moved &&
        Math.hypot(move.clientX - state.start.x, move.clientY - state.start.y) <
          6
      )
        return;
      state.moved = true;
      const radiansPerPixel =
        (view.current.fov * Math.PI) /
        180 /
        Math.max(1, element?.clientHeight ?? 1);
      view.current.yaw += (move.clientX - last.x) * radiansPerPixel;
      view.current.pitch += (move.clientY - last.y) * radiansPerPixel;
    };
    const onUp = (up: PointerEvent) => {
      state.pointers.delete(up.pointerId);
      state.pinch = null;
      if (state.pointers.size > 0) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };
  useEffect(() => {
    const element = overlayBox.current;
    if (!sphereActive || !element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      view.current.fov *= event.deltaY > 0 ? 1.08 : 1 / 1.08;
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [sphereActive]);
  useEffect(() => {
    if (sphereActive) setTransformMode(false);
  }, [sphereActive]);
  useEffect(() => {
    resetView();
  }, [loadedId]);
  useEffect(() => {
    if (!xrSession) return;
    if (!sphereActive) void xrSession.end().catch(() => {});
    return () => {
      if (!sphereActive) return;
      void xrSession.end().catch(() => {});
    };
  }, [sphereActive, xrSession]);
  useEffect(() => {
    const element = playerBox.current;
    if (!element) return;
    const update = () =>
      setPlayerBoxSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [!!context.internal.playerData.value]);

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [openEffects, setOpenEffects] = useState<
    "video" | "audio" | "subtitles" | "format" | null
  >(null);
  const videoFilter = videoFilterCss(context.internal.videoFilters.value);
  const [contextMenuPosition, setContextMenuPosition] = useState<position>({
    x: 0,
    y: 0,
  });

  const canvas = useRef<HTMLCanvasElement>(null);
  const ctx = canvas.current?.getContext("2d");

  const uniqueID = props.videoData?.id;
  const thumbnail = context.internal.playerData.value?.files.thumbnail;
  useEffect(() => {
    if (!uniqueID) return;
    if (uniqueID !== context.internal.playerData.value?.id) {
      context.internal.maxDuration.set(DEFAULT_MAX_DURATION);
      context.internal.currentPosition.set(0);
      context.internal.audioBuffer.set(0);
    }
    context.internal.videoBuffer.set(0);
    context.internal.playerData.set(props.videoData);
    if (context.internal.settings.value.autoPlay) {
      context.internal.playing.set(true);
    }
  }, [uniqueID]);
  useEffect(() => {
    if (
      props.chapters.length === 0 &&
      context.internal.chapters.value.length === 0
    )
      return;
    context.internal.chapters.set(props.chapters);
  }, [props.chapters]);

  useEffect(() => {
    if (
      props.heatmap.length === 0 &&
      context.internal.heatmap.value.length === 0
    )
      return;
    context.internal.heatmap.set(props.heatmap);
  }, [props.heatmap]);
  useEffect(() => {
    if (props.isPlaylist) return;
    context.internal.playlistContent.set([]);
  }, [props.isPlaylist]);
  useEffect(() => {
    const fullScreenChanger = () => {
      setFullscreen(
        document.fullscreenElement !== null && fullscreenOwner === playerId,
      );
    };

    document.addEventListener("fullscreenchange", fullScreenChanger);
    return () => {
      document.removeEventListener("fullscreenchange", fullScreenChanger);
    };
  }, []);
  useEffect(() => {
    if (
      !context.internal.playing.value ||
      context.internal.audioOnly.value ||
      sphereActive ||
      !context.internal.settings.value.videoBackgroundBloom
    )
      return;
    const backScreenDrawerInterval = setInterval(() => {
      const video = context.internal.refVideo.current;
      if (!ctx || !video) return;
      ctx.globalAlpha = 0.1;
      ctx.filter = videoFilter;
      if (format.stereo === "mono" || video.videoWidth === 0) {
        ctx.drawImage(video, 0, 0, 110, 75);
      } else {
        ctx.drawImage(
          video,
          eyeRect.x * video.videoWidth,
          eyeRect.y * video.videoHeight,
          eyeRect.width * video.videoWidth,
          eyeRect.height * video.videoHeight,
          0,
          0,
          110,
          75,
        );
      }
    }, 250);
    return () => clearInterval(backScreenDrawerInterval);
  }, [
    videoFilter,
    sphereActive,
    format.stereo,
    format.swapEyes,
    context.internal.refVideo.current,
    ctx,
    context.internal.playing.value,
    context.internal.audioOnly.value,
    context.internal.settings.value.videoBackgroundBloom,
  ]);
  useEffect(() => {
    const backdropChanger = () => {
      const scrollPosition = document.scrollingElement?.scrollTop ?? 0;
      if (
        lastKnownY >
        scrollPosition + context.internal.settings.value.stickyTriggerDistance
      ) {
        setDodgeNav(false);
        lastKnownY = scrollPosition;
        return;
      }
      if (
        lastKnownY <
        scrollPosition - context.internal.settings.value.stickyTriggerDistance
      ) {
        setDodgeNav(true);
        lastKnownY = scrollPosition;
        return;
      }
    };
    document.addEventListener("scroll", backdropChanger);
    return () => {
      document.removeEventListener("scroll", backdropChanger);
    };
  }, [dodgeNav]);
  useEffect(() => {
    const video = context.internal.refVideo.current;
    if (!showDebug || !video) return;
    const hasAudioClock =
      context.internal.audioControlled && !context.internal.audioOnly.value;
    const supportsFrameCallback = "requestVideoFrameCallback" in video;
    let frameCallbackId: number | null = null;
    let presentedFrames = 0;
    let frameGap: number | null = null;
    const samples: { frames: number; time: number }[] = [];
    const onFrame: VideoFrameRequestCallback = (_now, metadata) => {
      presentedFrames = metadata.presentedFrames;
      const audio = context.internal.refAudio.current;
      frameGap = audio
        ? audio.currentTime + offsetRef.current - metadata.mediaTime
        : null;
      frameCallbackId = video.requestVideoFrameCallback(onFrame);
    };
    if (supportsFrameCallback)
      frameCallbackId = video.requestVideoFrameCallback(onFrame);
    const update = () => {
      const audio = context.internal.refAudio.current;
      const gap =
        supportsFrameCallback && !video.paused && frameGap !== null
          ? frameGap
          : audio
            ? audio.currentTime + offsetRef.current - video.currentTime
            : null;
      const quality = video.getVideoPlaybackQuality();
      samples.push({
        frames: supportsFrameCallback
          ? presentedFrames
          : quality.totalVideoFrames - quality.droppedVideoFrames,
        time: performance.now(),
      });
      if (samples.length > 5) samples.shift();
      const first = samples[0]!;
      const last = samples[samples.length - 1]!;
      const fps =
        last.time > first.time
          ? ((last.frames - first.frames) * 1000) / (last.time - first.time)
          : 0;
      const ahead = (element: HTMLMediaElement) =>
        `${Math.max(0, getBufferedEnd(element) - element.currentTime).toFixed(1)}s`;
      const resync = lastResync.current;
      const droppedPercent =
        quality.totalVideoFrames > 0
          ? (quality.droppedVideoFrames / quality.totalVideoFrames) * 100
          : 0;
      setDebugInfo({
        desync:
          hasAudioClock && gap !== null
            ? `${gap >= 0 ? "+" : ""}${Math.round(gap * 1000)}ms${offsetRef.current !== 0 ? ` (offset ${offsetRef.current > 0 ? "+" : ""}${Math.round(offsetRef.current * 1000)}ms)` : ""}`
            : "—",
        clock: !hasAudioClock
          ? "video only"
          : supportsFrameCallback && !video.paused
            ? "frame callback"
            : "currentTime",
        rate: video.playbackRate.toFixed(3),
        lastResync: resync
          ? ` · last ${Math.round((Date.now() - resync.time) / 1000)}s ago (${resync.gap.toFixed(2)}s)`
          : "",
        buffer:
          hasAudioClock && audio
            ? `video ${ahead(video)} · audio ${ahead(audio)}`
            : ahead(video),
        ready:
          hasAudioClock && audio
            ? `video ${READY_STATES[video.readyState] ?? video.readyState} · audio ${READY_STATES[audio.readyState] ?? audio.readyState}`
            : `${READY_STATES[video.readyState] ?? video.readyState}`,
        resolution:
          video.videoWidth > 0
            ? `${video.videoWidth}×${video.videoHeight} (shown ${video.clientWidth}×${video.clientHeight})`
            : "—",
        framerate: `${fps.toFixed(1)} fps (${quality.droppedVideoFrames} dropped, ${droppedPercent.toFixed(1)}%)`,
      });
    };
    update();
    const debugInterval = setInterval(update, 250);
    return () => {
      clearInterval(debugInterval);
      if (frameCallbackId !== null)
        video.cancelVideoFrameCallback(frameCallbackId);
    };
  }, [
    showDebug,
    context.internal.refVideo.current,
    context.internal.audioControlled,
    context.internal.audioOnly.value,
  ]);
  const togglePlay = () => {
    context.internal.playing.set(!context.internal.playing.value);
  };
  const moveVideoPointer = (time: number, expectedPlayState: boolean) => {
    setLastAction(Date.now() - HIDE_INTERFACE_AFTER_MS_SHORT);
    setHideControls(false);
    if (context.internal.audioOnly.value) {
      if (context.internal.refAudio.current)
        context.internal.refAudio.current.currentTime += time;
    } else if (context.internal.targetControllerRef.current) {
      context.internal.playing.set(expectedPlayState);
      context.internal.syncAll(
        context.internal.targetControllerRef.current.currentTime + time,
        expectedPlayState,
      );
    }
  };
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      fullscreenOwner = playerId;
      await document.body.requestFullscreen();
    }
  };
  useEffect(() => {
    if (context.internal.playing.value) activePlayer = playerId;
  }, [context.internal.playing.value]);
  const audioControlledRef = useRef(context.internal.audioControlled);
  audioControlledRef.current = context.internal.audioControlled;
  useEffect(() => {
    const { refVideo, playing } = context.internal;
    return () => {
      if (!audioControlledRef.current && !refVideo.current) playing.set(false);
    };
  }, []);
  useEffect(() => {
    const onOrientationChange = () => {
      if (screen.orientation.type.match(/\w+/)?.[0] === "landscape") {
        // On rotate, if non are active, first one gets the fullscreen.
        if (activePlayer === null) activePlayer = playerId;
        if (activePlayer !== playerId) return;
        fullscreenOwner = playerId;
        void document.body.requestFullscreen();
      } else {
        void document.exitFullscreen();
      }
    };
    screen.orientation.addEventListener("change", onOrientationChange);
    return () => {
      screen.orientation.removeEventListener("change", onOrientationChange);
      if (activePlayer === playerId) activePlayer = null;
    };
  }, []);
  const generalClick = (forced: boolean) => {
    if (forced || document.body.offsetWidth > 1200) {
      if (!hideControls) togglePlay();
      setHideControls(false);
    } else {
      setHideControls(!hideControls);
    }
    setLastAction(Date.now());
  };
  const guardTap = (handler: () => void) => () => {
    if (wasDrag()) return;
    handler();
  };
  const processedSpeed =
    Math.floor(context.internal.playSpeed.value * 100) / 100;
  const [seekFeedback, setSeekFeedback] = useState<{
    side: "left" | "right";
    key: number;
  } | null>(null);
  const seekFeedbackTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const showSeekFeedback = (side: "left" | "right") => {
    clearTimeout(seekFeedbackTimer.current);
    setSeekFeedback({ side, key: Date.now() });
    seekFeedbackTimer.current = setTimeout(
      () => setSeekFeedback(null),
      SEEK_FEEDBACK_MS,
    );
  };
  useEffect(() => () => clearTimeout(seekFeedbackTimer.current), []);
  const seekFeedbackPill = (side: "left" | "right") =>
    seekFeedback?.side === side ? (
      <Box
        key={seekFeedback.key}
        sx={{
          position: "absolute",
          inset: 0,
          margin: "auto",
          height: 40,
          width: "fit-content",
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1.5,
          borderRadius: 999,
          color: "common.white",
          background: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(6px)",
          pointerEvents: "none",
          fontVariantNumeric: "tabular-nums",
          animation: `playerSeekFeedback ${SEEK_FEEDBACK_MS}ms ease-out forwards`,
          "@keyframes playerSeekFeedback": {
            "0%": { opacity: 0, transform: "scale(0.9)" },
            "20%": { opacity: 1, transform: "scale(1)" },
            "70%": { opacity: 1 },
            "100%": { opacity: 0 },
          },
        }}
      >
        {side === "left" ? <FastRewindIcon /> : <FastForwardIcon />}
        <Typography variant="body2">
          {side === "left" ? "−10s" : "+10s"}
        </Typography>
      </Box>
    ) : null;
  const controlButton = (
    label: string,
    onClick: (event: MouseEvent<HTMLButtonElement>) => void,
    icon: JSX.Element,
    placement: "top" | "bottom" = "top",
    pressed?: boolean,
  ) => (
    <PlayerTooltip title={label} placement={placement}>
      <IconButton
        aria-label={label}
        aria-pressed={pressed}
        onClick={onClick}
        sx={{ color: "common.white" }}
      >
        {icon}
      </IconButton>
    </PlayerTooltip>
  );
  const pillSx = {
    display: "flex",
    alignItems: "center",
    borderRadius: 999,
    background: "rgba(0, 0, 0, 0.35)",
    backdropFilter: "blur(6px)",
  } as const;
  const speedText = (
    `${processedSpeed}`.length === 1
      ? `${processedSpeed}.00`
      : `${processedSpeed}`.length === 3
        ? `${processedSpeed}0`
        : `${processedSpeed}`
  ).toString();
  return (
    <Box
      tabIndex={0}
      sx={(theme) => ({
        width: "100%",
        paddingTop: "56.25%",
        position: "relative",
        gridArea: "video",
        [theme.breakpoints.down("sm")]: context.internal.settings.value.sticky
          ? {
              position: "sticky",
              top: dodgeNav
                ? 0
                : `${context.internal.settings.value.stickySpacing}px`,
              transition: "top 1s",
              zIndex: fullscreen ? 10 : 5,
            }
          : {
              zIndex: fullscreen ? 10 : 5,
            },
        "&::before": {
          backdropFilter: "blur(5px)",
          content: "no-open-quote",
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
        },
      })}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuAnchor(null);
        setShowContextMenu(true);
        setContextMenuPosition({
          x: event.clientX,
          y: event.clientY,
        });
      }}
      onKeyDown={(event) => {
        if (event.altKey || event.ctrlKey || event.shiftKey) return;
        switch (event.code) {
          case "Digit9":
          case "Digit0":
          case "Minus":
          case "Equal":
          case "BracketRight":
          case "BracketLeft":
          case "Space":
          case "ArrowLeft":
          case "ArrowRight":
          case "KeyL":
          case "Period":
          case "Comma":
          case "KeyM":
          case "KeyT":
          case "KeyC":
          case "Backquote":
            break;
          case "KeyK":
            if (taikoMode) {
              AudioInstantManagerGlobal.play("/side.wav");
            }
            break;
          case "KeyJ":
            if (taikoMode) {
              AudioInstantManagerGlobal.play("/center.wav");
            }
            break;
          case "KeyD":
            if (taikoMode) {
              AudioInstantManagerGlobal.play("/side.wav");
            }
            break;
          case "KeyF":
            if (taikoMode) {
              AudioInstantManagerGlobal.play("/center.wav");
            } else {
              return;
            }
            break;
          default:
            return;
        }
        event.preventDefault();
        event.stopPropagation();
      }}
      onKeyUp={(event) => {
        if (event.altKey || event.ctrlKey || event.shiftKey) return;
        switch (event.code) {
          case "KeyT": {
            setTaikoMode(!taikoMode);
            break;
          }
          case "KeyF":
            if (!taikoMode) {
              return;
            }
            break;
          case "Digit9": {
            const lowerVolume = Math.max(
              0,
              context.internal.volume.value * 0.8,
            );
            context.internal.volume.set(lowerVolume);
            setForcedVolumeWidth("100px !important");
            setForcedVolumePadding("0px 8px");
            setLastAction(Date.now() - HIDE_INTERFACE_AFTER_MS_SHORT);
            setHideControls(false);
            if (context.internal.refAudio.current)
              context.internal.refAudio.current.volume = lowerVolume;
            if (context.internal.refVideo.current)
              context.internal.refVideo.current.volume = lowerVolume;
            break;
          }
          case "Digit0": {
            const higherVolume = Math.min(
              1,
              context.internal.volume.value * 1.2,
            );
            context.internal.volume.set(higherVolume);
            setForcedVolumeWidth("100px !important");
            setForcedVolumePadding("0px 8px");
            setLastAction(Date.now() - HIDE_INTERFACE_AFTER_MS_SHORT);
            setHideControls(false);
            if (context.internal.refAudio.current)
              context.internal.refAudio.current.volume = higherVolume;
            if (context.internal.refVideo.current)
              context.internal.refVideo.current.volume = higherVolume;
            break;
          }
          case "BracketLeft":
            context.internal.playSpeed.set(
              Math.max(
                SPEED_MIN,
                Math.round(context.internal.playSpeed.value * 90) / 100,
              ),
            );
            setLastAction(Date.now() - HIDE_INTERFACE_AFTER_MS_SHORT);
            setHideControls(false);
            break;
          case "BracketRight":
            context.internal.playSpeed.set(
              Math.min(
                SPEED_MAX,
                Math.round(context.internal.playSpeed.value * 110) / 100,
              ),
            );
            setLastAction(Date.now() - HIDE_INTERFACE_AFTER_MS_SHORT);
            setHideControls(false);
            break;
          case "Minus":
            context.internal.playSpeed.set(
              Math.max(SPEED_MIN, context.internal.playSpeed.value - 0.06),
            );
            setLastAction(Date.now() - HIDE_INTERFACE_AFTER_MS_SHORT);
            setHideControls(false);
            break;
          case "Equal":
            context.internal.playSpeed.set(
              Math.min(SPEED_MAX, context.internal.playSpeed.value + 0.06),
            );
            setLastAction(Date.now() - HIDE_INTERFACE_AFTER_MS_SHORT);
            setHideControls(false);
            break;
          case "KeyM":
            context.internal.muted.set(!context.internal.muted.value);
            break;
          case "Backquote":
            setShowDebug(!showDebug);
            break;
          case "KeyC":
            if (!hasSubtitles) return;
            toggleSubtitles();
            break;
          case "Escape":
            if (!transformMode) return;
            setTransformMode(false);
            break;
          case "KeyK":
            if (!taikoMode) {
              if (context.internal.playing.value) {
                setLastAction(Date.now());
                setHideControls(false);
              } else {
                setLastAction(0);
                setHideControls(true);
              }
              togglePlay();
            }
            break;
          case "Space":
            if (context.internal.playing.value) {
              setLastAction(Date.now());
              setHideControls(false);
            } else {
              setLastAction(0);
              setHideControls(true);
            }
            togglePlay();
            break;
          case "KeyJ":
            if (!taikoMode) {
              moveVideoPointer(-5, context.internal.playing.value);
            }
            break;
          case "ArrowLeft":
            moveVideoPointer(-5, context.internal.playing.value);
            break;
          case "ArrowRight":
          case "KeyL":
            moveVideoPointer(5, context.internal.playing.value);
            break;
          case "Period":
            moveVideoPointer(1 / 60, false);
            break;
          case "Comma":
            moveVideoPointer(-1 / 60, false);
            break;
          default:
            return;
        }
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div />
      {!context.internal.playerData.value ? (
        <Skeleton
          sx={{
            position: "absolute",
            top: 0,
            borderRadius: "16px",
          }}
          variant="rectangular"
          width="100%"
          height="100%"
        />
      ) : (
        <>
          <div
            style={{
              position: "absolute",
              inset: "-3% -5%",
              backgroundSize: "contain",
              filter: "blur(150px)",
              pointerEvents: "none",
              ...(props.videoData ? { opacity: 0.5, zIndex: -1 } : {}),
            }}
          >
            <canvas
              ref={canvas}
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                opacity: context.internal.audioOnly.value ? 0 : 1,
                transition: "opacity 5s",
              }}
              width="110"
              height="75"
            />
            <img
              alt="Thumbnail"
              src={thumbnail}
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                opacity: context.internal.audioOnly.value ? 1 : 0,
                transition: "opacity 5s",
              }}
            />
          </div>
          <Box
            ref={playerBox}
            sx={(theme) =>
              fullscreen
                ? {
                    position: "fixed",
                    inset: 0,
                    background: "black",
                    zIndex: 2147483647,
                    cursor: hideControls ? "none" : "auto",
                  }
                : {
                    position: "absolute",
                    display: "flex",
                    top: 0,
                    background: "rgba(0,0,0,1)",
                    height: "100%",
                    width: "100%",
                    overflow: "hidden",
                    cursor: hideControls ? "none" : "auto",
                    borderRadius: "16px",
                    [theme.breakpoints.down("md")]: {
                      borderRadius: context.internal.settings.value.sticky
                        ? "0px"
                        : "16px",
                    },
                  }
            }
            onMouseMove={() => {
              const now = Date.now();
              if (lastAction + 500 < now) {
                setLastAction(now);
                setHideControls(false);
              }
            }}
            onMouseLeave={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              const leftOut = box.left > event.clientX;
              const rightOut = box.right < event.clientX;
              const topOut = box.top > event.clientY;
              const bottomOut = box.bottom < event.clientY;
              const wasRightClick = event.clientY < 0 || event.clientX < 0;
              if (
                context.internal.playing.value &&
                !wasRightClick &&
                (leftOut || rightOut || bottomOut || topOut)
              ) {
                setLastAction(0);
                setHideControls(true);
              }
            }}
            onTouchMove={() => {
              const now = Date.now();
              if (lastAction + 500 < now) {
                setLastAction(now);
                setHideControls(false);
              }
            }}
          >
            {context.internal.playerData.value ? (
              <>
                <Movable
                  role="presentation"
                  enableMovement={transformEnabled && !sphereActive}
                  enableZoom={transformEnabled && !sphereActive}
                  onTransformChange={(transform) =>
                    setTransformed(
                      transform.x !== 0 ||
                        transform.y !== 0 ||
                        transform.zoom !== 1,
                    )
                  }
                  style={{
                    cursor: transformMode ? "grab" : undefined,
                    touchAction: transformMode ? "none" : undefined,
                  }}
                >
                  <div
                    style={
                      eyeBox
                        ? {
                            position: "absolute",
                            left: eyeBox.left,
                            top: eyeBox.top,
                            width: eyeBox.width,
                            height: eyeBox.height,
                            overflow: "hidden",
                          }
                        : { width: "100%", height: "100%" }
                    }
                  >
                    <video
                      id="Player"
                      // eslint-disable-next-line
                      ref={context.internal.refVideo as Ref<HTMLVideoElement>}
                      crossOrigin={
                        context.internal.settings.value.corsMedia
                          ? "anonymous"
                          : undefined
                      }
                      muted={
                        context.internal.audioOnly.value
                          ? true
                          : context.internal.playerData.value.files.audio !==
                              null
                            ? true
                            : context.internal.muted.value
                      }
                      src={
                        context.internal.sourceOverride.value
                          ? context.internal.sourceOverride.value
                          : context.internal.audioOnly.value
                            ? undefined
                            : context.internal.playerData.value.files.video
                      }
                      poster={
                        context.internal.audioOnly.value ? thumbnail : undefined
                      }
                      style={
                        eyeBox
                          ? {
                              position: "absolute",
                              width: `${100 / eyeRect.width}%`,
                              height: `${100 / eyeRect.height}%`,
                              left: `${(-eyeRect.x / eyeRect.width) * 100}%`,
                              top: `${(-eyeRect.y / eyeRect.height) * 100}%`,
                              objectFit: "fill",
                              filter: videoFilter,
                            }
                          : {
                              height: "100%",
                              width: "100%",
                              filter: videoFilter,
                              opacity: sphereActive ? 0 : undefined,
                              objectFit: context.internal.audioOnly.value
                                ? "cover"
                                : undefined,

                              ...(fullscreen
                                ? {
                                    position: "fixed",
                                    inset: 0,
                                    margin: "auto",
                                  }
                                : {}),
                            }
                      }
                      onLoadedMetadata={(event) =>
                        setVideoSize({
                          width: event.currentTarget.videoWidth,
                          height: event.currentTarget.videoHeight,
                        })
                      }
                      width="100%"
                      onEnded={
                        context.internal.audioControlled
                          ? undefined
                          : context.internal.actionOnEnded
                      }
                      onLoadStart={
                        context.internal.audioControlled
                          ? undefined
                          : context.internal.actionOnLoadStart
                      }
                      onDurationChange={
                        context.internal.audioControlled
                          ? (e) => {
                              if (
                                context.internal.maxDuration.value !==
                                  DEFAULT_MAX_DURATION &&
                                context.internal.maxDuration.value !== 0 &&
                                Math.floor(
                                  context.internal.maxDuration.value,
                                ) !== Math.floor(e.currentTarget.duration) &&
                                e.currentTarget.duration !== 0 &&
                                !Number.isNaN(e.currentTarget.duration)
                              ) {
                                setDurationError(
                                  `Video seek is unavailable for this video`,
                                );
                              } else {
                                setDurationError("");
                              }
                            }
                          : context.internal.actionOnDurationChange
                      }
                      onTimeUpdate={
                        context.internal.audioControlled
                          ? (e) => {
                              if (
                                document.hidden &&
                                !context.internal.audioOnly.value &&
                                context.internal.settings.value.autoAudioOnly
                              ) {
                                context.internal.audioOnly.set(true);
                              }
                              context.internal.videoBuffer.set(
                                getBufferedEnd(e.currentTarget),
                              );

                              if (
                                !showContextMenu &&
                                lastAction <
                                  Date.now() - HIDE_INTERFACE_AFTER_MS
                              )
                                setHideControls(true);

                              if (
                                !context.internal.refAudio.current ||
                                e.currentTarget.ended ||
                                e.currentTarget.paused ||
                                e.currentTarget.seeking ||
                                context.internal.refAudio.current.seeking ||
                                context.internal.refAudio.current.paused ||
                                context.internal.isSettling()
                              )
                                return;
                              const videoTarget =
                                context.internal.refAudio.current.currentTime +
                                context.internal.audioOffset.value;
                              if (
                                videoTarget < 0 ||
                                videoTarget >= e.currentTarget.duration
                              )
                                return;
                              const signedGap =
                                videoTarget - e.currentTarget.currentTime;
                              const deSyncGap = Math.abs(signedGap);
                              const nudgedRate =
                                context.internal.playSpeed.value *
                                (deSyncGap > ERROR_RANGE_SECONDS_NUDGE &&
                                deSyncGap <= ERROR_RANGE_SECONDS_RESET
                                  ? 1 +
                                    Math.max(
                                      -MAX_NUDGE_RATE,
                                      Math.min(MAX_NUDGE_RATE, signedGap),
                                    )
                                  : 1);
                              if (
                                Math.abs(
                                  e.currentTarget.playbackRate - nudgedRate,
                                ) > 0.005
                              )
                                e.currentTarget.playbackRate = nudgedRate;
                              if (deSyncGap > ERROR_RANGE_SECONDS_RESET) {
                                resyncCount.current++;
                                lastResync.current = {
                                  time: Date.now(),
                                  gap: deSyncGap,
                                };
                                context.internal.syncAll(
                                  context.internal.refAudio.current.currentTime,
                                  context.internal.playing.value,
                                  true,
                                );
                              }
                            }
                          : (e) => {
                              if (
                                !showContextMenu &&
                                lastAction <
                                  Date.now() - HIDE_INTERFACE_AFTER_MS
                              )
                                setHideControls(true);

                              context.internal.actionOnTimeUpdate(e, "video");
                            }
                      }
                      onError={
                        context.internal.audioControlled
                          ? undefined
                          : context.internal.actionOnError
                      }
                      onWaiting={
                        context.internal.audioControlled &&
                        !context.internal.audioOnly.value
                          ? (e) => context.internal.actionOnWaiting(e, "video")
                          : undefined
                      }
                    />
                  </div>
                </Movable>
                {sphereActive ? (
                  <SphereRenderer
                    video={context.internal.refVideo}
                    format={format}
                    view={view}
                    filter={videoFilter}
                    xrSession={xrSession}
                    onXrEnd={() => setXrSession(null)}
                    onXrSelect={togglePlay}
                    onXrError={setVrError}
                    onError={(message) =>
                      setSphereFailure({ id: loadedId, message })
                    }
                  />
                ) : undefined}
                {subtitleSettings.selectable ? undefined : subtitleOverlay}
                <Box
                  ref={overlayBox}
                  onPointerDown={onLookPointerDown}
                  sx={(theme) => ({
                    position: "absolute",
                    inset: 0,
                    width: "auto",
                    minHeight: "auto",
                    display: "flex",
                    flexDirection: "row",
                    pointerEvents:
                      transformMode && !sphereActive ? "none" : undefined,
                    touchAction: sphereActive ? "none" : undefined,
                    cursor: sphereActive ? "grab" : undefined,
                    transition: theme.transitions.create("bottom"),
                  })}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    style={{
                      height: "100%",
                      width: "25%",
                      position: "relative",
                    }}
                    onClick={guardTap(
                      createDoubleClickListener(
                        () => generalClick(false),
                        () => {
                          showSeekFeedback("left");
                          moveVideoPointer(-10, context.internal.playing.value);
                        },
                        0,
                      ),
                    )}
                  >
                    {seekFeedbackPill("left")}
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    style={{ height: "100%", width: "50%" }}
                    onClick={guardTap(
                      createDoubleClickListener(
                        () => generalClick(false),
                        () => void toggleFullscreen(),
                        1,
                      ),
                    )}
                  >
                    <Box
                      style={{
                        position: "absolute",
                        margin: "auto",
                        inset: 0,
                        height: "80px",
                        width: "80px",
                        borderRadius: "80px",
                        opacity:
                          hideControls && !context.internal.synchronizing.value
                            ? 0
                            : context.internal.playing.value
                              ? 0.3
                              : 1,
                        transition: "opacity 200ms",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (wasDrag()) return;
                        generalClick(true);
                      }}
                    >
                      <Box
                        sx={(theme) => ({
                          position: "absolute",
                          margin: "auto",
                          inset: 0,
                          height: "72px",
                          width: "72px",
                          borderRadius: "50%",
                          color: "common.white",
                          background: "rgba(0, 0, 0, 0.6)",
                          backdropFilter: "blur(6px)",
                          boxShadow: "0 2px 12px rgba(0, 0, 0, 0.4)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          transition: theme.transitions.create("transform"),
                          "&:hover": { transform: "scale(1.06)" },
                        })}
                      >
                        {context.internal.synchronizing.value ? (
                          <CircularProgress color="inherit" size={36} />
                        ) : context.internal.playing.value ? (
                          <PauseIcon sx={{ fontSize: 44 }} />
                        ) : (
                          <PlayArrowIcon sx={{ fontSize: 44 }} />
                        )}
                      </Box>
                    </Box>
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    style={{
                      height: "100%",
                      width: "25%",
                      position: "relative",
                    }}
                    onClick={guardTap(
                      createDoubleClickListener(
                        () => generalClick(false),
                        () => {
                          showSeekFeedback("right");
                          moveVideoPointer(10, context.internal.playing.value);
                        },
                        2,
                      ),
                    )}
                  >
                    {seekFeedbackPill("right")}
                  </div>
                </Box>
                {subtitleSettings.selectable ? subtitleOverlay : undefined}
                <Box
                  sx={(theme) => ({
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "120px",
                    pointerEvents: "none",
                    opacity: hideControls ? 0 : 1,
                    background:
                      "linear-gradient(transparent, rgba(0, 0, 0, 0.6))",
                    transition: theme.transitions.create("opacity"),
                  })}
                />
                <Box
                  sx={(theme) => ({
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "96px",
                    pointerEvents: "none",
                    opacity: hideControls ? 0 : 1,
                    background:
                      "linear-gradient(rgba(0, 0, 0, 0.6), transparent)",
                    transition: theme.transitions.create("opacity"),
                  })}
                />

                <Box
                  sx={(theme) => ({
                    position: "absolute",
                    top:
                      !hideControls && (fullscreen || props.showInlineTitle)
                        ? "40px"
                        : 0,
                    /*
                        hideControls fullscreen 0
                        !hideControls fullscreen 40
                        hideControls !fullscreen 0
                        !hideControls !fullscreen 0
                        */
                    opacity: hideVideoErrors
                      ? 0
                      : hideControls /*||context.internal.audioOnly.value*/
                        ? 0.3
                        : 1,
                    left: 0,
                    right: 0,
                    width: "100%",
                    padding: theme.spacing(1),
                    transition: theme.transitions.create(["top", "opacity"]),
                    pointerEvents: "none",
                  })}
                  onClick={() => setLastAction(Date.now())}
                  onContextMenu={(event) => event.stopPropagation()}
                >
                  {durationError !== "" && (
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        width: "fit-content",
                        margin: "auto",
                        px: 1.5,
                        py: 0.25,
                        borderRadius: 999,
                        color: "common.white",
                        background: "rgba(211, 47, 47, 0.85)",
                        backdropFilter: "blur(6px)",
                      }}
                    >
                      {durationError}
                    </Typography>
                  )}
                </Box>
                {showDebug ? (
                  <Box
                    sx={(theme) => ({
                      position: "absolute",
                      top: 0,
                      left: 0,
                      zIndex: 1,
                      margin: theme.spacing(1),
                      padding: theme.spacing(0.5, 1),
                      borderRadius: "4px",
                      background: "rgba(0, 0, 0, 0.5)",
                      color: "white",
                      fontFamily: "monospace",
                      fontSize: "11px",
                      lineHeight: 1.4,
                      whiteSpace: "pre",
                      pointerEvents: "none",
                      userSelect: "none",
                    })}
                  >
                    {[
                      `Desync: ${debugInfo.desync} (${debugInfo.clock})`,
                      `Rate: ${debugInfo.rate}`,
                      `Resyncs: ${resyncCount.current}${context.internal.synchronizing.value ? " (syncing)" : ""}${debugInfo.lastResync}`,
                      `Buffer ahead: ${debugInfo.buffer}`,
                      `Ready: ${debugInfo.ready}`,
                      `Resolution: ${debugInfo.resolution}`,
                      `Framerate: ${debugInfo.framerate}`,
                      `Format: ${format.projection} ${format.stereo}${format.swapEyes ? " (swapped)" : ""}${
                        sphereActive
                          ? ` · yaw ${Math.round((view.current.yaw * 180) / Math.PI)}° pitch ${Math.round((view.current.pitch * 180) / Math.PI)}° fov ${Math.round(view.current.fov)}°`
                          : format.projection !== "flat"
                            ? " (shown flat)"
                            : ""
                      }`,
                      `Subtitles: ${
                        !hasSubtitles
                          ? "none"
                          : !subtitleSettings.enabled
                            ? "off"
                            : subtitleError
                              ? `error (${subtitleError})`
                              : subtitleTrack
                                ? `${subtitleFile?.label} · ${subtitleTrack.kind} · ${subtitleTrack.cues.length} cues${subtitleLoading ? " (loading)" : ""}`
                                : "loading"
                      }`,
                    ].join("\n")}
                  </Box>
                ) : undefined}
                <VideoFiltersPanel
                  open={openEffects === "video"}
                  onClose={() => setOpenEffects(null)}
                  value={context.internal.videoFilters.value}
                  onChange={context.internal.videoFilters.set}
                />
                <SubtitlesPanel
                  open={openEffects === "subtitles"}
                  onClose={() => setOpenEffects(null)}
                  value={subtitleSettings}
                  onChange={context.internal.subtitleSettings.set}
                  available={hasSubtitles}
                  files={subtitleList}
                  current={subtitleFile?.label ?? null}
                  error={subtitleError}
                  styled={subtitleTrack?.kind === "ass"}
                />
                <VideoFormatPanel
                  open={openEffects === "format"}
                  onClose={() => setOpenEffects(null)}
                  value={format}
                  onChange={context.internal.videoFormat.set}
                  pixelsAvailable={context.internal.videoPixelsAvailable}
                  error={sphereError}
                  onResetView={resetView}
                  onEnterVr={sphereActive && vrSupported ? enterVr : undefined}
                  vrError={vrError}
                />
                <AudioEffectsPanel
                  open={openEffects === "audio"}
                  onClose={() => setOpenEffects(null)}
                  value={context.internal.audioEffects.value}
                  available={context.internal.audioEffectsAvailable}
                  onChange={context.internal.audioEffects.set}
                  offset={context.internal.audioOffset.value}
                  offsetAvailable={
                    context.internal.audioControlled &&
                    !context.internal.audioOnly.value
                  }
                  onOffsetChange={context.internal.audioOffset.set}
                />
                <Box
                  sx={{
                    display: taikoMode ? "flex" : "none",
                    position: "absolute",
                    inset: 0,
                    justifyContent: "center",
                    alignItems: "center",
                    flexDirection: "column",
                    background: "rgba(0, 0, 0, 0.25)",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 0.5,
                      px: 3,
                      py: 2,
                      borderRadius: 2,
                      color: "common.white",
                      background: "rgba(18, 18, 18, 0.88)",
                      backdropFilter: "blur(6px)",
                    }}
                  >
                    <Typography
                      variant="overline"
                      color="inherit"
                      sx={{ opacity: 0.7 }}
                    >
                      Taiko mode
                    </Typography>
                    <Typography>Play with [D] [F] and [J] [K]</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.7 }}>
                      Exit with [T]
                    </Typography>
                  </Box>
                </Box>
                <Box
                  sx={(theme) => ({
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    color: "common.white",
                    px: 1,
                    pt: 0.5,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    opacity: hideControls ? 0 : 1,
                    transform: hideControls ? "translateY(-50%)" : "none",
                    visibility: hideControls ? "hidden" : "visible",
                    transition: theme.transitions.create([
                      "opacity",
                      "transform",
                      "visibility",
                    ]),
                  })}
                  onClick={() => setLastAction(Date.now())}
                  onContextMenu={(event) => event.stopPropagation()}
                >
                  <Box sx={{ flex: 1, minWidth: 0, px: 1 }}>
                    {sphereActive ? (
                      <Box
                        role="button"
                        aria-label="180°, 360° and 3D"
                        onClick={() => setOpenEffects("format")}
                        sx={{
                          ...pillSx,
                          display: "inline-flex",
                          gap: 0.5,
                          px: 1,
                          py: 0.25,
                          mb: 0.5,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        <ThreeSixtyIcon sx={{ fontSize: 16 }} />
                        {`${format.projection}°`}
                      </Box>
                    ) : undefined}
                    {fullscreen || props.showInlineTitle ? (
                      <Text
                        lines={1}
                        fontSize="20px"
                        color="white"
                        sx={{ textShadow: "0 1px 3px rgba(0, 0, 0, 0.8)" }}
                      >
                        {context.internal.playerData.value.title}
                      </Text>
                    ) : undefined}
                  </Box>
                  <Box sx={pillSx}>
                    <PlayerTooltip title="Slower (-)" placement="bottom">
                      <IconButton
                        size="small"
                        aria-label="Slower"
                        sx={{ color: "common.white" }}
                        onClick={() => {
                          context.internal.playSpeed.set(
                            Math.max(
                              SPEED_MIN,
                              context.internal.playSpeed.value - 0.06,
                            ),
                          );
                        }}
                      >
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                    </PlayerTooltip>
                    <PlayerTooltip
                      title="Reset speed ([ and ] also change it)"
                      placement="bottom"
                    >
                      <Box
                        role="button"
                        aria-label="Reset speed"
                        onClick={() => context.internal.playSpeed.set(1)}
                        sx={(theme) => ({
                          px: 0.5,
                          cursor: "pointer",
                          fontSize: 14,
                          fontVariantNumeric: "tabular-nums",
                          [theme.breakpoints.down("sm")]: { fontSize: 12 },
                        })}
                      >
                        {`${speedText}×`}
                      </Box>
                    </PlayerTooltip>
                    <PlayerTooltip title="Faster (=)" placement="bottom">
                      <IconButton
                        size="small"
                        aria-label="Faster"
                        sx={{ color: "common.white" }}
                        onClick={() => {
                          context.internal.playSpeed.set(
                            Math.min(
                              SPEED_MAX,
                              context.internal.playSpeed.value + 0.06,
                            ),
                          );
                        }}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </PlayerTooltip>
                  </Box>
                  {controlButton(
                    context.internal.distortAudio.value
                      ? "Pitch shift on"
                      : "Pitch shift off",
                    () =>
                      context.internal.distortAudio.set(
                        !context.internal.distortAudio.value,
                      ),
                    context.internal.distortAudio.value ? (
                      <MusicNoteIcon />
                    ) : (
                      <MusicOffIcon />
                    ),
                    "bottom",
                    context.internal.distortAudio.value,
                  )}
                </Box>
                {transformMode ? (
                  <Box
                    sx={(theme) => ({
                      ...pillSx,
                      position: "absolute",
                      top: hideControls ? theme.spacing(1) : theme.spacing(7),
                      left: 0,
                      right: 0,
                      mx: "auto",
                      width: "fit-content",
                      pl: 1.5,
                      gap: 0.5,
                      color: "common.white",
                      background: "rgba(0, 0, 0, 0.6)",
                      transition: theme.transitions.create("top"),
                    })}
                    onClick={() => setLastAction(Date.now())}
                    onContextMenu={(event) => event.stopPropagation()}
                  >
                    <ControlCameraIcon fontSize="small" />
                    <Typography variant="body2" noWrap>
                      Move and zoom
                    </Typography>
                    {controlButton(
                      "Reset",
                      resetTransform,
                      <RestartAltIcon />,
                      "bottom",
                    )}
                    {controlButton(
                      "Done (Esc)",
                      () => setTransformMode(false),
                      <CheckIcon />,
                      "bottom",
                    )}
                  </Box>
                ) : undefined}
                <Box
                  sx={(theme) => ({
                    position: "absolute",
                    bottom: hideControls ? "-72px" : 0,
                    left: 0,
                    right: 0,
                    color: "common.white",
                    padding: theme.spacing(1),
                    display: "flex",
                    flexDirection: "column-reverse",
                    gap: theme.spacing(0.5),
                    transition: theme.transitions.create("bottom"),
                  })}
                  onClick={() => setLastAction(Date.now())}
                  onContextMenu={(event) => event.stopPropagation()}
                >
                  <Box
                    sx={(theme) => ({
                      width: "100%",
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 0.5,
                      opacity: hideControls ? 0 : 1,
                      transition: theme.transitions.create("opacity"),
                    })}
                  >
                    {controlButton(
                      context.internal.playing.value ? "Pause (K)" : "Play (K)",
                      togglePlay,
                      context.internal.playing.value ? (
                        <PauseIcon />
                      ) : (
                        <PlayArrowIcon />
                      ),
                    )}
                    {context.internal.playlistContent.value.length > 0
                      ? controlButton(
                          "Next",
                          () => {
                            let currentID = 0;
                            for (
                              let i = 0;
                              i < context.internal.playlistContent.value.length;
                              i++
                            ) {
                              const video =
                                context.internal.playlistContent.value[i];
                              if (
                                context.internal.playerData.value?.id ===
                                video?.id
                              ) {
                                currentID = i;
                              }
                            }
                            const next =
                              currentID ===
                              context.internal.playlistContent.value.length - 1
                                ? 0
                                : currentID + 1;
                            const videoData =
                              context.internal.playlistContent.value[next]!;
                            context.internal.playerData.set(videoData);
                            if (context.internal.miniPlayer.value) {
                              context.internal.touchHistory(videoData);
                            } else {
                              context.internal.navigate(videoData);
                            }
                          },
                          <SkipNextIcon />,
                        )
                      : undefined}
                    <Box
                      sx={(theme) => ({
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        "&:hover > .VolumeBar": {
                          padding: theme.spacing(0, 1),
                          width: "100px",
                        },
                      })}
                    >
                      {controlButton(
                        context.internal.muted.value
                          ? "Unmute (M)"
                          : "Mute (M)",
                        () =>
                          context.internal.muted.set(
                            !context.internal.muted.value,
                          ),
                        context.internal.muted.value ? (
                          <VolumeOffIcon />
                        ) : (
                          <VolumeUpIcon />
                        ),
                      )}
                      <Box
                        className="VolumeBar"
                        sx={{
                          padding: forcedVolumePadding,
                          width: forcedVolumeWidth,
                          overflow: "hidden",
                          transition: "width 200ms, padding 200ms",
                        }}
                      >
                        <ProgressBar
                          current={Math.abs(
                            Math.exp(
                              Math.log(
                                1 -
                                  (context.internal.targetControllerRef.current
                                    ?.volume ?? 0),
                              ) * Math.log(10),
                            ) - 1,
                          )}
                          bufferAudio={1}
                          bufferVideo={1}
                          max={1}
                          onStartDragging={() => {
                            setForcedVolumeWidth("100px !important");
                            setForcedVolumePadding("0px 8px");
                          }}
                          onEndDragging={(newCurrent) => {
                            if (!context.internal.targetControllerRef.current)
                              return;
                            setForcedVolumeWidth("0px");
                            setForcedVolumePadding("0px");
                            context.internal.muted.set(false);
                            const val =
                              1 -
                              Math.exp(
                                Math.log(1 - Math.abs(newCurrent)) /
                                  Math.log(10),
                              );
                            context.internal.volume.set(val);
                            context.internal.targetControllerRef.current.volume =
                              val;
                          }}
                        />
                      </Box>
                    </Box>
                    <Typography
                      noWrap
                      sx={(theme) => ({
                        ml: 0.5,
                        fontSize: 14,
                        fontVariantNumeric: "tabular-nums",
                        [theme.breakpoints.down("sm")]: { fontSize: 12 },
                      })}
                    >
                      {`${Time.parseTimeDuration(
                        context.internal.currentPosition.value / processedSpeed,
                      )} / ${
                        isDurationKnown(context.internal.maxDuration.value)
                          ? Time.parseTimeDuration(
                              context.internal.maxDuration.value /
                                processedSpeed,
                            )
                          : "--:--"
                      }`}
                    </Typography>
                    <div style={{ flex: 1 }} />
                    {hasSubtitles
                      ? controlButton(
                          subtitleSettings.enabled
                            ? "Hide subtitles (C)"
                            : "Show subtitles (C)",
                          toggleSubtitles,
                          subtitleSettings.enabled ? (
                            <ClosedCaptionIcon />
                          ) : (
                            <ClosedCaptionOffIcon />
                          ),
                          "top",
                          subtitleSettings.enabled,
                        )
                      : undefined}
                    {context.internal.playerData.value.files.audio !== null
                      ? controlButton(
                          context.internal.audioOnly.value
                            ? "Show video"
                            : "Audio only",
                          () =>
                            context.internal.audioOnly.set(
                              !context.internal.audioOnly.value,
                            ),
                          context.internal.audioOnly.value ? (
                            <MovieIcon />
                          ) : (
                            <HeadphonesIcon />
                          ),
                          "top",
                          context.internal.audioOnly.value,
                        )
                      : undefined}
                    {controlButton(
                      "Settings",
                      (event) => {
                        setMenuAnchor(event.currentTarget);
                        setShowContextMenu(true);
                      },
                      <SettingsIcon />,
                      "top",
                      showContextMenu && menuAnchor !== null,
                    )}
                    {controlButton(
                      fullscreen
                        ? "Exit fullscreen (double-tap)"
                        : "Fullscreen (double-tap)",
                      () => void toggleFullscreen(),
                      fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />,
                    )}
                  </Box>
                  <Box
                    sx={(theme) => ({
                      padding:
                        hideControls && !fullscreen ? 0 : theme.spacing(0, 1.5),
                      marginBottom: hideControls && !fullscreen ? "9px" : 0,
                      opacity: hideControls && !fullscreen ? 0.25 : 1,
                      pointerEvents:
                        hideControls && !fullscreen ? "none" : undefined,
                      transition: theme.transitions.create([
                        "margin-bottom",
                        "padding",
                        "opacity",
                      ]),
                    })}
                  >
                    <ProgressBar
                      current={context.internal.currentPosition.value}
                      bufferAudio={
                        context.internal.audioOnly.value
                          ? context.internal.audioBuffer.value
                          : null
                      }
                      bufferVideo={
                        context.internal.audioOnly.value
                          ? null
                          : context.internal.videoBuffer.value
                      }
                      max={context.internal.maxDuration.value}
                      seekable={isDurationKnown(
                        context.internal.maxDuration.value,
                      )}
                      onStartDragging={() => {}}
                      factor={processedSpeed}
                      main
                      chapters={context.internal.chapters.value}
                      heatmap={context.internal.heatmap.value}
                      minimized={hideControls}
                      onEndDragging={(newCurrent) => {
                        if (context.internal.audioOnly.value) {
                          if (context.internal.refAudio.current)
                            context.internal.refAudio.current.currentTime =
                              newCurrent;
                        } else if (
                          context.internal.targetControllerRef.current
                        ) {
                          context.internal.syncAll(
                            newCurrent,
                            context.internal.playing.value,
                          );
                        }
                      }}
                    />
                  </Box>
                </Box>
              </>
            ) : undefined}
          </Box>
        </>
      )}

      <Popover
        open={showContextMenu}
        onClose={() => {
          setShowContextMenu(false);
        }}
        container={overlayContainer}
        anchorReference={menuAnchor ? "anchorEl" : "anchorPosition"}
        anchorEl={menuAnchor}
        anchorPosition={{
          top: contextMenuPosition.y,
          left: contextMenuPosition.x,
        }}
        anchorOrigin={{
          vertical: "top",
          horizontal: menuAnchor ? "right" : "left",
        }}
        transformOrigin={{
          vertical: menuAnchor ? "bottom" : "top",
          horizontal: menuAnchor ? "right" : "left",
        }}
        sx={{ zIndex: OVERLAY_Z_INDEX }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 220,
              borderRadius: 2,
              color: "common.white",
              bgcolor: "rgba(18, 18, 18, 0.88)",
              backdropFilter: "blur(6px)",
              backgroundImage: "none",
            },
          },
        }}
        onContextMenu={(event) => event.stopPropagation()}
      >
        <Typography
          variant="overline"
          sx={{ display: "block", px: 2, pt: 1, opacity: 0.7, lineHeight: 2 }}
        >
          Video options
        </Typography>
        <MenuList
          dense
          sx={{ pt: 0, "& .MuiListItemIcon-root": { color: "inherit" } }}
        >
          {durationError !== "" ? (
            <MenuItem onClick={() => setHideVideoErrors(!hideVideoErrors)}>
              <ListItemIcon>
                <InfoIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{`${hideVideoErrors ? "Show" : "Hide"} errors`}</ListItemText>
            </MenuItem>
          ) : null}
          <MenuItem
            onClick={() =>
              context.internal.singleLoop.set(
                !context.internal.singleLoop.value,
              )
            }
          >
            <ListItemIcon>
              {context.internal.singleLoop.value ? (
                <RepeatOneIcon fontSize="small" />
              ) : (
                <RepeatIcon fontSize="small" />
              )}
            </ListItemIcon>
            <ListItemText>
              {context.internal.singleLoop.value
                ? "Loop this video"
                : "Loop playlist"}
            </ListItemText>
          </MenuItem>
          {hasSubtitles ? (
            <MenuItem onClick={toggleSubtitles}>
              <ListItemIcon>
                {subtitleSettings.enabled ? (
                  <ClosedCaptionIcon fontSize="small" />
                ) : (
                  <ClosedCaptionOffIcon fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText>
                {subtitleSettings.enabled ? "Hide subtitles" : "Show subtitles"}
              </ListItemText>
              <Typography variant="caption" sx={{ opacity: 0.6 }}>
                C
              </Typography>
            </MenuItem>
          ) : null}
          <MenuItem
            onClick={() => {
              setOpenEffects("subtitles");
              setShowContextMenu(false);
            }}
          >
            <ListItemIcon>
              <SubtitlesIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Subtitle settings</ListItemText>
          </MenuItem>
          <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.12)" }} />
          <MenuItem
            onClick={() => {
              setOpenEffects("format");
              setShowContextMenu(false);
            }}
          >
            <ListItemIcon>
              <ThreeSixtyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>180°, 360° and 3D</ListItemText>
          </MenuItem>
          {sphereActive ? (
            <MenuItem
              onClick={() => {
                resetView();
                setShowContextMenu(false);
              }}
            >
              <ListItemIcon>
                <RestartAltIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Reset view</ListItemText>
            </MenuItem>
          ) : null}
          {sphereActive && vrSupported ? (
            <MenuItem
              onClick={() => {
                enterVr();
                setShowContextMenu(false);
              }}
            >
              <ListItemIcon>
                <ViewInArIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Enter VR</ListItemText>
            </MenuItem>
          ) : null}
          {!sphereActive ? (
            <MenuItem
              onClick={() => {
                setTransformMode(!transformMode);
                setShowContextMenu(false);
              }}
            >
              <ListItemIcon>
                {transformMode ? (
                  <CheckIcon fontSize="small" />
                ) : (
                  <ControlCameraIcon fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText>
                {transformMode ? "Done moving and zooming" : "Move and zoom"}
              </ListItemText>
              {transformMode ? (
                <Typography variant="caption" sx={{ opacity: 0.6 }}>
                  Esc
                </Typography>
              ) : null}
            </MenuItem>
          ) : null}
          {transformed && !sphereActive ? (
            <MenuItem onClick={resetTransform}>
              <ListItemIcon>
                <RestartAltIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Reset move and zoom</ListItemText>
            </MenuItem>
          ) : null}
          <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.12)" }} />
          <MenuItem
            onClick={() => {
              setOpenEffects("video");
              setShowContextMenu(false);
            }}
          >
            <ListItemIcon>
              <TuneIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Video filters</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              setOpenEffects("audio");
              setShowContextMenu(false);
            }}
          >
            <ListItemIcon>
              <GraphicEqIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Audio effects</ListItemText>
          </MenuItem>
          <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.12)" }} />
          <MenuItem onClick={() => setShowDebug(!showDebug)}>
            <ListItemIcon>
              <BugReportIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{`${showDebug ? "Hide" : "Show"} debug`}</ListItemText>
            <Typography variant="caption" sx={{ opacity: 0.6 }}>
              `
            </Typography>
          </MenuItem>
        </MenuList>
      </Popover>
    </Box>
  );
}

//#endregion

export { VideoPlayer };
