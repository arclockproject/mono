//#region Imports
import type React from "react";
import { createContext, useContext } from "react";

import type { PlayerContextProps } from "./globals";

//#endregion

//#region usePlayer.tsx
let _PlayerContext: unknown;
const _getPlayerContext = <metaType, listMetaType>() => {
  if (!_PlayerContext) {
    _PlayerContext = createContext<PlayerContextProps<metaType, listMetaType>>(
      // For now lets not consider edge case for when context is not initialized
      {} as unknown as PlayerContextProps<metaType, listMetaType>,
    );
  }
  return _PlayerContext as React.Context<
    PlayerContextProps<metaType, listMetaType>
  >;
};
/**
 * @internal
 *
 * Reads and controls the player state from any component inside
 * `PlayerContextProvider`. Outside of it, the result is an empty object.
 *
 * Most actions are controlled by passing data to `<VideoPlayer ...>` or by the user
 * when interacting with components. Please use that instead.
 * 
 * **Warning**: For compatibility reasons, `player.internal` is exposed to allow for direct
 * interaction with the player. Those might have side-effects and should be avoided
 * if possible. As they might be changed without warning in a patch or minor update.
 * 
 * @see {@link https://arclockproject.org/docs/common/components/Player Guide} | {@link https://arclockproject.org/docs/api/common/components/Player API}
 * @example
 * const player = usePlayer();
 * player.internal.playerData.set(video); // load a video
 * player.internal.playing.set(true); // play it
 */
const usePlayer = <metaType, listMetaType>(): PlayerContextProps<
  metaType,
  listMetaType
> => useContext(_getPlayerContext<metaType, listMetaType>());
//#endregion

export { usePlayer, _getPlayerContext };
