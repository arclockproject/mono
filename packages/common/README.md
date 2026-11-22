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
| `AudioMixer` | `@mui/icons-material` |
| `GalleryBrowser` | `@mui/icons-material` |
| `Player` | `@mui/icons-material` `lodash` |
| `PSDViewer` | `@webtoon/psd` |
| `Reader` | `@mui/icons-material` `react-virtuoso` |

## Usage

Import each library or component from its own path:

```tsx
import Time from "@arclockproject/common/library/Time";
import Random from "@arclockproject/common/library/Random";
import Window from "@arclockproject/common/components/Window";

Time.parseTimeDuration(3605); // "1:00:05"
Random.rangeInt(0, 6) + 1; // dice roll
```

CommonJS works too, with the default export under `.default`:

```js
const Time = require("@arclockproject/common/library/Time").default;
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
| [`Extension`](https://arclockproject.org/docs/common/library/Extension) | Finds out which file extension a URL has, by trying to load it. |
| [`Firewall`](https://arclockproject.org/docs/common/library/Firewall) | Login and permission checks for an Express server. |
| [`LocalStorage`](https://arclockproject.org/docs/common/library/LocalStorage) | JSON in `localStorage`, and a `useState` that is saved there. |
| [`Random`](https://arclockproject.org/docs/common/library/Random) | Random helpers that can be seeded. |
| [`Search`](https://arclockproject.org/docs/common/library/Search) | Turns search text into a safe SQL query, with sorting and paging. |
| [`Time`](https://arclockproject.org/docs/common/library/Time) | Formats durations and elapsed time as text. |
| [`Worker`](https://arclockproject.org/docs/common/library/Worker) | A queue that runs an async task per item, a few at a time. |

### Components

| Name | Description |
|---|---|
| [`AppearingText`](https://arclockproject.org/docs/common/components/AppearingText) | Deprecated. Use `Text` with `speed` instead. |
| [`AudioMixer`](https://arclockproject.org/docs/common/components/AudioMixer) | Plays several audio tracks at once, each with its own volume and pan. |
| [`FileBrowser`](https://arclockproject.org/docs/common/components/FileBrowser) | Browse a list of file paths as folders and files. |
| [`GalleryBrowser`](https://arclockproject.org/docs/common/components/GalleryBrowser) | A paged gallery of images and videos with fullscreen, zoom and bookmarks. |
| [`Image`](https://arclockproject.org/docs/common/components/Image) | Shows an image or video that can be dragged and zoomed. |
| [`Movable`](https://arclockproject.org/docs/common/components/Movable) | A container whose content can be dragged and zoomed. |
| [`Player`](https://arclockproject.org/docs/common/components/Player) | Video player, mini player and audio player that share playback state. |
| [`PSDViewer`](https://arclockproject.org/docs/common/components/PSDViewer) | Shows a Photoshop (`.psd`) file. |
| [`Reader`](https://arclockproject.org/docs/common/components/Reader) | A book reader with single page, double page and scroll views. |
| [`Text`](https://arclockproject.org/docs/common/components/Text) | Text that can be cut off after a number of lines and can type itself out. |
| [`Window`](https://arclockproject.org/docs/common/components/Window) | A floating desktop-style window. |

## Contributing

Please see [CONTRIBUTING.md](https://github.com/ArcLockProject/mono/blob/dev/CONTRIBUTING.md) for contribution guidelines.

## License

This project is licensed under the terms of the [MIT License](https://github.com/ArcLockProject/mono/blob/dev/LICENSE).
