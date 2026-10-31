<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/favicon_dark@4x.png">
  <img src="./assets/favicon_light@4x.png" alt="ArcLock Project logo" width="64" height="64">
</picture>

# ArcLock Project

An easy solution for difficult problems.

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![@arclockproject/common](https://img.shields.io/npm/v/@arclockproject/common?label=%40arclockproject%2Fcommon)](https://www.npmjs.com/package/@arclockproject/common)
[![@arclockproject/mmd-player](https://img.shields.io/npm/v/@arclockproject/mmd-player?label=%40arclockproject%2Fmmd-player)](https://www.npmjs.com/package/@arclockproject/mmd-player)

**[Documentation](https://arclockproject.org)** · **[Contributing](./CONTRIBUTING.md)** · **[Issues](https://github.com/ArcLockProject/mono/issues)**

</div>

## Packages

This monorepo contains the following packages:

| Package | Description | Docs |
|---|---|---|
| [`@arclockproject/common`](./packages/common) | Reusable React components and library utilities. | [Guide](https://arclockproject.org/docs/common) · [API](https://arclockproject.org/docs/api/common) |
| [`@arclockproject/mmd-player`](./packages/mmd-player) | Full MMD loader and player. | [Guide](https://arclockproject.org/docs/mmd-player) · [API](https://arclockproject.org/docs/api/mmd-player/component) |

## Installation

```sh
npm install @arclockproject/common
npm install @arclockproject/mmd-player
```

## Usage

```tsx
import Time from "@arclockproject/common/library/Time";

Time.parseTimeDuration(3605); // "1:00:05"
```

See the [documentation](https://arclockproject.org) for live examples of every component and library.

## Development

Requires Node.js 20 and [pnpm](https://pnpm.io).

```sh
git clone https://github.com/ArcLockProject/mono.git
cd mono
pnpm install
pnpm run dev
```

`pnpm run dev` builds the packages and starts the docs site at http://localhost:3000.

| Command | Description |
|---|---|
| `pnpm run dev` | Build the packages, then start the docs site. |
| `pnpm run packages:build` | Build all packages. |
| `pnpm run docs:dev` | Start the docs site only. |
| `pnpm run docs:build` | Build the docs site. |

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for the workflow and commit conventions.

## License

This project is licensed under the terms of the [MIT License](./LICENSE).
