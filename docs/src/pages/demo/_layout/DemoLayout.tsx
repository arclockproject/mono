import BrowserOnly from "@docusaurus/BrowserOnly";
import Link from "@docusaurus/Link";
import useBrokenLinks from "@docusaurus/useBrokenLinks";
import SourceFile, {
  type SourceFileEntry,
} from "@site/src/components/SourceFile";
import Layout from "@theme/Layout";
import clsx from "clsx";
import {
  type ComponentType,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import styles from "./DemoLayout.module.css";

const fallback = <p className="container">Loading demo...</p>;

/**
 * Loads the demo's code in the browser only. Some components touch `window` as soon as they
 * are imported, so the demo must not be imported while the static pages are built.
 */
function LazyApp(props: { load: () => Promise<{ default: ComponentType }> }) {
  const App = useMemo(() => lazy(props.load), [props.load]);
  return (
    <Suspense fallback={fallback}>
      <App />
    </Suspense>
  );
}

/** Whether the Source view is open. Starts open when the URL ends in `#source`. */
function useSourceOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (window.location.hash === "#source") setOpen(true);
  }, []);
  const change = (value: boolean) => {
    setOpen(value);
    const { pathname, search } = window.location;
    window.history.replaceState(
      null,
      "",
      `${pathname}${search}${value ? "#source" : ""}`,
    );
  };
  return [open, change] as const;
}

/**
 * Page frame for the demos.
 */
function DemoLayout(props: {
  /** Page title, shown in the tab and the header. */
  title: string;
  /** One line under the title. */
  description: string;
  /** Hide the header and footer, and let the demo fill the page below the navbar. */
  fullscreen?: boolean;
  /** Imports the demo, e.g. `() => import("./_app/Maze")`. The file must default-export the app. */
  load: () => Promise<{ default: ComponentType }>;
  /**
   * Files shown in the Source view, from `_layout/sources.ts`. The demo stays loaded
   * while the source is open.
   */
  source: SourceFileEntry[];
}) {
  const [sourceOpen, setSourceOpen] = useSourceOpen();
  useBrokenLinks().collectAnchor("source");

  return (
    <Layout
      title={props.title}
      description={props.description}
      noFooter={props.fullscreen}
    >
      {!props.fullscreen && (
        <header className="container margin-top--lg margin-bottom--md">
          <Link to="/demo">&larr; All demos</Link>
          <div className={styles.titleRow}>
            <h1 className="margin-top--sm margin-bottom--xs">{props.title}</h1>
            <div className="button-group">
              <button
                type="button"
                className={clsx(
                  "button button--sm",
                  sourceOpen ? "button--secondary" : "button--primary",
                )}
                onClick={() => setSourceOpen(false)}
              >
                Demo
              </button>
              <button
                id="source"
                type="button"
                className={clsx(
                  "button button--sm",
                  sourceOpen ? "button--primary" : "button--secondary",
                )}
                onClick={() => setSourceOpen(true)}
              >
                Source
              </button>
            </div>
          </div>
          <p className="margin-bottom--none">{props.description}</p>
        </header>
      )}
      <main>
        <div hidden={sourceOpen && !props.fullscreen}>
          <BrowserOnly fallback={fallback}>
            {() => <LazyApp load={props.load} />}
          </BrowserOnly>
        </div>
        {sourceOpen && !props.fullscreen && (
          <div className="container margin-bottom--xl">
            <SourceFile files={props.source} />
          </div>
        )}
      </main>
      {props.fullscreen && (
        <>
          <button
            id="source"
            type="button"
            className={clsx("button button--primary", styles.sourceButton)}
            onClick={() => setSourceOpen(!sourceOpen)}
            aria-expanded={sourceOpen}
          >
            {sourceOpen ? "Close source" : "</> Source"}
          </button>
          {sourceOpen && (
            <aside className={styles.drawer} aria-label="Source">
              <div className={styles.drawerHeader}>
                <strong>{props.title} source</strong>
                <button
                  type="button"
                  className="clean-btn"
                  onClick={() => setSourceOpen(false)}
                  aria-label="Close source"
                >
                  &times;
                </button>
              </div>
              <SourceFile files={props.source} maxHeight="none" />
            </aside>
          )}
        </>
      )}
    </Layout>
  );
}

export default DemoLayout;
