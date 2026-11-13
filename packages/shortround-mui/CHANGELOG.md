# @shortround/mui

## 0.6.0

### Minor Changes

- `Chat` slots for `@shortround/chat`'s `<IntentionChat>`, on `MuiSidekickComponents` and so on `muiTheme`: a
  transcript (messages, Markdown text, the intentions a line ran, a model's tool runs, errors) and a composer (the
  input with its line hints, and the rows above it). With `muiTheme` at the root, `<IntentionChat>` needs no other
  setup. This package doesn't depend on `@shortround/chat`.
- Types: `MuiSidekickComponents` includes `Chat`, and `muiTheme` is typed with its own components, so reading a group
  off it (`muiTheme.components.Sidekick`) needs no check under `strict`.
- Takes `@shortround/core` and `@shortround/react` `^0.6.0` as peers.

## 0.5.0

### Breaking Changes

- Takes `@shortround/core` and the new `@shortround/react` as peers, `^0.5.0` (core was a dependency).
  Install all three, at one version. The theme draws exactly as before. See MIGRATING.md, 0.5.0.

### Minor Changes

- Accepts React 19 as well as 18: the `react` peer is `^18.2.0 || ^19.0.0`. `@mui/material` 5, 6, 7 and 9 are
  accepted, as before; on React 19, MUI itself needs 5.16.8 or later.
- Colours the palette input's line hints (`@shortround/react` 0.5.0) from the theme's palette: verbs primary, hints
  secondary, params info, values success, unread words faded, a broken word with an error underline, the ghost faint.
  Colour only, so the words stay under the caret.

### Patch Changes

- Uses the app's React JSX runtime (`react/jsx-runtime`) instead of a bundled copy of React 18's, which would break
  under another React. The package ships its `CHANGELOG.md`.

## 0.4.0

### Minor Changes

- 34929b7: MUI draws the icon ShortRound chooses, and its own icons look as intended.
  - **Behaviour change:** a name MUI doesn't know shows a question mark; an intention with no `icon` shows none, and
    its row keeps the space. Both used to show the search icon.
  - Back and Cancel have their own icons (they showed the search icon).
  - Icons render at 18px in the theme's `action.active` colour. Before, MUI's `sx` was passed to Lucide, which ignored
    it, so icons were 24px in the text colour.
  - An icon sits level with its title: the small gap below a row's title moved above its subtitle, so single-line rows
    no longer push the icon down.
  - MUI's icons are on `MuiSidekickComponents.icons`, so apps passing `SidekickComponents` directly keep them.
  - `@mui/icons-material` is no longer a peer dependency (it was never used).

### Patch Changes

- Updated dependencies [7391cca]
- Updated dependencies [53937ec]
- Updated dependencies [34929b7]
- Updated dependencies [699cf3e]
- Updated dependencies [ca97237]
  - @shortround/core@0.4.0

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

- 63a2fab: The sidekick follows the app's MUI theme more faithfully; it looks slightly different.
  - Corners use the theme's `shape.borderRadius` once. Before, it was applied twice (a radius of 4 gave 16px corners).
  - The frame and the control bar have an opaque `background.paper` background, where they had a faint tint of the
    primary colour.
  - The title is `text.primary`; it was `palette.surfaceHeader.contrastText`.
  - The control bar has horizontal padding (its `px`/`py` were ignored by `styled()`).

- 2711c59: The theme contract, written down. `SidekickComponents` now documents what each slot must do (JSDoc), and `Intention`
  types `subtitle` (shown by themes) and `keywords`. MUI's slots carry the contract's test hooks (`data-testid`:
  `shortround-input`, `shortround-item-<id>`, `shortround-no-matches`, `shortround-close`, `shortround-size-<size>`,
  `shortround-anchor`), so tests can find the palette's controls; no behaviour change.
- Updated dependencies [5f0c592]
- Updated dependencies [bcfb9c6]
- Updated dependencies [b31f345]
- Updated dependencies [2711c59]
- Updated dependencies [5f5d6db]
  - @shortround/core@0.3.0

## 0.2.3

### Patch Changes

- Hotfix for bugs found in the 2026-09 audit.
  - The palette no longer crashes when an intention shows a validation message.
  - Clicking the already-selected size no longer crashes the sidekick.
  - Anchor-position icons use lucide-react and cover all nine positions; `react-icons` is no longer a dependency.
  - Removed a stray `;` rendered in the palette frame.
  - Ships TypeScript declarations.
  - README toast examples fixed.

- Updated dependencies
  - @shortround/core@0.2.3

## 0.2.2

### Minor Changes

- Allow some style customizations (use muiName)

### Patch Changes

- Updated dependencies
  - @shortround/core@0.2.2

## 0.2.1

### Patch Changes

- Added simple docs and exported types.
- Updated dependencies
  - @shortround/core@0.2.1

## 0.2.0

### Minor Changes

- Added simple docs and typedefs

### Patch Changes

- Updated dependencies
  - @shortround/core@0.2.0

## 0.1.0

### Minor Changes

- Initial Release (WIP)

### Patch Changes

- Updated dependencies
  - @shortround/core@0.1.0
