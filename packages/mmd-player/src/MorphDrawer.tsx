//#region Imports

import CloseIcon from "@mui/icons-material/Close";
import OpacityIcon from "@mui/icons-material/Opacity";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useEffect, useReducer, useRef, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { toRomaji } from "wanakana";
import {
  type MMDLoadDetails,
  type MMDPlayer,
  playOrRestart,
  type SimpleVector,
} from "./config";
import { SidePanel } from "./SidePanel";

//#endregion

//#region MorphDrawer.tsx

/**
 * Standard face morphs most models share. Hidden unless "Face" is ticked, so a
 * model's own morphs (outfits, extras) are easy to find.
 */
const faceMorphs = new Set([
  `まばたき`,
  `笑い`,
  `なごみ`,
  `ウィンク`,
  `ウィンク右`,
  `ウィンク２`,
  `ウィンク２右`,
  `なごみ左`,
  `なごみ右`,
  `びっくり`,
  `じと目`,
  `悲しむ`,
  `怒り目`,
  `ジト目`,
  `眼角上`,
  `眼角下`,
  `下眼上`,
  `下眼上２`,
  `真面目`,
  `困る`,
  `にこり`,
  `怒り`,
  `恥ずかしい`,
  `上`,
  `下`,
  `前`,
  `困る左`,
  `困る右`,
  `にこり左`,
  `にこり右`,
  `怒り左`,
  `怒り右`,
  `恥ずかしい左`,
  `恥ずかしい右`,
  `上左`,
  `上右`,
  `下左`,
  `下右`,
  `前左`,
  `前右`,
  `あ`,
  `い`,
  `う`,
  `え`,
  `お`,
  `にやり`,
  `ワ`,
  `ん`,
  `い１`,
  `い２`,
  `あ２`,
  `にやり２`,
  `にやり３`,
  `ω`,
  `てへぺろ`,
  `ぺろっ`,
  `口角上げ`,
  `口角下げ`,
  `口横広げ`,
  `口横狭め`,
  `舌広げ`,
  `はぅ`,
  `ｷﾘｯ`,
  `ｷﾘｯ1`,
  `ｷﾘｯ2`,
  `ｷﾘｯ3`,
  `ｷﾘｯ4`,
  `ｷﾘｯ5`,
  `びっくり1`,
  `じと目1`,
  `い1`,
  `お1`,
  `にやり3`,
  `ワ1`,
  `ワ2`,
  `□`,
  `□1`,
  `□2`,
  `□3`,
  `□4`,
  `□5`,
  `□6`,
  `□7`,
  `口下`,
  `口上`,
  `口横広げ1`,
  `口横広げ2`,
  `口角下げ0`,
  `口角下げ1`,
  `口角下げ2`,
  `口角下げ3`,
  `口角下げ4`,
  `口角下げ5`,
  `口横缩げ`,
  `口横缩げ1`,
  `う２`,
  `え２`,
  `∧`,
  `▲`,
  `叫び`,
  `ω□`,
  `m`,
  `にっこり`,
  `いやだ`,
  `なんで`,
  `あE`,
  `あ2E`,
  `いE`,
  `い2E`,
  `うE`,
  `う2E`,
  `えE`,
  `え2E`,
  `おE`,
  `▲E`,
  `□E`,
  `ワE`,
  `叫びE`,
  `ωE`,
  `ω□E`,
  `にやりE`,
  `にっこりE`,
  `いやだE`,
  `なんでE`,
  `グル目E`,
  `はちゅ目`,
  `い2`,
  `い3`,
  `え1`,
  `笑い1`,
  `瞳上`,
  `瞳上２`,
  `瞳下`,
  `瞳左`,
  `瞳右`,
  `カメラ目線`,
  `カメラ目線2`,
  `離れ目`,
  `寄り目`,
  `瞳小`,
  `瞳大`,
  `瞳孔大`,
  `困る2`,
  `じと眉`,
  `眉上移動`,
  `眉下移動`,
  `口小`,
  `口大`,
  `口前`,
  `あ３`,
  `~~`,
  `にぃー`,
  `にぃー２`,
  `にっこり２`,
  `ぷく～_左`,
  `ぷく～_右`,
  `ぺろっ1`,
  `ぺろっ2`,
  `小_あご`,
]);

/** Slots a change applies to: every slot, or only the focused one. */
const targetSlots = (details: MMDLoadDetails, all: boolean) =>
  all ? [...Array(details.maxModelFocus).keys()] : [details.focusedModel];

/** Sets a morph on the models and remembers it, so it can be re-applied. */
const setMorph = (
  details: MMDLoadDetails,
  all: boolean,
  name: string,
  value: number,
) => {
  for (const i of targetSlots(details, all)) {
    details.modelMorph[i]?.setMorphWeight(name, value);
    details.actionMemory[i] ??= {};
    details.actionMemory[i][name] = value;
  }
};

/** Applies the remembered weights of `slots` to their models again. */
const applyMemory = (details: MMDLoadDetails, slots: number[]) => {
  for (const i of slots)
    for (const [name, value] of Object.entries(details.actionMemory[i] ?? {}))
      details.modelMorph[i]?.setMorphWeight(name, value);
};

/** Sets every remembered morph of `slots` back to 0 and clears memory. */
const resetMemory = (details: MMDLoadDetails, slots: number[]) => {
  for (const i of slots) {
    for (const name in details.actionMemory[i])
      details.modelMorph[i]?.setMorphWeight(name, 0);
    details.actionMemory[i] = {};
  }
};

const moveEntities = (
  effect: "angle" | "offset",
  details: MMDLoadDetails,
  vector: SimpleVector,
  all: boolean,
  clear = false,
) => {
  const list =
    effect === "offset" ? details.entitiesOffset : details.entitiesAngle;
  const prop = effect === "offset" ? "position" : "rotation";
  for (const i of targetSlots(details, all)) {
    const current = list[i];
    if (clear || !current) list[i] = { ...vector };
    else {
      current.x += vector.x;
      current.y += vector.y;
      current.z += vector.z;
    }
    const v = list[i]!;
    details.entitiesData[i]?.[1]?.[prop].set(v.x, v.y, v.z);
  }
};

/** Distance per press. Multiplied by the "Step" slider. */
const stepRate = { offset: 0.25, angle: 0.025 };
/** One row per axis: [axis, label when moving, label when rotating]. */
const moveRows = [
  ["y", ["Down", "Up"], "Turn"],
  ["x", ["Left", "Right"], "Tilt"],
  ["z", ["Forward", "Back"], "Roll"],
] as const;

/** Touch-friendly height for every control in the panel. */
const touch = { minHeight: 48 };

/** One morph: tap the name to switch between 0 and 1, or drag the slider. */
function MorphRow(props: {
  name: string;
  all: boolean;
  details: MMDLoadDetails;
  /** Highlighted by the arrow keys in the filter. */
  active: boolean;
}) {
  const { details, name } = props;
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (props.active) row.current?.scrollIntoView({ block: "nearest" });
  }, [props.active]);
  const [value, setValue] = useState(
    () => details.modelMorph[details.focusedModel]?.getMorphWeight(name) ?? 0,
  );
  const set = (next: number) => {
    setMorph(details, props.all, name, next);
    setValue(next);
  };
  return (
    <Stack
      ref={row}
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{ px: 1, bgcolor: props.active ? "action.selected" : undefined }}
    >
      <Button
        color="inherit"
        title={`${name}: tap for ${value > 0 ? 0 : 1}`}
        onClick={() => set(value > 0 ? 0 : 1)}
        sx={{ ...touch, flex: 1, minWidth: 0, justifyContent: "flex-start" }}
      >
        <Box
          component="span"
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textTransform: "none",
          }}
        >
          {name}
        </Box>
      </Button>
      <Slider
        aria-label={name}
        size="small"
        value={value}
        min={0}
        max={1}
        step={0.05}
        onChange={(_, next) => set(next)}
        sx={{ width: "50%", flexShrink: 0 }}
      />
      <Typography
        variant="body2"
        sx={{
          width: "4ch",
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value.toFixed(2)}
      </Typography>
    </Stack>
  );
}

/** The right "Morphs" panel: morph weights, and moving or rotating characters. */
function MorphDrawer(props: {
  ready: boolean;
  open: boolean;
  onClose: () => void;
  player: MMDPlayer;
  /** Bump to show the morph list and focus its filter (the "/" key). */
  focusFilter?: number;
}): JSX.Element {
  const details = props.player.MMDLoadDetails;
  const runtime = details.controller.musicRuntime;
  /** Bump to redraw, and to re-read the weights after bulk changes. */
  const [revision, redraw] = useReducer((n: number) => n + 1, 0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!runtime) return;
    setPlaying(runtime.isAnimationPlaying);
    const onPlay = runtime.onPlayAnimationObservable.add(() =>
      setPlaying(true),
    );
    const onPause = runtime.onPauseAnimationObservable.add(() =>
      setPlaying(false),
    );
    return () => {
      runtime.onPlayAnimationObservable.remove(onPlay);
      runtime.onPauseAnimationObservable.remove(onPause);
    };
  }, [runtime]);
  const [tab, setTab] = useState<"morphs" | "move">("morphs");
  const [all, setAll] = useState(false);
  const [seeThrough, setSeeThrough] = useState(false);
  const [filter, setFilter] = useState("");
  /** Row picked with the arrow keys in the filter. -1 for none. */
  const [active, setActive] = useState(-1);
  const filterRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!props.focusFilter) return;
    setTab("morphs");
    requestAnimationFrame(() => filterRef.current?.focus());
  }, [props.focusFilter]);
  const [showFace, setShowFace] = useState(false);
  const [saved, setSaved] = useState<MMDLoadDetails["actionMemory"] | null>(
    null,
  );
  const [moveType, setMoveType] = useState<"offset" | "angle">("offset");
  const [step, setStep] = useState(1);

  const slots = targetSlots(details, all);
  const allNames =
    details.modelMorph[details.focusedModel]?.morphs.map((m) => m.name) ?? [];
  const query = filter.trim().toLowerCase();
  const names = allNames.filter(
    (name) =>
      (showFace || !faceMorphs.has(name)) &&
      (!query ||
        name.toLowerCase().includes(query) ||
        toRomaji(name).includes(query)),
  );
  const seekBy = (seconds: number) =>
    runtime?.seekAnimation(
      Math.max(
        0,
        Math.min(
          runtime.animationFrameTimeDuration,
          runtime.currentFrameTime + 30 * seconds,
        ),
      ),
    );
  const playFromStart = async () => {
    if (!runtime) return;
    await runtime.seekAnimation(0, true);
    if (!runtime.isAnimationPlaying) runtime.playAnimation();
  };

  return (
    <SidePanel
      side="right"
      title="Morphs"
      maxWidth={600}
      open={props.ready && props.open}
      onClose={props.onClose}
      transparent={seeThrough}
    >
      <Stack sx={{ flex: "1 0 auto" }}>
        <Stack direction="row">
          <Button sx={{ ...touch, flex: 1 }} onClick={playFromStart}>
            Start
          </Button>
          <Button sx={{ ...touch, flex: 1 }} onClick={() => seekBy(-1)}>
            -1s
          </Button>
          <Button
            aria-label={playing ? "Pause" : "Play"}
            color={seeThrough ? "primary" : "inherit"}
            sx={{ ...touch, flex: 1 }}
            onClick={() => {
              if (playing) runtime?.pauseAnimation();
              else if (runtime) playOrRestart(runtime);
            }}
          >
            {playing ? <PauseIcon /> : <PlayArrowIcon />}
          </Button>
          <Button sx={{ ...touch, flex: 1 }} onClick={() => seekBy(1)}>
            +1s
          </Button>
          <Button
            aria-label="See-through panel"
            aria-pressed={seeThrough}
            color={seeThrough ? "primary" : "inherit"}
            sx={{ ...touch, flex: 1 }}
            onClick={() => setSeeThrough(!seeThrough)}
          >
            <OpacityIcon />
          </Button>
        </Stack>

        <Stack direction="row" alignItems="center" sx={{ pl: 1, gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0, overflowX: "auto" }}>
            <ToggleButtonGroup
              exclusive
              size="small"
              aria-label="Character"
              value={details.focusedModel}
              onChange={(_, slot: number | null) => {
                if (slot === null) return;
                details.focusedModel = slot;
                details.refocusModel();
                redraw();
              }}
            >
              {[...Array(details.maxModelFocus).keys()].map((i) => (
                <ToggleButton
                  key={i}
                  value={i}
                  disabled={!details.modelMorph[i]}
                  title={details.entities[i]?.model?.file}
                  sx={{ ...touch, minWidth: 44 }}
                >
                  {i}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
          <FormControlLabel
            label="All"
            sx={{ flexShrink: 0, mr: 1 }}
            title="Apply changes to every character"
            control={
              <Checkbox checked={all} onChange={(_, on) => setAll(on)} />
            }
          />
        </Stack>

        <Tabs
          variant="fullWidth"
          value={tab}
          onChange={(_, next) => setTab(next)}
        >
          <Tab value="morphs" label="Morphs" />
          <Tab value="move" label="Move" />
        </Tabs>

        {tab === "morphs" ? (
          <>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ px: 2, pt: 1 }}
            >
              <TextField
                size="small"
                placeholder="Filter (kana or romaji)"
                value={filter}
                inputRef={filterRef}
                onChange={(event) => {
                  setFilter(event.target.value);
                  setActive(-1);
                }}
                onKeyDown={(event) => {
                  const move = { ArrowDown: 1, ArrowUp: -1 }[event.key];
                  if (move) {
                    event.preventDefault();
                    setActive((i) =>
                      Math.max(0, Math.min(names.length - 1, i + move)),
                    );
                  } else if (event.key === "Enter" && active >= 0)
                    listRef.current?.children[active]
                      ?.querySelector("button")
                      ?.click();
                }}
                slotProps={{
                  input: {
                    endAdornment: filter && (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="Clear filter"
                          size="small"
                          edge="end"
                          onClick={() => {
                            setFilter("");
                            setActive(-1);
                            filterRef.current?.focus();
                          }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ flex: 1 }}
              />
              <FormControlLabel
                label="Face"
                title="Show the standard face morphs too"
                control={
                  <Checkbox
                    checked={showFace}
                    onChange={(_, on) => setShowFace(on)}
                  />
                }
              />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ px: 2 }}>
              {allNames.length
                ? `${names.length} of ${allNames.length} morphs`
                : "This character has no morphs."}
            </Typography>
            <Box
              ref={listRef}
              sx={{ height: 200, flexGrow: 1, overflowY: "auto" }}
            >
              {names.map((name, i) => (
                <MorphRow
                  key={`${details.focusedModel}-${revision}-${name}`}
                  name={name}
                  all={all}
                  details={details}
                  active={i === active}
                />
              ))}
            </Box>
            <Stack
              direction="row"
              sx={{ borderTop: 1, borderColor: "divider" }}
            >
              <Button
                sx={{ ...touch, flex: 1 }}
                title="The animation can override morphs. This sets your values again."
                onClick={() => applyMemory(details, slots)}
              >
                Re-apply
              </Button>
              <Button
                sx={{ ...touch, flex: 1 }}
                title="Remember the current values of every character"
                onClick={() =>
                  setSaved(details.actionMemory.map((m) => ({ ...m })))
                }
              >
                Save
              </Button>
              <Button
                sx={{ ...touch, flex: 1 }}
                disabled={!saved}
                title="Go back to the saved values"
                onClick={() => {
                  resetMemory(details, slots);
                  for (const i of slots)
                    details.actionMemory[i] = { ...saved?.[i] };
                  applyMemory(details, slots);
                  redraw();
                }}
              >
                Restore
              </Button>
              <Button
                sx={{ ...touch, flex: 1 }}
                color="warning"
                title="Set your changed morphs back to 0"
                onClick={() => {
                  resetMemory(details, slots);
                  redraw();
                }}
              >
                Reset
              </Button>
            </Stack>
          </>
        ) : (
          <Stack spacing={1} sx={{ p: 2 }}>
            <ToggleButtonGroup
              exclusive
              fullWidth
              value={moveType}
              onChange={(_, next) => next && setMoveType(next)}
            >
              <ToggleButton value="offset" sx={touch}>
                Move
              </ToggleButton>
              <ToggleButton value="angle" sx={touch}>
                Rotate
              </ToggleButton>
            </ToggleButtonGroup>
            <Stack
              direction="row"
              alignItems="center"
              spacing={2}
              sx={{ px: 1 }}
            >
              <Typography variant="body2">Step</Typography>
              <Slider
                aria-label="Step"
                value={step}
                min={0.5}
                max={20}
                step={0.5}
                valueLabelDisplay="auto"
                onChange={(_, next) => setStep(next)}
              />
            </Stack>
            {moveRows.map(([axis, moveLabels, rotateLabel]) => (
              <Stack key={axis} direction="row" spacing={1}>
                {([-1, 1] as const).map((sign, i) => (
                  <Button
                    key={sign}
                    variant="outlined"
                    fullWidth
                    sx={touch}
                    onClick={() =>
                      moveEntities(
                        moveType,
                        details,
                        {
                          x: 0,
                          y: 0,
                          z: 0,
                          [axis]: sign * stepRate[moveType] * step,
                        },
                        all,
                      )
                    }
                  >
                    {moveType === "offset"
                      ? moveLabels[i]
                      : `${rotateLabel} ${sign < 0 ? "−" : "+"}`}
                  </Button>
                ))}
              </Stack>
            ))}
            <Button
              color="warning"
              sx={touch}
              onClick={() =>
                moveEntities(moveType, details, { x: 0, y: 0, z: 0 }, all, true)
              }
            >
              {moveType === "offset" ? "Reset position" : "Reset rotation"}
            </Button>
          </Stack>
        )}
      </Stack>
    </SidePanel>
  );
}

//#endregion

export { MorphDrawer };
