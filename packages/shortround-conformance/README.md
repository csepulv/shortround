# @shortround/conformance

The ShortRound theme contract, as a test suite. A theme is what an app hands to `ShortRoundProvider`:
`{ components, Toast }`, the slot components ShortRound renders (`SidekickComponents`) and a Toast view.
`@shortround/mui`'s `muiTheme` is one. Slots only draw: ShortRound renders cmdk (the input, each row, keyboard
and selection), moves focus and announces the sidekick, so a theme imports no cmdk. Run this suite from your theme's
tests and it checks, slot by slot, that your theme draws what ShortRound needs: rows show their title and subtitle,
the input is placed where typing reaches it, the close, size and position controls work and carry ShortRound's
names, the side panel shows its content, and toasts show their message only while open.

> Not on npm. Get it from GitHub (below).

Updating a theme written for an earlier ShortRound? The
[migration guide](https://github.com/csepulv/shortround/blob/main/MIGRATING.md) lists the slot changes for each
release, under "If you have a custom theme or slot".

## Running it

```js
// your-theme/src/__tests__/conformance.test.jsx
import { describeThemeContract } from '@shortround/conformance';

import { myTheme } from '../my-theme.js';

describeThemeContract('My theme', myTheme);
```

That registers one Vitest test per obligation, named after the slot and what it must do. Each check renders the
palette under `ShortRoundProvider` with your theme, as an app would:

```
✓ IntentionPalette.Item: shows the intention's title and subtitle
✗ Sidekick.ControlBar: the close control closes the palette
    Sidekick.ControlBar: no element with data-testid="shortround-close"
```

Requirements: Vitest with the `jsdom` environment; `@shortround/core`, `@testing-library/react`, `react` and
`react-dom` installed (peer dependencies). The suite installs the two browser APIs core's cmdk needs that jsdom
lacks, and runs its tests on real timers even if your file uses fake ones.

A failure names the slot that falls short. Some checks reach their slot through another one (typing into the Input to
see "no matches"); if that step fails, the message says `(precondition)` and names the slot it went through, so fix
that slot first. When a frame drops its children, nothing inside it renders, so many checks fail at once; the
frames' own check names the cause.

## The contract

| Slot | Props | Must | Test hook (`data-testid`) |
|---|---|---|---|
| `IntentionPalette.Frame` | `height`, `children` | Render its children (row styling goes here, through `[cmdk-item]` and `[data-selected]`) | — |
| `IntentionPalette.Input` | `input`, `inputMessage?` | Place `input` (ShortRound's input element); show `inputMessage.text` | `shortround-input`, put on `input` by ShortRound |
| `IntentionPalette.Item` | `intention`, `icon?`, `isSelected` | Show the title and subtitle; show `icon` when given, keeping its space when there is none (`isSelected`: whether the row is highlighted, if you need it) | `shortround-item-<id>`, put on the row by ShortRound |
| `IntentionPalette.Group` | `name` | Show the group's name | — |
| `IntentionPalette.NoMatches` | `inputValue` | Say nothing matched, naming `inputValue` | `shortround-no-matches` |
| `Sidekick.Popover` | `anchorPosition`, `anchorOrigin`, `height`, `totalWidth`, `children` | Render its children (in a portal or not) | — |
| `Sidekick.Frame` | `height`, `commandWidth`, `children` | Render its children | — |
| `Sidekick.ControlBar` | `title?`, `labels`, `anchorOrigin`, `size`, `onClose`, `setSize`, `cycleAnchorOrigin` | Show the title; a close control calls `onClose`; size controls call `setSize` with `compact`, `medium` or `full`; a position control calls `cycleAnchorOrigin`; each control, and the group of size controls, is named with `labels` (`aria-label`) | `shortround-close`, `shortround-size-<size>`, `shortround-anchor` |
| `SidecarContent` | `isOpen`, `renderSidecar`, `height` | Render `renderSidecar()` when the side panel opens (`isOpen`) | — |
| `Toast` (beside `components`) | `isOpen`, `message`, `onClose` | While `isOpen`, show `message`; otherwise render nothing. `ShortRoundProvider` holds the state; the theme calls `onClose` to dismiss it (not checked) | `shortround-toast` |

A theme's own icons go beside the slots, on `components.icons`, by name, with `back`, `cancel` and `unknown` (the
placeholder for a name the theme doesn't know). ShortRound chooses each row's icon from them and the app's registry,
and passes it to `Item` as `icon`. The suite checks that `Item` shows the `icon` it is given (`item-icon`), not
which icons a theme has.

What ShortRound does, and this suite therefore doesn't check: keyboard and click selection, disabled rows, each
row's value, the controlled input, focus moving into the sidekick and back, Escape closing it only from inside, and
the sidekick's `role="dialog"` and name. Those are core's tests. The names in `labels` are `ControlLabels`, exported
by `@shortround/core`.

The same props are typed in `@shortround/core` (`ShortRoundTheme`, `SidekickComponents`, `ToastProps`), with these
obligations as JSDoc; annotating your theme with it lets an editor flag a missing slot:

```js
/** @type {import('@shortround/core').ShortRoundTheme} */
export const myTheme = {
  components: { IntentionPalette: { … }, Sidekick: { … }, SidecarContent },
  Toast: MyToast
};
```

`TEST_IDS` (exported) holds the hook names; `CONTRACT_CHECKS` holds the checks themselves.

## Getting it from GitHub

pnpm installs a package from a subdirectory of a git repository with the `path:` parameter
([pnpm: Install from a subdirectory of a Git repository](https://pnpm.io/package-sources)):

```sh
pnpm add -D csepulv/shortround#path:/packages/shortround-conformance
```

Not yet tried against the public repository (the package reaches it with the next publish). Without pnpm, clone the
repository and link the package directory.
