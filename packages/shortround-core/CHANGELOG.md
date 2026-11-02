# @shortround/core

## 0.4.0

### Minor Changes

- 53937ec: Rows after the matches, such as "Send as chat" for text no command matches.
  - `ShortRoundSidekick` (and `useShortRound`) take `resolveDefaultFallbackInput(text, { matches }) → intentions` for the
    default list; an action's result brings its own as `resolveFallbackInput`, or none. Start and Cancel restore the
    default; Back restores the earlier list's.
  - It's called while text is typed (not on a blank input, not during a typed-text step), with `matches` (typed-line
    rows, then fuzzy matches); its rows can be chosen, and come last when their `group` is one no match uses (a row
    in a match's group, or with no group beside ungrouped matches, is drawn at the end of that group). A row whose id is already listed is left out; a
    fallback that throws is logged and adds no rows.
  - Type: `ResolveFallbackInput`.

- 34929b7: Apps can give ShortRound their own icons, from any library.
  - `ShortRoundProvider` takes `icons`, an `IconRegistry`: `Icon` (a component that draws any name), `names` (an
    intention's icon name → the name `Icon` or the theme knows) and `intentions` (an icon for one intention, by id).
  - Core chooses each row's icon and passes it to the theme's `Item` as `icon`: the intention's override; none when the
    intention has no `icon`; for Back and Cancel, the theme's; the name through `names` and `Icon`; the theme's icon for
    the name; the theme's placeholder (`unknown`).
  - **For theme authors:** `Item` gets `icon` and should draw it, keeping its space when there is none; a theme's own
    icons go on `SidekickComponents.icons` (with `back`, `cancel` and `unknown`). `@shortround/conformance` checks that
    `Item` shows `icon` (`item-icon`).

- 699cf3e: Back and Cancel stay at the top without taking the first Enter; the palette opens where you name; core loads outside
  a browser.
  - **Behaviour change:** Back and Cancel form their own group, **Navigate**, drawn at the top of the list but last for
    the keyboard. After every new list the highlight is on the first enabled row of your own, so the first Enter in a
    picker or a typed-text prompt runs it; before, it ran Cancel or Back. Tests that pressed ArrowDown past Back now
    land on Back instead. `makeRevertIntentionsFor` returns rows in the `Navigate` group (was `Actions`), and an app
    group named `Actions` no longer shares a group with them.
  - **Behaviour change:** arrow keys wrap around at either end of every list (cmdk's `loop`); ArrowUp from the first
    row reaches Back and Cancel.
  - **For tests and themes:** Back and Cancel come last in the DOM (CSS draws them first), so code that takes rows by
    position gets the app's first row; and core wraps the groups in one element inside `[cmdk-list]`, so a style that
    selects `[cmdk-list] > [cmdk-group]` no longer matches.
  - When a Navigate row is highlighted, the whole group, heading included, scrolls into view.
  - **Behaviour change:** anchor positions are CSS alone. `top` and `bottom` are centred horizontally (they were
    offset), and every position stays in place when the window is resized.
  - `anchorPosition` is no longer part of the store's state: `useSidekick` works it out from `anchorOrigin`, so
    `createSidekickStore({ anchorOrigin: 'bottom-left' })` (or `initialSidekickState`) opens in that corner. A position
    stored beside the origin is ignored. Types: `anchorPosition` moves from `SidekickStoreState` to
    `UseSidekickResult`, as the new `AnchorPositionStyle`.
  - `@shortround/core` can be imported outside a browser (it read `window` when it loaded).
  - Rows with no `group` share one group without React's "unique key" warning.

- ca97237: Apps can decide what the side panel shows, and when.
  - `ShortRoundSidekick` takes `sidecarReducer(current, proposed, { reason })`: core proposes each side panel change
    with a reason (`result`, `back`, `start`, `reset`, `open`, `app`) and applies what the reducer returns, `{ renderer }`
    or `{ renderer: null }`. Returning `current` keeps the panel without remounting it. Without a reducer, core's
    proposals apply.
  - **Behaviour change:** closing the palette clears the side panel however it closes, including the app setting
    `isOpen: false` on the store; before, only the close control, Escape and `shouldReset` did. An app that kept content
    across a close can bring it back with the `open` reason.
  - `ShortRoundSidekick` takes `defaultSidecarRenderer`, the start list's panel: shown when the palette opens, on Back to
    the start and on Cancel (which used to close the panel).
  - The store has `openSidecar(renderer)` and `closeSidecar()`, usable outside React; they and `useSidekick`'s
    `setSidecarRenderer` and `closeSidecar` go through the reducer (reason `app`).
  - Types: `SidecarReducer`, `SidecarChange`, `SidecarReason`.

### Patch Changes

- 7391cca: Back works after steps that bring no list.
  - A step whose result brings no list (only a `message`, or only `sideEffects`) leaves the list's Back and Cancel in
    place. Before, they disappeared.
  - Back returns to the list before the current one, skipping such steps; before, it could stay on the same list, or
    leave the user on a list with no Back or Cancel. The side panel's `start` and `back` reasons follow, so Back to the
    start list proposes `defaultSidecarRenderer` again.
  - `dispatchedStack` still records every step.

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
