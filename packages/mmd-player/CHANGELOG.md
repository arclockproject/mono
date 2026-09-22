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
