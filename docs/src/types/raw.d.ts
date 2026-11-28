/** A file imported with `?raw`, e.g. `import("./App.tsx?raw")`. Its contents as text. */
declare module "*?raw" {
  const source: string;
  export default source;
}
