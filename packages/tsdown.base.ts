/**
 * Shared tsdown options for every package. Spread it into `defineConfig()` and add `entry`.
 *
 * Builds ESM (`.js`, `.d.ts`) and CJS (`.cjs`, `.d.cts`). JSDoc is kept in `.d.ts` and `.d.cts`.
 *
 * The minifier only removes comments from `.js` and `.cjs`: code is not compressed, renamed or put
 * on one line, and `@__PURE__` annotations are kept for tree-shaking.
 */
const baseConfig = {
  fixedExtension: false,
  dts: true,
  target: false,
  treeshake: true,
  clean: true,
  format: { esm: {}, cjs: {} },
  cjsDefault: false,
  minify: {
    compress: false,
    mangle: false,
    codegen: { removeWhitespace: false },
  },
} as const;

export { baseConfig };
