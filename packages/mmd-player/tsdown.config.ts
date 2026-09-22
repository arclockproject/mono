import { defineConfig } from "tsdown";
export default defineConfig({
  entry: ["src/index.tsx"],
  fixedExtension: false,
  dts: true,
  target: false,
  treeshake: true,
  format: "esm",
  clean: true,
});
