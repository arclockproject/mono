//#region globals.tsx

type videoHeatmap = {
  id: string;
  start_time: number;
  end_time: number;
  value_time: number;
};
type videoChapters = {
  start_time: number;
  title: string;
  end_time: number;
};
type videoData<metaType> = {
  id: string;
  title: string;
  files: {
    video: string;
    audio: string | null;
    subtitles: string | null;
    thumbnail: string;
  };
  meta: null | metaType;
};

type settings = {
  /**
   * @default false
   */
  autoAudioOnly: boolean;
  /**
   * @default true
   */
  videoBackgroundBloom: boolean;
  /**
   * @default false
   */
  autoPlay: boolean;
  /**
   * @default true
   */
  allowMiniPlayer: boolean;
  /**
   * @default false
   */
  sticky: boolean;
  /**
   * @default 0
   */
  stickySpacing: number;
  /**
   * @default 0
   */
  stickyTriggerDistance: number;
};

type contextState<k> = {
  value: k;
  set: React.Dispatch<React.SetStateAction<k>>;
};

type PlayerContextProps<metaType, listMetaType> = {
  internal: {
    refVideo: React.RefObject<HTMLVideoElement | null>;
    refAudio: React.RefObject<HTMLAudioElement | null>;
    syncAll: (time: number, playing: boolean, wasDeSync?: boolean) => void;
    synchronizing: contextState<boolean>;
    playSpeed: contextState<number>;
    volume: contextState<number>;
    sourceOverride: contextState<string>;
    distortAudio: contextState<boolean>;
    playerData: contextState<videoData<metaType> | undefined>;
    audioOnly: contextState<boolean>;
    playing: contextState<boolean>;
    currentPosition: contextState<number>;
    maxDuration: contextState<number>;
    miniPlayer: contextState<boolean>;
    miniPlayerVisible: contextState<boolean>;
    muted: contextState<boolean>;
    videoBuffer: contextState<number>;
    audioBuffer: contextState<number>;
    singleLoop: contextState<boolean>;
    playlistMeta: contextState<listMetaType | undefined>;
    playlistContent: contextState<videoData<metaType>[]>;
    chapters: contextState<videoChapters[]>;
    heatmap: contextState<videoHeatmap[]>;
    audioControlled: boolean;
    settings: contextState<settings>;
    touchHistory: (video: videoData<metaType>) => void;
    navigate: (link: videoData<metaType>) => void;
    actionOnEnded: (
      event: React.SyntheticEvent<HTMLAudioElement, Event>,
    ) => Promise<void>;
    actionOnLoadStart: (
      event: React.SyntheticEvent<HTMLAudioElement, Event>,
    ) => void;
    actionOnDurationChange: (
      event: React.SyntheticEvent<HTMLAudioElement, Event>,
    ) => void;
    actionOnTimeUpdate: (
      event: React.SyntheticEvent<HTMLAudioElement, Event>,
      type: "audio" | "video",
    ) => void;
    actionOnError: () => void;
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
