/**
 * Plays sound files with the Web Audio API. Each file is downloaded and decoded
 * once, so later plays start with no delay. Every `play` starts a new sound,
 * even for the same file.
 *
 * Browser only: creating one needs `window.AudioContext` and so it breaks in SSG and SSR.
 *
 * **Note**: This class is not as tested as its sibling `Audio`.
 * Unexpected behaviour is to be expected at the current state of the Class.
 *
 * @see {@link https://arclockproject.org/docs/common/library/AudioInstant Guide} | {@link https://arclockproject.org/docs/api/common/library/AudioInstant API}
 */
class AudioInstantManager {
  private audioContext: AudioContext;
  private cacheOnceShot: {
    [path: string]: AudioBuffer;
  } = {};
  private cacheInstance: {
    [path: string]: {
      source: AudioBufferSourceNode;
      gainNode: GainNode;
    };
  } = {};
  /**
   * Volume sounds play at, from 0 to 1. Change it with `setMaxVolume`.
   */
  maxVolume = 1;

  constructor() {
    this.audioContext = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
  }

  /**
   * Sets the volume for new sounds and for sounds tracked by `stopInstance`.
   *
   * @param volume From 0 (silent) to 1 (full).
   */
  public setMaxVolume(volume: number): void {
    this.maxVolume = volume;
    for (const key in this.cacheInstance) {
      const instance = this.cacheInstance[key]!;
      instance.gainNode.gain.setValueAtTime(
        this.maxVolume,
        this.audioContext.currentTime,
      );
    }
  }

  private async getCachedAudioBuffer(path: string): Promise<AudioBuffer> {
    if (!this.cacheOnceShot[path]) {
      const response = await fetch(path);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.cacheOnceShot[path] = audioBuffer;
      return audioBuffer;
    }
    return this.cacheOnceShot[path]!;
  }

  /**
   * Plays the file at `path`. The first play of a file waits for it to download.
   *
   * @param path URL of the audio file.
   * @param options How to play it. All are optional.
   * @returns Resolves once the sound has started.
   * @example
   * await AudioInstantManagerGlobal.play("/sounds/hit.mp3", { speed: 1.5 });
   */
  public async play(
    path: string,
    options?: {
      /** Not used for playback. With `gradual`, setting it stops the sound from being tracked for `stopInstance`. */
      singleInstance?: boolean;
      /** Repeat when it reaches the end. */
      loop?: boolean;
      /** Fade in over 1 second. */
      gradual?: boolean;
      /** Playback rate, where `1` is normal speed. */
      speed?: number;
      /** Not supported here yet, and ignored at the moment. */
      preservesPitch?: boolean;
    },
  ): Promise<void> {
    const audioBuffer = await this.getCachedAudioBuffer(path);

    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();

    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    source.buffer = audioBuffer;

    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    if (options?.loop) source.loop = options.loop;
    if (options?.speed)
      source.playbackRate.setValueAtTime(
        options.speed,
        this.audioContext.currentTime,
      );

    source.start(0);

    if (!options?.gradual) {
      gainNode.gain.setValueAtTime(
        this.maxVolume,
        this.audioContext.currentTime,
      );
      return;
    }

    gainNode.gain.linearRampToValueAtTime(
      this.maxVolume,
      this.audioContext.currentTime + 1,
    );

    if (!options?.singleInstance) {
      this.cacheInstance[path] = { source, gainNode };
    }
  }

  /**
   * Stops the tracked sound for `path`. Only the latest sound played with
   * `gradual: true` is tracked per file.
   *
   * @param path The same URL that was passed to `play`.
   */
  public stopInstance(path: string): void {
    const instance = this.cacheInstance[path];
    if (instance) {
      instance.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      instance.source.stop();
      delete this.cacheInstance[path];
    }
  }

  /**
   * Stops every tracked sound. See `stopInstance` for which sounds are tracked.
   */
  public stopAllInstances(): void {
    for (const key in this.cacheInstance) {
      this.stopInstance(key);
    }
  }
}
/**
 * Shared `AudioInstantManager` for the whole app. It is created when this
 * module is imported, so only import it in the browser.
 */
const AudioInstantManagerGlobal: AudioInstantManager =
  new AudioInstantManager();
export { AudioInstantManager, AudioInstantManagerGlobal };
