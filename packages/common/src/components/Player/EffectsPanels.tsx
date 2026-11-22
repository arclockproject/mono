//#region Imports

import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  IconButton,
  Slider,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import type { PropsWithChildren, ReactNode } from "react";
import type { JSX } from "react/jsx-runtime";
import {
  AUDIO_OFFSET_MAX,
  AUDIO_OFFSET_STEP,
  type audioEffects,
  DEFAULT_AUDIO_EFFECTS,
  DEFAULT_SUBTITLE_SETTINGS,
  DEFAULT_VIDEO_FILTERS,
  DEFAULT_VIDEO_FORMAT,
  type subtitleFile,
  type subtitleSettings,
  type videoFilters,
  type videoFormat,
} from "./globals";

//#endregion

//#region EffectsPanels.tsx

const background = "rgba(18, 18, 18, 0.88)";

/**
 * A panel that slides in over the player from the left or right edge. Clicks,
 * right-clicks and keys inside it don't reach the player.
 */
function EffectsSidePanel(
  props: PropsWithChildren<{
    open: boolean;
    onClose: () => void;
    side: "left" | "right";
    title: string;
  }>,
): JSX.Element {
  const offScreen = props.side === "left" ? "-100%" : "100%";
  const stop = (event: { stopPropagation: () => void }) =>
    event.stopPropagation();
  return (
    <Stack
      role="region"
      aria-label={props.title}
      onClick={stop}
      onContextMenu={stop}
      onKeyDown={stop}
      onKeyUp={stop}
      onTouchMove={stop}
      sx={(theme) => ({
        position: "absolute",
        top: 0,
        bottom: 0,
        [props.side]: 0,
        zIndex: 20,
        width: "100%",
        maxWidth: 320,
        color: "common.white",
        bgcolor: background,
        backdropFilter: "blur(6px)",
        cursor: "auto",
        transform: props.open ? "none" : `translateX(${offScreen})`,
        visibility: props.open ? "visible" : "hidden",
        transition: theme.transitions.create(["transform", "visibility"]),
      })}
    >
      <Stack
        direction="row"
        alignItems="center"
        sx={{
          pl: 2,
          pr: 0.5,
          minHeight: 48,
          borderBottom: 1,
          borderColor: "rgba(255, 255, 255, 0.12)",
        }}
      >
        <Typography variant="subtitle1" sx={{ flex: 1 }}>
          {props.title}
        </Typography>
        <IconButton
          aria-label={`Close ${props.title}`}
          onClick={props.onClose}
          sx={{ color: "inherit" }}
        >
          <CloseIcon />
        </IconButton>
      </Stack>
      <Stack
        sx={{
          flex: 1,
          minHeight: 0,
          overflowX: "hidden",
          overflowY: "auto",
          pb: 2,
        }}
      >
        {props.children}
      </Stack>
    </Stack>
  );
}

function Section(props: { title: string; children: ReactNode }): JSX.Element {
  return (
    <Stack gap={1} sx={{ px: 2, pt: 1.5 }}>
      <Typography variant="overline" sx={{ opacity: 0.7, lineHeight: 1.5 }}>
        {props.title}
      </Typography>
      {props.children}
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
  disabled?: boolean;
  onChange: (value: number) => void;
}): JSX.Element {
  return (
    <Box sx={{ opacity: props.disabled ? 0.5 : 1 }}>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="caption">{props.label}</Typography>
        <Typography
          variant="caption"
          sx={{ opacity: 0.7, fontVariantNumeric: "tabular-nums" }}
        >
          {props.format(props.value)}
        </Typography>
      </Stack>
      <Box sx={{ px: 1 }}>
        <Slider
          size="small"
          aria-label={props.label}
          value={props.value}
          min={props.min}
          max={props.max}
          step={props.step}
          disabled={props.disabled}
          onChange={(_event, value) => props.onChange(value as number)}
          sx={{ color: "common.white", py: 1, display: "block" }}
        />
      </Box>
    </Box>
  );
}

function Presets<T>(props: {
  presets: { label: string; value: T }[];
  isActive: (value: T) => boolean;
  onPick: (value: T) => void;
}): JSX.Element {
  return (
    <Stack direction="row" flexWrap="wrap" gap={0.75}>
      {props.presets.map((preset) => {
        const active = props.isActive(preset.value);
        return (
          <Chip
            key={preset.label}
            label={preset.label}
            size="small"
            clickable
            onClick={() => props.onPick(preset.value)}
            sx={{
              color: "common.white",
              borderColor: "rgba(255, 255, 255, 0.3)",
              bgcolor: active ? "primary.main" : "transparent",
              "&:hover": {
                bgcolor: active ? "primary.dark" : "rgba(255, 255, 255, 0.08)",
              },
            }}
            variant={active ? "filled" : "outlined"}
          />
        );
      })}
    </Stack>
  );
}

const same = <T extends object>(a: T, b: T) =>
  Object.keys(a).every((key) => a[key as keyof T] === b[key as keyof T]);

const VIDEO_PRESETS: { label: string; value: videoFilters }[] = [
  { label: "Normal", value: DEFAULT_VIDEO_FILTERS },
  {
    label: "Vivid",
    value: { ...DEFAULT_VIDEO_FILTERS, contrast: 115, saturation: 140 },
  },
  {
    label: "Warm",
    value: { ...DEFAULT_VIDEO_FILTERS, sepia: 25, saturation: 115, hue: -8 },
  },
  {
    label: "Cool",
    value: { ...DEFAULT_VIDEO_FILTERS, hue: 12, saturation: 110 },
  },
  {
    label: "Black & white",
    value: { ...DEFAULT_VIDEO_FILTERS, grayscale: 100, contrast: 110 },
  },
  {
    label: "Night",
    value: { ...DEFAULT_VIDEO_FILTERS, brightness: 85, sepia: 30 },
  },
  {
    label: "High contrast",
    value: { ...DEFAULT_VIDEO_FILTERS, contrast: 150 },
  },
];

const AUDIO_PRESETS: {
  label: string;
  value: Omit<audioEffects, "enabled" | "boost" | "balance">;
}[] = [
  {
    label: "Flat",
    value: { bass: 0, mid: 0, treble: 0, mono: false, nightMode: false },
  },
  {
    label: "Bass boost",
    value: { bass: 8, mid: 0, treble: 0, mono: false, nightMode: false },
  },
  {
    label: "Voice",
    value: { bass: -4, mid: 4, treble: 3, mono: false, nightMode: false },
  },
  {
    label: "Treble boost",
    value: { bass: 0, mid: 0, treble: 6, mono: false, nightMode: false },
  },
  {
    label: "Night",
    value: { bass: -2, mid: 2, treble: 0, mono: false, nightMode: true },
  },
];

const percent = (value: number) => `${Math.round(value)}%`;
const decibels = (value: number) => `${value > 0 ? "+" : ""}${value} dB`;

/**
 * Left panel with video filter presets and sliders. Filters are CSS only, so
 * they cost nothing on the network.
 */
function VideoFiltersPanel(props: {
  open: boolean;
  onClose: () => void;
  value: videoFilters;
  onChange: (value: videoFilters) => void;
}): JSX.Element {
  const set = (key: keyof videoFilters) => (value: number) =>
    props.onChange({ ...props.value, [key]: value });
  return (
    <EffectsSidePanel
      side="left"
      title="Video filters"
      open={props.open}
      onClose={props.onClose}
    >
      <Section title="Presets">
        <Presets
          presets={VIDEO_PRESETS}
          isActive={(value) => same(value, props.value)}
          onPick={props.onChange}
        />
      </Section>
      <Section title="Light and colour">
        <LabeledSlider
          label="Brightness"
          value={props.value.brightness}
          min={0}
          max={200}
          step={1}
          format={percent}
          onChange={set("brightness")}
        />
        <LabeledSlider
          label="Contrast"
          value={props.value.contrast}
          min={0}
          max={200}
          step={1}
          format={percent}
          onChange={set("contrast")}
        />
        <LabeledSlider
          label="Saturation"
          value={props.value.saturation}
          min={0}
          max={300}
          step={1}
          format={percent}
          onChange={set("saturation")}
        />
        <LabeledSlider
          label="Hue"
          value={props.value.hue}
          min={-180}
          max={180}
          step={1}
          format={(value) => `${value}°`}
          onChange={set("hue")}
        />
      </Section>
      <Section title="Effects">
        <LabeledSlider
          label="Grayscale"
          value={props.value.grayscale}
          min={0}
          max={100}
          step={1}
          format={percent}
          onChange={set("grayscale")}
        />
        <LabeledSlider
          label="Sepia"
          value={props.value.sepia}
          min={0}
          max={100}
          step={1}
          format={percent}
          onChange={set("sepia")}
        />
        <LabeledSlider
          label="Invert"
          value={props.value.invert}
          min={0}
          max={100}
          step={1}
          format={percent}
          onChange={set("invert")}
        />
        <LabeledSlider
          label="Blur"
          value={props.value.blur}
          min={0}
          max={10}
          step={0.5}
          format={(value) => `${value}px`}
          onChange={set("blur")}
        />
      </Section>
      <Box sx={{ px: 2, pt: 2 }}>
        <Button
          fullWidth
          variant="outlined"
          color="inherit"
          disabled={same(props.value, DEFAULT_VIDEO_FILTERS)}
          onClick={() => props.onChange(DEFAULT_VIDEO_FILTERS)}
        >
          Reset
        </Button>
      </Box>
    </EffectsSidePanel>
  );
}

/**
 * Right panel with the audio offset and audio effects. The effects run on the
 * element that already plays the sound, so nothing is fetched again.
 */
function AudioEffectsPanel(props: {
  open: boolean;
  onClose: () => void;
  value: audioEffects;
  available: boolean;
  onChange: (value: audioEffects) => void;
  /** Seconds the audio plays later than the video. Negative plays it earlier. */
  offset: number;
  /** Whether the entry has a separate audio file and the video is shown. */
  offsetAvailable: boolean;
  onOffsetChange: (value: number) => void;
}): JSX.Element {
  const disabled = !props.available || !props.value.enabled;
  const set =
    <K extends keyof audioEffects>(key: K) =>
    (value: audioEffects[K]) =>
      props.onChange({ ...props.value, [key]: value });
  return (
    <EffectsSidePanel
      side="right"
      title="Audio effects"
      open={props.open}
      onClose={props.onClose}
    >
      <Section title="Effects">
        <FormControlLabel
          label="Use audio effects"
          disabled={!props.available}
          control={
            <Switch
              checked={props.available && props.value.enabled}
              onChange={(_event, on) => set("enabled")(on)}
            />
          }
        />
        {!props.available ? (
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Not available for this video. Its sound comes from another site,
            which the browser does not let the player change.
          </Typography>
        ) : undefined}
      </Section>
      <Section title="Sync">
        <LabeledSlider
          label="Audio offset"
          value={props.offset}
          min={-AUDIO_OFFSET_MAX}
          max={AUDIO_OFFSET_MAX}
          step={AUDIO_OFFSET_STEP}
          format={(value) =>
            value === 0
              ? "In sync"
              : `${Math.round(Math.abs(value) * 1000)}ms ${value > 0 ? "later" : "earlier"}`
          }
          disabled={!props.offsetAvailable}
          onChange={props.onOffsetChange}
        />
        {props.offsetAvailable ? (
          <Button
            size="small"
            color="inherit"
            disabled={props.offset === 0}
            onClick={() => props.onOffsetChange(0)}
            sx={{ alignSelf: "flex-start" }}
          >
            Reset offset
          </Button>
        ) : (
          <Note>
            Only for videos with a separate audio file, while the video is
            shown.
          </Note>
        )}
      </Section>
      <Section title="Presets">
        <Box
          sx={{
            opacity: disabled ? 0.5 : 1,
            pointerEvents: disabled ? "none" : undefined,
          }}
        >
          <Presets
            presets={AUDIO_PRESETS}
            isActive={(value) =>
              same(value, {
                bass: props.value.bass,
                mid: props.value.mid,
                treble: props.value.treble,
                mono: props.value.mono,
                nightMode: props.value.nightMode,
              })
            }
            onPick={(value) => props.onChange({ ...props.value, ...value })}
          />
        </Box>
      </Section>
      <Section title="Equalizer">
        <LabeledSlider
          label="Bass"
          value={props.value.bass}
          min={-12}
          max={12}
          step={1}
          format={decibels}
          disabled={disabled}
          onChange={set("bass")}
        />
        <LabeledSlider
          label="Mid"
          value={props.value.mid}
          min={-12}
          max={12}
          step={1}
          format={decibels}
          disabled={disabled}
          onChange={set("mid")}
        />
        <LabeledSlider
          label="Treble"
          value={props.value.treble}
          min={-12}
          max={12}
          step={1}
          format={decibels}
          disabled={disabled}
          onChange={set("treble")}
        />
      </Section>
      <Section title="Output">
        <LabeledSlider
          label="Volume boost"
          value={props.value.boost}
          min={1}
          max={3}
          step={0.05}
          format={(value) => percent(value * 100)}
          disabled={disabled}
          onChange={set("boost")}
        />
        <LabeledSlider
          label="Balance"
          value={props.value.balance}
          min={-1}
          max={1}
          step={0.05}
          format={(value) =>
            value === 0
              ? "Centre"
              : `${Math.round(Math.abs(value) * 100)}% ${value < 0 ? "left" : "right"}`
          }
          disabled={disabled}
          onChange={set("balance")}
        />
        <FormControlLabel
          label="Mono"
          disabled={disabled}
          control={
            <Switch
              checked={props.value.mono}
              onChange={(_event, on) => set("mono")(on)}
            />
          }
        />
        <FormControlLabel
          label="Night mode (even out loud and quiet parts)"
          disabled={disabled}
          control={
            <Switch
              checked={props.value.nightMode}
              onChange={(_event, on) => set("nightMode")(on)}
            />
          }
        />
      </Section>
      <Box sx={{ px: 2, pt: 2 }}>
        <Button
          fullWidth
          variant="outlined"
          color="inherit"
          disabled={same(
            { ...props.value, enabled: false },
            DEFAULT_AUDIO_EFFECTS,
          )}
          onClick={() =>
            props.onChange({
              ...DEFAULT_AUDIO_EFFECTS,
              enabled: props.value.enabled,
            })
          }
        >
          Reset
        </Button>
      </Box>
    </EffectsSidePanel>
  );
}

const Note = (props: { children: ReactNode }): JSX.Element => (
  <Typography variant="caption" sx={{ opacity: 0.7 }}>
    {props.children}
  </Typography>
);

const SUBTITLE_COLORS: { label: string; value: string }[] = [
  { label: "White", value: "#ffffff" },
  { label: "Yellow", value: "#ffeb3b" },
  { label: "Cyan", value: "#4dd0e1" },
  { label: "Green", value: "#81c784" },
];

/**
 * Right panel with subtitle on/off, which file to show, and how they look.
 * The settings are saved and used for every video.
 */
function SubtitlesPanel(props: {
  open: boolean;
  onClose: () => void;
  value: subtitleSettings;
  onChange: (value: subtitleSettings) => void;
  /** Whether the loaded entry has a subtitle file. */
  available: boolean;
  /** The loaded entry's subtitle files. A picker is shown for two or more. */
  files: subtitleFile[];
  /** Name of the file being shown, or `null`. */
  current: string | null;
  /** Why the file could not be loaded, or `null`. */
  error: string | null;
  /** Whether the file has its own styles (`.ass`). */
  styled: boolean;
}): JSX.Element {
  const set =
    <K extends keyof subtitleSettings>(key: K) =>
    (value: subtitleSettings[K]) =>
      props.onChange({ ...props.value, [key]: value });
  const plain = !props.styled || !props.value.fileStyles;
  return (
    <EffectsSidePanel
      side="right"
      title="Subtitles"
      open={props.open}
      onClose={props.onClose}
    >
      <Section title="Subtitles">
        <FormControlLabel
          label="Show subtitles (C)"
          disabled={!props.available}
          control={
            <Switch
              checked={props.available && props.value.enabled}
              onChange={(_event, on) => set("enabled")(on)}
            />
          }
        />
        {!props.available ? (
          <Note>This video has no subtitles.</Note>
        ) : undefined}
        {props.files.length > 1 ? (
          <Box>
            <Typography variant="caption">Track</Typography>
            <Box sx={{ pt: 0.5 }}>
              <Presets
                presets={props.files.map((file) => ({
                  label: file.label,
                  value: file.label,
                }))}
                isActive={(label) => label === props.current}
                onPick={(label) =>
                  props.onChange({
                    ...props.value,
                    track: label,
                    enabled: true,
                  })
                }
              />
            </Box>
          </Box>
        ) : undefined}
        {props.error ? (
          <Note>{`The subtitles could not be loaded. ${props.error}`}</Note>
        ) : undefined}
        {props.styled ? (
          <FormControlLabel
            label="Use the file's fonts, colours and positions"
            control={
              <Switch
                checked={props.value.fileStyles}
                onChange={(_event, on) => set("fileStyles")(on)}
              />
            }
          />
        ) : undefined}
      </Section>
      <Section title="Text">
        <LabeledSlider
          label="Size"
          value={props.value.size}
          min={50}
          max={200}
          step={5}
          format={percent}
          onChange={set("size")}
        />
        <Box
          sx={{
            opacity: plain ? 1 : 0.5,
            pointerEvents: plain ? undefined : "none",
          }}
        >
          <Typography variant="caption">Colour</Typography>
          <Box sx={{ pt: 0.5 }}>
            <Presets
              presets={SUBTITLE_COLORS}
              isActive={(value) => value === props.value.color}
              onPick={set("color")}
            />
          </Box>
        </Box>
        <LabeledSlider
          label="Background"
          value={props.value.background}
          min={0}
          max={100}
          step={5}
          format={(value) => (value === 0 ? "Outline" : percent(value))}
          disabled={!plain}
          onChange={set("background")}
        />
        {!plain ? (
          <Note>
            Colour and background follow the file. Turn off its styles to change
            them.
          </Note>
        ) : undefined}
      </Section>
      <Section title="Position and timing">
        <LabeledSlider
          label="Raise"
          value={props.value.raise}
          min={0}
          max={40}
          step={1}
          format={percent}
          onChange={set("raise")}
        />
        <LabeledSlider
          label="Delay"
          value={props.value.delay}
          min={-10}
          max={10}
          step={0.1}
          format={(value) =>
            value === 0
              ? "In sync"
              : `${Math.abs(value).toFixed(1)}s ${value > 0 ? "later" : "earlier"}`
          }
          onChange={set("delay")}
        />
      </Section>
      <Box sx={{ px: 2, pt: 2 }}>
        <Button
          fullWidth
          variant="outlined"
          color="inherit"
          disabled={same(
            { ...props.value, enabled: false, track: "" },
            DEFAULT_SUBTITLE_SETTINGS,
          )}
          onClick={() =>
            props.onChange({
              ...DEFAULT_SUBTITLE_SETTINGS,
              enabled: props.value.enabled,
              track: props.value.track,
            })
          }
        >
          Reset
        </Button>
      </Box>
    </EffectsSidePanel>
  );
}

const FORMAT_PRESETS: { label: string; value: videoFormat }[] = [
  { label: "Normal", value: DEFAULT_VIDEO_FORMAT },
  {
    label: "VR180",
    value: { projection: "180", stereo: "sbs", swapEyes: false },
  },
  {
    label: "360°",
    value: { projection: "360", stereo: "mono", swapEyes: false },
  },
  {
    label: "3D 360°",
    value: { projection: "360", stereo: "tb", swapEyes: false },
  },
  {
    label: "3D side by side",
    value: { projection: "flat", stereo: "sbs", swapEyes: false },
  },
];

const PROJECTIONS: { label: string; value: videoFormat["projection"] }[] = [
  { label: "Flat", value: "flat" },
  { label: "180°", value: "180" },
  { label: "360°", value: "360" },
];

const STEREO: { label: string; value: videoFormat["stereo"] }[] = [
  { label: "Off", value: "mono" },
  { label: "Side by side", value: "sbs" },
  { label: "Top and bottom", value: "tb" },
];

/**
 * Left panel to say how the video's frames are laid out: flat, 180° or 360°,
 * and whether it holds two eyes.
 */
function VideoFormatPanel(props: {
  open: boolean;
  onClose: () => void;
  value: videoFormat;
  onChange: (value: videoFormat) => void;
  /** Whether the video's pixels can be read, which 180° and 360° need. */
  pixelsAvailable: boolean;
  /** Why 180°/360° can't be shown, or `null`. */
  error: string | null;
  /** Points the view forward again. */
  onResetView: () => void;
  /** Shows "Enter VR" when set. */
  onEnterVr?: () => void;
  /** Why VR could not start, or `null`. */
  vrError?: string | null;
}): JSX.Element {
  const set =
    <K extends keyof videoFormat>(key: K) =>
    (value: videoFormat[K]) =>
      props.onChange({ ...props.value, [key]: value });
  const sphere = props.value.projection !== "flat";
  return (
    <EffectsSidePanel
      side="left"
      title="180°, 360° and 3D"
      open={props.open}
      onClose={props.onClose}
    >
      <Section title="Presets">
        <Presets
          presets={FORMAT_PRESETS}
          isActive={(value) => same(value, props.value)}
          onPick={props.onChange}
        />
      </Section>
      <Section title="Projection">
        <Presets
          presets={PROJECTIONS}
          isActive={(value) => value === props.value.projection}
          onPick={set("projection")}
        />
        {sphere && !props.pixelsAvailable ? (
          <Note>
            180° and 360° need the video to come from this site, or the player's
            corsMedia setting. It is shown flat.
          </Note>
        ) : props.error ? (
          <Note>{`${props.error} It is shown flat.`}</Note>
        ) : sphere ? (
          <Note>Drag to look around. Scroll or pinch to zoom.</Note>
        ) : undefined}
      </Section>
      <Section title="3D (two eyes)">
        <Presets
          presets={STEREO}
          isActive={(value) => value === props.value.stereo}
          onPick={set("stereo")}
        />
        <FormControlLabel
          label="Swap eyes"
          disabled={props.value.stereo === "mono"}
          control={
            <Switch
              checked={props.value.swapEyes}
              onChange={(_event, on) => set("swapEyes")(on)}
            />
          }
        />
        <Note>Outside VR, only the left eye is shown.</Note>
      </Section>
      <Stack gap={1} sx={{ px: 2, pt: 2 }}>
        {props.onEnterVr ? (
          <Button fullWidth variant="contained" onClick={props.onEnterVr}>
            Enter VR
          </Button>
        ) : undefined}
        {props.vrError ? (
          <Note>{`VR could not start. ${props.vrError}`}</Note>
        ) : undefined}
        {sphere ? (
          <Button
            fullWidth
            variant="outlined"
            color="inherit"
            onClick={props.onResetView}
          >
            Reset view
          </Button>
        ) : undefined}
      </Stack>
    </EffectsSidePanel>
  );
}

//#endregion

export {
  AudioEffectsPanel,
  SubtitlesPanel,
  VideoFiltersPanel,
  VideoFormatPanel,
};
