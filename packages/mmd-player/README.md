<div align="center">

# @arclockproject/mmd-player

A full MMD (MikuMikuDance) loader and player for React, built on [Babylon.js](https://www.babylonjs.com) and [babylon-mmd](https://github.com/noname0310/babylon-mmd).

[![npm](https://img.shields.io/npm/v/@arclockproject/mmd-player)](https://www.npmjs.com/package/@arclockproject/mmd-player)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/ArcLockProject/mono/blob/dev/LICENSE)

**[Guide](https://arclockproject.org/docs/mmd-player)** · **[API](https://arclockproject.org/docs/api/mmd-player/component)** · **[GitHub](https://github.com/ArcLockProject/mono/tree/dev/packages/mmd-player)**

</div>

## Installation

```sh
npm install @arclockproject/mmd-player
```

It also needs React and MUI:

```sh
npm install react react-dom @mui/material @mui/icons-material @mui/x-tree-view @emotion/react @emotion/styled wanakana
```

Babylon.js and babylon-mmd are installed with the package.

## Usage

```tsx
import MMD from "@arclockproject/mmd-player";

<MMD
  maxWidth="1280px"
  maxHeight="720px"
  presets={() => [/* songs, motions and models to load */]}
  rawMMDDetails={() => ({ pmd: [], pmx: [], vmd: [] })}
/>;
```

See the [guide](https://arclockproject.org/docs/mmd-player/component) for a full working example with a model, motion, camera and music.

Only one `MMD` player can be on a page at a time.

## Contributing

Please see [CONTRIBUTING.md](https://github.com/ArcLockProject/mono/blob/dev/CONTRIBUTING.md) for contribution guidelines.

## License

This project is licensed under the terms of the [MIT License](https://github.com/ArcLockProject/mono/blob/dev/LICENSE).
