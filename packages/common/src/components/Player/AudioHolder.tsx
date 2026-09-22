//#region Imports

import type { Ref } from "react";
import type { JSX } from "react/jsx-runtime";
import { usePlayer } from "./usePlayer";

//#endregion

//#region AudioHolder.tsx

function AudioHolder<metaType, listMetaType>(): JSX.Element {
  const context = usePlayer<metaType, listMetaType>();
  return (
    <div style={{ display: "none" }}>
      {context.internal.playerData.value ? (
        <audio
          // eslint-disable-next-line
          ref={context.internal.refAudio as Ref<HTMLAudioElement>}
          src={
            context.internal.audioControlled
              ? context.internal.sourceOverride.value
                ? context.internal.sourceOverride.value
                : context.internal.playerData.value.files.audio
                  ? context.internal.playerData.value.files.audio
                  : undefined
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
        />
      ) : undefined}
    </div>
  );
}

//#endregion

export { AudioHolder };
