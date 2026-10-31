/**
 * Plays sound files using `<audio>` elements, with fade in and out.
 *
 * There are two kinds of sounds:
 * - **One-shot** (default): each `play` starts the file from the beginning, and
 *   overlapping plays of the same file are allowed. Good for clicks and effects.
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
  //   constructor() {
  //     this.audioContext = new (window.AudioContext ||
  //       (window as any).webkitAudioContext)();
  //   }
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
  ): HTMLAudioElement {
    if (!this.cacheOnceShot[path]) {
      const audio = document.createElement("audio");
      audio.src = path;
      audio.volume = 0;
      this.cacheOnceShot[path] = [audio];
      return audio;
    } else {
      if (this.cacheOnceShot[path].length > 10)
        console.warn(
          `Cache for '${path}' exceeded 10 instances (${this.cacheOnceShot[path].length})!`,
        );
      const index = this.cacheOnceShot[path].findIndex(
        (audio) => audio.paused === isPaused,
      );
      if (index !== -1) {
        console.log("Returning instance ", index);
        return this.cacheOnceShot[path][index]!;
      }
      const audio = document.createElement("audio");
      audio.src = path;
      this.cacheOnceShot[path].push(audio);
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
      console.log(audio.volume);
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
      console.log(audio.volume);
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
 * @example
 * import { AudioManagerGlobal } from "@arclockproject/common/library/Audio";
 *
 * AudioManagerGlobal.play("/sounds/click.mp3");
 */
const AudioManagerGlobal: AudioManager = new AudioManager();
export { AudioManager, AudioManagerGlobal };
