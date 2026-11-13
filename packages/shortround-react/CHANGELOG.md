# @shortround/react

## 0.6.0

### Breaking Changes

- `ShortRoundProvider` needs only `components` and `Toast`. It no longer refuses a theme without `IntentionPalette`,
  `Sidekick` or `SidecarContent`; `ShortRoundSidekick` throws when it mounts instead, naming the groups it misses
  (`ShortRoundSidekick: the theme has no components.Sidekick`). A theme for an app that draws only the chat has `Chat`
  and a `Toast`.
- Types: `ShortRoundTheme.components` is `Partial<SidekickComponents>` with other groups allowed. Under `strict`, code
  that reads a group off a value typed `ShortRoundTheme` (`theme.components.Sidekick.Frame`) needs a check or `!`.

### Minor Changes

- `LineInput`: an input with the typed line drawn under it (each word's role, and the ghost), for a host's own input.
- `useShortRoundComponents()`: the nearest provider's slots, or `null` without one, for a package that draws through
  slot groups of its own (`@shortround/chat`'s `Chat`).
- Takes `@shortround/core` `^0.6.0` as a peer.

## 0.5.0

### Major Changes

- First release. The React UI that was in `@shortround/core` up to 0.4.0, unchanged in behaviour: `ShortRoundSidekick`,
  `ShortRoundProvider`, `useShortRound`, `useSidekick`, `useShortRoundToast`, `SidekickStoreProvider`,
  `useSidekickStore`, the palette on cmdk, keyboard, focus and the dialog, and the theme contract's types
  (`SidekickComponents`, `ShortRoundTheme`, `IconRegistry`, `ToastProps`). It draws `@shortround/core`, which it takes
  as a peer (`^0.5.0`; the packages are released at one version). See MIGRATING.md, 0.5.0. Earlier history: `@shortround/core`'s CHANGELOG.
- `useShortRound` is `@shortround/core`'s `createPaletteStore` as a hook, with the same return value, plus
  `revertIntentions` (the Back and Cancel rows a list asked for). Its `dispatch` chooses a row as `ShortRoundSidekick`
  does: it keeps the Back and Cancel a result asks for, and a completion row sets the input.

### Minor Changes

- Accepts React 19 as well as 18: the `react` and `react-dom` peers are `^18.2.0 || ^19.0.0`.
- The palette shows completion rows (see `@shortround/core`'s 0.5.0): choosing one, by Enter or a click, sets the
  input and keeps the palette open; Tab applies the first enabled one, and otherwise moves focus as usual.
- The palette renders again when its resolver says its rows changed, and stops listening when the resolver is
  replaced or the palette unmounts. The highlight returns to the first enabled row when the rows change that way; the
  rule is core's palette store's (`highlightedId`), which the palette reads.
- `ShortRoundSidekick` takes `palette` (a catalog's palette, `buildPalette`'s result), instead of `defaultIntentions`
  and the two resolvers: it opens on `palette.current()` with that side panel, and follows `palette.notify()` while
  open. `defaultIntentions` is now optional.
- Line hints: with a palette that has `commandLine()`, the input shows each word coloured by its role and the rest of
  the next word as ghost text, and Tab completes through the line wherever the caret is. On by default;
  `disableLineHints` turns them off. Pickers and typed-text steps show the plain input. Each word is a `span` with
  `data-role`, for themes. The hints and the typed-line rows are one reading, the palette store's line: a lookup is
  called once per text, and with the caret mid-line the completion rows are the next steps at the caret.

### Patch Changes

- In a typed-text step, choosing a row whose result brings no list (only a `message`, say) no longer turns matching
  back on: `disableInputMatching` belongs to the list a result brings (`@shortround/core` 0.5.0).
- A row whose id starts or ends with a space can be chosen, and shows as highlighted. cmdk trims an item's value, so
  such a row's id came back changed and choosing it did nothing; each row now reports its own id.
- Uses the app's React JSX runtime (`react/jsx-runtime`) instead of a bundled copy of React 18's, which would break
  under another React. The package ships its `CHANGELOG.md`.
