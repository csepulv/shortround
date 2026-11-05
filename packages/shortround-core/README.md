# @shortround/core

ShortRound's core: the command palette without a UI. It holds the palette's state (the list, what's typed, what ran,
Back and Cancel), the matching, the side panel's state, the catalog engine, the command builder (typed whole commands)
and the constants. It has no React and no DOM: a server, an editor extension or a Node test can import it.

To draw the palette with React, use [`@shortround/react`](https://github.com/csepulv/shortround/tree/main/packages/shortround-react)
with a theme such as `@shortround/mui`. Use core directly to drive the palette from your own UI, such as slash commands
in an editor.
Before 0.5.0, core also held the React components and hooks (`ShortRoundSidekick`, `ShortRoundProvider`,
`useShortRound`, ...); they are now `@shortround/react`.

## Installation

```bash
npm install @shortround/core
```

Upgrading from an earlier version? See the
[migration guide](https://github.com/csepulv/shortround/blob/main/MIGRATING.md).

## The palette, from your own UI

`createPaletteStore` is one palette: give it the start list, then call it as the user types and chooses. Draw
`rows()`; re-read when a listener is told.

```js
import { createPaletteStore, RevertIntentionIds } from '@shortround/core';

const leaf = { id: 'leaf', title: 'Leaf', action: () => ({}) };
const open = {
  id: 'open',
  title: 'Open things',
  action: () => ({ intentions: [leaf], includeRevertIntentions: [RevertIntentionIds.BACK] })
};

const palette = createPaletteStore({ defaultIntentions: [open] });
const stop = palette.subscribe(() => draw(palette.rows())); // draw is your UI's

palette.changeInput('open'); // rows(): [open]
await palette.select('open'); // rows(): [leaf]
await palette.select(RevertIntentionIds.BACK); // rows(): [open]
```

(This is the sequence
[`scripts/check-node-import.js`](https://github.com/csepulv/shortround/blob/main/packages/shortround-core/scripts/check-node-import.js)
runs against the built package, in plain Node.)

- `rows()` is what to show now: rows from the typed-text resolver, then the fuzzy matches, then the fallback's rows;
  the list itself during a typed-text step. It's worked out when read, since a resolver reads live app data.
- `changeInput(text, caret?)` sets the input and runs each intention's `validate`; `getState().inputMessage` says why
  a row is disabled. Pass the caret when it isn't at the end (with a catalog palette, the next steps follow it).
- `getState().highlightedId` is the highlighted row: after every change of the rows (typing, a new list, a lookup
  that landed) it is the first enabled row as drawn, so Enter on it runs what an instant lookup would have. Move it with
  `highlight(id)` (arrow keys) and run it with `select(getState().highlightedId)`.
- `select(id, { sidekickStore, defaultSidecarRenderer })` is choosing a row: a completion row sets the input; any other
  runs, proposes the side panel's change to the sidekick store (when given), and keeps the Back and Cancel rows the
  result asks for (`getState().revertIntentions`). It returns the result, for what your UI does itself: show
  `message`, close on `shouldReset`.
- `completeFirst()` is Tab: it applies the first enabled completion row and says whether there was one. With a
  catalog palette, it completes at the caret, and `commandLine().getState().caret` says where the caret goes.
- `dispatch(id)`, `back()` and `reset()` run without the side panel and Back and Cancel bookkeeping;
  `setDefaults({ defaultIntentions, resolveDefaultInput, resolveDefaultFallbackInput })` starts over with new ones.
- `watchResolver()` re-reads when the resolver says its rows changed (an async lookup landed), and returns a function
  that stops.
- **With a palette from a catalog**, `createPaletteStore({ palette })` starts from `palette.current()` (the states
  that hold now), and Back or Cancel to the start lands there too. `watchPalette()` re-reads when your app calls
  `palette.notify()`: the start list (or a list a run brought) follows, and a step whose command is no longer
  available returns to it with a message. Following to such a list drops the steps that led to it, and while a
  choice runs the store waits, then follows once it settles (a choice that never settles stops counting when the
  user makes another). `refresh()` re-reads on demand, and waits the same way while a choice runs.
  While watching, the store also reads typed lines through one command line of its own, `commandLine()` (`null` in a
  picker or a typed-text step): its typed rows, and the words and ghost you draw from the line, are one reading, so a
  lookup is called once per text. The function `watchPalette()` returns stops following and disposes that line
  (watches are counted: the last stop disposes it). `setDefaults` while watched follows the new source.

The intention and result shapes, typed-text resolvers, fallbacks and completion rows are described in
`@shortround/react`'s README (Intention Object, Typed input); they are the same objects here.

## The side panel's state

`createSidekickStore(initial)` holds whether the sidekick is open, where, at what size, and what its side panel shows.
`openSidecar(renderer)` and `closeSidecar()` go through the app's `sidecarReducer` (`setSidecarReducer`), as the
palette's proposals do. Core stores a renderer and hands it back; it never calls it, so what it draws is your UI's.

## Matching

`matchIntentions(text, intentions)` is the palette's fuzzy matching (title, group and aliases, threshold 0.5, in list
order). Use it to know what the palette would show for a text, instead of copying the rule.

## The catalog

`loadCatalog`, `checkCatalog`, `buildPalette`, `loadExamples`, `findExampleFailures` and `findUntypedCommands` build
and check the palette from a YAML catalog of an app's commands (format version 3): rows to pick from, and typed whole
commands. See
[CATALOG.md](./CATALOG.md) for the format and [ADOPTING-A-CATALOG.md](./ADOPTING-A-CATALOG.md) for adding one to an
app. (They were `@shortround/catalog` before 0.5.0, for format version 2.)

## The command builder

`makeCommandBuilder({ commands, lookups })` reads a typed line into whole commands (`search grid with tags react`),
for a host that isn't the palette. `read(text, caret?)` returns the candidate readings, best first, each with the
`call` it would run; the next steps at the caret; what is still being typed; and lookups still loading or failed.
It keeps what it read between calls, so reading after each keystroke stays cheap. `buildPalette` uses it for typed
lines; the format of its commands is the catalog's (see [CATALOG.md](./CATALOG.md), Typed lines).

## The command line

A command line is one line of text read against the commands: it says what a host should show for it and what Tab
and Enter do. A palette input is one host; an editor's slash command is another; anything that produces a line (a
voice transcript, an agent) could be a third.

```js
const catalogPalette = buildPalette(loadCatalog(text, bindings), { backIntentionId });
const line = catalogPalette.commandLine(); // the commands available now
line.change('search grid with sort cre');
const { roles, ghost, top, canRun, loading } = line.getState();
// roles: each word with its role (verb, text, hint, param, value, unread, broken); ghost: 'ated-newest '
line.acceptCompletion(); // Tab: the first next step; the caret lands after the inserted word
await line.submit(); // Enter: runs the line once, as a typed-line row would, and clears it
line.dispose(); // when the host goes away: it stops hearing lookups and the app
```

`getState()` returns the same object until something changes, so React can read it with `useSyncExternalStore`;
`subscribe` is told when the line changes, a lookup lands, or the loading delay passes. A palette's command line
follows the app: after `notify()` and after its own runs it reads the commands available now. Each line reads with
engines of its own, so several can be open at once (an editor's slash command beside the palette). A palette line's
`rows()` gives the typed-line rows for the line as it reads now; a palette store watching the palette shows those, from
its own line (`store.commandLine()`).
`makeCommandLine({ builder, run })` makes one over any command builder. A second `submit()` while a run is in
progress returns that run instead of running again, and text typed during the run stays.

In an editor, remove the typed trigger (the "/…" text) before `submit()`, and don't `cancel()` the line while it
submits: closing a popup usually happens first, and `submit()` clears the line itself after the run. The
[TipTap example](https://github.com/csepulv/shortround/tree/main/examples/tiptap-slash) shows a slash command built
this way, with core alone.

## Constants

`RevertIntentionIds` (Back and Cancel), `makeRevertIntentionsFor`, `NAVIGATE_GROUP`, `bringsList`, `AnchorPositions`,
`cycleCorners`, `cycleMiddlePositions`, `Sizes` and `ControlLabels`.

## TypeScript

The package carries its types: `Intention`, `IntentionActionResult`, `ResolveInput`, `ResolveFallbackInput`,
`PaletteStore`, `PaletteStoreState`, `PaletteDefaults`, `PaletteSource`, `SidekickStore`, `SidekickStoreState`,
`SidecarReducer`, `SidecarChange`, `SidecarReason`, `SidecarRenderer`, `BuilderCommand`, `BuilderState`, `WordRole`,
`CommandLine`, `CommandLineState`, and the
catalog's types (`Catalog`, `CheckedCatalog`, `Palette`, `PickerRow`, `RunOutcome`, `CatalogExample`, ...).

## License

MIT
