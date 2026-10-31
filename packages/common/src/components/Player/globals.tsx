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
     * URL of a separate audio file, or `null` if the audio is in the video.
     * With a separate file, audio can keep playing when the video is unmounted.
     */
    audio: string | null;
    /** URL of a subtitle track, or `null`. */
    subtitles: string | null;
    /** URL of the thumbnail image. */
    thumbnail: string;
  };
  /** Your own data for this entry, or `null`. */
  meta: null | metaType;
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
    /** Volume from 0 to 1. Saved in `localStorage`. */
    volume: contextState<number>;
    sourceOverride: contextState<string>;
    /** The passed value of `preservesPitch` to player's `<audio>` and `<video>`. */
    distortAudio: contextState<boolean>;
    /** The loaded entry. Set it to play something else. */
    playerData: contextState<videoData<metaType> | undefined>;
    /** Hide the video and play only the audio. Saved in `localStorage`. */
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
    /** Ref to current controller element */
    targetControllerRef:
      | React.RefObject<HTMLAudioElement | null>
      | React.RefObject<HTMLVideoElement | null>;
  };
};

const DEFAULT_MAX_DURATION = 356400;
//#endregion

export { DEFAULT_MAX_DURATION };

export type {
  videoChapters,
  videoHeatmap,
  videoData,
  settings,
  PlayerContextProps,
};
