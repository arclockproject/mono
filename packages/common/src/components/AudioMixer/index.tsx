import Time from "@arclockproject/common/library/Time";
import CloseIcon from "@mui/icons-material/Close";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import MusicOffIcon from "@mui/icons-material/MusicOff";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RepeatIcon from "@mui/icons-material/Repeat";
import ReplayIcon from "@mui/icons-material/Replay";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import {
  Box,
  IconButton,
  Slider,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { type AudioMixerTrack, useAudioMixer } from "./context";

export {
  type AudioMixerContextValue,
  AudioMixerProvider,
  type AudioMixerTrack,
  useAudioMixer,
} from "./context";

/**
 * Settings of one track in an `AudioMixer`.
 */
type TrackSettings = {
  /** Where the track starts, in seconds. */
  start: number;
  /** Where the track stops, in seconds. `0` plays to the end. */
  end: number;
  /** `0` to `1`. */
  volume: number;
  /** `-1` (left) to `1` (right). */
  pan: number;
  muted: boolean;
};

const DEFAULT_TRACK: TrackSettings = {
  start: 0,
  end: 0,
  volume: 1,
  pan: 0,
  muted: false,
};
const SPEED_MIN = 0.25;
const SPEED_MAX = 2;

const isSameOrigin = (url: string) => {
  if (typeof window === "undefined") return false;
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
};

const formatTime = (seconds: number) =>
  Time.parseTimeDuration(Math.floor(seconds)) ?? "0:00";

type Graph = {
  context: AudioContext;
  panners: WeakMap<HTMLMediaElement, StereoPannerNode>;
};

/**
 * Plays several audio tracks at the same time, each from its own start to end
 * time, and loops the whole mix. Each track has its own volume, pan and mute,
 * and speed and pitch shift apply to all of them.
 *
 * Tracks only load their metadata until you press play. Pan needs the file to
 * come from the same origin, or `corsMedia`.
 *
 * @see {@link https://arclockproject.org/docs/common/components/AudioMixer Guide} | {@link https://arclockproject.org/docs/api/common/components/AudioMixer API}
 * @example
 * <AudioMixer tracks={[{ id: "a", title: "Beat", url: "/beat.mp3" }]} />
 */
export function AudioMixer<
  track extends AudioMixerTrack = AudioMixerTrack,
>(props: {
  /**
   * Tracks to mix. Leave it out to use the tracks of the nearest
   * `AudioMixerProvider`.
   */
  tracks?: track[];
  /**
   * Called by a track's remove button. Inside an `AudioMixerProvider` it
   * defaults to removing the track from it. Without either, there is no
   * remove button.
   * @param track The track to remove.
   */
  onRemove?: (track: track) => void;
  /**
   * Load tracks with `crossOrigin="anonymous"`, so pan also works for files
   * on another origin. Only turn it on if that server sends CORS headers.
   * @default false
   */
  corsMedia?: boolean;
  /**
   * Start the whole mix again once every track has reached its end.
   * @default true
   */
  defaultLoop?: boolean;
}): JSX.Element {
  const mixer = useAudioMixer<track>();
  const tracks = props.tracks ?? mixer?.tracks ?? [];
  const onRemove =
    props.onRemove ??
    (mixer ? (track: track) => mixer.remove(track) : undefined);

  const elements = useRef(new Map<string, HTMLAudioElement>());
  const graph = useRef<Graph | null>(null);
  const finished = useRef(new Set<string>());
  const [settings, setSettings] = useState<{ [id: string]: TrackSettings }>({});
  const [times, setTimes] = useState<{
    [id: string]: { current: number; duration: number };
  }>({});
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(props.defaultLoop ?? true);
  const [speed, setSpeed] = useState(1);
  const [pitchShift, setPitchShift] = useState(true);
  const [masterVolume, setMasterVolume] = useState(1);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const loopRef = useRef(loop);
  loopRef.current = loop;

  const settingsOf = (id: string) => settings[id] ?? DEFAULT_TRACK;
  const canPan = (track: AudioMixerTrack) =>
    typeof window !== "undefined" &&
    "AudioContext" in window &&
    (!!props.corsMedia || isSameOrigin(track.url));
  const update = (id: string, change: Partial<TrackSettings>) =>
    setSettings((all) => ({
      ...all,
      [id]: { ...(all[id] ?? DEFAULT_TRACK), ...change },
    }));

  const connectPanners = () => {
    for (const track of tracks) {
      const element = elements.current.get(track.id);
      if (!element || !canPan(track)) continue;
      graph.current ??= { context: new AudioContext(), panners: new WeakMap() };
      const { context, panners } = graph.current;
      if (panners.has(element)) continue;
      try {
        const panner = context.createStereoPanner();
        panner.pan.value = settingsOf(track.id).pan;
        context.createMediaElementSource(element).connect(panner);
        panner.connect(context.destination);
        panners.set(element, panner);
      } catch (error) {
        console.error(error);
      }
    }
    if (graph.current?.context.state === "suspended")
      void graph.current.context.resume();
  };

  const startAll = () => {
    connectPanners();
    finished.current.clear();
    for (const track of tracks) {
      const element = elements.current.get(track.id);
      if (!element) continue;
      element.currentTime = settingsOf(track.id).start;
      void element.play().catch(() => {});
    }
    setPlaying(true);
  };
  const resumeAll = () => {
    connectPanners();
    for (const track of tracks) {
      if (finished.current.has(track.id)) continue;
      void elements.current
        .get(track.id)
        ?.play()
        .catch(() => {});
    }
    setPlaying(true);
  };
  const pauseAll = () => {
    for (const element of elements.current.values()) element.pause();
    setPlaying(false);
  };
  const togglePlay = () => {
    if (playing) pauseAll();
    else if (
      finished.current.size === 0 &&
      Object.keys(times).length > 0 &&
      tracks.some((track) => (times[track.id]?.current ?? 0) > 0)
    )
      resumeAll();
    else startAll();
  };
  const onTrackDone = (id: string) => {
    elements.current.get(id)?.pause();
    finished.current.add(id);
    if (!playingRef.current) return;
    if (!tracks.every((track) => finished.current.has(track.id))) return;
    if (loopRef.current) startAll();
    else setPlaying(false);
  };

  useEffect(() => {
    for (const track of tracks) {
      const element = elements.current.get(track.id);
      if (!element) continue;
      const trackSettings = settingsOf(track.id);
      element.volume = Math.min(1, trackSettings.volume * masterVolume);
      element.muted = trackSettings.muted;
      element.playbackRate = speed;
      element.preservesPitch = !pitchShift;
      const panner = graph.current?.panners.get(element);
      if (panner) panner.pan.value = trackSettings.pan;
    }
  });
  useEffect(() => {
    if (tracks.length === 0 && playing) setPlaying(false);
  }, [tracks.length]);

  const sectionSx = {
    p: 2,
    border: 1,
    borderColor: "divider",
    borderRadius: 2,
  } as const;
  const button = (
    label: string,
    onClick: () => void,
    icon: JSX.Element,
    options: {
      pressed?: boolean;
      color?: "primary" | "inherit";
      disabled?: boolean;
    } = {},
  ) => (
    <Tooltip title={label}>
      <span>
        <IconButton
          aria-label={label}
          aria-pressed={options.pressed}
          color={options.color ?? "inherit"}
          disabled={options.disabled}
          onClick={onClick}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );

  return (
    <Stack gap={2}>
      <Stack
        direction="row"
        alignItems="center"
        flexWrap="wrap"
        gap={2}
        sx={sectionSx}
      >
        <Stack direction="row" alignItems="center">
          {button(
            playing ? "Pause all" : "Play all",
            togglePlay,
            playing ? <PauseIcon /> : <PlayArrowIcon />,
            { color: "primary", disabled: tracks.length === 0 },
          )}
          {button("Restart from the start times", startAll, <ReplayIcon />, {
            disabled: tracks.length === 0,
          })}
          {button(
            loop ? "Loop on" : "Loop off",
            () => setLoop(!loop),
            <RepeatIcon />,
            { pressed: loop, color: loop ? "primary" : "inherit" },
          )}
          {button(
            pitchShift ? "Pitch shift on" : "Pitch shift off",
            () => setPitchShift(!pitchShift),
            pitchShift ? <MusicNoteIcon /> : <MusicOffIcon />,
            { pressed: pitchShift },
          )}
        </Stack>
        <LabeledSlider
          label="Speed"
          value={speed}
          min={SPEED_MIN}
          max={SPEED_MAX}
          step={0.05}
          format={(value) => `${value.toFixed(2)}×`}
          onChange={setSpeed}
          onReset={() => setSpeed(1)}
        />
        <LabeledSlider
          label="Master volume"
          value={masterVolume}
          min={0}
          max={1}
          step={0.01}
          format={(value) => `${Math.round(value * 100)}%`}
          onChange={setMasterVolume}
        />
      </Stack>

      {tracks.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: "center", py: 3 }}>
          Nothing in the mixer.
        </Typography>
      ) : (
        <>
          <Typography variant="caption" color="warning.main">
            Lower track volumes if the mix sounds distorted.
          </Typography>
          {tracks.map((track) => {
            const trackSettings = settingsOf(track.id);
            const time = times[track.id];
            const duration = time?.duration ?? 0;
            const end = trackSettings.end > 0 ? trackSettings.end : duration;
            const pannable = canPan(track);
            return (
              <Stack key={track.id} gap={1} sx={sectionSx}>
                {/* biome-ignore lint/a11y/useMediaCaption: Music tracks without controls have nothing to caption. */}
                <audio
                  ref={(element) => {
                    if (element) elements.current.set(track.id, element);
                    else elements.current.delete(track.id);
                  }}
                  src={track.url}
                  preload="metadata"
                  crossOrigin={props.corsMedia ? "anonymous" : undefined}
                  onLoadedMetadata={(event) => {
                    const element = event.currentTarget;
                    setTimes((all) => ({
                      ...all,
                      [track.id]: {
                        current: element.currentTime,
                        duration: Number.isFinite(element.duration)
                          ? element.duration
                          : 0,
                      },
                    }));
                  }}
                  onTimeUpdate={(event) => {
                    const element = event.currentTarget;
                    setTimes((all) => ({
                      ...all,
                      [track.id]: {
                        current: element.currentTime,
                        duration: all[track.id]?.duration ?? 0,
                      },
                    }));
                    if (
                      trackSettings.end > 0 &&
                      element.currentTime >= trackSettings.end
                    )
                      onTrackDone(track.id);
                  }}
                  onEnded={() => onTrackDone(track.id)}
                />
                <Stack direction="row" alignItems="center" gap={1}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap>{track.title}</Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {`${formatTime(time?.current ?? 0)} / ${duration > 0 ? formatTime(duration) : "–:––"}`}
                    </Typography>
                  </Box>
                  {button(
                    trackSettings.muted ? "Unmute" : "Mute",
                    () => update(track.id, { muted: !trackSettings.muted }),
                    trackSettings.muted ? <VolumeOffIcon /> : <VolumeUpIcon />,
                    { pressed: trackSettings.muted },
                  )}
                  {button(
                    "Reset this track's settings",
                    () => update(track.id, DEFAULT_TRACK),
                    <RestartAltIcon />,
                  )}
                  {onRemove
                    ? button("Remove", () => onRemove(track), <CloseIcon />)
                    : undefined}
                </Stack>
                <Box>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption">Part to play</Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {duration > 0
                        ? `${formatTime(trackSettings.start)} – ${formatTime(end)}`
                        : "Loading…"}
                    </Typography>
                  </Stack>
                  <Slider
                    size="small"
                    aria-label="Part to play"
                    disabled={duration === 0}
                    value={[trackSettings.start, end]}
                    min={0}
                    max={duration || 1}
                    step={0.1}
                    disableSwap
                    valueLabelDisplay="auto"
                    valueLabelFormat={formatTime}
                    onChange={(_event, value) => {
                      const [start, stop] = value as number[];
                      update(track.id, {
                        start: start ?? 0,
                        end:
                          stop !== undefined && stop < duration - 0.05
                            ? stop
                            : 0,
                      });
                    }}
                  />
                </Box>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  gap={{ xs: 0, sm: 3 }}
                >
                  <LabeledSlider
                    label="Volume"
                    value={trackSettings.volume}
                    min={0}
                    max={1}
                    step={0.01}
                    format={(value) => `${Math.round(value * 100)}%`}
                    onChange={(volume) => update(track.id, { volume })}
                  />
                  <LabeledSlider
                    label="Pan"
                    value={trackSettings.pan}
                    min={-1}
                    max={1}
                    step={0.05}
                    disabled={!pannable}
                    hint={
                      pannable
                        ? undefined
                        : "Not available: this file comes from another site."
                    }
                    format={(value) =>
                      value === 0
                        ? "Centre"
                        : `${Math.round(Math.abs(value) * 100)}% ${value < 0 ? "L" : "R"}`
                    }
                    onChange={(pan) => update(track.id, { pan })}
                    onReset={() => update(track.id, { pan: 0 })}
                  />
                </Stack>
              </Stack>
            );
          })}
        </>
      )}
    </Stack>
  );
}

function LabeledSlider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
  onReset?: () => void;
  disabled?: boolean;
  hint?: string;
}): JSX.Element {
  const slider = (
    <Box sx={{ flex: 1, minWidth: 160, opacity: props.disabled ? 0.5 : 1 }}>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="caption">{props.label}</Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          role={props.onReset ? "button" : undefined}
          title={props.onReset ? "Reset" : undefined}
          onClick={props.onReset}
          sx={{
            fontVariantNumeric: "tabular-nums",
            cursor: props.onReset ? "pointer" : undefined,
          }}
        >
          {props.format(props.value)}
        </Typography>
      </Stack>
      <Slider
        size="small"
        aria-label={props.label}
        value={props.value}
        min={props.min}
        max={props.max}
        step={props.step}
        disabled={props.disabled}
        onChange={(_event, value) => props.onChange(value as number)}
      />
    </Box>
  );
  return props.hint ? (
    <Tooltip title={props.hint}>
      <Box sx={{ flex: 1, minWidth: 160, display: "flex" }}>{slider}</Box>
    </Tooltip>
  ) : (
    slider
  );
}

export default AudioMixer;
