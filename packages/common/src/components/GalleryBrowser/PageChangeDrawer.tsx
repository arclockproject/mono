import {
  Box,
  Button,
  ButtonGroup,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import type React from "react";
import { useEffect, useId, useState } from "react";
import type { JSX } from "react/jsx-runtime";

/**
 * Dialog that asks for a page number between `min` and `max`.
 */
export default function PageChangeDrawer(props: {
  /** Value the field starts with. The dialog is open while this is not `null`. */
  starterValue: string | null;
  /** Lowest page that can be confirmed. */
  min: number;
  /** Highest page that can be confirmed. */
  max: number;
  /**
   * Called when the dialog closes.
   * @param newValue The confirmed page, or `null` if the dialog was cancelled.
   */
  onConclusion: (newValue: number | null) => void;
}): JSX.Element {
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (props.starterValue === null) return;
    setValue(props.starterValue);
    setError("");
  }, [props.starterValue]);
  const parse = (text: string): number | string => {
    const page = Number.parseInt(text, 10);
    if (`${page}` !== text.trim())
      return `Could not read '${text}' as a number.`;
    if (page > props.max)
      return `${page} is too large. The last page is ${props.max}.`;
    if (page < props.min)
      return `${page} is too small. The first page is ${props.min}.`;
    return page;
  };
  const changeBy = (change: number) => {
    const page = Number.parseInt(value, 10);
    if (Number.isNaN(page)) {
      setError(`Could not read '${value}' as a number.`);
      return;
    }
    setError("");
    setValue(`${Math.max(props.min, Math.min(props.max, page + change))}`);
  };
  const confirm = () => {
    const page = parse(value);
    if (typeof page === "number") props.onConclusion(page);
    else setError(page);
  };
  return (
    <Dialog
      open={props.starterValue !== null}
      onClose={() => props.onConclusion(null)}
      aria-labelledby={`${id}-title`}
    >
      <DialogTitle id={`${id}-title`}>Go to page</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          autoFocus
          id={`${id}-page`}
          label="Page"
          variant="standard"
          value={value}
          error={error !== ""}
          helperText={error || `${props.min} – ${props.max}`}
          slotProps={{ htmlInput: { inputMode: "numeric" } }}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setValue(event.target.value);
            setError("");
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            confirm();
          }}
        />
        <Box
          sx={(theme) => ({
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            gap: theme.spacing(1),
            marginTop: theme.spacing(1),
          })}
        >
          <ButtonGroup variant="text" aria-label="Go back">
            <Button onClick={() => changeBy(-100)}>-100</Button>
            <Button onClick={() => changeBy(-10)}>-10</Button>
            <Button onClick={() => changeBy(-1)}>-1</Button>
          </ButtonGroup>
          <ButtonGroup variant="text" aria-label="Go forward">
            <Button onClick={() => changeBy(1)}>+1</Button>
            <Button onClick={() => changeBy(10)}>+10</Button>
            <Button onClick={() => changeBy(100)}>+100</Button>
          </ButtonGroup>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => props.onConclusion(null)}>Cancel</Button>
        <Button onClick={confirm}>Confirm</Button>
      </DialogActions>
    </Dialog>
  );
}
