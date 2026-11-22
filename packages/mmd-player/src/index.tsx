"use client";

import {
  defaultResolutions,
  type MMDLoadDetails,
  type MMDTemplateEntry,
  type PlayerSize,
  type Resolution,
} from "./config";
import { type MMDHandle, Mmd } from "./Mmd";

export type {
  MMDTemplateEntry,
  MMDHandle,
  MMDLoadDetails,
  Resolution,
  PlayerSize,
};

export { defaultResolutions };

/**
 * Throws an error that points to the replacement. Kept so old imports fail with a clear message.
 *
 * @deprecated Removed in 1.0.0. Use mmdRef.current.MMDUpdatePreview() instead.
 * @see https://arclockproject.org/docs/mmd-player/migrate/1.0.0
 */
const MMDUpdatePreview = (): never => {
  throw new Error(
    "MMDUpdatePreview was removed in 1.0.0. Use mmdRef.current.MMDUpdatePreview() instead. See https://arclockproject.org/docs/mmd-player/migrate/1.0.0",
  );
};

export { MMDUpdatePreview };

export { Mmd as MMD };

export default Mmd;
