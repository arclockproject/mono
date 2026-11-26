## 2.2.0 (2026-11-26)

### ✨ Features

- Added onError and hardened to Firewall, also deprecated internal type exports. ([#21](https://github.com/arclockproject/mono/pull/21)) @arturwagneruk
- Added buildTyped, caseInsensitive to Search, and expanded the Search guide. ([#20](https://github.com/arclockproject/mono/pull/20)) @arturwagneruk

## 2.1.0 (2026-11-23)

### ✨ Features

- Improved FileBrowser UI and added sort, onItemClick, contextMenu, getIcon and renderItem. ([#19](https://github.com/arclockproject/mono/pull/19)) @arturwagneruk
- Added subtitles from inside MKV and MP4 videos, selectable subtitle text and a subtitles button to Player. ([#17](https://github.com/arclockproject/mono/pull/17)) @arturwagneruk

### 🐛 Bug Fixes

- Fixed Time.parseTimeDuration not showing --:-- for the Player's unknown duration. ([#17](https://github.com/arclockproject/mono/pull/17)) @arturwagneruk

## 2.0.0 (2026-11-22)

### ⚠️ Breaking Changes

- Removed PSD support from Image, and fixed video controls showing only while enableMovement is on. ([#16](https://github.com/arclockproject/mono/pull/16)) @arturwagneruk

### ✨ Features

- Added Worker, a queue that runs an async task for each item, a few at a time, with progress and cancelling. ([#16](https://github.com/arclockproject/mono/pull/16)) @arturwagneruk
- Added Search, to turn search text like cat -dog likes>=10 into a safe SQL query with sorting and paging. ([#16](https://github.com/arclockproject/mono/pull/16)) @arturwagneruk
- Added Firewall, login and permission checks for an Express server. ([#16](https://github.com/arclockproject/mono/pull/16)) @arturwagneruk
- PSDViewer now redraws the image from its layers with blend modes, opacity, masks, clipping and groups. ([#16](https://github.com/arclockproject/mono/pull/16)) @arturwagneruk
- Added Reader, a book reader with single page, double page and scroll views, zoom and bookmarks. ([#16](https://github.com/arclockproject/mono/pull/16)) @arturwagneruk
- Added GalleryBrowser, a paged gallery of images and videos with fullscreen, drag and zoom, and bookmarks. ([#16](https://github.com/arclockproject/mono/pull/16)) @arturwagneruk
- Added AudioMixer, to play several audio tracks at once with their own volume, pan and start and end time. ([#16](https://github.com/arclockproject/mono/pull/16)) @arturwagneruk
- Added subtitle files, video filters, audio effects and 180°, 360° and 3D video to Player. ([#16](https://github.com/arclockproject/mono/pull/16)) @arturwagneruk
- Added Text, with line clamping and typing. Deprecated AppearingText, LimitLines1 and LimitLines2. ([#16](https://github.com/arclockproject/mono/pull/16)) @arturwagneruk
- Added defaultTransform and onTransformChange to Movable. Zooming keeps the point under the cursor or pinch in place. ([#16](https://github.com/arclockproject/mono/pull/16)) @arturwagneruk
- Added Extension, to find which file extension a URL has on the server. ([#16](https://github.com/arclockproject/mono/pull/16)) @arturwagneruk
- Added LocalStorage, to read and write JSON in localStorage, with a useLocalStorageState hook. ([#16](https://github.com/arclockproject/mono/pull/16)) @arturwagneruk
- Added instance limit option to AudioManager ([#9](https://github.com/arclockproject/mono/pull/9)) @arturwagneruk

### 🐛 Bug Fixes

- Fixed require() loading the ES module build. CommonJS builds are now included. ([#16](https://github.com/arclockproject/mono/pull/16)) @arturwagneruk
- Fixed mobile touch drag in Window. ([#11](https://github.com/arclockproject/mono/pull/11)) @arturwagneruk
- Fixed fullscreen opening same Player when several are on page. ([#10](https://github.com/arclockproject/mono/pull/10)) @arturwagneruk

### 📖 Documentation

- Updated the README with the new components and libraries, and documented Window's spawn fields. ([#16](https://github.com/arclockproject/mono/pull/16)) @arturwagneruk

### 🎨 Styles

- Formatted code with Biome. ([#16](https://github.com/arclockproject/mono/pull/16)) @arturwagneruk

## 1.2.1 (2026-11-01)

### 📖 Documentation

- Add JSDoc to library and component exports. ([#6](https://github.com/arclockproject/mono/pull/6)) @arturwagneruk

## 1.2.0

### Features

#### Library/AudioInstant

- Created to allow Audio to be fired instantly without awaiting it from the HTML Audio element.

### Bug Fixes

#### Components/Movable

- On move/zoom state reset, properly fire `updateTransformDiv()` to sync html to current state.

## 1.1.0

### Features

#### Components/Movable

- Moving functionality from Components/Image extracted to contained component.
- Movable can enable/disable zoom and movement separately.

### Bug Fixes

#### Components/FileBrowser

- base now resolved instead of being ignored.
- https:// now resolves properly when used along / paths
- prevent paths ending with / resolving to a click.
- Correctly auto open folders past 1/2 depth.
- Allow file nav to handle overflow x
- Allow files to handle overflow y

## 1.0.0

### Breaking Change

- Package renamed from @arturwagner/common to @arclockproject/common
- @arclockproject/common/components/MMD moved to @arclockproject/mmd-player
- @arclockproject/common/components/FileBrowser no longer depends on @arclockproject/common/components/MMD

### Features

- Added require as export option to allow the usage of `require("@arclockproject/common/...")`

## 0.1.2

### Bug Fixes

- Moved deps, made deps support wider and changed build to production &nbsp;-&nbsp; by @ArturWagnerBusiness [<samp>(6b4f9)</samp>](https://github.com/ArcLockProject/mono/commit/6b4f989)
- C/Image Spread & telemetry not disabled Components/Image now can scale properly in edge cases. Telemetry disabled as per bun documentation. &nbsp;-&nbsp; by @ArturWagnerBusiness [<samp>(ae565)</samp>](https://github.com/ArcLockProject/mono/commit/ae56525)

## 0.1.1

- fix: Moved deps, made deps support wider and changed build to production

## 0.1.0

- Switched runner node to bun.
- Merged entire repo with template for bunup.
- Split Mono-File for C/Player into individual files.
- Split Mono-File for C/Mmd into individual files.
- Added mandatory type returns for exports
- Fixed linting based on biome's recommended setting.

## 0.0.6

- Update Storybook to 10.1.10
- Add CHANGELOG.md
- Migrate LICENSE from MIT to AGPLv3
- Updated dependencies with vulnerability alerts

## 0.0.5

- L/Array - Added error check for removal
- L/AStar - Allowed Node2D and Map2D to be overwritten
- L/Audio - Restored original working solution.
- L/Random - Seed can be passed to a new instance.
- C/Player & C/FileBrowser - Updated imports from relative to @
- C/Mmd - Fixed unknown type in

## 0.0.4

- Added Code and Story for Components/Window

## 0.0.3

- Removed dependency @babylonjs/inspector
- Added dependency @webtoon/psd
- Added Code and Story for Components/Image
- Added Code for Components/PSDViewer
- Added short note for Roadmap
- Mentioned limitation of Component/MMD in docs
- Fixed Component/MMD Story having broken paths

## 0.0.2

- Renamed LICENCE to LICENSE
- Moved main package.json install to src
- Updated Install documentation at /src/docs/2-install.mdx
- Added dependency cost for each import.
- Added FileBrowser Story
- Added MMD as default import of component/Mmd
- Fixed MiniPlayer in component/Player ignoring the current
- pause/play state from context.

## 0.0.1

- Initial Release
