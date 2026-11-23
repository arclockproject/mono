//#region globals.tsx

/**
 * One segment of the "most watched" graph drawn above the progress bar.
 */
type videoHeatmap = {
  /** Unique identifier. */
  id: string;
  /** Segment start, in seconds. */
  start_time: number;
  /** Segment end, in seconds. */
  end_time: number;
  /** How much this segment is watched, relative to the other segments. */
  value_time: number;
};
/**
 * A chapter, shown as a mark on the progress bar.
 */
type videoChapters = {
  /** Chapter start, in seconds. */
  start_time: number;
  /** Chapter name. */
  title: string;
  /** Chapter end, in seconds. */
  end_time: number;
};
/**
 * One video or song the player can load.
 */
type videoData<metaType> = {
  /** Unique id. Loading a different id resets the progress. */
  id: string;
  /** Title shown in the player and mini player. */
  title: string;
  /** URLs of the data. */
  files: {
    /** URL of the video file. */
    video: string;
    /**
     * URL of a separate audio file, or `null` if the audio is in the video
     * (or there is none). With a separate file, audio can keep playing when the
     * video is unmounted, and audio only mode is available. With `null`, the
     * video drives playback, and playback pauses when its `VideoPlayer` unmounts.
     */
    audio: string | null;
    /**
     * Subtitle files the viewer can pick from, or `null`. A single URL is
     * shown as one file named "Subtitles". `.vtt`, `.srt` and `.ass`/`.ssa`
     * are read, and `.ass` styles and positions are kept. They are shown in
     * audio only mode too. Files on another origin need CORS headers. Text
     * subtitle tracks inside an `.mkv`/`.webm` or `.mp4`/`.mov` video are
     * added after these (see `settings.embeddedSubtitles`).
     */
    subtitles: string | subtitleFile[] | null;
    /** URL of the thumbnail image. */
    thumbnail: string;
  };
  /** Your own data for this entry, or `null`. */
  meta: null | metaType;
  /**
   * How the video's frames are laid out, for 180°, 360° and 3D videos. Leave
   * it out for a normal video. The user can change it in the player too.
   * @default { projection: "flat", stereo: "mono", swapEyes: false }
   */
  format?: Partial<videoFormat>;
};

/**
 * One subtitle file of an entry.
 */
type subtitleFile = {
  /**
   * Name shown to the viewer, like `"English"`, `"Original"` or `"Fan dub"`.
   * The last picked name is saved and picked again for the next entry that
   * has a file with that name. Give each file of an entry its own name.
   */
  label: string;
  /** URL of the file. */
  url: string;
  /**
   * Number of a text subtitle track inside the video at `url`: the track
   * number in an `.mkv`/`.webm`, or the track ID in an `.mp4`/`.mov`. Leave it
   * out for a separate subtitle file. The player lists the video's own tracks
   * by itself (see `settings.embeddedSubtitles`), so this is only needed to
   * give a track your own label, or for a URL without one of those endings.
   */
  track?: number;
};

/**
 * The subtitle files of an entry as a list. Files without a URL are left out.
 */
const subtitleFiles = (
  value: string | subtitleFile[] | null | undefined,
): subtitleFile[] => {
  if (!value) return [];
  if (typeof value === "string") return [{ label: "Subtitles", url: value }];
  return value.filter((file) => !!file.url);
};

/**
 * The file to show: the first one named `label`, or else the first one.
 *
 * @returns `null` if there are no files.
 */
const pickSubtitleFile = (
  files: subtitleFile[],
  label: string,
): subtitleFile | null =>
  files.find((file) => file.label === label) ?? files[0] ?? null;

/**
 * How a video's frames are laid out.
 */
type videoFormat = {
  /**
   * - `"flat"`: a normal video.
   * - `"180"`: the front half of a sphere, like VR180. Drag to look around.
   *   Everything behind is black.
   * - `"360"`: the whole sphere (equirectangular). Drag to look around.
   *
   * 180° and 360° need the video's pixels, so the file must be on the same
   * origin, or `settings.corsMedia` must be on.
   */
  projection: "flat" | "180" | "360";
  /**
   * - `"mono"`: one picture.
   * - `"sbs"`: side by side, left eye in the left half.
   * - `"tb"`: top and bottom, left eye in the top half.
   *
   * Outside VR only one eye is shown. Squeezed (half width or half height)
   * and full size flat videos are told apart by their shape.
   */
  stereo: "mono" | "sbs" | "tb";
  /** The right eye is in the left or top half. */
  swapEyes: boolean;
};

const DEFAULT_VIDEO_FORMAT: videoFormat = {
  projection: "flat",
  stereo: "mono",
  swapEyes: false,
};

/**
 * Part of the frame that holds one eye, as fractions of the frame.
 * @param eye `0` for the left eye, `1` for the right eye.
 */
const stereoEyeRect = (
  format: videoFormat,
  eye: 0 | 1,
): { x: number; y: number; width: number; height: number } => {
  const second = (eye === 1) !== format.swapEyes;
  if (format.stereo === "sbs")
    return { x: second ? 0.5 : 0, y: 0, width: 0.5, height: 1 };
  if (format.stereo === "tb")
    return { x: 0, y: second ? 0.5 : 0, width: 1, height: 0.5 };
  return { x: 0, y: 0, width: 1, height: 1 };
};

/**
 * Width / height one eye of a flat 3D video should be shown at. A frame
 * wider than 3:1 (side by side) or narrower than 1.2:1 (top and bottom) holds
 * full size eyes. Otherwise each eye is squeezed and is stretched back to the
 * frame's shape.
 *
 * @returns `null` until the video size is known.
 */
const stereoAspect = (
  format: videoFormat,
  videoWidth: number,
  videoHeight: number,
): number | null => {
  if (videoWidth <= 0 || videoHeight <= 0) return null;
  const frame = videoWidth / videoHeight;
  if (format.stereo === "sbs") return frame >= 3 ? frame / 2 : frame;
  if (format.stereo === "tb") return frame <= 1.2 ? frame * 2 : frame;
  return frame;
};

/**
 * How subtitles look. Saved in `localStorage`.
 */
type subtitleSettings = {
  /** Show subtitles when the entry has them. */
  enabled: boolean;
  /** Text size, in percent. `50` to `200`. */
  size: number;
  /**
   * Opacity of the box behind plain subtitles, in percent. `0` draws an
   * outline instead. `0` to `100`.
   */
  background: number;
  /** Text colour of plain subtitles, as `#rrggbb`. */
  color: string;
  /**
   * Raise subtitles at the bottom, in percent of the video height. `0` to
   * `40`.
   */
  raise: number;
  /**
   * Seconds to show subtitles later. Negative shows them earlier. `-30` to
   * `30`.
   */
  delay: number;
  /**
   * Use the fonts, colours, sizes and positions from the file. Off shows
   * every line like a plain subtitle.
   */
  fileStyles: boolean;
  /**
   * Let viewers select the subtitle text and point at it, e.g. for pop-up
   * dictionaries like Yomitan. Clicks on the text then don't play, pause,
   * seek or drag, and right-click opens the browser's own menu, e.g. to copy.
   */
  selectable: boolean;
  /**
   * Name of the subtitle file picked last. Entries without a file of that
   * name show their first file.
   */
  track: string;
};

const DEFAULT_SUBTITLE_SETTINGS: subtitleSettings = {
  enabled: false,
  size: 100,
  background: 60,
  color: "#ffffff",
  raise: 0,
  delay: 0,
  fileStyles: true,
  selectable: false,
  track: "",
};

/**
 * Player settings. Pass them to `PlayerContextProvider`'s `settings` prop.
 */
type settings = {
  /**
   * Switch to audio only when the page is hidden, e.g. in a background tab.
   * @default false
   */
  autoAudioOnly: boolean;
  /**
   * Draw a soft glow of the video behind the player.
   * @default true
   */
  videoBackgroundBloom: boolean;
  /**
   * Start playing as soon as a `VideoPlayer` loads a video.
   * @default false
   */
  autoPlay: boolean;
  /**
   * Not used yet.
   * @default true
   */
  allowMiniPlayer: boolean;
  /**
   * On small screens, keep the player stuck to the top while scrolling.
   * @default false
   */
  sticky: boolean;
  /**
   * When `sticky`, the gap above the player in pixels, e.g. for a navigation bar.
   * The gap is removed while scrolling down and comes back when scrolling up.
   * @default 0
   */
  stickySpacing: number;
  /**
   * How far to scroll, in pixels, before the `stickySpacing` gap changes.
   * @default 0
   */
  stickyTriggerDistance: number;
  /**
   * Load media with `crossOrigin="anonymous"`, so audio effects also work for
   * files on another origin. Only turn it on if that server sends CORS headers,
   * or the files fail to load. Read when the media element is created.
   * @default false
   */
  corsMedia?: boolean;
  /**
   * List the text subtitle tracks inside the video next to the entry's
   * subtitle files: `.srt`, `.ass` and WebVTT tracks in `.mkv`/`.webm`, and
   * `tx3g` (`mov_text`) and WebVTT tracks in `.mp4`/`.m4v`/`.mov`. Only the
   * start of the video, its index and the subtitle lines are fetched, with
   * range requests. The server must support range requests, and files on
   * another origin need CORS headers. Image subtitles (PGS, VobSub), TTML,
   * fonts inside the file and fragmented MP4 files are not supported.
   * @default true
   */
  embeddedSubtitles?: boolean;
};

/**
 * CSS filters applied to the video. Percentages are like the CSS functions,
 * so `100` means unchanged for brightness, contrast and saturation.
 */
type videoFilters = {
  /** `0` to `200`. */
  brightness: number;
  /** `0` to `200`. */
  contrast: number;
  /** `0` to `300`. */
  saturation: number;
  /** Hue rotation in degrees, `-180` to `180`. */
  hue: number;
  /** `0` to `100`. */
  grayscale: number;
  /** `0` to `100`. */
  sepia: number;
  /** `0` to `100`. */
  invert: number;
  /** Blur in pixels, `0` to `10`. */
  blur: number;
};

/**
 * Audio effects, applied with the Web Audio API to the element that plays the
 * sound. They never fetch the media again.
 */
type audioEffects = {
  /** Turns the whole chain on. Off leaves the sound untouched. */
  enabled: boolean;
  /** Volume multiplier on top of the player volume, `1` to `3`. */
  boost: number;
  /** Low shelf at 200Hz, in dB, `-12` to `12`. */
  bass: number;
  /** Peak at 1kHz, in dB, `-12` to `12`. */
  mid: number;
  /** High shelf at 4kHz, in dB, `-12` to `12`. */
  treble: number;
  /** Stereo balance, `-1` (left) to `1` (right). */
  balance: number;
  /** Mix both channels into one. */
  mono: boolean;
  /** Compress loud and quiet parts closer together. */
  nightMode: boolean;
};

const DEFAULT_VIDEO_FILTERS: videoFilters = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  grayscale: 0,
  sepia: 0,
  invert: 0,
  blur: 0,
};

const DEFAULT_AUDIO_EFFECTS: audioEffects = {
  enabled: false,
  boost: 1,
  bass: 0,
  mid: 0,
  treble: 0,
  balance: 0,
  mono: false,
  nightMode: false,
};

/**
 * `videoFilters` as a CSS `filter` value, or `"none"` when nothing changes.
 */
const videoFilterCss = (filters: videoFilters): string => {
  const parts: string[] = [];
  if (filters.brightness !== 100)
    parts.push(`brightness(${filters.brightness}%)`);
  if (filters.contrast !== 100) parts.push(`contrast(${filters.contrast}%)`);
  if (filters.saturation !== 100)
    parts.push(`saturate(${filters.saturation}%)`);
  if (filters.hue !== 0) parts.push(`hue-rotate(${filters.hue}deg)`);
  if (filters.grayscale !== 0) parts.push(`grayscale(${filters.grayscale}%)`);
  if (filters.sepia !== 0) parts.push(`sepia(${filters.sepia}%)`);
  if (filters.invert !== 0) parts.push(`invert(${filters.invert}%)`);
  if (filters.blur !== 0) parts.push(`blur(${filters.blur}px)`);
  return parts.length > 0 ? parts.join(" ") : "none";
};

/**
 * Whether `url` is on the page's origin. Relative URLs are.
 */
const isSameOrigin = (url: string | null | undefined): boolean => {
  if (!url || typeof window === "undefined") return false;
  if (url.startsWith("data:") || url.startsWith("blob:")) return true;
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
};

/**
 * A piece of player state with its setter, like the pair `useState` returns.
 */
type contextState<k> = {
  value: k;
  set: React.Dispatch<React.SetStateAction<k>>;
};

/**
 * What `usePlayer` returns. Everything is under `internal`, and can change
 * between versions.
 */
type PlayerContextProps<metaType, listMetaType> = {
  internal: {
    refVideo: React.RefObject<HTMLVideoElement | null>;
    refAudio: React.RefObject<HTMLAudioElement | null>;
    /**
     * Seeks video and audio to `time` (seconds) and keeps them in sync.
     * `synchronizing` is `true` until both are ready to play.
     *
     * Smaller video files tend to sync better. For instance, 4k video tends to
     * always sync with 200ms-400ms desync.
     *
     * There is 0ms desync if time is set to 0.
     *
     * @param time Where to seek to, in seconds.
     * @param playing Play once ready. With `false`, it does not start playing.
     * @param wasDeSync If `true` an internal error counter will go up. Once it
     * reaches to 10 in 2 seconds, it will automatically toggle player to audio
     * only mode. This is called by player itself when audio and video drift
     * apart too much.
     */
    syncAll: (time: number, playing: boolean, wasDeSync?: boolean) => void;
    /** If the player is currently attempting to synchronize video and audio. */
    synchronizing: contextState<boolean>;
    /** Playback speed, where `1` is normal. */
    playSpeed: contextState<number>;
    /**
     * Seconds the separate audio file plays later than the video. Negative
     * plays it earlier. Snapped to `0.05` steps and kept within `-2` to `2`.
     * Only used when `audioControlled` is `true` and the video is shown.
     * Resets to `0` when a different entry loads. Subtitles follow the video.
     *
     * Large changes seek the video once the value stops changing. Small
     * changes while playing are caught up by the drift correction instead.
     */
    audioOffset: contextState<number>;
    /** Volume from 0 to 1. Saved in `localStorage`. */
    volume: contextState<number>;
    sourceOverride: contextState<string>;
    /** The passed value of `preservesPitch` to player's `<audio>` and `<video>`. */
    distortAudio: contextState<boolean>;
    /** The loaded entry. Set it to play something else. */
    playerData: contextState<videoData<metaType> | undefined>;
    /**
     * Hide the video and play only the audio. Saved in `localStorage`.
     * Always `false` for entries without a separate audio file. The saved
     * choice comes back for the next entry that has one.
     */
    audioOnly: contextState<boolean>;
    /** Whether it is playing. Set it to play or pause. */
    playing: contextState<boolean>;
    /** Current time, in seconds. */
    currentPosition: contextState<number>;
    /** Length of the loaded entry, in seconds. */
    maxDuration: contextState<number>;
    /** Whether `MiniPlayer` is shown. */
    miniPlayer: contextState<boolean>;
    miniPlayerVisible: contextState<boolean>;
    /** If video and audio are muted. Does not alter the actual volume parameter. */
    muted: contextState<boolean>;
    /** Available butter in seconds */
    videoBuffer: contextState<number>;
    /** Available butter in seconds */
    audioBuffer: contextState<number>;
    /** Repeat the current entry instead of moving to the next in the playlist. */
    singleLoop: contextState<boolean>;
    /** Your own data for the playlist. */
    playlistMeta: contextState<listMetaType | undefined>;
    /** Entries played one after another. Empty when not playing a playlist. */
    playlistContent: contextState<videoData<metaType>[]>;
    chapters: contextState<videoChapters[]>;
    heatmap: contextState<videoHeatmap[]>;
    /**
     * `true` when the separate audio file drives playback, rather than the video.
     *
     * **Note**: Tested behaviour with `true`. Behaviour with `false` requires
     * testing and might not behave as expected.
     **/
    audioControlled: boolean;
    /** Player settings. */
    settings: contextState<settings>;
    /** The `touchHistory` prop of `PlayerContextProvider`, or a no-op. */
    touchHistory: (video: videoData<metaType>) => void;
    /** The `navigate` prop of `PlayerContextProvider`, or a no-op. */
    navigate: (link: videoData<metaType>) => void;
    /** Whether `PlayerContextProvider` got a `navigate` prop. Without it, `navigate` does nothing. */
    canNavigate: boolean;
    /** Event called when current play ends. */
    actionOnEnded: (
      event: React.SyntheticEvent<HTMLAudioElement, Event>,
    ) => Promise<void>;
    /** Event called when current play start to load. */
    actionOnLoadStart: (
      event: React.SyntheticEvent<HTMLAudioElement, Event>,
    ) => void;
    /** Event called when duration changes. Mainly when video finally loads. */
    actionOnDurationChange: (
      event: React.SyntheticEvent<HTMLAudioElement, Event>,
    ) => void;
    /** Event called every second when playing with who the current controller is. */
    actionOnTimeUpdate: (
      event: React.SyntheticEvent<HTMLAudioElement, Event>,
      type: "audio" | "video",
    ) => void;
    /** General error handler */
    actionOnError: () => void;
    /**
     * Called when an element runs out of data while playing. With a separate
     * audio file it pauses the other element until this one plays again,
     * without seeking, so nothing is fetched again.
     */
    actionOnWaiting: (
      event: React.SyntheticEvent<HTMLMediaElement, Event>,
      type: "audio" | "video",
    ) => void;
    /**
     * `true` while a sync is pending, an element is stalled, or shortly after
     * either. Drift checks should wait while it is `true`.
     */
    isSettling: () => boolean;
    /** Filters applied to the video. Saved in `localStorage`. */
    videoFilters: contextState<videoFilters>;
    /** Audio effects. Saved in `localStorage`. */
    audioEffects: contextState<audioEffects>;
    /**
     * Whether audio effects can be used for the loaded entry. They need the
     * sound to come from the same origin, or `settings.corsMedia`.
     */
    audioEffectsAvailable: boolean;
    /** Subtitle look and on/off. Saved in `localStorage`. */
    subtitleSettings: contextState<subtitleSettings>;
    /**
     * Layout of the loaded entry's frames. Reset to the entry's `format` when
     * a different entry loads.
     */
    videoFormat: contextState<videoFormat>;
    /**
     * Whether the video's pixels can be read, which 180° and 360° need. It
     * needs the video on the same origin, or `settings.corsMedia`.
     */
    videoPixelsAvailable: boolean;
    /** Ref to current controller element */
    targetControllerRef:
      | React.RefObject<HTMLAudioElement | null>
      | React.RefObject<HTMLVideoElement | null>;
  };
};

/**
 * Length used while the real one is not known yet, in seconds (99 hours). It
 * is big rather than `0`, so positions divided by it stay valid.
 */
const DEFAULT_MAX_DURATION = 356400;

/**
 * Whether `duration` is a real length: finite, above `0` and not
 * `DEFAULT_MAX_DURATION`.
 */
const isDurationKnown = (duration: number): boolean =>
  Number.isFinite(duration) &&
  duration > 0 &&
  duration !== DEFAULT_MAX_DURATION;
/** Largest audio offset, in seconds, either way. */
const AUDIO_OFFSET_MAX = 2;
/** Audio offsets snap to multiples of this, in seconds. */
const AUDIO_OFFSET_STEP = 0.05;
/** Fastest playback speed the speed buttons and shortcuts allow. */
const SPEED_MAX = 2;
/** Slowest playback speed the speed buttons and shortcuts allow. */
const SPEED_MIN = 0.25;

/**
 * End of the buffered range that contains the current time, in seconds.
 *
 * @returns The current time if nothing around it is buffered yet.
 */
const getBufferedEnd = (element: HTMLMediaElement): number => {
  for (let i = 0; i < element.buffered.length; i++) {
    if (
      element.buffered.start(i) <= element.currentTime &&
      element.buffered.end(i) >= element.currentTime
    )
      return element.buffered.end(i);
  }
  return element.currentTime;
};
//#endregion

export {
  DEFAULT_SUBTITLE_SETTINGS,
  DEFAULT_VIDEO_FORMAT,
  isSameOrigin,
  pickSubtitleFile,
  stereoAspect,
  subtitleFiles,
  stereoEyeRect,
  DEFAULT_AUDIO_EFFECTS,
  DEFAULT_MAX_DURATION,
  DEFAULT_VIDEO_FILTERS,
  getBufferedEnd,
  isDurationKnown,
  AUDIO_OFFSET_MAX,
  AUDIO_OFFSET_STEP,
  SPEED_MAX,
  SPEED_MIN,
  videoFilterCss,
};

export type {
  subtitleFile,
  subtitleSettings,
  videoFormat,
  audioEffects,
  videoChapters,
  videoFilters,
  videoHeatmap,
  videoData,
  settings,
  PlayerContextProps,
};
