# Migrating ShortRound

This guide lists what you need to do, or may want to do, when you upgrade. It has one section per release, newest
first. If you are several releases behind, read every section between your version and the new one. The guide starts
at 0.2.2; from an earlier version, treat the upgrade as a fresh install and follow the README. The package
CHANGELOGs list everything that changed; this guide covers only what affects your app.

Each item says what changed, what to do, and how to check it. Items are grouped by who they affect, so you can skip
the groups that don't apply to you.

## 0.4.0

From 0.3.0.

### Upgrade

Upgrade `@shortround/core`, `@shortround/mui` and `@shortround/catalog` together. Each MUI release depends on the
core release of the same version, and the catalog's new fallback and start panel need core 0.4.0: with core 0.3.0
they do nothing. `@shortround/mui` no longer lists `@mui/icons-material` as a peer dependency (it never used it);
remove it from your app if nothing else of yours needs it.

### Every app

- **The first Enter runs your first row, not Back or Cancel.** Back and Cancel are drawn at the top of the list, in
  their own group, "Navigate", but come last for the keyboard. After every new list, the highlight is on your first
  enabled row, so the first Enter in a picker or a typed-text prompt runs it. In 0.3.0 it ran Back or Cancel.
  *To do:* if your tests pressed ArrowDown to get past Back before Enter, remove that key press. ArrowDown from your
  first row now moves to your next row, or to Back when yours is the only row, as in a typed-text prompt.
  *Check:* open a picker and press Enter.

- **Arrow keys wrap around** at both ends of every list. ArrowUp from your first row reaches Back and Cancel.

- **Back and Cancel are in the `Navigate` group, not `Actions`**, and so are the rows `makeRevertIntentionsFor`
  returns. An app group named "Actions" no longer shares its group with them.
  *To do:* nothing, unless your code or tests look for Back or Cancel under "Actions".

- **Positions are CSS alone.** `top` and `bottom` are centred horizontally (in 0.3.0 they were offset from the
  centre), and every position stays in place when the window is resized.
  *Check:* move the sidekick to the top and to the bottom.

- **`anchorOrigin` alone says where the sidekick opens.** `createSidekickStore({ anchorOrigin: 'bottom-left' })`, or
  the same in `initialSidekickState`, opens in that corner. `anchorPosition` is no longer part of the store's state:
  `useSidekick()` returns it, worked out from `anchorOrigin`.
  *To do:* remove any `anchorPosition` you stored beside `anchorOrigin`; it is ignored.

- **Closing the sidekick clears the side panel, however it closes**, including your app calling
  `store.set({ isOpen: false })`. In 0.3.0 only the close control, Escape and `shouldReset` cleared it.
  *To do:* if your app relied on the panel surviving a close, bring it back on open with a `sidecarReducer` (below).

- **Opening the sidekick replaces the side panel** with the start list's panel (`defaultSidecarRenderer`), or with
  none. A panel your app set while the sidekick was closed is replaced.
  *To do:* set the panel after opening, or keep it with a `sidecarReducer` that returns `current` for the reason
  `open`.

- **`@shortround/core` can be imported outside a browser**, such as in server rendering or Node tests. 0.3.0 read
  `window` when it loaded.
  *To do:* remove any workaround you added for it, such as a stubbed `window` or a lazy import.

- **New and optional.** Each is described in `@shortround/core`'s README.
  - `sidecarReducer(current, proposed, { reason })` on `ShortRoundSidekick` decides each side panel change: core
    proposes one, with a reason (`result`, `back`, `start`, `reset`, `open` or `app`), and applies what the reducer
    returns. Returning `current` keeps the panel without remounting it.
  - `defaultSidecarRenderer` on `ShortRoundSidekick`, the start list's panel: shown when the sidekick opens, on Back
    to the start and on Cancel. Without it, Cancel and Back to the start close the panel, as before.
  - `openSidecar(renderer)` and `closeSidecar()` on the store, usable outside React. They, and `useSidekick()`'s
    `setSidecarRenderer` and `closeSidecar`, go through the reducer with the reason `app`.
  - `resolveDefaultFallbackInput(text, { matches })` on `ShortRoundSidekick` adds rows after the matches, such as
    "Send as chat"; an action's result brings its own as `resolveFallbackInput`, or none. Give its rows a `group` of
    their own to draw them last: a row in a match's group is drawn in that group. Memoize it, like
    `defaultIntentions`: a new function resets the list and the input, so read app state that changes when the
    fallback runs, rather than closing over it.
  - `icons` on `ShortRoundProvider` gives rows your own icons, from any library (an `IconRegistry`: `Icon`, `names`,
    `intentions`). Define it at module scope, or memoize it, like the theme.

### If you use `@shortround/mui`

- **Rows show different icons.** A name MUI doesn't know shows a question mark, and an intention with no `icon` shows
  none; its row keeps the space, so titles line up. In 0.3.0 both showed the search icon. Back and Cancel have their
  own icons (they showed the search icon too).
  *To do:* give each intention an `icon` MUI knows (`search`, `settings`, `home`, `person`, `folder`, `file`, `code`,
  `palette`, `dashboard`, `notification`), or give ShortRound your own icons through `ShortRoundProvider`'s `icons`.
  *Check:* open the sidekick and look for question marks.

- **Icons are 18px, in the theme's `action.active` colour**, and sit level with their row's title. In 0.3.0 the size
  and colour never reached the icons, so they were 24px in the text colour.
  *To do:* if you overrode the icons' size or colour to compensate, check your overrides.

- If you pass `MuiSidekickComponents` yourself instead of using the provider, MUI's icons come with it
  (`MuiSidekickComponents.icons`).

### If your tests or code find the sidekick's parts

- **Back and Cancel come last in the document**, after your rows; CSS draws them first. Code or tests that take
  rows by position, such as `getAllByRole('option')[0]`, now get your first row.
  *To do:* find Back and Cancel by their test hooks, `shortround-item-<id>` with the ids in `RevertIntentionIds`.

### If you have a custom theme or slot

- **`IntentionPalette.Item` receives `icon`**, the icon ShortRound chose for the row: an element, or nothing. Draw
  it, and keep its space when there is none. `@shortround/conformance` checks this (`item-icon`), so a theme that
  ignores `icon` now fails.
- **A theme's own icons go on `SidekickComponents.icons`**, by name, including `back`, `cancel` and `unknown` (the
  placeholder for a name nothing knows). Without them, a row shows an icon only when the app's `icons` draws it.
- **Core wraps the groups in one element inside `[cmdk-list]`**, to draw Navigate first. A style that selects
  groups as direct children of `[cmdk-list]` (`[cmdk-list] > [cmdk-group]`) no longer matches; select them as
  descendants.

### If you use `@shortround/catalog`

Nothing to migrate: a catalog that works with 0.3.0 works the same way. New and optional:

- `buildPalette(catalog, { startState })` opens the palette in the state you name, such as the page the user is on.
  A name the catalog has no built state for throws when the palette is built.
- `buildPalette(catalog, { fallback })` adds rows after a state's matches: `fallback(text, { matches, stateName })`.
  Pass the palette's `resolveFallbackInput` as `ShortRoundSidekick`'s `resolveDefaultFallbackInput`, and give its
  rows a `group` of their own to draw them last. Pickers and text steps don't get it.
- When the start state has a `panel`, the palette has `sidecarRenderer`: pass it as `ShortRoundSidekick`'s
  `defaultSidecarRenderer`, and the sidekick opens with that panel.
- A `run` may return `sideEffects` (`{ sidecarRenderer }` or `{ closeSidecar: true }`). They win over the ones its
  state's `panel` would set and apply even when the run is cancelled. In a line of several commands, the last one
  that returns them decides.
- Every result that brings a list says which kind, as `listKind`: `'state'`, `'picker'` or `'text'`.

### TypeScript

- `anchorPosition` moves from `SidekickStoreState` to `UseSidekickResult`, typed as the new `AnchorPositionStyle`.
- New in core: `SidecarReducer`, `SidecarChange`, `SidecarReason`, `ResolveFallbackInput`, `IconRegistry`; `icon` on
  `IntentionPalette.Item`'s props; `icons` on `SidekickComponents`.
- New in the catalog: `ResolveFallbackInput`, `MatchedRow`; `startState` and `fallback` on `buildPalette`'s options;
  `resolveFallbackInput` and `sidecarRenderer` on the palette; `listKind` and `resolveFallbackInput` on results.

### Fixed (no action)

Rows with no `group` no longer cause React's "unique key" warning. When Back or Cancel is highlighted, the
`Navigate` heading scrolls into view with it. A step whose result brings no list (only a message, say) no longer
removes Back and Cancel, and Back now returns to the list before the current one, skipping such steps.

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
