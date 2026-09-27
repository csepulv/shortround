# @shortround/core

## 0.2.3

### Patch Changes

- Hotfix for bugs found in the 2026-09 audit.
  - The sidekick keeps its state when a parent component re-renders.
  - Keyboard shortcuts use the latest callbacks and are removed on unmount.
  - Validation messages clear once the input is valid, and on dispatch.
  - An action that returns nothing, or selecting a disabled intention, no longer throws.
  - Going back no longer mutates the previous history.
  - `setSize` rejects an unknown size with a clear error.
  - The intention list height CSS is valid again.
  - TypeScript declarations corrected: `dispatchedStack` entries, optional `ThemeProvider`, `setAnchorOrigin`.

## 0.2.2

### Minor Changes

- Allow some style customizations (use muiName)

## 0.2.1

### Patch Changes

- Added simple docs and exported types.

## 0.2.0

### Minor Changes

- Added simple docs and typedefs

## 0.1.0

### Minor Changes

- Initial Release (WIP)
