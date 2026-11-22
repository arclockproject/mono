//#region Imports

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import { useState } from "react";
import type { JSX } from "react/jsx-runtime";
import type { MMDTemplateEntry } from "./config";

//#endregion

//#region SavePresetDialog.tsx

/**
 * Asks for the id, title and subtitle before a preset is saved. The id can only
 * be edited for a new preset. Render it only while saving: it reads `preset`
 * once, when it mounts.
 */
function SavePresetDialog(props: {
  preset: MMDTemplateEntry;
  isNew: boolean;
  /** Closes without saving. */
  onCancel: () => void;
  /**
   * @param preset `preset` with the entered id, title and subtitle.
   * @returns Whether it was saved. If not, the dialog stays open.
   */
  onSave: (preset: MMDTemplateEntry) => Promise<boolean>;
}): JSX.Element {
  const [id, setId] = useState(props.preset.id ?? "");
  const [title, setTitle] = useState(props.preset.title);
  const [subTitle, setSubTitle] = useState(props.preset.subTitle);
  const [pending, setPending] = useState(false);
  const save = async () => {
    setPending(true);
    const saved = await props
      .onSave({ ...props.preset, id, title, subTitle })
      .catch(() => false);
    if (!saved) setPending(false);
  };
  return (
    <Dialog open disablePortal onClose={props.onCancel} fullWidth maxWidth="xs">
      <DialogTitle>
        {props.isNew ? "Save as new preset" : "Save to current preset"}
      </DialogTitle>
      <DialogContent>
        <Stack gap={2} sx={{ pt: 1 }}>
          <TextField
            label="ID"
            value={id}
            disabled={!props.isNew}
            onChange={(event) => setId(event.target.value)}
          />
          <TextField
            label="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
          <TextField
            label="Subtitle"
            value={subTitle}
            onChange={(event) => setSubTitle(event.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onCancel}>Cancel</Button>
        <Button
          variant="contained"
          disabled={pending || !title.trim() || (props.isNew && !id.trim())}
          onClick={save}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

//#endregion

export { SavePresetDialog };
