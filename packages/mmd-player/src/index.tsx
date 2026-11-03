"use client";

import type { MMDLoadDetails, MMDTemplateEntry } from "./config";
import { type MMDHandle, Mmd } from "./Mmd";

export type { MMDTemplateEntry, MMDHandle, MMDLoadDetails };

/**
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
