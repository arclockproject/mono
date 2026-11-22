import { useCallback, useState } from "react";

/**
 * Checks a value read from storage.
 *
 * @param value The parsed JSON. It can be anything, because storage can be edited by hand.
 * @returns The value if it is valid, or `undefined` to use the fallback.
 */
type LocalStorageValidator<T> = (value: unknown) => T | undefined;

/**
 * Reads and writes JSON values in `localStorage`. Never throws: storage that is
 * full, blocked (e.g. private mode) or holds bad data is treated as empty.
 *
 * @see {@link https://arclockproject.org/docs/common/library/LocalStorage Guide} | {@link https://arclockproject.org/docs/api/common/library/LocalStorage API}
 */
const LocalStorage = {
  /**
   * Reads the JSON value saved under `key`.
   *
   * @param key Storage key.
   * @param fallback Returned when nothing is saved, the JSON is broken, or `validate` rejects it.
   * @param validate Checks the parsed value.
   * @returns The saved value, or `fallback`.
   * @example
   * LocalStorage.read("volume", 1, (v) => (typeof v === "number" ? v : undefined)); // 1
   */
  read: <T>(
    key: string,
    fallback: T,
    validate: LocalStorageValidator<T>,
  ): T => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return validate(JSON.parse(raw)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  /**
   * Saves `value` as JSON under `key`.
   *
   * @param key Storage key.
   * @param value Anything `JSON.stringify` can write.
   * @returns `false` if storage is full or blocked.
   * @example
   * LocalStorage.write("volume", 0.5); // true
   */
  write: (key: string, value: unknown): boolean => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
};

/**
 * `useState` that is saved in `localStorage`. The value is read once, when the
 * component mounts, and saved on every set. Other components or tabs using the
 * same `key` are not updated.
 *
 * @see {@link https://arclockproject.org/docs/common/library/LocalStorage Guide} | {@link https://arclockproject.org/docs/api/common/library/LocalStorage API}
 * @param key Storage key.
 * @param fallback Used when nothing valid is saved.
 * @param validate Checks the saved value, see `LocalStorage.read`.
 * @returns The value and a setter, like `useState`. The setter takes a value, not a function.
 * @example
 * const [align, setAlign] = useLocalStorageState("align", { x: 0, y: 0 }, parseAlignment);
 */
function useLocalStorageState<T>(
  key: string,
  fallback: T,
  validate: LocalStorageValidator<T>,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() =>
    LocalStorage.read(key, fallback, validate),
  );
  const set = useCallback(
    (next: T) => {
      setValue(next);
      LocalStorage.write(key, next);
    },
    [key],
  );
  return [value, set];
}

export default LocalStorage;
export { useLocalStorageState };
export type { LocalStorageValidator };
