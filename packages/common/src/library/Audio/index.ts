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
  maxVolume = 1;
  //   constructor() {
  //     this.audioContext = new (window.AudioContext ||
  //       (window as any).webkitAudioContext)();
  //   }
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
  public play(
    path: string | string,
    options?: {
      singleInstance?: boolean;
      loop?: boolean;
      gradual?: boolean;
      speed?: number;
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
  public stopAllInstances(data?: { gradual?: boolean }): void {
    for (const key in this.cacheInstance) {
      this.stopInstance(key as string, { gradual: data?.gradual });
    }
  }
  public stopInstance(path: string, data?: { gradual?: boolean }): void {
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
const AudioManagerGlobal: AudioManager = new AudioManager();
export { AudioManager, AudioManagerGlobal };
