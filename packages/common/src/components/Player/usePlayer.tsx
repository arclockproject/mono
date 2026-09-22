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
const usePlayer = <metaType, listMetaType>(): PlayerContextProps<
  metaType,
  listMetaType
> => useContext(_getPlayerContext<metaType, listMetaType>());
//#endregion

export { usePlayer, _getPlayerContext };
