import { useLocalStorageState } from "@arclockproject/common/library/LocalStorage";
import { createContext, type PropsWithChildren, useContext } from "react";
import type { JSX } from "react/jsx-runtime";

/**
 * One track of an `AudioMixer`. Add your own fields as needed.
 */
export type AudioMixerTrack = {
  /** Unique id. Tracks with the same `id` are the same track. */
  id: string;
  /** Name shown in the mixer. */
  title: string;
  /** URL of the audio file. Video files work too, only their sound is used. */
  url: string;
};

/**
 * What `useAudioMixer` returns.
 */
export type AudioMixerContextValue<
  track extends AudioMixerTrack = AudioMixerTrack,
> = {
  /** Tracks in the mixer, in the order they were added. */
  tracks: track[];
  /**
   * Adds a track at the end. A track with the same `id` is moved to the end.
   * @param track The track to add.
   */
  add: (track: track) => void;
  /**
   * Removes the track with this `id`, if it is in the mixer.
   * @param track The track, or anything with its `id`.
   */
  remove: (track: Pick<AudioMixerTrack, "id">) => void;
  /**
   * Replaces all tracks.
   * @param tracks The new tracks.
   */
  set: (tracks: track[]) => void;
  /**
   * Says whether a track is in the mixer, e.g. to switch an "Add" button to "Remove".
   * @param track The track, or anything with its `id`.
   * @returns Whether a track with this `id` is in the mixer.
   */
  has: (track: Pick<AudioMixerTrack, "id">) => boolean;
};

const AudioMixerContext =
  createContext<AudioMixerContextValue<AudioMixerTrack> | null>(null);

const parseTracks = <track extends AudioMixerTrack>(
  value: unknown,
): track[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value.filter(
    (item): item is track =>
      typeof item === "object" &&
      item !== null &&
      typeof item.id === "string" &&
      typeof item.title === "string" &&
      typeof item.url === "string",
  );
};

/**
 * Holds the list of mixer tracks and saves it in `localStorage`, so any part of
 * your app can add tracks with `useAudioMixer`. An `AudioMixer` inside it shows
 * these tracks when it has no `tracks` prop.
 *
 * @see {@link https://arclockproject.org/docs/common/components/AudioMixer Guide} | {@link https://arclockproject.org/docs/api/common/components/AudioMixer API}
 * @example
 * <AudioMixerProvider>
 *   <AddToMixerButton />
 *   <AudioMixer />
 * </AudioMixerProvider>
 */
export function AudioMixerProvider<
  track extends AudioMixerTrack = AudioMixerTrack,
>(
  props: PropsWithChildren<{
    /**
     * `localStorage` key the tracks are saved under.
     * @default "@arclockproject/common/components/AudioMixer.tracks"
     */
    storageKey?: string;
  }>,
): JSX.Element {
  const [tracks, setTracks] = useLocalStorageState<track[]>(
    props.storageKey ?? "@arclockproject/common/components/AudioMixer.tracks",
    [],
    parseTracks<track>,
  );
  const value: AudioMixerContextValue<track> = {
    tracks,
    add: (track) =>
      setTracks([...tracks.filter((item) => item.id !== track.id), track]),
    remove: (track) => {
      if (!tracks.some((item) => item.id === track.id)) return;
      setTracks(tracks.filter((item) => item.id !== track.id));
    },
    set: setTracks,
    has: (track) => tracks.some((item) => item.id === track.id),
  };
  return (
    <AudioMixerContext.Provider
      value={value as unknown as AudioMixerContextValue<AudioMixerTrack>}
    >
      {props.children}
    </AudioMixerContext.Provider>
  );
}

/**
 * The tracks of the nearest `AudioMixerProvider`, and functions to change them.
 *
 * @returns The mixer tracks and functions, or `null` outside a provider.
 * @example
 * const mixer = useAudioMixer();
 * mixer?.add({ id: "beat-1", title: "Beat", url: "/beat.mp3" });
 */
export function useAudioMixer<
  track extends AudioMixerTrack = AudioMixerTrack,
>(): AudioMixerContextValue<track> | null {
  return useContext(AudioMixerContext) as AudioMixerContextValue<track> | null;
}
