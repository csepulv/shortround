# @shortround/core

## 0.3.0

### Minor Changes

- 5f0c592: Behaviour moves into core; theme slots only draw. Core now renders cmdk's input and rows (keyboard and click
  selection, disabled rows, ids as values, the controlled input), so a theme imports no cmdk. The sidekick is a
  non-modal dialog: focus moves to its input on open and returns on close; after a row is clicked, focus goes back to
  the input; Cmd/Ctrl+K opens it from anywhere, or brings focus back into it when it is already open; it is announced as
  a dialog named by its title. Core exports `ControlLabels`, the control bar's accessible names, passed to ControlBar as
  `labels`.

  **Escape:** closes the sidekick only when pressed inside it (before, Escape anywhere on the page closed it). Content
  inside the sidekick sees Escape first and can keep it with `event.preventDefault()`. `installKeyboardShortcuts={false}`
  now turns off only the global Cmd/Ctrl+K; Escape inside the sidekick still closes it (before, the flag turned off
  both).

  **Breaking for hand-built themes** (`@shortround/mui` is updated): `IntentionPalette.Input` receives `input` (core's
  input element, to place) instead of `inputValue` and `onInputChange`; `IntentionPalette.Item` receives `isSelected`
  instead of `onSelect` and draws inside core's row; `Sidekick.ControlBar` receives `labels` and must apply them as its
  controls' accessible names. The input's placeholder is core's.

  **MUI:** no longer depends on cmdk. Its control bar's controls are named "Close", "Move palette", "Compact", "Medium"
  and "Full" (the size buttons were "compact", "medium", "full", so a test finding them by name needs the new
  capitals), and the size group "Palette size" (was "sidekick size"). A row no longer carries the class
  `intention-item`. The list no longer shows a focus ring after a mouse click.

- bcfb9c6: Rows from typed text. A list can come with a resolver that turns the typed text into extra rows, shown above the
  fuzzy matches and selectable like any other row: `resolveDefaultInput` on `ShortRoundSidekick` for the default list,
  `resolveInput` on an action result for the list it brings. Optional; without one the palette behaves as before.

  Memoize the resolver, like `defaultIntentions`: a new function resets the list and the input. A resolver runs on
  every render while text is typed, should be quick and synchronous, and its errors are logged and show no rows.

- b31f345: Palette friction found in the junkdrawer integration.
  - **Behaviour change:** the sidecar stays open after a result without a renderer. A result closes it with
    `sideEffects: { closeSidecar: true }`. Cancel, and Back to the start, still close it.
  - Selecting a disabled intention, or one that is invalid for the current input, no longer runs silently or resets
    the palette. `dispatch` validates at selection time, shows the reason on the input's message line, keeps the
    input, and returns `{ isRejected: true }`.
  - `ShortRoundSidekick` accepts `onClose`, called after the sidekick closes, whatever closed it.

- 5f5d6db: Choose the theme once, at the app's root. Core adds `ShortRoundProvider` (`<ShortRoundProvider theme={…}>`) and
  `useShortRoundToast()`. Below the provider, `ShortRoundSidekick` needs no `SidekickComponents` or `showToast`, and
  app code imports only `@shortround/core`. A theme is `{ components, Toast }`; the provider holds the toast's state,
  and a nested provider wins for its subtree. The `SidekickComponents` and `showToast` props still work and override
  the provider; without either a prop or a provider, `ShortRoundSidekick` now throws an error that names
  `ShortRoundProvider`. The unused `ThemeProvider` slot is removed from the `SidekickComponents` type; TypeScript users
  who set it on an object typed `SidekickComponents` must remove it (nothing ever read it). MUI adds
  `muiTheme`, whose toast hides itself after 4 seconds; `MuiSidekickComponents`, `MuiToastProvider` and `useMuiToast`
  are unchanged, and MUI's toast carries `data-testid="shortround-toast"`.

### Patch Changes

- 2711c59: The theme contract, written down. `SidekickComponents` now documents what each slot must do (JSDoc), and `Intention`
  types `subtitle` (shown by themes) and `keywords`. MUI's slots carry the contract's test hooks (`data-testid`:
  `shortround-input`, `shortround-item-<id>`, `shortround-no-matches`, `shortround-close`, `shortround-size-<size>`,
  `shortround-anchor`), so tests can find the palette's controls; no behaviour change.

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
