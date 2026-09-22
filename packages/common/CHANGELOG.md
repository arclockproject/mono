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
