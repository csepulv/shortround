# @shortround/core

## 0.6.0

### Minor Changes

- `buildCatalogRuntime(loadCatalog(text, bindings))`: the catalog at run time, with no UI. A palette
  (`buildPalette(runtime, …)`, which still takes a loaded catalog too) and a chat (`@shortround/chat`) are views over
  one runtime, so an app with both calls `runtime.notify()` once. It has `isAvailable`, `run`, `notify`, `subscribe`
  and `commandLine()`, and gives the intentions as tools for a model: `tools()` (a name, a description and a JSON
  Schema for each) and `runTool({ toolName, input })`. Types: `CatalogRuntime`, `IntentionTool`,
  `IntentionToolProperty`, `IntentionToolItem`, `IntentionToolCall`, `IntentionToolAnswer`, `RunResult`.
  - `tools()` offers every intention, each time: one that isn't available now is marked "(not available now)" after
    its label. For one that is, a lookup param's description lists the app's values now (up to twenty; a lookup gets
    up to 500 ms). A required param the app holds a value for isn't in the schema's `required`. A command whose name
    a model provider won't take is left out, with a warning, once.
  - The runtime's own command line (`runtime.commandLine()`) says a typed line needs an app-held value the app holds
    none of (`appNeeds`), and doesn't run it; the palette's line still asks for it with a picker.
- A model's tool call is checked as the catalog says before `run` sees it: an intention that isn't available now, an
  unknown param, or several values for a one-value param is refused; free text arrives as text, a value that isn't
  text is refused, a `required` param left out, `null`, empty or blank is refused, a param given `null` counts as left
  out (unless it is `nullable`), and a value outside a param's choices is refused, naming them. A param left out that
  the app holds a value for (`current`) is filled, and the call is refused when the app holds none.
- `makeChatLine({ runtime, onIntentionRun, onSendAsChat, showHintForMissing })`: a chat's input line over a runtime.
  A typed intention runs, anything else is sent as chat, and the rows say what Enter would do. Also `drawnLineState`,
  `SEND_AS_CHAT_ROW_ID`, `firstEnabledIndex` and `moveHighlight`. Types: `ChatLine`, `ChatLineRow`, `ChatLineKey`.
- A command can be typed by its label, lowercased, when the label is plain words (`Close preview` is typed "close
  preview"). A label never takes a phrase from another command's name or alias. `findUntypedCommands` counts a typed
  label.
- Catalog fields: a command's `toolDescription` (rules or context for a model, after its label in the tool's
  description); a list param's `minItems`; typed params: `argSource.type` `integer` and `number` (with `minimum` and
  `maximum`), text's `maxLength`, and a param's `nullable` (`true`, or words such as `[all, every]` that mean `null`
  when typed). One rule is checked on the typed line, in the palette's text step and in a model's call, and a value
  that breaks it is refused with the rule ("Limit is a whole number from 1, or all"). The catalog refuses a null word
  one of the command's params already uses, and `nullable` on a param with a list or a lookup. An examples file's
  `means` writes a number type's value as a number (`limit: 20`; `'20'` no longer matches). See CATALOG.md.
- A `run` may return `output` beside `message`: data a model gets in place of the message. A typed run
  still shows the message; a model's call shows the answer through the chat's `ToolRun` slot.
- `findInvalidToolNames(catalog)`: the commands whose names a model provider won't take as tool names.
- The command line's state has `awaiting` (the params a hint word waits for) and `brokenRules` (the rules a typed
  value breaks).

### Patch Changes

- The palette's text step for a freeform `list: true` param runs with a list of one, as the typed line and a picker do.
- Peers of `@shortround/react`, `@shortround/mui` and `@shortround/chat` on core are `^0.6.0`; the four packages are
  released together.

## 0.5.0

### Breaking Changes

- Core is headless: no React, no DOM. The components and hooks (`ShortRoundSidekick`, `ShortRoundProvider`,
  `useShortRound`, `useSidekick`, `useShortRoundToast`, `SidekickStoreProvider`, `useSidekickStore`) move to the new
  `@shortround/react`; the constants and `createSidekickStore` stay here. See MIGRATING.md, 0.5.0.
- The catalog engine is part of core: `loadCatalog`, `checkCatalog`, `buildPalette`, `loadExamples` and
  `findExampleFailures`, with the docs `CATALOG.md` and `ADOPTING-A-CATALOG.md`. `@shortround/catalog` is retired
  (its history: `CHANGELOG-catalog.md`).
  - Types: the catalog's `ResolveInput` and `ResolveFallbackInput` are renamed `CatalogResolveInput` and
    `CatalogResolveFallbackInput`; from core, the old names are core's own types, which the catalog's fit.
- The catalog format is version 3, and version 2 is no longer read: `loadCatalog` and `checkCatalog` reject a v2
  catalog with a pointer to MIGRATING.md, "From a v2 catalog". Version 3 joins the picking rows and the typed whole
  commands in one file: `groups`; `states` that hold while their `when` holds, with a `panel`; `commands` with
  `params`, each with an `argSource` (`freeform`, `list`, `lookup`, `current`) and optional `path` overrides for the
  picking rows. See CATALOG.md.
  - A `run` is called once with one object, the command's args by param (`{ term, sort, tags: [...] }`), not with
    positional arguments.
  - A typed line runs one command with all its args.
  - Row ids follow the catalog's command and param names.
  - An example's `means` is a call (`{ search: { term: 'grid' } }`).
  - `RunOutcome` has no `isCancelled`.
- `buildPalette` returns a palette that follows the app: `current()` (the list for the states that hold now),
  `notify()`, `subscribe()`, `isAvailable(commandName)` and `listNow()`.
- Core, `@shortround/react` and `@shortround/mui` are released together, at one version.
- The package ships its changelogs (`CHANGELOG.md`, and `CHANGELOG-catalog.md` for `@shortround/catalog`'s history).

### Minor Changes

- `createPaletteStore`: the palette without a UI. It holds the list, the input and its validation message, what ran,
  Back and Cancel, typed-text resolvers and fallbacks, and decides what choosing a row does (`select`), including the
  side panel's proposals and the Back and Cancel rows. `useShortRound` in `@shortround/react` is this store as a hook.
  - `rows()` is what to show now; `changeInput`, `dispatch`, `back`, `reset`, `setDefaults`, `completeFirst` (Tab)
    and `watchResolver` complete it. Types: `PaletteStore`, `PaletteStoreState`, `PaletteDefaults`.
- Completion rows: an intention with `completion` (a string) completes the typed line instead of running. Choosing it
  sets the input to `completion`; `action` isn't called and nothing is added for Back to step back over.
  `completeFirst()` (Tab in the React palette) applies the first enabled one. Type: `Intention.completion`.
- A resolver can say its rows changed while the input didn't (an async lookup landed): a `resolveInput` may carry
  `subscribe(listener)`, returning an unsubscribe function. While watched (`watchResolver`), each notice tells the
  store's listeners; a new list's resolver replaces the old one. Type: `ResolveInput.subscribe`.
- `createPaletteStore({ palette })`: the store starts from a catalog palette's `current()`, and Back and Cancel to the
  start land there. `watchPalette()` follows the palette's `notify()`: the start list (or a list a run brought)
  re-reads, and a step whose command is no longer available returns to it with a message. `refresh()` re-reads on
  demand. Results from a catalog carry `listKind` and `command`. Types: `PaletteSource`, `PaletteDefaults.palette`.
  - Following the app to such a list drops the steps that led to it, so `back()` has no stale step to return to.
  - While a choice runs, the store holds off following, then follows once when it settles: an app that calls
    `notify()` from inside a run no longer makes the step flash "… isn't available now".
  - While watching, the store reads typed lines through one command line of its own (`commandLine()`, `null` in a
    picker or a typed-text step): its typed rows (the line's `rows()`) and the words, ghost and Tab drawn from the line
    are one reading, so a lookup is called once per text. The completion rows are the next steps at the caret:
    `changeInput(text, caret)` takes it (the end when left out). The function `watchPalette()` returns also disposes
    the line. Watches are counted (they share the line; the last stop disposes it), and `setDefaults` while watched
    follows the new source.
  - A lookup that throws is a failed lookup, as a rejected one is: the line says "Couldn't load …" and the typed text
    stays.
- The store holds the highlight (`getState().highlightedId`, moved with `highlight(id)`): after every change of the
  rows, a lookup that landed included, it is the first enabled row as drawn, so Enter runs what an instant lookup would
  have. A UI on core alone gets the rule `@shortround/react`'s palette had.
- `disableInputMatching` belongs to the list a result brings: a result with no `intentions` (only a `message`, say)
  leaves it as it is, as with Back and Cancel. In 0.4.0's `useShortRound`, every result set it, so a message-only row
  chosen in a typed-text step turned matching back on.
- `makeCommandBuilder({ commands, lookups })`: the command-builder engine, which reads a typed line into whole
  commands with their calls, next steps and lookups still loading. Its lookups may be async, and dates read as ranges
  (chrono-node). Types: `BuilderCommand`, `BuilderState`. New dependencies: `jsep`, `chrono-node`,
  `damerau-levenshtein`.
  - Each word's role (`annotations`) holds while the line is unfinished, from the best reading so far.
  - A command's name is read as a typed word only when it is a plain lowercase word (`search`, not `newSearch`); its
    aliases are read as before. A command with neither has no typed form (it is still a row);
    `findUntypedCommands(catalog)` lists such commands, for a test.
  - A phrase of several words reads as soon as its last word is typed, before any space after it: a whole line
    `clear filters` runs the command whose alias it is.
  - Right after a command's name, a `default` param with values offers its values as next steps, ahead of the hints
    and other params' words, instead of its own label (`preview ` offers the results). While the app holds the
    default's current value (`argSource.current`, such as the previewed result), it isn't offered, so Tab can't
    replace that value.
  - A command runs by its name alone when it has no params, or while the app holds a current value for each
    (`open` while a result is previewed). While the app holds none, it reads like any other: `open ` offers the
    results, and Enter completes the first.
  - When the values offered at the caret have none to choose from, and nothing is typed for that param, `incomplete`
    says so with the param's `emptyText`. A catalog gives each param its `path.empty`, or "No {label} to choose from",
    as its picker says (`drop ` with no filters: "No filters to drop"). Type: `BuilderCommand`'s param `emptyText`.
    In a palette, `incomplete` shows as disabled rows under Status, with "Loading …" and "Couldn't load …".
  - A `current` function that returns `null` or `undefined` means the app holds no arg.
  - A closing quote ends a freeform term: a param's word may follow it directly (`search "react grid" kind library`).
    An unquoted term still runs until a reserved word.
- The command line: one typed line read against the commands, with what a host shows for it (each word's role, the
  ghost of the next word, what would run, whether it can) and what Tab (`acceptCompletion`) and Enter (`submit`) do.
  `palette.commandLine()` gives one for the commands available now: it follows the app and reads with engines of its
  own. `makeCommandLine({ builder, run })` makes one over any command builder. Either way, `dispose()` releases it.
  Enter runs once: a second Enter while a run is in progress returns that run. Its state carries every candidate
  (`readings`) beside the best (`top`), and a palette's line has `rows()`, the typed-line rows for the line as it
  reads. Types: `CommandLine`, `CommandLineState`, `WordRole`; `Palette.commandLine`, and `PaletteSource.commandLine`
  (optional).
- `matchIntentions(text, intentions)`: the palette's fuzzy matching, for a host that needs to know what the palette
  would show.
- Also exported: `bringsList`, `NAVIGATE_GROUP`, `cycleCorners`, `cycleMiddlePositions`.
- `createSidekickStore` runs on Zustand's vanilla store, with the same shape. A listener is called with
  `(state, previousState)`; a `set` whose function returns the same state object notifies no one.
- Types carry no React: a side-panel renderer is `SidecarRenderer` (`() => unknown`). `SidekickStore` now declares
  `changeSidecar`, `clearSidecar` and `setSidecarReducer`, which the store always had.

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

- b31f345: Palette friction found in an app integration.
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
