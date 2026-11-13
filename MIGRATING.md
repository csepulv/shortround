# Migrating ShortRound

This guide lists what you need to do, or may want to do, when you upgrade. It has one section per release, newest
first. If you are several releases behind, read every section between your version and the new one. The guide starts
at 0.2.2; from an earlier version, treat the upgrade as a fresh install and follow the README. The package
CHANGELOGs list everything that changed; this guide covers only what affects your app.

Each item says what changed, what to do, and how to check it. Items are grouped by who they affect, so you can skip
the groups that don't apply to you.

## 0.6.0

From 0.5.0. A new package, `@shortround/chat`, puts a chat over your catalog, and `@shortround/mui` draws it. For an
existing app, three things change: a command can now be typed by its label, a list param's text step gives a list, and
the provider no longer requires the palette's slot groups. Apart from one case in strict TypeScript (see "TypeScript"),
nothing in an app's code has to change.

### Upgrade

Upgrade `@shortround/core`, `@shortround/react` and `@shortround/mui` together, as before. To add the chat, install
`@shortround/chat` with its peers `ai` (7) and `@ai-sdk/react` (4); see its README.

### Apps with a catalog

- **A command can be typed by its label.** Besides its name (when that is a plain lowercase word) and its aliases, a
  typed line now starts a command by its label, lowercased, when the label is plain words: `Close preview` is typed
  "close preview". This holds for the palette's typed line and the chat's.
  A label never takes a phrase from another command's name or alias: if `Shut` has the alias `close` and another
  command is labelled `Close`, "close" still starts `Shut`. A longer label does win over a shorter phrase, as any
  longer phrase does: a command labelled `Close all` now reads "close all", where before "close" started `Shut` and
  "all" was its words.
  *To do:* nothing, usually. If your `findUntypedCommands` test expects a list, the commands whose labels are plain
  words leave it; expect what it now returns (often `[]`). If a label of several words begins with another command's
  name or alias, check that typing it now starts the command you mean.
  *Check:* type a label in the palette ("close preview" with a preview open); the command's row reads it, and Enter
  runs it.
- **New, for a chat:** a command may have a `toolDescription` (rules or context for a model, after its label in the
  tool's description); a `run` may return `output` beside `message`, data a model gets in place of the message (a typed
  run still shows the message; a model's call shows the answer through `Chat.ToolRun`, which MUI draws as JSON); and
  `findInvalidToolNames(catalog)` lists commands whose names a model provider won't take as tool names (a v2 catalog's
  dotted names, such as `notes.archive`).
  *To do:* nothing for the palette, which ignores all three. Before adding a chat, add
  `expect(findInvalidToolNames(checkCatalog(CATALOG_TEXT))).toEqual([])` to your catalog tests, and rename what it
  lists (letters, digits, `_` and `-`, up to 64 characters); until then the runtime leaves those commands out of its
  tools and warns once.
- **A model's call is checked as the catalog says.** Before a command's `run` sees a model's call, a `required` param
  left out, `null`, an empty list or blank text is refused (a typed line already needed it); free text arrives as text
  (`2` becomes `"2"`); a value that isn't text (an object) is refused; a param given `null` counts as left out (unless
  it is `nullable`, below); and a list param may set `minItems`, which refuses a shorter list.
  *To do:* nothing for the palette. If a command's `run` treats an empty filter as "everything", set `minItems: 1` on
  the param; if it treats a missing one that way too, mark the param `required`, or refuse it in `run`.
- **New: typed params.** A freeform param may be `type: integer` or `number` (with `minimum` and `maximum`), text may
  set `maxLength`, and a one-value param with no `list` or `lookup` may be `nullable` (`[all, every]`: typing a word
  gives `null`; `true`: only a model can send `null`). A null word can't be a word the command's params already use (a
  hint, a param's label or alias, a value's alias); the catalog refuses it, naming it. One rule is checked on the typed
  line, in the palette's text step and in a model's call, and a value that breaks it is refused with the rule ("Limit is
  a whole number from 1"); on a chat line Enter then does nothing. A number is one word on a typed line, so a sentence
  after the command is sent as chat.
  *To do:* nothing for a catalog without them. A catalog that adds them gets numbers (and `null`) in `run`, from
  every path; its examples file writes them that way (`means: { showNotes: { limit: 20 } }`).
- **A list param's text step gives a list.** The palette's step for a freeform `list: true` param now runs with
  `[value]`, as the typed line and a picker already did, where before it gave the value alone.
  *To do:* if a `run` for such a param handled a single value from the step, it can drop that case.
  *Check:* choose the param's row, type a value, and Enter; `run` receives a list of one.

### Theme authors

- **The provider needs only `components` and `Toast`.** `ShortRoundProvider` no longer refuses a theme without
  `IntentionPalette`, `Sidekick` or `SidecarContent`; `ShortRoundSidekick` throws when it mounts instead, naming the
  groups it misses (`ShortRoundSidekick: the theme has no components.Sidekick`). A theme for an app that draws only
  the chat has `Chat` and a `Toast`.
  *To do:* nothing for a complete theme. A test that expected the provider's old error ("ShortRoundProvider: the theme
  has no components.Sidekick") now gets the sidekick's, when the sidekick mounts.
- **`@shortround/conformance` follows the theme.** `describeThemeContract` runs the palette's checks when the theme has
  any palette group, the `Chat` checks when it has `Chat`, and the Toast's always. The Toast checks now render only the
  provider ("shows a message while it is open" replaces "shows an intention's message while it is open"). The `Chat`
  checks need `@shortround/chat`, `ai` and `@ai-sdk/react` installed; a missing one fails them, naming what to
  install. A `Chat.Row` sets `aria-selected` from `isHighlighted`; a `Chat.ToolRun` shows its `label`, not the name
  the model called.
  *To do:* nothing for a palette theme. For a `Chat` group, install those packages beside the suite.

### New (optional)

- **`@shortround/chat`**: `<IntentionChat runtime transport />` (drawn through the theme's `Chat` slots) and
  `useIntentionChat` for your own UI; `makeIntentionChat` for a conversation your app holds itself;
  `@shortround/chat/server` for your route; `CHAT_SLOT_NAMES` lists the `Chat` slots. See its README.
- **`buildCatalogRuntime(catalog)`** in core: the catalog at run time, which a palette (`buildPalette(runtime, …)`)
  and a chat are views over, so an app with both calls `notify()` once. It gives the intentions as tools for a model
  (`tools()`, `runTool()`). Build the runtime once, and one palette over it: a palette over a runtime follows it for
  the runtime's life. Core also exports `makeChatLine`, `drawnLineState`, `SEND_AS_CHAT_ROW_ID`,
  `firstEnabledIndex` and `moveHighlight`; see core's README.
- **`LineInput`** and **`useShortRoundComponents()`** in `@shortround/react`: line hints in your own input, and the
  provider's slot groups for a package that draws through its own.
- **`muiTheme`'s `Chat` slots**: with `muiTheme` at the root, `<IntentionChat>` needs no other setup.

### TypeScript

- Core: new `CatalogRuntime`, `IntentionTool`, `IntentionToolCall`, `IntentionToolAnswer`, `ChatLine`, `ChatLineRow`,
  `ChatLineKey`, `RunResult` (what a run returns: `message`, `output`, `sideEffects`; `RunOutcome` is built on it);
  `CatalogCommand` gains `toolDescription`, `CatalogParam` gains `minItems` and `nullable`, `ArgSource` gains the
  `integer` and `number` types, `minimum`, `maximum` and `maxLength`, `IntentionTool.inputSchema` may have `required`,
  and its properties are `IntentionToolProperty` (a number type, bounds, `maxLength`, `minItems`, a `'null'` pair;
  `IntentionToolValueType`), `CatalogIntention` gains `missing?` and a `BuilderState` reading `appNeeds?`,
  with a list's items `IntentionToolItem`; `buildPalette` takes a `Catalog` or a `CatalogRuntime`; `BuilderState` and
  `CommandLineState` gain `awaiting` (the params a hint word waits for) and `brokenRules` (the rules a typed value
  breaks).
- React: `ShortRoundTheme.components` is `Partial<SidekickComponents>` with other groups allowed, so a chat-only theme
  type-checks while a misshapen palette group still doesn't; new `LineInput` and `useShortRoundComponents`. Under
  `strict`, code that reads a group off a value typed `ShortRoundTheme` (`theme.components.Sidekick.Frame`) now needs a
  check or `!`, since the group may be missing.
- MUI: `MuiSidekickComponents` gains `Chat`; `muiTheme` is typed with its own components, so reading a group off it
  needs no check.

## 0.5.0

From 0.4.0. ShortRound splits into a headless core and a React package. Every React app changes its imports. An app
with a catalog also moves it to format version 3 (see "From a v2 catalog"); otherwise nothing else in an app's code
has to change.

### Upgrade

Install `@shortround/react` beside `@shortround/core`, and upgrade `@shortround/core`, `@shortround/react` and
`@shortround/mui` together: all three are released at one version. `@shortround/react` takes `@shortround/core` as a
peer, and `@shortround/mui` takes both as peers (it depended on core before), so your app lists them itself.
`@shortround/catalog` is gone: its functions are in `@shortround/core`; remove it from your app. React 18 and 19
both work (`react` and `react-dom` `^18.2.0 || ^19.0.0`), and `@shortround/mui` still takes `@mui/material` 5, 6, 7
or 9. On React 19, MUI's own peers need `@mui/material` 5.16.8 or later (5.15 accepts React 17 and 18 only).

```bash
npm install @shortround/core@0.5 @shortround/react@0.5 @shortround/mui@0.5
npm uninstall @shortround/catalog
```

### Every React app: the components and hooks move to `@shortround/react`

`@shortround/core` no longer has React in it. Import the UI from `@shortround/react`; the constants and the sidekick
store stay in core.

| Was imported from `@shortround/core` | Now from |
| --- | --- |
| `ShortRoundSidekick`, `ShortRoundProvider`, `useShortRound`, `useSidekick`, `useShortRoundToast`, `SidekickStoreProvider`, `useSidekickStore` | `@shortround/react` |
| `createSidekickStore`, `RevertIntentionIds`, `makeRevertIntentionsFor`, `AnchorPositions`, `Sizes`, `ControlLabels` | `@shortround/core` (unchanged) |

*To do:* change the import lines; the components, hooks and their props are the same.
*Check:* your app builds, and searching your code for `from '@shortround/core'` finds only the constants and
`createSidekickStore` (plus the catalog functions, below).

### Apps with a catalog: `@shortround/catalog` is now part of core

| Was imported from `@shortround/catalog` | Now from |
| --- | --- |
| `loadCatalog`, `checkCatalog`, `buildPalette`, `loadExamples`, `findExampleFailures` | `@shortround/core` |

*To do:* change the import lines, and move the catalog to format version 3 (next section). The function names are
the same; the docs are core's `CATALOG.md` and `ADOPTING-A-CATALOG.md`.
*TypeScript:* two of the catalog's types are renamed, because core has types of the same names:
`ResolveInput` is now `CatalogResolveInput`, and `ResolveFallbackInput` is now `CatalogResolveFallbackInput`.
Imported from `@shortround/core`, the old names mean core's types, which the catalog's still fit.
*Check:* your catalog tests pass, and nothing imports `@shortround/catalog`.

### From a v2 catalog

Version 3 is one format for both ways of using the palette: picking rows, and typing a whole command
(`search grid with tags react`). 0.5.0 reads only version 3; `loadCatalog` rejects a v2 catalog with a message that
points here. The move has five parts: the catalog file, the words people type, the bindings, the examples, and the
sidekick.

**1. The catalog file.** The changes, field by field:

| Version 2 | Version 3 |
| --- | --- |
| `version: 2` | `version: 3` |
| Commands written inside each state | Commands at the top level, under `commands`; each state lists its commands' names (`commands: [search, preview]`) |
| The same command name in two states, with different runs (one asks for a result, one acts on the previewed one) | One command whose param has both a `lookup` (to ask) and a `current` (the app's previewed one): its row runs at once while something is current, and asks otherwise. Or two commands with different names, if they really do different things |
| A command's `title` | `label` (the row's text; not a word anyone types, see part 2) |
| `group: Search` (a name), a command's `icon` | `group: search` (a key into a top-level `groups` map: `search: { label: Search, icon: search }`). A command's row takes the command's `icon`, else its group's; a param's row takes its `path.icon`, else its group's |
| `start: true` on the first state, and `then:` on a command to move to another state | Each state holds while its `when` holds (`when: app.conditions.previewed`, `when: '!app.conditions.previewed'`); `start: true` marks at most one. There is no `then`: after a run, the palette shows the states that hold. `buildPalette`'s `startState` option is gone, and ignored if passed: express "the page the user is on" as a condition (`when: app.conditions.onSettingsPage`) |
| `panel: sidecar` | Unchanged: the side panel is open while the state holds |
| `when:` on a command | Unchanged, but a command now has one `when` for every state that lists it. A condition that applied in one state only is combined with that state's: `'!app.conditions.previewed \|\| app.results.previewedHasServiceLink'` |
| `ask: { text: ..., required: ... }` (the typed words) | A param with `argSource: { freeform: true, type: text }`; the prompt and the message go in its `path` (`prompt`, `required`). The param's own `required: true` is different: a typed line can't run until it is given. Leave it out when converting |
| `ask: { choose: <picker> }`, with the picker under `pickers` | A param with `argSource: { lookup: <the picker's from> }`; the picker's `empty` goes in the param's `path.empty`, where `{title}` becomes `{label}`. The `pickers` map goes |
| `forEach: facets`, with `facets` listing the facets | One `list: true` param per facet, each with `argSource: { lookup: ..., key: <facet> }`; the facet's `title` and `aliases` become the param's `label` and `aliases`. The `facets` map goes. Shared fields can sit under an `x-facet: &facet` key and be merged with `<<: *facet` |
| `args: [any]` (a fixed argument) | In a command with several params (as `match` inside `search`), a param whose `argSource.list` has that value, with `path: { rows: each value }` for a row of its own (`rows: each value` takes effect only there). A command that only ever runs with one fixed value has no param: its `run` binding passes the value (`setMatchAny: () => setMatch('any')`). To keep v2's row title and aliases: `path.title: 'Match {title}'` (`{title}` is the value's title) and `aliases` on the list value: `[{ value: any, title: any, aliases: [either] }]` |
| `args: [{ terms: $value }]` (the asked value inside an object) | Name the param `terms`: `run` receives `{ terms: 'grid' }`, the same object |
| `args: [$value.facet, $value.value]` (positional arguments from a row's value) | A small adapter in the bindings (part 3): `({ filter }) => drop(filter.facet, filter.value)` |
| Several commands that add to one thing (search terms, sort, match, a facet) | Usually one command with a param for each, so a typed line can set them together (`search grid with sort created`). It needs: a new `run` that makes the whole change at once (part 3); `default: true` on the param that takes the bare words after the command; `hints: [with]` (or similar) on the other params, so they can follow the typed words; and `path.group` on a param whose row should stay in another v2 group. Keep commands that do something different to the same thing (replace the terms, clear the filters) separate |

Row ids follow the catalog's names. A command with no params or one param has one row, `<app>.<command>`. A command
with several params has a row per param, `<app>.<command>.<param>`, and a `rows: each value` param has a row per
value, `<app>.<command>.<param>.<value>`. To keep a v2 id for a param's row or a value's row (for tests or saved
shortcuts), set the whole id in that param's `path.id` (`path: { id: app.search.merge }`), or on a list value
(`{ value: all, title: all, path: { id: app.search.matchAll } }`). A command's own row has no override, so keep the
command's v2 name to keep its id. Version 2's `forEach` rows were `<app>.<command>.<facet>`.

A worked example: the same catalog in
[version 2](https://github.com/csepulv/shortround/blob/main/packages/shortround-core/src/catalog/__tests__/fixtures/search-palette.v2.yaml)
and
[version 3](https://github.com/csepulv/shortround/blob/main/packages/shortround-core/src/catalog/__tests__/fixtures/search-palette-v3.yaml).
Run `checkCatalog` on the new file as you go; it names the command (and param) and the reason for anything wrong.

**2. The words people type.** A typed line names a command by its name or an alias (and, from 0.6.0, by a label of plain
words), and fills a param by its label, aliases or hints. A literal translation leaves most commands untypeable:

- **A command's name is typed only if it is a plain lowercase word** (`next`, `open`). Version 2's names are dotted
  (`search.clearFilters`): give each command an alias phrase people say (`clear filters`).
- **A param's label is a word too.** Three commands with a param labelled `Result` make a line that starts with
  `result` ambiguous; that matters only if people start lines with it.
- Add the words people use that v2 never needed (`tags` beside `tagged`).

The [catalog-discovery skill's review script](https://github.com/csepulv/shortround/tree/main/skills/catalog-discovery)
lists the words nobody can type and the words that mean two things in a state.

**3. The bindings.**

- **A `run` is called once, with one object**: the command's args by param (`{ term: 'grid', sort: 'relevance', tags:
  ['react'] }`; a `list: true` param's arg is a list). A v2 function that took positional arguments
  (`addFacetValue(facet, value)`) gets a small adapter, and a command that merges several v2 commands gets one
  function that makes the whole change at once.
- **Conditions replace `then`.** Each state's `when` names functions that return a boolean (such as
  `app.conditions.previewed`); add them to the bindings.
- **`current`** (new, optional): a function returning the arg the app holds now, such as the previewed result's id,
  or `undefined`. A one-param command's row runs at once with it, and asks otherwise; a typed line fills any param it
  leaves out that has one.
- **Lookups** are called with `{ command, filled, key }`, may return a promise, and return rows `{ value, title,
  subtitle?, aliases?, key?, isApplied? }`. Mark a value already in effect `isApplied: true`. Version 2's `from` also
  received the catalog's `facets`; a lookup that used them for titles now takes them from the app.
- A `run` no longer returns `isCancelled`; it may still return `{ message, sideEffects }`.

**4. The examples.** An example's `means` is now a call, not a row id:

```yaml
# version 2
- say: search react grid
  means: app.search::text
# version 3
- say: search react grid
  means: { search: { term: react grid } }
```

**5. The sidekick.** Give it the palette whole, and tell the palette when your app's state changes outside it: the
states' conditions (a preview closed by its own button), and the data typed lines read (new results, new facet
values). The palette caches what a line read until it is told.

```jsx
<ShortRoundSidekick palette={palette} />
```

```js
useEffect(() => palette.notify(), [palette, previewed, results]);
```

`palette` replaces `defaultIntentions`, `resolveDefaultInput` and `resolveDefaultFallbackInput` (and a
`defaultSidecarRenderer` that came from the start state's panel): the sidekick opens on the states that hold, with
their panel.

*Check:* `checkCatalog` passes on the new file; every command can be typed (part 2); your catalog-loads test and
`findExampleFailures` test pass; in the app, the palette opens on the right list, and after a change outside the
palette (closing a preview by its own button, a new search), the open palette follows.

**Asking an agent to do it:**

> Move `catalog.yaml` from ShortRound catalog format version 2 to version 3. Follow `MIGRATING.md`, "From a v2
> catalog", and core's `CATALOG.md`. Keep every command's behaviour; where several v2 commands add to one thing,
> propose merging them into one command with params, and ask before doing it. Give every command words people can
> type. Update the bindings, the examples and the sidekick wiring, and run the catalog tests.

### Theme authors

- The theme contract's types (`SidekickComponents`, `ShortRoundTheme`, `IconRegistry`, `ToastProps`) are
  `@shortround/react`'s. Behaviour (cmdk, keyboard, focus, the dialog) is the React package's, so themes still only
  draw.
- `@shortround/conformance` renders with `@shortround/react`, so a theme's tests need `@shortround/react` installed beside
  core.
- With a catalog's palette (line hints on), the `input` your `IntentionPalette.Input` slot receives is a wrapper
  around the input, with a layer that draws the words under it, and the input's own text is transparent. Place
  `input` as given; don't clone it or force the input's text colour. Colour the words through their `data-role`.

### Apps with their own UI (new, optional)

- **`createPaletteStore`** in `@shortround/core` is the palette without React: the list, typing, choosing a row,
  Back and Cancel, the side panel's proposals. Drive it from any UI, such as slash commands in an editor; see core's
  README. `useShortRound` is now this store as a hook, with the same return value plus `revertIntentions`: the Back
  and Cancel rows a list asked for, which a palette of your own on the hook can now draw (`dispatch` chooses a row as
  `ShortRoundSidekick` does, keeping them).
- **`matchIntentions(text, intentions)`** is the palette's fuzzy matching, so code that copied the rule can import it.
- **`createPaletteStore({ palette })`** drives a catalog's palette from your own UI: it starts from
  `palette.current()`, and `watchPalette()` follows `palette.notify()`. While watched it reads typed lines through one
  command line, `store.commandLine()`: draw the input's words and ghost from that line, so the rows and the input are
  one reading, and pass the caret to `changeInput(text, caret)`. `getState().highlightedId` is the row Enter should run.
- **`makeCommandBuilder({ commands, lookups })`** reads a typed line into whole commands with their calls, for a host
  that isn't the palette.
- **`makeCommandLine({ builder, run })`** makes a command line over any command builder.
- **`palette.commandLine()`** is a typed line for your own UI or an editor's slash command: what to show for it (each
  word's role, the ghost of the next word) and what Tab and Enter do; see core's README, The command line.
- Also exported now: `bringsList`, `NAVIGATE_GROUP`, `cycleCorners`, `cycleMiddlePositions`.

### Sidekick store (rarely matters)

- `createSidekickStore` keeps its shape. It is now built on Zustand's vanilla store, so a listener passed to
  `subscribe` is called with `(state, previousState)`, and a `set` whose function returns the same state object
  notifies no one.
  *To do:* nothing, unless your code relied on either.

### A result without a list (rarely matters)

- `disableInputMatching` belongs to the list a result brings. A result with no `intentions` (only a `message`, say)
  leaves it as it is; in 0.4.0, every result set it, so such a row chosen in a typed-text step turned matching back on.
  *To do:* nothing, unless an action returns `disableInputMatching` without `intentions` to change matching: return it
  with the list it describes.
  *Check:* in a typed-text step, choose a row that returns only `{ message }`; the step's rows still all show,
  whatever is typed.

### Removed

- `@shortround/shadcn-ui`, a prototype that was never published.

### New (optional)

- **Completion rows.** An intention with `completion` (a string) completes the typed line instead of running:
  choosing it sets the input to `completion` and keeps the palette open, and its `action` isn't called. Tab applies
  the first enabled completion row.
  *To do:* nothing, unless you want rows that build a line step by step. Rows without `completion` behave as before.
  *Check:* a row with `completion: 'search '`; choose it, and the input reads `search `.

- **Resolvers that update without new input.** A `resolveInput` (or `resolveDefaultInput`) function may carry
  `subscribe(listener)`, returning an unsubscribe function. While the palette is open, `@shortround/react`'s palette
  watches it and renders again when the listener is called; a UI of your own on `createPaletteStore` calls the
  store's `watchResolver()` to have the store tell its listeners. Use it when your resolver's rows can change while
  the input doesn't, such as after an async lookup.
  *To do:* nothing, unless your resolver has data that arrives later.

- **Line hints.** With a catalog's palette, `@shortround/react`'s input colours each word by its role and shows the
  rest of the next word as ghost text; Tab completes through the line.
  *To do:* nothing. To keep the plain input, pass `disableLineHints`. A theme other than `@shortround/mui` can colour
  the words through their `data-role`.

- **Commands a typed line can't reach.** A command's name is typed only when it is a plain lowercase word; a name like
  `clearFilters` needs an alias. `findUntypedCommands(catalog)` lists the commands with neither, as `{ command, label }`.
  *To do:* add a test that expects `[]` (ADOPTING-A-CATALOG.md, step 5), or aliases for the commands it lists.

### TypeScript

- `Intention` gains `completion?: string`; `ResolveInput` gains `subscribe?: (listener: () => void) => () => void`.
- The UI's types move with the UI: `UseShortRoundResult`, `UseSidekickResult`, `AnchorPositionStyle` and the theme
  types above are `@shortround/react`'s. `UseShortRoundResult` gains `revertIntentions`. The headless types (`Intention`, `IntentionActionResult`, `ResolveInput`,
  `ResolveFallbackInput`, `SidekickStore`, `SidecarReducer`, ...) stay in core, with no React types: a side-panel
  renderer is `SidecarRenderer` (`() => unknown`), so a `() => ReactNode` still fits. New: `PaletteStore`,
  `PaletteStoreState`, `PaletteDefaults`, `PaletteSource`, `BuilderCommand`, `BuilderState`, `WordRole`,
  `CommandLine`, `CommandLineState`.
- `SidekickStore` now declares `changeSidecar`, `clearSidecar` and `setSidecarReducer` (the store always had them);
  `IntentionActionResult` gains `listKind?` and `command?` (set by a catalog's results); new: `PaletteNow`.
- The catalog's types describe version 3: `CheckedCatalog` and `Catalog` have `groups`, `states` and `commands`
  (`CatalogCommand`, `CatalogParam`, `ArgSource`, `CatalogState`); `Palette` adds `current`, `notify`, `subscribe`,
  `isAvailable`, `listNow` and `commandLine`; `CatalogExample.means` is an `ExampleCall`; `RunOutcome` has no `isCancelled`; `buildPalette`'s options have no
  `startState`.
- `ShortRoundSidekick` takes `palette?: PaletteSource` and `disableLineHints?: boolean`, and `defaultIntentions` is
  optional.

### Fixed (no action)

- A row whose id starts or ends with a space can now be chosen, and shows as highlighted.
- `@shortround/mui` and `@shortround/react` use the app's `react/jsx-runtime` (0.4.0's MUI bundled React 18's), so they
  run under React 19.

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
[`packages/shortround-core/ADOPTING-A-CATALOG.md`](packages/shortround-core/ADOPTING-A-CATALOG.md) (in
`@shortround/catalog` until 0.5.0, when the catalog became part of core).

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
