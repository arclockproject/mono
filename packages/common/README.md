<div align="center">

# @arclockproject/common

Reusable React components and small library utilities.

[![npm](https://img.shields.io/npm/v/@arclockproject/common)](https://www.npmjs.com/package/@arclockproject/common)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/ArcLockProject/mono/blob/dev/LICENSE)

**[Guide](https://arclockproject.org/docs/common)** · **[API](https://arclockproject.org/docs/api/common)** · **[GitHub](https://github.com/ArcLockProject/mono/tree/dev/packages/common)**

</div>

## Installation

```sh
npm install @arclockproject/common
```

The libraries have no dependencies. The components need React and MUI:

```sh
npm install react react-dom @mui/material @emotion/react @emotion/styled
```

Some components need a little more:

| Component | Also install |
|---|---|
| `Player` | `@mui/icons-material` `lodash` |
| `PSDViewer` | `@webtoon/psd` |

## Usage

Import each library or component from its own path:

```tsx
import Time from "@arclockproject/common/library/Time";
import Random from "@arclockproject/common/library/Random";
import Window from "@arclockproject/common/components/Window";

Time.parseTimeDuration(3605); // "1:00:05"
Random.rangeInt(0, 6) + 1; // dice roll
```

## What's included

### Library

| Name | Description |
|---|---|
| [`Array`](https://arclockproject.org/docs/common/library/Array) | Helpers that change an array in place. |
| [`AStar`](https://arclockproject.org/docs/common/library/AStar) | A 2D grid with A* pathfinding. |
| [`Audio`](https://arclockproject.org/docs/common/library/Audio) | Plays sounds with `<audio>` elements, with fade in and out. |
| [`AudioInstant`](https://arclockproject.org/docs/common/library/AudioInstant) | Plays sounds with the Web Audio API, with no delay after loading. |
| [`EventManager`](https://arclockproject.org/docs/common/library/EventManager) | A typed event emitter. |
| [`Random`](https://arclockproject.org/docs/common/library/Random) | Random helpers that can be seeded. |
| [`Time`](https://arclockproject.org/docs/common/library/Time) | Formats durations and elapsed time as text. |

### Components

| Name | Description |
|---|---|
| [`AppearingText`](https://arclockproject.org/docs/common/components/AppearingText) | Text that types itself out one character at a time. |
| [`FileBrowser`](https://arclockproject.org/docs/common/components/FileBrowser) | Browse a list of file paths as folders and files. |
| [`Image`](https://arclockproject.org/docs/common/components/Image) | Shows an image, video or PSD that can be dragged and zoomed. |
| [`Movable`](https://arclockproject.org/docs/common/components/Movable) | A container whose content can be dragged and zoomed. |
| [`Player`](https://arclockproject.org/docs/common/components/Player) | Video player, mini player and audio player that share playback state. |
| [`PSDViewer`](https://arclockproject.org/docs/common/components/PSDViewer) | Shows a Photoshop (`.psd`) file. |
| [`Text`](https://arclockproject.org/docs/common/components/Text) | Text cut off after one or two lines. |
| [`Window`](https://arclockproject.org/docs/common/components/Window) | A floating desktop-style window. |

## Contributing

Please see [CONTRIBUTING.md](https://github.com/ArcLockProject/mono/blob/dev/CONTRIBUTING.md) for contribution guidelines.

## License

This project is licensed under the terms of the [MIT License](https://github.com/ArcLockProject/mono/blob/dev/LICENSE).
