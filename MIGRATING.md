# Migrating ShortRound

This guide lists what you need to do, or may want to do, when you upgrade. It has one section per release, newest
first. If you are several releases behind, read every section between your version and the new one. The package
CHANGELOGs list everything that changed; this guide covers only what affects your app.

Each item says what changed, what to do, and how to check it. Items are grouped by who they affect, so you can skip
the groups that don't apply to you.

## 0.3.0

From 0.2.2, the last release on npm. (0.2.3 was published on GitHub only; its changes are included here.)

### Upgrade

Upgrade `@shortround/core` and `@shortround/mui` together: each MUI release depends on the core release of the same
version. Peer dependencies are unchanged, except that `@shortround/mui` now also supports MUI 9. `@shortround/mui` no
longer depends on `cmdk` or `react-icons`.

### Every app

- **Escape closes the sidekick only when pressed inside it** (its input, list, control bar or side panel). Before,
  Escape anywhere on the page closed it. Content inside the sidekick sees Escape first and can keep it with
  `event.preventDefault()`, for example a widget in the side panel that uses Escape itself.
  *To do:* if your app relied on Escape anywhere closing the sidekick, add your own listener that calls
  `useSidekick().onClose()`, from a component under the same `SidekickStoreProvider` as the sidekick (or with the
  store you pass it as `sidekickStore`); elsewhere, `useSidekick()` has a store of its own. *Check:* with the sidekick open, press Escape in the page, then inside the sidekick.

- **`installKeyboardShortcuts={false}` now turns off only the global Cmd/Ctrl+K.** Escape inside the sidekick closes
  it either way. Before, the flag turned off both.
  *To do:* if you turned the shortcuts off to handle keys yourself, remove your own Escape handling for the sidekick
  (closing it twice is harmless but redundant), or keep it only if you want Escape anywhere on the page to close it.
  A listener of your own on `document`, in the capture phase, runs before anything inside the sidekick, so content
  there can no longer keep Escape with `preventDefault()`.
  ShortRound's Cmd/Ctrl+K handler doesn't call `preventDefault()`; keep your own if you need to stop the browser's
  default.

- **`useSidekick().onOpen()` opens the sidekick as before**, from your own shortcut or a button. When the sidekick is
  already open, it doesn't bring focus back into it; only ShortRound's own Cmd/Ctrl+K does that.

- **Focus moves into the sidekick when it opens**: to its input, or to the sidekick itself in compact size. **When it
  closes, focus returns** to the element that had it, unless the user has since moved focus elsewhere in the page.
  After a row is clicked, focus goes back to the input, so typing carries on. ShortRound's Cmd/Ctrl+K while the
  sidekick is open brings focus back into it (`onOpen()` from your own code doesn't; see above).
  *To do:* remove your own code that focused the palette on open. The sidekick is non-modal: it doesn't trap focus,
  and the page stays usable while it's open. If your app needs a focus trap, keep your own.
  *Check:* open the sidekick from a button, press Escape, and confirm focus is back on the button.

- **The side panel stays open after a result without a renderer.** Before, it closed. Cancel, and Back to the start,
  still close it.
  *To do:* to close it from an action, return `sideEffects: { closeSidecar: true }`.

- **`dispatch` no longer runs a disabled intention, or one whose `validate` rejects the current input, and no longer
  resets the palette for it.** It shows the reason on the input's message line ("Not available right now" when there
  is none), keeps the input, and returns `{ isRejected: true }`. Disabled rows still can't be clicked or chosen with
  Enter, as before. When `validate` returns a result, that result decides, so a row that starts `disabled: true`
  until its input is valid still runs once `validate` accepts.
  *To do:* nothing, unless your code or tests call `dispatch` for such an intention and expected the old behaviour.

- **`setSize` throws on an unknown size** (anything but `compact`, `medium` or `full`).
  *To do:* if you compute the size, make sure it is one of those.

- **New and optional:** `onClose` on `ShortRoundSidekick`, called after the sidekick closes, whatever closed it;
  `resolveDefaultInput` on `ShortRoundSidekick` and `resolveInput` on an action's result, which turn typed text into
  extra rows.

### If you use `@shortround/mui`

- **The sidekick looks slightly different.**
  - Corners use your theme's `shape.borderRadius` once. Before, it was applied twice: a radius of 4 gave 16px
    corners.
  - The frame and the control bar have an opaque `background.paper` background, where they had a faint tint of the
    primary colour.
  - The title is `text.primary`; it was `palette.surfaceHeader.contrastText`.
  - The control bar has horizontal padding.
  *To do:* if you overrode these to compensate, check your overrides. If you set `palette.surfaceHeader` to colour the
  title, colour it through `components.ShortRoundSidekickControlBar.styleOverrides` instead.
  *Check:* open the sidekick with your theme and compare.

### If your tests or code find the sidekick's parts

- **The sidekick is announced as a dialog**: `role="dialog"`, `aria-modal="false"`, named by `title` (or
  "ShortRound").
  *To do:* a test that queries `getByRole('dialog')` may now also match the sidekick; query by name, or scope the
  query. The dialog is also a stable anchor for your own code: `getByRole('dialog', { name: 'Your title' })`.

- **The title appears twice in the document**: once in the control bar and once in a visually hidden label for the
  input, which screen readers use.
  Both copies are inside the sidekick's dialog, so scoping a query to the dialog doesn't separate them.
  *To do:* replace `getByText(title)`. To check the sidekick is open with that title, use
  `getByRole('dialog', { name: title })`. To reach the visible copy, leave out the label:
  `getByText(title, { ignore: '[cmdk-label], script, style' })`.

- **The control bar's controls are named by ShortRound**, the same in every theme (`ControlLabels`, exported by
  `@shortround/core`):

  | Control | 0.2.x accessible name | 0.3.0 accessible name |
  |---|---|---|
  | Position | none | "Move palette" |
  | Close | none | "Close" |
  | Size group | "sidekick size" | "Palette size" |
  | Size buttons | "compact", "medium", "full" | "Compact", "Medium", "Full" |

  *To do:* update tests and code that find these by name (note the capitals). If your app added names to these
  controls itself, remove that code, or check it doesn't overwrite ShortRound's.

- **Stable test hooks** (`data-testid`) are on the sidekick's parts: `shortround-input`, `shortround-item-<id>`,
  `shortround-no-matches`, `shortround-close`, `shortround-size-<size>`, `shortround-anchor`, and `shortround-toast`
  (`@shortround/mui`'s toast, whether shown through `MuiToastProvider` or `ShortRoundProvider`). Prefer these to class
  names or style labels.

- **`@shortround/mui`'s rows no longer carry the class `intention-item`.**
  *To do:* style or find rows through `[cmdk-item]` (with `[data-selected="true"]` for the highlighted row).

- **The input's placeholder text is unchanged.**

### If you render a theme's slots yourself

For example in tests, or in a wrapper around a slot.

- **`Sidekick.ControlBar` needs `labels`.** ShortRound passes `ControlLabels`; rendered without it,
  `@shortround/mui`'s control bar throws.
  *To do:* pass it: `<ControlBar labels={ControlLabels} … />`, with `ControlLabels` from `@shortround/core`.

### If you have a custom theme or slot

Slots now only draw: ShortRound renders cmdk (the input, each row, keyboard and selection), moves focus and announces
the sidekick. A theme imports no cmdk.

- **`IntentionPalette.Input`** receives `{ input, inputMessage }`: place `input`, ShortRound's input element, and
  show `inputMessage.text`. It no longer receives `inputValue` or `onInputChange`, and no longer renders cmdk's
  `Command.Input`.
- **`IntentionPalette.Item`** receives `{ intention, isSelected }` and draws inside ShortRound's row, which handles
  click, keyboard and disabled rows. It no longer receives `onSelect`, and no longer renders cmdk's `Command.Item`.
  Style the highlighted row through `[cmdk-item][data-selected="true"]` in the palette frame, or use `isSelected`.
- **`Sidekick.ControlBar`** receives `labels` and must use them as its controls' accessible names (`aria-label`), the
  size controls inside a group named `labels.size`.
- **The placeholder is ShortRound's.** A theme can no longer set it.
- *Check:* run `@shortround/conformance` from your theme's tests:
  `describeThemeContract('My theme', { components, Toast })`. It checks each slot's obligations, including the
  names. See its README for installing it from GitHub.

### Optional: choose the theme once, at the root

New in 0.3.0. Your 0.2.x code (`SidekickComponents`, `showToast` and `MuiToastProvider`) keeps working; these props
still override the provider, each for its own part.

```jsx
import { ShortRoundProvider } from '@shortround/core';
import { muiTheme } from '@shortround/mui';

// Inside your MUI ThemeProvider, so the palette and its toasts use your theme:
<ShortRoundProvider theme={muiTheme}>
  <App />
</ShortRoundProvider>;
```

Below the provider, `ShortRoundSidekick` needs no `SidekickComponents` or `showToast`, and your code shows toasts
with `useShortRoundToast()` from `@shortround/core`. Define the theme, and any custom slot components, at module scope
(or memoize them): created during render, they remount on every render.

- **Toasts through `muiTheme` hide themselves after 4 seconds.** `MuiToastProvider`'s toasts still wait for a click.
- **Without `SidekickComponents` and without a provider, `ShortRoundSidekick` throws**, naming `ShortRoundProvider`.

### New: `@shortround/catalog`

Nothing to migrate: a new package, released at 0.3.0 alongside core and MUI. It builds a palette from a catalog
(a YAML file of states, commands and the functions they run) and needs `@shortround/core` 0.3.0 for typed lines
(`resolveDefaultInput`). To adopt it, see
[`packages/shortround-catalog/ADOPTING-A-CATALOG.md`](packages/shortround-catalog/ADOPTING-A-CATALOG.md).

### TypeScript

- `ThemeProvider` is no longer part of `SidekickComponents`: remove it from objects typed `SidekickComponents`.
- `SidekickComponents` is optional on `ShortRoundSidekick` (required without a provider).
- `useShortRound().dispatchedStack` is typed as `{ intention, result }[]`, the shape it always had at runtime (it
  was typed `Intention[]`).
- New: `ShortRoundTheme`, `ToastProps`, `ControlLabels`; `Intention.subtitle` and `Intention.keywords` are typed.
- `@shortround/mui` ships its own declarations. Remove any `declare module '@shortround/mui'` you added for it.

### Fixed (no action)

The palette no longer crashes on a validation message, or when the selected size is clicked again; validation
messages clear once the input is valid; the sidekick keeps its state when a parent re-renders; Back no longer changes
earlier history; the list's height is valid CSS again; keyboard shortcuts use the latest callbacks and are removed on
unmount.
