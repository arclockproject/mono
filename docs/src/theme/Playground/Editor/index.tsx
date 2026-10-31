import React, { type ReactNode, useState } from "react";
//@ts-ignore Docosaurus does resolve this import.
import PlaygroundEditor from "@theme-original/Playground/Editor";
import styles from "./styles.module.css";

/**
 * Wraps the theme's live editor so the code starts collapsed above the
 * result. Clicking the header shows the code, which can then be edited.
 */
export default function PlaygroundEditorWrapper(): ReactNode {
  const [open, setOpen] = useState(false);

  return (
    <details
      className={styles.details}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className={styles.summary}>
        {open
          ? "▼ Code (edit it and the result below updates)"
          : "▶ Show code (click to view and edit)"}
      </summary>
      <PlaygroundEditor />
    </details>
  );
}
