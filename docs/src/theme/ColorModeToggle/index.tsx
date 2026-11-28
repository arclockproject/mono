import useIsBrowser from "@docusaurus/useIsBrowser";
import type { Props } from "@theme/ColorModeToggle";
import IconDarkMode from "@theme/Icon/DarkMode";
import IconLightMode from "@theme/Icon/LightMode";
import IconSystemColorMode from "@theme/Icon/SystemColorMode";
import clsx from "clsx";
import { memo, type ReactNode, useEffect, useRef } from "react";
import styles from "./styles.module.css";

/**
 * Replaces the theme's color mode toggle with a light/dark switch. The switch
 * always flips the theme on screen, so every click changes something. The
 * second button goes back to the browser's theme and only shows while a light
 * or dark choice is saved.
 */
function ColorModeToggle({
  className,
  buttonClassName,
  respectPrefersColorScheme,
  onChange,
}: Props): ReactNode {
  const isBrowser = useIsBrowser();
  const checkbox = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    const sync = () => {
      if (checkbox.current) {
        checkbox.current.checked = html.dataset.theme === "dark";
      }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(html, { attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className={clsx(styles.toggle, className)}>
      {respectPrefersColorScheme && (
        <button
          className={clsx("clean-btn", styles.resetButton)}
          type="button"
          onClick={() => onChange(null)}
          disabled={!isBrowser}
          title="Use the browser's theme"
          aria-label="Use the browser's theme"
        >
          <IconSystemColorMode aria-hidden />
        </button>
      )}
      <div
        className={clsx(
          styles.switch,
          !isBrowser && styles.switchDisabled,
          buttonClassName,
        )}
        title="Dark mode"
      >
        <input
          ref={checkbox}
          type="checkbox"
          role="switch"
          className={styles.checkbox}
          disabled={!isBrowser}
          aria-label="Dark mode"
          onChange={(event) =>
            onChange(event.currentTarget.checked ? "dark" : "light")
          }
        />
        <span className={styles.knob} aria-hidden>
          <IconLightMode className={styles.lightIcon} />
          <IconDarkMode className={styles.darkIcon} />
        </span>
      </div>
    </div>
  );
}

export default memo(ColorModeToggle);
