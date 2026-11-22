//#region Imports

import type { Ref } from "react";
import type { JSX } from "react/jsx-runtime";
import { usePlayer } from "./usePlayer";

//#endregion

//#region AudioHolder.tsx

/**
 * Hidden `<audio>` element that plays the loaded entry's separate audio file.
 * Keep it mounted (e.g. next to `MiniPlayer`) so audio keeps playing when the
 * `VideoPlayer` is unmounted. Must be inside `PlayerContextProvider`.
 *
 * @see {@link https://arclockproject.org/docs/common/components/Player Guide} | {@link https://arclockproject.org/docs/api/common/components/Player API}
 */
function AudioHolder<metaType, listMetaType>(): JSX.Element {
  const context = usePlayer<metaType, listMetaType>();
  return (
    <div style={{ display: "none" }}>
      {context.internal.playerData.value ? (
        <audio
          // eslint-disable-next-line
          ref={context.internal.refAudio as Ref<HTMLAudioElement>}
          crossOrigin={
            context.internal.settings.value.corsMedia ? "anonymous" : undefined
          }
          src={
            context.internal.audioControlled
              ? context.internal.sourceOverride.value
                ? context.internal.sourceOverride.value
                : context.internal.playerData.value.files.audio
                  ? context.internal.playerData.value.files.audio
                  : context.internal.playerData.value.files.video
              : undefined
          }
          muted={
            context.internal.muted.value
              ? true
              : context.internal.audioOnly.value
                ? false
                : context.internal.playerData.value.files.audio === null
                  ? !context.internal.miniPlayer.value
                  : false
          }
          onEnded={
            context.internal.audioControlled
              ? context.internal.actionOnEnded
              : undefined
          }
          onLoadStart={
            context.internal.audioControlled
              ? context.internal.actionOnLoadStart
              : undefined
          }
          onDurationChange={
            context.internal.audioControlled
              ? context.internal.actionOnDurationChange
              : undefined
          }
          onTimeUpdate={
            context.internal.audioControlled
              ? (e) => context.internal.actionOnTimeUpdate(e, "audio")
              : undefined
          }
          onError={
            context.internal.audioControlled
              ? context.internal.actionOnError
              : undefined
          }
          onWaiting={
            context.internal.audioControlled &&
            !context.internal.audioOnly.value
              ? (e) => context.internal.actionOnWaiting(e, "audio")
              : undefined
          }
        />
      ) : undefined}
    </div>
  );
}

//#endregion

export { AudioHolder };
