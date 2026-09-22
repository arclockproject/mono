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
  maxVolume = 1;

  constructor() {
    this.audioContext = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
  }

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

  public async play(
    path: string,
    options?: {
      singleInstance?: boolean;
      loop?: boolean;
      gradual?: boolean;
      speed?: number;
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

  public stopInstance(path: string): void {
    const instance = this.cacheInstance[path];
    if (instance) {
      instance.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      instance.source.stop();
      delete this.cacheInstance[path];
    }
  }

  public stopAllInstances(): void {
    for (const key in this.cacheInstance) {
      this.stopInstance(key);
    }
  }
}
const AudioInstantManagerGlobal: AudioInstantManager =
  new AudioInstantManager();
export { AudioInstantManager, AudioInstantManagerGlobal };
