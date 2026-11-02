/**
 * Options for `new AudioManager()`.
 */
type AudioManagerOptions = {
  /**
   * Limits how many `<audio>` elements one-shot sounds keep per file.
   * Single-instance sounds always use one element, so this doesn't apply to them.
   * Leave it out for no limit.
   */
  cache?: {
    /**
     * Most elements kept per file. When this many exist and none is free,
     * `onMax` runs before another is created.
     *
     * Example: with `maxInstances: 10`, `onMax` runs before the 11th would be created.
     *
     * `1` or lower still allows 1 element.
     */
    maxInstances: number;
    /**
     * What to do when the limit is reached:
     * - `"drop"`: don't create the element. The sound doesn't play.
     * - `"throw"`: throw an `Error` from `play`.
     * - A function: called with the file path and the number of elements for it.
     *   Return `true` to drop the sound. Any other return value, including none,
     *   creates the element and plays the sound.
     */
    onMax: "drop" | "throw" | ((path: string, count: number) => boolean | void);
  };
};

/**
 * Plays sound files using `<audio>` elements, with fade in and out.
 *
 * There are two kinds of sounds:
 * - **One-shot** (default): each `play` starts the file from the beginning, and
 *   overlapping plays of the same file are allowed. Good for clicks and effects.
 *   The number of overlapping plays can be limited with the `cache` option.
 * - **Single instance** (`singleInstance: true`): one shared element per file,
 *   which resumes where it stopped and can be stopped with `stopInstance`.
 *   Good for music and ambience.
 *
 * Most apps use the shared `AudioManagerGlobal` instead of creating their own.
 *
 * @see {@link https://arclockproject.org/docs/common/library/Audio Guide} | {@link https://arclockproject.org/docs/api/common/library/Audio API}
 */
class AudioManager {
  //   private audioContext: AudioContext;
  private cacheOnceShot: {
    [path: string]: HTMLAudioElement[];
  } = {};
  private cacheInstance: {
    [path: string]: {
      audio: HTMLAudioElement;
      effects: ReturnType<typeof setInterval>[];
    };
  } = {};
  /**
   * Volume sounds play at, from 0 to 1. Change it with `setMaxVolume`.
   */
  maxVolume = 1;
  /**
   * Options passed to the constructor. Changes apply to the next `play`.
   */
  options: AudioManagerOptions;
  /**
   * @param options Leave it out to keep the old behaviour: a console warning
   * once a file has more than 10 one-shot elements, with no limit on how many
   * are created. Pass `{}` for no limit and no warnings.
   * @example
   * new AudioManager({ cache: { maxInstances: 5, onMax: "drop" } });
   */
  constructor(
    options: AudioManagerOptions = {
      // Temporary, to keep the warning the previous version had.
      // @todo Remove this default in the next breaking change.
      cache: {
        maxInstances: 11,
        onMax: (path, count) =>
          console.warn(`Cache for '${path}' exceeded 10 instances (${count})!`),
      },
    },
  ) {
    this.options = options;
  }
  /**
   * Sets the volume for all sounds. Single-instance sounds that are playing
   * change right away, and any fade on them stops.
   *
   * @param volume From 0 (silent) to 1 (full).
   */
  public setMaxVolume(volume: number): void {
    this.maxVolume = volume;
    for (const key in this.cacheInstance) {
      const instance = this.cacheInstance[key]!;
      if (instance.audio.volume > 0) {
        instance.effects.forEach((effect) => {
          clearInterval(effect);
        });
        instance.audio.volume = this.maxVolume;
      }
    }
  }
  private getCacheOnceShot(
    path: string,
    { isPaused }: { isPaused: boolean },
  ): HTMLAudioElement | null {
    const instances = this.cacheOnceShot[path];
    if (!instances) {
      const audio = document.createElement("audio");
      audio.src = path;
      audio.volume = 0;
      this.cacheOnceShot[path] = [audio];
      return audio;
    } else {
      const instance = instances.find((audio) => audio.paused === isPaused);
      if (instance) return instance;

      if (
        this.options.cache &&
        instances.length >= this.options.cache.maxInstances
      ) {
        switch (this.options.cache.onMax) {
          case "drop":
            return null;
          case "throw":
            throw new Error(`AudioManager reached max instances allowed on '${path}'`);
          default:
            if (this.options.cache.onMax(path, instances.length)) return null;
        }
      }
      const audio = document.createElement("audio");
      audio.src = path;
      instances.push(audio);
      return audio;
    }
  }
  private getCacheInstance(path: string) {
    if (!this.cacheInstance[path]) {
      const audio = document.createElement("audio");
      audio.src = path;
      audio.volume = 0;
      this.cacheInstance[path] = { audio, effects: [] };
    }
    return this.cacheInstance[path];
  }
  /**
   * Plays the file at `path`.
   *
   * @param path URL of the audio file.
   * @param options How to play it. All are optional.
   * @example
   * AudioManagerGlobal.play("/sounds/click.mp3");
   * AudioManagerGlobal.play("/music/theme.mp3", { singleInstance: true, loop: true, gradual: true });
   */
  public play(
    path: string | string,
    options?: {
      /** Use one shared element for this file, which resumes instead of restarting. Needed for `stopInstance`. */
      singleInstance?: boolean;
      /** Repeat when it reaches the end. */
      loop?: boolean;
      /** Fade in instead of starting at full volume. */
      gradual?: boolean;
      /** Playback rate, where `1` is normal speed. */
      speed?: number;
      /** Keep the pitch the same when `speed` is not `1`. */
      preservesPitch?: boolean;
    },
  ): void {
    const { audio, effects } = options?.singleInstance
      ? this.getCacheInstance(path)
      : {
          audio: this.getCacheOnceShot(path, { isPaused: true }),
          effects: null,
        };
    if (audio === null) return;
    if (effects !== null) {
      effects.forEach((effect) => {
        clearInterval(effect);
      });
      effects.splice(0, effects.length);
    }
    if (options?.loop !== undefined) audio.loop = options.loop;
    if (options?.preservesPitch !== undefined)
      audio.preservesPitch = options.preservesPitch;
    if (options?.speed !== undefined) audio.playbackRate = options.speed;
    if (!options?.singleInstance) audio.currentTime = 0;
    if (!options?.gradual) {
      if (audio.volume !== this.maxVolume) audio.volume = this.maxVolume;
      audio.play();
      return;
    }
    audio.play();
    const interval = setInterval(() => {
      if (audio.paused || audio.volume >= this.maxVolume) {
        audio.volume = this.maxVolume;
        clearInterval(interval);
      } else {
        audio.volume = Math.min(this.maxVolume, (audio.volume + 0.001) * 1.2);
      }
    }, 100);
    if (effects !== null) effects.push(interval);
  }
  /**
   * Stops every single-instance sound. One-shot sounds keep playing.
   *
   * @param data Optional settings.
   */
  public stopAllInstances(data?: {
    /** Fade out instead of stopping at once. */
    gradual?: boolean;
  }): void {
    for (const key in this.cacheInstance) {
      this.stopInstance(key as string, { gradual: data?.gradual });
    }
  }
  /**
   * Pauses the single-instance sound for `path`. Playing it again resumes from
   * the same position. Has no effect on one-shot sounds.
   *
   * @param path The same URL that was passed to `play`.
   * @param data Optional settings.
   * @example
   * AudioManagerGlobal.stopInstance("/music/theme.mp3", { gradual: true });
   */
  public stopInstance(
    path: string,
    data?: {
      /** Fade out instead of stopping at once. */
      gradual?: boolean;
    },
  ): void {
    const { audio, effects } = this.getCacheInstance(path);
    effects.forEach((effect) => {
      clearInterval(effect);
    });
    effects.splice(0, effects.length);
    if (audio.paused) return;
    if (!data?.gradual) {
      audio.pause();
      return;
    }
    const interval = setInterval(() => {
      if (audio.paused || audio.volume <= 0) {
        audio.volume = 0;
        audio.pause();
        clearInterval(interval);
      } else {
        audio.volume = Math.max(0, (audio.volume - 0.001) * 0.8);
      }
    }, 100);
    effects.push(interval);
  }
}
/**
 * Shared `AudioManager` for the whole app, so volume and single-instance
 * sounds are managed in one place.
 * 
 * Default configuration:
 * - Warn when single sound has more then 10 instances
 * - No instance limit for single sound 
 *
 * @example
 * import { AudioManagerGlobal } from "@arclockproject/common/library/Audio";
 *
 * AudioManagerGlobal.play("/sounds/click.mp3");
 */
const AudioManagerGlobal: AudioManager = new AudioManager();
export type { AudioManagerOptions };
export { AudioManager, AudioManagerGlobal };
