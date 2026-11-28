import Link from "@docusaurus/Link";
import CodeBlock from "@theme/CodeBlock";
import clsx from "clsx";
import { useEffect, useState } from "react";
import styles from "./styles.module.css";

/** One file to show. */
type SourceFileEntry = {
  /** Shown on the tab, e.g. `Maze app`. */
  label: string;
  /**
   * Shown as the code block title, e.g. `docs/src/pages/demo/_app/Maze.tsx`.
   * Its extension sets the highlighting.
   */
  path: string;
  /**
   * The file's text. Pass a function like `() => import("./App.tsx?raw")` to
   * load it only when its tab is opened.
   */
  source: string | (() => Promise<{ default: string }>);
  /** Link to the file on GitHub, shown next to the tabs. */
  href?: string;
};

const LANGUAGES: Record<string, string> = {
  ts: "ts",
  tsx: "tsx",
  js: "js",
  jsx: "jsx",
  css: "css",
  json: "json",
  md: "md",
  mdx: "md",
};

const languageOf = (path: string) =>
  LANGUAGES[path.split(".").pop() ?? ""] ?? "text";

/**
 * Shows the source of one or more files with syntax highlighting, a copy
 * button and line numbers. Several files get a tab each. Works in pages and
 * in MDX, where it can be used without an import.
 */
export default function SourceFile(props: {
  /** The files, in tab order. */
  files: SourceFileEntry[];
  /**
   * Height of the code area before it scrolls, as CSS.
   * @default "70vh"
   */
  maxHeight?: string;
}) {
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState<Record<number, string>>({});
  const file = props.files[active];
  const text = typeof file?.source === "string" ? file.source : loaded[active];

  useEffect(() => {
    if (!file || typeof file.source === "string" || active in loaded) return;
    let cancelled = false;
    file.source().then((module) => {
      if (!cancelled)
        setLoaded((all) => ({ ...all, [active]: module.default }));
    });
    return () => {
      cancelled = true;
    };
  }, [active, file, loaded]);

  if (!file) return null;

  return (
    <div
      className={styles.root}
      style={{ "--source-max-height": props.maxHeight ?? "70vh" } as object}
    >
      <CodeBlock
        language={text === undefined ? "text" : languageOf(file.path)}
        title={
          <>
            <div className={styles.tabs}>
              {props.files.map((entry, index) => (
                <button
                  key={entry.path}
                  type="button"
                  className={clsx(
                    "clean-btn",
                    styles.tab,
                    index === active && styles.tabActive,
                  )}
                  aria-pressed={index === active}
                  onClick={() => setActive(index)}
                >
                  {entry.label}
                </button>
              ))}
              {file.href && (
                <Link href={file.href} className={styles.github}>
                  View on GitHub
                </Link>
              )}
            </div>
            {file.path}
          </>
        }
        showLineNumbers
      >
        {text ?? "Loading..."}
      </CodeBlock>
    </div>
  );
}

export type { SourceFileEntry };
