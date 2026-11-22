//#region Imports

import { useLocalStorageState } from "@arclockproject/common/library/LocalStorage";
import type { PropsWithChildren } from "react";
import { useEffect, useRef, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import {
  AUDIO_OFFSET_MAX,
  AUDIO_OFFSET_STEP,
  type audioEffects,
  DEFAULT_AUDIO_EFFECTS,
  DEFAULT_MAX_DURATION,
  DEFAULT_SUBTITLE_SETTINGS,
  DEFAULT_VIDEO_FILTERS,
  DEFAULT_VIDEO_FORMAT,
  getBufferedEnd,
  isSameOrigin,
  type settings,
  type subtitleSettings,
  type videoChapters,
  type videoData,
  type videoFilters,
  type videoFormat,
  type videoHeatmap,
} from "./globals";
import { _getPlayerContext } from "./usePlayer";

//#endregion

//#region PlayerContextProvider.tsx
const ALLOWED_DE_SYNC_PER_SECOND = 10;
let performedDeSyncs = 0;
setInterval(() => {
  performedDeSyncs = 0;
}, 2000);
const ALLOWED_GAP_ON_PLAY_SECONDS = 0.25;
/** Seconds of buffer a video needs ahead before playback resumes after a sync. */
const READY_AHEAD_SECONDS = 1.5;
/** After this long, resume once the elements can play at all. */
const READY_FALLBACK_MS = 8000;
/** How long drift checks wait after a sync or a stall ends. */
const SETTLE_MS = 1000;
/** How long the audio offset must stay still before the video is seeked to match it. */
const OFFSET_DEBOUNCE_MS = 300;
const READY_EVENTS = ["seeked", "canplay", "canplaythrough", "progress"];
const LIMITS = {
  boost: [1, 3],
  bass: [-12, 12],
  mid: [-12, 12],
  treble: [-12, 12],
  balance: [-1, 1],
  brightness: [0, 200],
  contrast: [0, 200],
  saturation: [0, 300],
  hue: [-180, 180],
  grayscale: [0, 100],
  sepia: [0, 100],
  invert: [0, 100],
  blur: [0, 10],
  size: [50, 200],
  background: [0, 100],
  raise: [0, 40],
  delay: [-30, 30],
} as const;

/** `value` snapped to `AUDIO_OFFSET_STEP` and kept within `AUDIO_OFFSET_MAX`. */
const clampAudioOffset = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  const snapped = Math.round(value / AUDIO_OFFSET_STEP) * AUDIO_OFFSET_STEP;
  return (
    Math.round(
      Math.min(AUDIO_OFFSET_MAX, Math.max(-AUDIO_OFFSET_MAX, snapped)) * 1000,
    ) / 1000
  );
};

/** `time` kept within the element's length. */
const clampToMedia = (element: HTMLMediaElement, time: number) =>
  Math.max(
    0,
    Number.isFinite(element.duration) ? Math.min(element.duration, time) : time,
  );

const hasBufferAhead = (element: HTMLMediaElement) => {
  const end = getBufferedEnd(element);
  return (
    element.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA ||
    end - element.currentTime >= READY_AHEAD_SECONDS ||
    (Number.isFinite(element.duration) && end >= element.duration - 0.1)
  );
};

/**
 * Calls `onReady` once every element has finished seeking and can play, and
 * the elements in `needsBuffer` have some buffer ahead. Only listens to events
 * the browser sends anyway, so it adds no requests.
 *
 * @returns A function that removes the listeners without calling `onReady`.
 */
const whenSeekedAndReady = (
  elements: HTMLMediaElement[],
  onReady: () => void,
  needsBuffer: HTMLMediaElement[] = [],
): (() => void) => {
  let done = false;
  let fallback = false;
  const ready = (element: HTMLMediaElement) =>
    !element.seeking &&
    element.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA &&
    (fallback || !needsBuffer.includes(element) || hasBufferAhead(element));
  const finish = () => {
    done = true;
    clearTimeout(fallbackTimer);
    clearTimeout(firstCheck);
    for (const element of elements)
      for (const name of READY_EVENTS) element.removeEventListener(name, check);
  };
  function check() {
    if (done || !elements.every(ready)) return;
    finish();
    onReady();
  }
  for (const element of elements)
    for (const name of READY_EVENTS) element.addEventListener(name, check);
  const fallbackTimer = setTimeout(() => {
    fallback = true;
    check();
  }, READY_FALLBACK_MS);
  const firstCheck = setTimeout(check, 0);
  return finish;
};

/** Reads a stored object, keeping only keys of `defaults` with the same type, clamped to `LIMITS`. */
const parseShape =
  <T extends object>(defaults: T) =>
  (value: unknown): T | undefined => {
    if (typeof value !== "object" || value === null) return undefined;
    const result = { ...defaults } as Record<string, unknown>;
    for (const [key, fallback] of Object.entries(defaults)) {
      const stored = (value as Record<string, unknown>)[key];
      if (typeof stored !== typeof fallback) continue;
      const limit = LIMITS[key as keyof typeof LIMITS];
      result[key] =
        typeof stored === "number" && limit
          ? Math.min(limit[1], Math.max(limit[0], stored))
          : stored;
    }
    return result as T;
  };

const parseVideoFilters = parseShape(DEFAULT_VIDEO_FILTERS);
const parseAudioEffects = parseShape(DEFAULT_AUDIO_EFFECTS);

const parseSubtitleSettings = (value: unknown) => {
  const parsed = parseShape(DEFAULT_SUBTITLE_SETTINGS)(value);
  if (parsed && !/^#[0-9a-f]{6}$/i.test(parsed.color))
    parsed.color = DEFAULT_SUBTITLE_SETTINGS.color;
  return parsed;
};

type AudioGraph = {
  context: AudioContext;
  sources: WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>;
  connected: MediaElementAudioSourceNode | null;
  input: GainNode;
  bass: BiquadFilterNode;
  mid: BiquadFilterNode;
  treble: BiquadFilterNode;
  mono: GainNode;
  compressor: DynamicsCompressorNode;
  panner: StereoPannerNode;
  boost: GainNode;
};

const createAudioGraph = (): AudioGraph => {
  const context = new AudioContext();
  const input = context.createGain();
  const bass = context.createBiquadFilter();
  bass.type = "lowshelf";
  bass.frequency.value = 200;
  const mid = context.createBiquadFilter();
  mid.type = "peaking";
  mid.frequency.value = 1000;
  mid.Q.value = 0.8;
  const treble = context.createBiquadFilter();
  treble.type = "highshelf";
  treble.frequency.value = 4000;
  const mono = context.createGain();
  const compressor = context.createDynamicsCompressor();
  const panner = context.createStereoPanner();
  const boost = context.createGain();
  input.connect(bass);
  bass.connect(mid);
  mid.connect(treble);
  treble.connect(mono);
  mono.connect(compressor);
  compressor.connect(panner);
  panner.connect(boost);
  boost.connect(context.destination);
  return {
    context,
    sources: new WeakMap(),
    connected: null,
    input,
    bass,
    mid,
    treble,
    mono,
    compressor,
    panner,
    boost,
  };
};

const applyAudioEffects = (graph: AudioGraph, effects: audioEffects) => {
  const on = effects.enabled;
  const now = graph.context.currentTime;
  graph.bass.gain.setTargetAtTime(on ? effects.bass : 0, now, 0.02);
  graph.mid.gain.setTargetAtTime(on ? effects.mid : 0, now, 0.02);
  graph.treble.gain.setTargetAtTime(on ? effects.treble : 0, now, 0.02);
  graph.panner.pan.setTargetAtTime(on ? effects.balance : 0, now, 0.02);
  graph.boost.gain.setTargetAtTime(on ? effects.boost : 1, now, 0.02);
  const mono = on && effects.mono;
  graph.mono.channelCount = mono ? 1 : 2;
  graph.mono.channelCountMode = mono ? "explicit" : "max";
  const night = on && effects.nightMode;
  graph.compressor.threshold.setTargetAtTime(night ? -36 : 0, now, 0.02);
  graph.compressor.ratio.setTargetAtTime(night ? 8 : 1, now, 0.02);
  graph.compressor.knee.setTargetAtTime(night ? 24 : 0, now, 0.02);
};
/**
 * Holds the player state shared by `VideoPlayer`, `MiniPlayer` and
 * `AudioHolder`. Put it high in the tree, e.g. around your router, so playback
 * survives page changes. Only its `children` can use the player.
 *
 * `metaType` is the type of each entry's `meta`, and `listMetaType` the type of
 * `playlistMeta`.
 *
 * @see {@link https://arclockproject.org/docs/common/components/Player Guide} | {@link https://arclockproject.org/docs/api/common/components/Player API}
 * @example
 * <PlayerContextProvider navigate={(video) => router.push(`/watch/${video.id}`)}>
 *   <App />
 *   <MiniPlayer />
 *   <AudioHolder />
 * </PlayerContextProvider>
 */
const PlayerContextProvider = <metaType, listMetaType>(
  props: PropsWithChildren<{
    /**
     * Called when the player moves to another entry without opening its page,
     * e.g. the next playlist entry while the mini player is shown. Use it to
     * record watch history.
     */
    touchHistory?: (video: videoData<metaType>) => void;
    /**
     * Called when the player wants to open an entry's page, e.g. the mini
     * player's "Resume" button or the next playlist entry. Use it to route.
     */
    navigate?: (link: videoData<metaType>) => void;
    /**
     * If passed, the player uses these settings instead of its own.
     *
     * `usePlayer().internal.settings.set` then has no effect, so update this
     * prop to change them.
     */
    settings?: settings;
  }>,
): JSX.Element => {
  const refVideo = useRef<HTMLVideoElement>(null);
  const refAudio = useRef<HTMLAudioElement>(null);
  const [settings, setSettings] = useState<settings>({
    autoAudioOnly: false,
    autoPlay: false,
    videoBackgroundBloom: true,
    allowMiniPlayer: true,
    sticky: false,
    stickySpacing: 0,
    stickyTriggerDistance: 0,
  });
  const [audioOnlyPreference, setAudioOnly] = useState(false);
  const [sourceOverride, setSourceOverride] = useState("");
  const [playing, setPlaying] = useState(false);
  const [playlistMeta, setPlaylistMeta] = useState<listMetaType | undefined>(
    undefined,
  );
  const [playlistContent, setPlaylistContent] = useState<videoData<metaType>[]>(
    [],
  );
  const [muted, setMuted] = useState(false);
  const [synchronizing, setSynchronizing] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [distortAudio, setDistortAudio] = useState(true);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [currentVideoBuffer, setCurrentVideoBuffer] = useState(0);
  const [currentAudioBuffer, setCurrentAudioBuffer] = useState(0);
  const [maxDuration, setMaxDuration] = useState(DEFAULT_MAX_DURATION);
  const [chapters, setChapters] = useState<videoChapters[]>([]);
  const [heatmap, setHeatmap] = useState<Required<videoHeatmap>[]>([]);
  const [playerData, setPlayerData] = useState<videoData<metaType>>();
  const [miniPlayer, setMiniPlayer] = useState(true);
  const [miniPlayerVisible, setMiniPlayerVisible] = useState(true);
  const [singleLoop, setSingleLoop] = useState(true);

  const [videoFilters, setVideoFilters] = useLocalStorageState<videoFilters>(
    "@arclockproject/common/components/Player.videoFilters",
    DEFAULT_VIDEO_FILTERS,
    parseVideoFilters,
  );
  const [audioEffects, setAudioEffects] = useLocalStorageState<audioEffects>(
    "@arclockproject/common/components/Player.audioEffects",
    DEFAULT_AUDIO_EFFECTS,
    parseAudioEffects,
  );
  const [subtitleSettings, setSubtitleSettings] =
    useLocalStorageState<subtitleSettings>(
      "@arclockproject/common/components/Player.subtitleSettings",
      DEFAULT_SUBTITLE_SETTINGS,
      parseSubtitleSettings,
    );
  const [audioOffset, setAudioOffsetState] = useState(0);
  const audioOffsetRef = useRef(audioOffset);
  audioOffsetRef.current = audioOffset;
  const [videoFormat, setVideoFormat] = useState<videoFormat>(() => ({
    ...DEFAULT_VIDEO_FORMAT,
    ...playerData?.format,
  }));
  const formatId = useRef(playerData?.id);
  if (formatId.current !== playerData?.id) {
    formatId.current = playerData?.id;
    setVideoFormat({ ...DEFAULT_VIDEO_FORMAT, ...playerData?.format });
    setAudioOffsetState(0);
  }
  const audioGraph = useRef<AudioGraph | null>(null);

  const pendingSync = useRef<(() => void) | null>(null);
  const stallCleanup = useRef<(() => void) | null>(null);
  const settleUntil = useRef(0);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const isSettling = () =>
    Date.now() < settleUntil.current ||
    pendingSync.current !== null ||
    stallCleanup.current !== null;
  const hasSeparateAudio = playerData?.files.audio !== null;
  const audioOnly = audioOnlyPreference && hasSeparateAudio;
  const audioControlled = hasSeparateAudio;
  const targetControllerRef: typeof refAudio | typeof refVideo = audioControlled
    ? refAudio
    : refVideo;
  useEffect(() => {
    const storeAudioOnly = localStorage.getItem(
      "@arclockproject/common/components/Player.audioOnly",
    );
    const storeVolume = localStorage.getItem(
      "@arclockproject/common/components/Player.volume",
    );
    if (storeAudioOnly) setAudioOnly(storeAudioOnly === "true");
    if (storeVolume) setVolume(parseFloat(storeVolume));
  }, []);
  const isPlaylist = playlistContent.length === 0;
  useEffect(() => {
    if (isPlaylist) setSingleLoop(true);
    else setSingleLoop(false);
  }, [isPlaylist]);
  const syncAll = (time: number, playing: boolean, wasDeSync?: boolean) => {
    pendingSync.current?.();
    pendingSync.current = null;
    stallCleanup.current?.();
    if (audioControlled) {
      if (!refAudio.current) return;
      if (performedDeSyncs >= ALLOWED_DE_SYNC_PER_SECOND) {
        // console.log(
        //   "performedDeSyncs >= ALLOWED_DE_SYNC_PER_SECOND",
        //   performedDeSyncs >= ALLOWED_DE_SYNC_PER_SECOND,
        // );
        setAudioOnly(true);
        setSynchronizing(false);
        performedDeSyncs = 0;
        if (playing) {
          void refAudio.current?.play();
        }
        return;
      }
      setSynchronizing(true);
      if (wasDeSync) {
        console.warn("performedDeSyncs", performedDeSyncs);
        performedDeSyncs++;
      }
      const toSync: HTMLMediaElement[] = [refAudio.current];
      refVideo.current?.pause();
      refAudio.current.pause();
      let videoPastEnd = false;
      if (refVideo.current && !audioOnly) {
        toSync.push(refVideo.current);
        const target = time + audioOffsetRef.current;
        const clamped = clampToMedia(refVideo.current, target);
        videoPastEnd = clamped < target;
        refVideo.current.currentTime = clamped;
      }
      refAudio.current.currentTime = time;
      const video = toSync.length > 1 ? refVideo.current : null;
      pendingSync.current = whenSeekedAndReady(
        toSync,
        () => {
          pendingSync.current = null;
          settleUntil.current = Date.now() + SETTLE_MS;
          const audio = refAudio.current;
          if (video && audio && !videoPastEnd) {
            const audioTarget = clampToMedia(
              audio,
              video.currentTime - audioOffsetRef.current,
            );
            if (Math.abs(audio.currentTime - audioTarget) > 0.05)
              audio.currentTime = audioTarget;
          }
          if (playing && playingRef.current) {
            if (!audioOnly) void refVideo.current?.play();
            void refAudio.current?.play();
          }
          setSynchronizing(false);
        },
        video ? [video] : [],
      );
    } else {
      if (!refVideo.current) return;
      setSynchronizing(true);
      refVideo.current.currentTime = time;
      pendingSync.current = whenSeekedAndReady([refVideo.current], () => {
        pendingSync.current = null;
        settleUntil.current = Date.now() + SETTLE_MS;
        if (playing && playingRef.current) {
          void refVideo.current?.play();
        }
        setSynchronizing(false);
      });
    }
  };
  useEffect(() => {
    const memoryVolume = parseFloat(
      localStorage.getItem("@arclockproject/common/components/Player.volume") ??
        "1",
    );
    setVolume(memoryVolume);
    if (refAudio.current) refAudio.current.volume = memoryVolume;
    if (refVideo.current) refVideo.current.volume = memoryVolume;
  }, [refAudio.current, refVideo.current]);
  useEffect(() => {
    if (refAudio.current) refAudio.current.preservesPitch = !distortAudio;
    if (refVideo.current) refVideo.current.preservesPitch = !distortAudio;
  }, [distortAudio]);

  useEffect(() => {
    if (refAudio.current) refAudio.current.playbackRate = playSpeed;
    if (refVideo.current) refVideo.current.playbackRate = playSpeed;
  }, [playSpeed]);
  useEffect(() => {
    if (audioOnly) refVideo.current?.load();
    if (!playing) return;
    if (audioOnly) {
      refVideo.current?.pause();
    } else if (targetControllerRef.current) {
      performedDeSyncs = 0;
      syncAll(currentPosition, playing);
    }
  }, [audioOnly]);
  useEffect(() => {
    if (audioControlled) return;
    refAudio.current?.pause();
    refAudio.current?.load();
  }, [audioControlled]);
  useEffect(() => {
    if (!playing) {
      stallCleanup.current?.();
      if (pendingSync.current) {
        pendingSync.current();
        pendingSync.current = null;
        setSynchronizing(false);
      }
    }
    if (audioControlled) {
      if (!refAudio.current) return;

      if (playing) {
        void refAudio.current.play();
        refAudio.current.playbackRate = playSpeed;
        refAudio.current.volume = volume;
        refAudio.current.preservesPitch = !distortAudio;
        if (!audioOnly /* && !miniPlayer */ && refVideo.current) {
          refVideo.current.playbackRate = playSpeed;
          refVideo.current.volume = volume;
          refVideo.current.preservesPitch = !distortAudio;
          if (
            Math.abs(
              clampToMedia(
                refVideo.current,
                refAudio.current.currentTime + audioOffsetRef.current,
              ) - refVideo.current.currentTime,
            ) > ALLOWED_GAP_ON_PLAY_SECONDS
          )
            syncAll(refAudio.current.currentTime, playing);
          else void refVideo.current.play();
        }
      } else {
        if (!audioOnly) refVideo.current?.pause();
        refAudio.current.pause();
      }
    } else {
      if (!refVideo.current) return;
      if (playing) {
        refVideo.current.playbackRate = playSpeed;
        refVideo.current.volume = volume;
        refVideo.current.preservesPitch = !distortAudio;
        void refVideo.current.play();
      } else {
        refVideo.current.pause();
      }
    }

    return;
  }, [refVideo.current, refAudio.current, playing, playerData, miniPlayer]);
  const setAudioOffset: React.Dispatch<React.SetStateAction<number>> = (
    action,
  ) => {
    const next = clampAudioOffset(
      typeof action === "function" ? action(audioOffsetRef.current) : action,
    );
    if (next === audioOffsetRef.current) return;
    settleUntil.current = Math.max(
      settleUntil.current,
      Date.now() + OFFSET_DEBOUNCE_MS + SETTLE_MS,
    );
    audioOffsetRef.current = next;
    setAudioOffsetState(next);
  };
  const syncedOffset = useRef(audioOffset);
  useEffect(() => {
    if (syncedOffset.current === audioOffset) return;
    const timer = setTimeout(() => {
      syncedOffset.current = audioOffset;
      const audio = refAudio.current;
      const video = refVideo.current;
      if (
        !audioControlled ||
        audioOnly ||
        !audio ||
        !video ||
        pendingSync.current ||
        video.readyState < HTMLMediaElement.HAVE_METADATA
      )
        return;
      const gap = Math.abs(
        clampToMedia(video, audio.currentTime + audioOffset) -
          video.currentTime,
      );
      if (gap > (playingRef.current ? ALLOWED_GAP_ON_PLAY_SECONDS : 0.01))
        syncAll(audio.currentTime, playingRef.current);
    }, OFFSET_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [audioOffset]);
  const restartFromStart = () => {
    playingRef.current = true;
    setPlaying(true);
    setCurrentPosition(0);
    syncAll(0, true);
  };
  const actionOnWaiting = (
    event: React.SyntheticEvent<HTMLMediaElement, Event>,
    type: "audio" | "video",
  ) => {
    if (!audioControlled || audioOnly || !playingRef.current) return;
    if (pendingSync.current) return;
    const stalled = event.currentTarget;
    const other = type === "video" ? refAudio.current : refVideo.current;
    if (!other || stalled.paused || other.paused) return;
    stallCleanup.current?.();
    other.pause();
    const cleanup = () => {
      stalled.removeEventListener("playing", resume);
      if (stallCleanup.current === cleanup) stallCleanup.current = null;
    };
    function resume() {
      cleanup();
      if (!playingRef.current || pendingSync.current || !other) return;
      settleUntil.current = Date.now() + SETTLE_MS;
      const otherTarget = clampToMedia(
        other,
        type === "video"
          ? stalled.currentTime - audioOffsetRef.current
          : stalled.currentTime + audioOffsetRef.current,
      );
      if (
        Math.abs(otherTarget - other.currentTime) > ALLOWED_GAP_ON_PLAY_SECONDS
      )
        other.currentTime = otherTarget;
      void other.play();
    }
    stalled.addEventListener("playing", resume);
    stallCleanup.current = cleanup;
  };

  const soundUrl =
    sourceOverride ||
    (hasSeparateAudio ? playerData?.files.audio : playerData?.files.video);
  const audioEffectsAvailable =
    typeof window !== "undefined" &&
    "AudioContext" in window &&
    (!!(props.settings ?? settings).corsMedia || isSameOrigin(soundUrl));
  const videoPixelsAvailable =
    !!(props.settings ?? settings).corsMedia ||
    isSameOrigin(sourceOverride || playerData?.files.video);
  useEffect(() => {
    const element = audioControlled ? refAudio.current : refVideo.current;
    const graph = audioGraph.current;
    if (!audioEffects.enabled || !audioEffectsAvailable || !element) {
      if (graph) applyAudioEffects(graph, { ...audioEffects, enabled: false });
      return;
    }
    const active = graph ?? createAudioGraph();
    audioGraph.current = active;
    let source = active.sources.get(element);
    if (!source) {
      try {
        source = active.context.createMediaElementSource(element);
      } catch (error) {
        console.error(error);
        return;
      }
      active.sources.set(element, source);
    }
    if (active.connected !== source) {
      active.connected?.disconnect();
      source.connect(active.input);
      active.connected = source;
    }
    applyAudioEffects(active, audioEffects);
    if (playing && active.context.state === "suspended")
      void active.context.resume();
  }, [
    audioEffects,
    audioEffectsAvailable,
    audioControlled,
    refAudio.current,
    refVideo.current,
    playing,
    playerData,
  ]);
  const refNavigate = props.navigate ? props.navigate : () => {};
  const refTouchHistory = props.touchHistory ? props.touchHistory : () => {};
  const playlistStep = (step: 1 | -1) => {
    if (playlistContent.length < 2) return;
    let currentID = 0;
    for (let i = 0; i < playlistContent.length; i++) {
      if (playerData?.id === playlistContent[i]!.id) {
        currentID = i;
      }
    }
    const target =
      (currentID + step + playlistContent.length) % playlistContent.length;
    const video = playlistContent[target]!;
    setMaxDuration(DEFAULT_MAX_DURATION);
    setCurrentAudioBuffer(0);
    setCurrentVideoBuffer(0);
    setCurrentPosition(0);
    setPlayerData(video);
    if (miniPlayer) refTouchHistory(video);
    else refNavigate(video);
  };
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator))
      return;
    const hasPlaylist = playlistContent.length > 1;
    const setHandler = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler | null,
    ) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        return;
      }
    };
    setHandler("nexttrack", hasPlaylist ? () => playlistStep(1) : null);
    setHandler("previoustrack", hasPlaylist ? () => playlistStep(-1) : null);
    return () => {
      setHandler("nexttrack", null);
      setHandler("previoustrack", null);
    };
  }, [
    playlistContent,
    playerData,
    miniPlayer,
    props.navigate,
    props.touchHistory,
  ]);
  const PlayerContext = _getPlayerContext<metaType, listMetaType>();
  return (
    <PlayerContext.Provider
      value={{
        internal: {
          targetControllerRef,
          refVideo,
          refAudio,
          navigate: refNavigate,
          canNavigate: !!props.navigate,
          actionOnWaiting,
          isSettling,
          videoFilters: {
            value: videoFilters,
            set: (action) =>
              setVideoFilters(
                typeof action === "function" ? action(videoFilters) : action,
              ),
          },
          audioEffects: {
            value: audioEffects,
            set: (action) =>
              setAudioEffects(
                typeof action === "function" ? action(audioEffects) : action,
              ),
          },
          audioEffectsAvailable,
          subtitleSettings: {
            value: subtitleSettings,
            set: (action) =>
              setSubtitleSettings(
                typeof action === "function"
                  ? action(subtitleSettings)
                  : action,
              ),
          },
          videoFormat: { value: videoFormat, set: setVideoFormat },
          videoPixelsAvailable,
          touchHistory: refTouchHistory,
          volume: {
            value: volume,
            set: (e) => {
              localStorage.setItem(
                "@arclockproject/common/components/Player.volume",
                String(e),
              );
              setVolume(e);
            },
          },
          syncAll,
          sourceOverride: { value: sourceOverride, set: setSourceOverride },
          synchronizing: { value: synchronizing, set: setSynchronizing },
          playSpeed: { value: playSpeed, set: setPlaySpeed },
          audioOffset: { value: audioOffset, set: setAudioOffset },
          distortAudio: { value: distortAudio, set: setDistortAudio },
          playerData: { value: playerData, set: setPlayerData },
          settings: { value: props.settings ?? settings, set: setSettings },
          audioOnly: {
            value: audioOnly,
            set: (state) => {
              localStorage.setItem(
                "@arclockproject/common/components/Player.audioOnly",
                state ? "true" : "false",
              );
              setAudioOnly(state);
            },
          },
          playing: { value: playing, set: setPlaying },
          playlistMeta: { value: playlistMeta, set: setPlaylistMeta },
          playlistContent: { value: playlistContent, set: setPlaylistContent },
          muted: { value: muted, set: setMuted },
          currentPosition: { value: currentPosition, set: setCurrentPosition },
          maxDuration: { value: maxDuration, set: setMaxDuration },
          miniPlayer: { value: miniPlayer, set: setMiniPlayer },
          miniPlayerVisible: {
            value: miniPlayerVisible,
            set: setMiniPlayerVisible,
          },
          videoBuffer: {
            value: currentVideoBuffer,
            set: setCurrentVideoBuffer,
          },
          audioBuffer: {
            value: currentAudioBuffer,
            set: setCurrentAudioBuffer,
          },
          singleLoop: { value: singleLoop, set: setSingleLoop },
          chapters: { value: chapters, set: setChapters },
          heatmap: { value: heatmap, set: setHeatmap },

          audioControlled,

          actionOnEnded: async () => {
            if (singleLoop) {
              restartFromStart();
            } else {
              if (playlistContent.length > 0) {
                setMaxDuration(DEFAULT_MAX_DURATION);
                setCurrentAudioBuffer(0);
                setCurrentVideoBuffer(0);
                setCurrentPosition(0);
                let currentID = 0;
                for (let i = 0; i < playlistContent.length; i++) {
                  const video = playlistContent[i]!;
                  if (playerData?.id === video.id) {
                    currentID = i;
                  }
                }
                if (playlistContent.length === 1) {
                  restartFromStart();
                } else {
                  const next =
                    currentID === playlistContent.length - 1
                      ? 0
                      : currentID + 1;
                  const video = playlistContent[next]!;
                  setPlayerData(video);
                  if (miniPlayer) {
                    // Load video without navigate
                    refTouchHistory(video);
                  } else {
                    refNavigate(video);
                  }
                }
              } else {
                setPlaying(false);
              }
            }
          },
          actionOnLoadStart: (e) => {
            e.currentTarget.volume = volume;
            e.currentTarget.preservesPitch = !distortAudio;
            syncAll(currentPosition, playing);

            // setProcessing(false);
            // e.currentTarget.volume =
            //   1 - Math.exp(Math.log(1 - Math.abs(playerVolume.value)) / Math.log(10));
            // e.currentTarget.currentTime = playerPosition.value;
          },
          actionOnDurationChange: (e) => {
            setMaxDuration(e.currentTarget.duration);
          },
          actionOnTimeUpdate: (e, type) => {
            const bufferedEnd = getBufferedEnd(e.currentTarget);
            setCurrentPosition(e.currentTarget.currentTime);
            if (type === "video") {
              setCurrentVideoBuffer(bufferedEnd);
            } else {
              setCurrentAudioBuffer(bufferedEnd);
              if (
                !audioOnly &&
                refVideo.current !== null &&
                !refVideo.current.ended &&
                refVideo.current.paused !== e.currentTarget.paused
              ) {
                if (e.currentTarget.paused) void refVideo.current.pause();
                else void refVideo.current.play();
              }
            }
          },
          actionOnError: () => {
            // if (/** On error option */ false) {
            //   // context.sourceOverride.set(
            //   //   // HTTPS URL
            //   // );
            // }
          },
        },
      }}
    >
      {props.children}
    </PlayerContext.Provider>
  );
};

//#endregion

export { PlayerContextProvider };
