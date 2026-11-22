//#region Imports

import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import RemoveIcon from "@mui/icons-material/Remove";
import {
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  type PropsWithChildren,
  type ReactNode,
  useRef,
  useState,
} from "react";
import type { JSX } from "react/jsx-runtime";
import type { MMDPlayer, mmdDetailsProcessed } from "./config";
import { fileLabel, isPartMotion, loadMMDFileByURL } from "./loadFile";
import { SimpleTreeViewSearchable } from "./SimpleTreeViewSearchable";

//#endregion

//#region SceneCustomizer.tsx

/** What the file picker below the summary fills in. */
type Target =
  | { kind: "stage" }
  | { kind: "camera" }
  | { kind: "chara" | "dance" | "parts"; slot: number };

const pickers = {
  chara: { files: "charaPmx", title: "Character", suffix: ".chara.pmx" },
  dance: { files: "charaVmd", title: "Dance", suffix: ".chara.vmd" },
  parts: {
    files: "charaPartVmd",
    title: "Parts (tap to add or remove)",
    suffix: ".chara.part.vmd",
  },
  stage: { files: "stagePmx", title: "Stage", suffix: ".stage.pmx" },
  camera: { files: "charaCam", title: "Camera", suffix: ".cam.vmd" },
} as const;

const ellipsis = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

/** One line of the scene summary: a label, its values, and a clear button. */
function Row(
  props: PropsWithChildren<{ label: ReactNode; onClear?: () => void }>,
) {
  return (
    <Stack direction="row" alignItems="center" gap={1} sx={{ minHeight: 48 }}>
      <Typography variant="body2" sx={{ width: 56, flexShrink: 0 }}>
        {props.label}
      </Typography>
      <Stack
        direction="row"
        gap={1}
        flexWrap="wrap"
        sx={{ flex: 1, minWidth: 0 }}
      >
        {props.children}
      </Stack>
      {props.onClear && (
        <IconButton aria-label={`Clear ${props.label}`} onClick={props.onClear}>
          <CloseIcon fontSize="small" />
        </IconButton>
      )}
    </Stack>
  );
}

/**
 * The "Customize" start tab: a summary of the scene on top, and a file picker
 * for whichever part of it is selected.
 */
function SceneCustomizer(props: {
  player: MMDPlayer;
  /** The MMD files to pick from. `null` while loading. */
  files: mmdDetailsProcessed | null;
  basePath: string;
  loadAudioMeta: (value: string) => [string, string];
  /** Call after any change, to redraw and update the preview. */
  onChange: () => void;
  /** Called by "Reset all", after the scene is cleared. */
  onReset: () => void;
  /** Loads the file list again. */
  onRefreshFiles: () => void;
}): JSX.Element {
  const { player } = props;
  const details = player.MMDLoadDetails;
  const [target, setTarget] = useState<Target>({ kind: "chara", slot: 0 });
  const [audioId, setAudioId] = useState("");
  /** Search text per picker, so switching between them keeps it. */
  const [search, setSearch] = useState<Partial<Record<Target["kind"], string>>>(
    {},
  );
  const pickerRef = useRef<HTMLDivElement>(null);
  const picker = pickers[target.kind];
  const slotOf = (t: Target) => ("slot" in t ? t.slot : -1);

  /** Selects what the picker fills in. On narrow screens the picker is below, so bring it into view. */
  const select = (next: Target) => {
    setTarget(next);
    const top = pickerRef.current?.getBoundingClientRect().top ?? 0;
    const bottom = player.root.current?.getBoundingClientRect().bottom ?? 0;
    if (top > bottom - 120)
      pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  /** A button showing one part of the scene. Highlighted while the picker fills it in. */
  const field = (
    t: Target,
    text: string | undefined,
    empty: string,
    disabled = false,
  ) => {
    const active = t.kind === target.kind && slotOf(t) === slotOf(target);
    return (
      <Button
        size="small"
        variant={active ? "contained" : "outlined"}
        color={text ? "primary" : "inherit"}
        disabled={disabled}
        onClick={() => select(t)}
        sx={{ minWidth: 0, maxWidth: "100%", textTransform: "none" }}
      >
        <Box component="span" sx={ellipsis}>
          {text ?? empty}
        </Box>
      </Button>
    );
  };
  const url = (file: string) => `${props.basePath}${file}`;
  const isPicked = (file: string) => {
    const path = url(file);
    if (target.kind === "stage")
      return details.stageFolder + details.stagePMX === path;
    if (target.kind === "camera") return details.vmdCamera === path;
    const entity = details.entities[target.slot];
    const model = entity?.model;
    if (target.kind === "chara")
      return !!model && model.folder + model.file === path;
    return entity?.movement?.includes(path) ?? false;
  };
  const pick = (file: string) => {
    loadMMDFileByURL(player, url(file), slotOf(target));
    props.onChange();
  };
  const setSlots = (count: number) => {
    details.maxModelFocus = Math.max(0, count);
    if (slotOf(target) >= details.maxModelFocus)
      setTarget(
        details.maxModelFocus
          ? { kind: "chara", slot: details.maxModelFocus - 1 }
          : { kind: "stage" },
      );
    props.onChange();
  };
  const resetAll = () => {
    Object.assign(details, {
      music: "",
      musicRaw: "",
      entities: [],
      entitiesData: [],
      entitiesOffset: [],
      entitiesAngle: [],
      focusedModel: 0,
      maxModelFocus: 5,
      stagePMX: "",
      stageFolder: "",
      vmdCamera: "",
      actionMemory: [],
    });
    setTarget({ kind: "chara", slot: 0 });
    setAudioId("");
    props.onReset();
    props.onChange();
  };

  return (
    <Stack direction="row" flexWrap="wrap" gap={2} sx={{ p: 1 }}>
      <Stack sx={{ flex: "1 1 320px", minWidth: 0 }}>
        <Typography variant="overline">Scene</Typography>
        <Row
          label="Music"
          onClear={
            details.musicRaw
              ? () => {
                  details.music = details.musicRaw = "";
                  props.onChange();
                }
              : undefined
          }
        >
          <Stack direction="row" gap={1} sx={{ flex: 1, minWidth: 0 }}>
            <TextField
              size="small"
              placeholder="Audio id"
              value={audioId}
              onChange={(event) => setAudioId(event.target.value)}
              sx={{ flex: 1, minWidth: 80 }}
            />
            <Button
              variant="outlined"
              disabled={!audioId}
              onClick={() => {
                const [audio, image] = props.loadAudioMeta(audioId);
                details.music = audioId;
                details.musicRaw = audio;
                details.thumbnail = image;
                props.onChange();
              }}
            >
              Fetch
            </Button>
          </Stack>
          {details.musicRaw && (
            <Typography variant="caption" sx={{ ...ellipsis, width: "100%" }}>
              {details.musicRaw.split("/").pop()}
            </Typography>
          )}
        </Row>
        <Row
          label="Stage"
          onClear={
            details.stagePMX
              ? () => {
                  details.stagePMX = details.stageFolder = "";
                  props.onChange();
                }
              : undefined
          }
        >
          {field(
            { kind: "stage" },
            details.stagePMX ? fileLabel(details.stagePMX) : undefined,
            "+ Stage",
          )}
        </Row>
        <Row
          label="Camera"
          onClear={
            details.vmdCamera
              ? () => {
                  details.vmdCamera = "";
                  props.onChange();
                }
              : undefined
          }
        >
          {field(
            { kind: "camera" },
            details.vmdCamera ? fileLabel(details.vmdCamera) : undefined,
            "+ Camera",
          )}
        </Row>
        {[...Array(details.maxModelFocus).keys()].map((slot) => {
          const entity = details.entities[slot];
          const model = entity?.model?.file;
          const dance = entity?.movement?.find((m) => !isPartMotion(m));
          const parts = entity?.movement?.filter(isPartMotion).length ?? 0;
          return (
            <Row
              key={slot}
              label={`Slot ${slot}`}
              onClear={
                entity?.model || entity?.movement?.length
                  ? () => {
                      details.entities[slot] = {};
                      props.onChange();
                    }
                  : undefined
              }
            >
              {field(
                { kind: "chara", slot },
                model ? fileLabel(model) : undefined,
                "+ Character",
              )}
              {field(
                { kind: "dance", slot },
                dance ? fileLabel(dance) : undefined,
                "+ Dance",
                !model,
              )}
              {field(
                { kind: "parts", slot },
                parts ? `${parts} part${parts > 1 ? "s" : ""}` : undefined,
                "+ Parts",
                !model,
              )}
            </Row>
          );
        })}
        <Stack
          direction="row"
          alignItems="center"
          flexWrap="wrap"
          gap={1}
          sx={{ mt: 1 }}
        >
          <Typography variant="body2">Slots</Typography>
          <IconButton
            aria-label="Fewer character slots"
            onClick={() => setSlots(details.maxModelFocus - 1)}
          >
            <RemoveIcon />
          </IconButton>
          <Typography sx={{ minWidth: "2ch", textAlign: "center" }}>
            {details.maxModelFocus}
          </Typography>
          <IconButton
            aria-label="More character slots"
            onClick={() => setSlots(details.maxModelFocus + 1)}
          >
            <AddIcon />
          </IconButton>
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" color="warning" onClick={resetAll}>
            Reset all
          </Button>
        </Stack>
      </Stack>

      <Stack
        ref={pickerRef}
        sx={{ flex: "1 1 320px", minWidth: 0, scrollMarginTop: 8 }}
      >
        <Stack
          gap={1}
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 1,
            bgcolor: "background.paper",
            py: 1,
          }}
        >
          <Typography variant="overline">
            {picker.title}
            {"slot" in target ? ` · Slot ${target.slot}` : ""}
          </Typography>
          <Stack direction="row" gap={1}>
            <TextField
              size="small"
              placeholder="Search (kana or romaji)"
              value={search[target.kind] ?? ""}
              onChange={(event) =>
                setSearch({ ...search, [target.kind]: event.target.value })
              }
              sx={{ flex: 1 }}
            />
            <Button
              title="Load the file list again"
              onClick={props.onRefreshFiles}
            >
              Refresh
            </Button>
          </Stack>
        </Stack>
        {!props.files ? (
          <Typography color="text.secondary">Loading files…</Typography>
        ) : props.files[picker.files].length ? (
          <SimpleTreeViewSearchable
            files={props.files[picker.files]}
            search={search[target.kind] ?? ""}
            isPicked={isPicked}
            onPick={pick}
          />
        ) : (
          <Typography color="text.secondary">
            No files found. Their names must end in <code>{picker.suffix}</code>
            .
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}

//#endregion

export { SceneCustomizer };
