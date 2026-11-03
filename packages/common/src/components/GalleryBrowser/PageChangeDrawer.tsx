import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  ButtonGroup,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import type { JSX } from "react/jsx-runtime";
export default function PageChangeDrawer(props: {
  starterValue: string | null;
  min: number;
  max: number;
  onConclusion: (newValue: number | null) => void;
}): JSX.Element {
  const [currentPageOverride, setCurrentPageOverride] = useState("0");
  const [error, setError] = useState("");
  useEffect(() => {
    if (props.starterValue === null) return;
    setCurrentPageOverride(props.starterValue);
  }, [props.starterValue]);
  const changeButton = (change: number) => {
    const parsedPage = parseInt(currentPageOverride);
    if (parsedPage + "" !== currentPageOverride)
      setError(`Could not parse '${currentPageOverride}' as a number!`);
    return setCurrentPageOverride(
      `${Math.max(props.min, Math.min(props.max, parsedPage + change))}`,
    );
  };
  const validate = () => {
    const parsedPage = parseInt(currentPageOverride);
    if (parsedPage + "" !== currentPageOverride)
      return `Could not parse '${currentPageOverride}' as a number!`;
    if (parsedPage > props.max)
      return `'${currentPageOverride}' is too large! (${props.max} max)`;
    if (parsedPage < props.min)
      return `'${currentPageOverride}' is too small! (${props.min} minimum)`;
    return parsedPage;
  };
  return (
    <>
      <Dialog
        open={props.starterValue !== null}
        onClose={() => {
          props.onConclusion(null);
        }}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">Change current page</DialogTitle>
        <DialogContent>
          <Box
            sx={(theme) => ({
              display: "flex",
              flexDirection: "row",
              gap: theme.spacing(1),
            })}
          >
            <TextField
              fullWidth
              id="standard-basic"
              label="Standard"
              variant="standard"
              value={currentPageOverride}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                setCurrentPageOverride(event.target.value);
              }}
            />
          </Box>
          <Box
            sx={(theme) => ({
              display: "flex",
              flexDirection: "row",
              gap: theme.spacing(1),
            })}
          >
            <ButtonGroup variant="text" aria-label="Decrease Current Page">
              <Button onClick={() => changeButton(-100)}>-100</Button>
              <Button onClick={() => changeButton(-10)}>-10</Button>
              <Button onClick={() => changeButton(-1)}>-1</Button>
            </ButtonGroup>
            <ButtonGroup variant="text" aria-label="Increase Current Page">
              <Button onClick={() => changeButton(1)}>+1</Button>
              <Button onClick={() => changeButton(10)}>+10</Button>
              <Button onClick={() => changeButton(100)}>+100</Button>
            </ButtonGroup>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              props.onConclusion(null);
            }}
            autoFocus
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              const validated = validate();
              if (typeof validated === "number")
                return props.onConclusion(validated);
              else return setError(validated);
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={error !== ""}
        onClose={() => {
          setError("");
        }}
      >
        <DialogTitle>Error</DialogTitle>
        <DialogContent>
          <Typography>{error}</Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setError("");
            }}
          >
            Ok
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
