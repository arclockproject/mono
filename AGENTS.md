# Notes for AI assistants

## Setup

- Run `nvm use 20` before any `pnpm`/`node` command.
- `pnpm run dev` builds the packages, then starts the docs site on port 3000.

## API docs come from JSDoc

The pages under **API** in the docs sidebar are generated from JSDoc by
`docs/plugins/api-docs`. It runs on `docusaurus start`/`build` and regenerates
when a package source file changes.

- Generated pages: `docs/docs/api/**/*.mdx`. They are gitignored, so **never edit
  them**. Edit the JSDoc in `packages/` instead.
- The `_category_.json` files in `docs/docs/api/` are committed and set the
  sidebar labels and order.
- Hand-written guide pages live in `docs/docs/common/...` and `docs/docs/mmd-player/...`.
  Each API page links to its guide page automatically, if the guide page exists.

What gets documented: every export of these entry files, plus the local types
they use but don't export (shown as "not exported, used by the API above").

| Package | Entry files | API page |
|---|---|---|
| `@arclockproject/common` | `src/library/*/index.ts`, `src/components/*/index.tsx` | `docs/api/common/{library,components}/<Name>` |
| `@arclockproject/mmd-player` | `src/index.tsx` | `docs/api/mmd-player/component` |

New folders matching those patterns get a page automatically. The config is in
`docs/docusaurus.config.ts`.

## Writing JSDoc

### Style

- Short, plain sentences. Say what it does and what the reader needs to know to
  use it (side effects, units, what happens at the edges). Don't repeat the type.
- Describe what the code **does today**. If that looks like a bug, don't document
  the bug as intended and don't change the code. Write neutral docs and tell the
  user about the bug.
- A prop or option that does nothing gets `Not used yet.`
- Only comments change when documenting. The one exception is splitting a
  one-line inline type over several lines so its fields can have comments, e.g.
  `data?: { gradual?: boolean }`. Check with
  `git diff -U0 | grep -E '^[+-]' | grep -vE '^[+-]\s*(\*|/\*\*|\*/|//)'`.

### Where the comment goes

- Directly above the declaration. A `// biome-ignore` line in between is fine.
- **Object of functions** (like `Time`): one comment on the object, one per function.
- **Class:** on the class, each public method and property, and the constructor.
  Constructor `@param` text is reused for `constructor(public x: number)`
  properties, so don't write it twice.
- **Overloads:** on the first overload.
- **Props and option objects:** a `/** … */` on each field *inside* the type, not
  as `@param` on the component. Inline object types (e.g. `options?: { loop?: boolean }`)
  render as nested lists, so comment each field.
- **Callback props:** may have their own `@param`/`@returns`. They render under the prop.
- **Internal types used by the API** (e.g. Player's `settings`): document them too.
  They get their own section.

### Tags

| Tag | Use |
|---|---|
| `@param name text` | Every parameter that isn't obvious. |
| `@returns text` | What comes back, including `null`/`undefined` cases. |
| `@default value` | Default of a prop or field, e.g. `@default 100`, `@default { x: 100, y: 100 }`. |
| `@example` | 1–4 lines, **no code fence**, each line prefixed with ` * `. Use `// result` comments. Must be valid TSX and correct for the current code. |
| `@see` | On main exports only (see below). External links (e.g. Wikipedia) are kept. |
| `@deprecated text` | Shows a warning box on exports and methods, and a **Deprecated.** note on props. |
| `@internal` / `@hidden` / `@ignore` | Leaves the declaration out of the docs. |
| `@remarks` | Appended to the description. |

### Links: `Guide | API`

Every main export (component, class, object, hook) gets one `@see` line with
both links, **no trailing `/`**, and no `#anchor` on the API link:

```ts
 * @see {@link https://arclockproject.org/docs/common/components/Image Guide} | {@link https://arclockproject.org/docs/api/common/components/Image API}
```

- Guide links may have an anchor that exists on the guide page, e.g. `…/library/Audio#usage`.
- Links to `https://arclockproject.org/docs/` are for IDE hovers only, so the
  generator drops them from the website. Don't put important text inside them.
- Per-method `@see` links back to the docs aren't needed.

### Examples: JSDoc or guide page?

- **JSDoc `@example`:** a few lines showing input → output. It appears in IDE
  hovers and on the API page.
- **Guide page:** live demos (` ```tsx live `), multi-step setups, how parts fit
  together, and choices between options. Don't copy the same example into both places.

### Example

```ts
/**
 * Formats seconds as a timestamp, like a video player shows: `1:00:05`, `2:00` or `0:06`.
 *
 * @see {@link https://arclockproject.org/docs/common/library/Time#usage Guide} | {@link https://arclockproject.org/docs/api/common/library/Time API}
 * @param time Seconds. A string is read with `parseInt()`, so decimals are dropped.
 * @returns `H:MM:SS` or `M:SS`, or `null` if `time` is not a number.
 * @example
 * Time.parseTimeDuration(3605); // "1:00:05"
 * Time.parseTimeDuration("foo"); // null
 */
```

## Guide pages

Library guide pages (`docs/docs/common/library/*`) use this structure (see
`docs/docs/common/library/Random/index.mdx`):

```mdx
---
title: Name
---

## Dependencies {#dependencies}

## Usage {#usage}
```

Component guide pages (`docs/docs/common/components/*`) still use an older
format: a dependency list, then live demos. Leave them as they are unless asked.

Don't add API sections to guide pages. The API section is generated.

## Checking your work

1. `npx tsc --noEmit` in the changed package.
2. `pnpm run docs:build` (from the repo root) must pass. It fails on broken page
   links. Broken `#anchors` only warn, so check the build output for warnings too.
3. Open the generated page in `docs/docs/api/` and check that it reads well.
