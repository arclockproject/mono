# api-docs plugin

> [!NOTE]
> AI-assisted: drafted with Claude, then reviewed and edited by a human.

Generates the **API** pages of the docs site from the JSDoc in the packages, so
the JSDoc is the single source for both IDE hovers and the website.

- Configured in [`docusaurus.config.ts`](../../docusaurus.config.ts) (the `apiDocs` entry in `plugins`).
- Each package needs a `src/` folder with its source, and a `tsconfig.json` in its root that includes the entry files.
- Writes `docs/docs/api/**/*.mdx` on `docusaurus start` and `build`, and again
  when a package source file changes. These pages are gitignored, so never edit them.
- The `_category_.json` files next to them are committed and set the sidebar labels and order.
- To add a new package, see [ADDING_A_PACKAGE.md](./ADDING_A_PACKAGE.md).

## Files

```
entry file ──extract.ts──▶ Section[] ──render.ts──▶ .mdx page
                          (types.ts)
```

| File | What it does | Change it to… |
|---|---|---|
| `index.ts` | The Docusaurus plugin: options, finding entry files, caching, writing pages. | change the options or how files are found |
| `extract.ts` | Reads an entry file with the TypeScript compiler and its JSDoc. | support a JSDoc tag (`TAGS`) or change what counts as a component (rules at the top) |
| `render.ts` | Turns the result into an MDX page. | change how a kind of export looks (`KINDS`) or the page layout |
| `types.ts` | The data passed from `extract.ts` to `render.ts`. | add a field or a new kind of export |

## Limitations

- **Types are shown as written in the source**, not computed. This keeps them
  readable and hot reload fast.
- **Props from other packages are only named**, e.g. "Also accepts all props of
  `TypographyProps`", since those types can have hundreds of props.
- **Links to `https://arclockproject.org/docs/` are dropped.** They exist for IDE
  hovers only.
- **One `*` per path** in the module config.

## Testing changes

Run `pnpm run docs:build` from the repo root, then read the changed pages in
`docs/docs/api/`. The build fails on broken links between pages.

## Problems

If the generated pages look wrong or the plugin breaks, [open an issue](https://github.com/ArcLockProject/mono/issues/new) and mention `@ArturWagnerUK`.
