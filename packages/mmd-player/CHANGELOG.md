## 1.0.0 (2026-11-22)

### ⚠️ Breaking Changes

- Fixed MMD Players sharing state issues. ([#12](https://github.com/arclockproject/mono/pull/12)) @arturwagneruk

### ✨ Features

- Redesigned the controls with a playback bar, side panels, an option wheel and keyboard shortcuts. ([#16](https://github.com/arclockproject/mono/pull/16)) @arturwagneruk

### 🐛 Bug Fixes

- Fixed loading a dance motion removing the character's part motions. ([#16](https://github.com/arclockproject/mono/pull/16)) @arturwagneruk
- Fixed the scene details dialog picking up the page's code styles. ([#16](https://github.com/arclockproject/mono/pull/16)) @arturwagneruk
- Added MMDUpdatePreview stud with a notice to the migration docs. ([#12](https://github.com/arclockproject/mono/pull/12)) @arturwagneruk
- Fixed text fields not accepting user input. ([#12](https://github.com/arclockproject/mono/pull/12)) @arturwagneruk

### 🔧 Chores

- Removed unused dev dependencies and the vite script. ([#16](https://github.com/arclockproject/mono/pull/16)) @arturwagneruk

## 0.1.2 (2026-11-01)

### 📖 Documentation

- Add JSDoc to the MMD component. ([#6](https://github.com/arclockproject/mono/pull/6)) @arturwagneruk

## 0.1.1

### Chore

- Version bump due to NPM registry verson conflict.

## 0.1.0

### Features

- Added prop `noDebug` to hide debug buttons
- Allowed switching between 3 camera types on both desktop and mobile play.

### Chore (UI)

- Frame offsets text fields moved into ControlsDrawer (Left) to not take screen space.
- UI adjusted to ensure list items scroll in both low width/height scenario
- Enabled Mobile mode instead for MorphDrawer and shifter uk down to accommodate for it.
- Removed background from Kill button but left it on main screen.
- Improved style for ControlsDrawer and added description for interface.

### Bug Fixes

- Moved 'Swapped AspectRatio' higher to make it possible to click on very low mobile resolutions
- Allowed scrolling withing MMDPlayer to allow for user to actually see all buttons.
- Fixed Customize tab header not wrapping.
- Fixed Start buttons incorrect zindex (document order).

## 0.0.1

### Breaking Change

- @arclockproject/common/components/MMD moved to @arclockproject/mmd-player
