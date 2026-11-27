import { defineConfig } from "tsdown";
import { baseConfig } from "../tsdown.base.ts";

export default defineConfig({
  ...baseConfig,
  entry: ["src/index.tsx"],
});
