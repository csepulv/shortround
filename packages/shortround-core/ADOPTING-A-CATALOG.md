# Adopting a catalog

How to add a palette to an app from a finished catalog: the steps from `catalog.yaml` to a running
`ShortRoundSidekick`. The catalog's fields and the way typed lines read are in [CATALOG.md](./CATALOG.md); this
document is the setup. To make a catalog in the first place, see "Making a catalog" there. Moving a catalog from
format version 2: see
[`MIGRATING.md`, "From a v2 catalog"](https://github.com/csepulv/shortround/blob/main/MIGRATING.md#from-a-v2-catalog).

You start with:

- `catalog.yaml` (format version 3): the app's groups, states and commands.
- `catalog.examples.yaml` (optional, recommended): typed lines and the call each should run.
- Optionally, a list of the functions the catalog names (every `run`, `lookup`, `current` and condition in `when`),
  noting which the app already has, which need a small adapter, and which are missing. If your catalog came without
  one, make it at the start of step 2.

## Before you start

- **Install** `@shortround/core` and `@shortround/react` (0.6.0 or later). Core brings the catalog engine and the
  command builder, with `yaml`, `zod`, `jsep`, `chrono-node` and `damerau-levenshtein`, and doesn't depend on React.

## 1. Check the catalog

```js
import { checkCatalog } from '@shortround/core';

checkCatalog(CATALOG_TEXT); // throws, naming the command (and param) and the reason, if anything is wrong
```

`checkCatalog` makes every check `loadCatalog` will make except finding your functions, so it runs before any
binding exists. It checks each `when` clause's shape too. Fix what it reports first.

## 2. Write the bindings

Bindings are a plain object whose dotted paths match every `run`, `lookup`, `current` and condition in the catalog's
built part. Planned states and commands need nothing: the engine leaves them out.

```js
// catalog-bindings.js
export function makeCatalogBindings({ search, results }) {
  return {
    app: {
      conditions: { previewed: () => results.getPreviewed() !== null }, // a condition: returns a boolean
      search: {
        apply: (args) => search.apply(args) // Search's run: one call with every arg, { term, sort, tags: [...] }
      },
      sortOptions: {
        rows: () => SORT_OPTIONS.map((option) => ({ value: option.id, title: option.label })) // a lookup
      }
    }
  };
}
```

Work through the function list:

- **Every `run` receives one object**, the command's args by param: `{ term: 'grid' }`, `{ result: 'w2' }`, or a
  compound command's `{ term: 'grid', sort: 'relevance', tags: ['react'] }` (a `list: true` param's arg is a list).
  A command with several params runs once with all of them, so your function should make one change for the whole
  call (one URL push, one store update). A function that already takes that object passes straight through; one that
  takes positional arguments gets a small adapter (`dropFilter: ({ filter }) => search.drop(filter.facet,
  filter.value)`).
- Each path must end at a function the object *owns*: a class instance's methods live on its prototype, so wrap them.
- **Lookups** (`argSource.lookup`) are called with `{ command, filled, key }` and return rows `{ value, title,
  subtitle?, aliases?, key?, isApplied? }`. They may return a promise: a typed line says "Loading …" after a short
  delay, and an error says the values couldn't load. A picker waits for its rows, so keep a slow lookup bounded (fall
  back to what you have after a time limit). Mark a value already in effect `isApplied: true`; it isn't offered again.
- **`current`** returns the arg your app holds now (such as the previewed result's id), or `undefined` when it holds
  none: a one-param command's row runs at once with it, and asks otherwise; a typed line fills any param it leaves
  out that has one.
- **Conditions** return a boolean, read each time the list is built. States hold while their `when` holds, so the
  list follows your app's own state.
- **Outcomes:** a `run` may return `{ message }`, and `sideEffects` (`{ sidecarRenderer }` or `{ closeSidecar: true
  }`) to open or close the side panel; they win over what the states' `panel` would do.
- **Missing** functions have to be written in the app before the command can be built. Until then, mark the command
  `planned: true` in the catalog; the palette leaves it out.

## 3. Build the palette

```js
import { buildPalette, loadCatalog, RevertIntentionIds } from '@shortround/core';

import CATALOG_TEXT from './catalog.yaml?raw'; // Vite; any way of reading the file's text works

const palette = useMemo(
  () =>
    buildPalette(loadCatalog(CATALOG_TEXT, makeCatalogBindings({ search, results })), {
      panels: { sidecar: () => <Preview /> },
      backIntentionId: RevertIntentionIds.BACK
    }),
  [search, results]
);
```

- `loadCatalog` resolves every path against the bindings. A path your bindings don't provide fails here, naming the
  command (and param) and the path.
- `panels` needs a renderer for each `panel` the catalog's states use.
- `fallback` (optional) adds rows after a state's matches, for example "Send as chat" when nothing matched:
  `fallback: (text, { matches, stateName }) => (matches.length ? [] : [sendAsChatRow(text)])`. Give its rows a
  `group` of their own (such as `Chat`) to draw them last. Pickers and text steps never get it.
- **Build the palette once.** It reads your app's state through the bindings each time, so it doesn't need
  rebuilding when the state changes.

## 4. Wire the sidekick, and tell it when your state changes

```jsx
import { ShortRoundSidekick } from '@shortround/react';

<ShortRoundSidekick palette={palette} /* the app's other props, unchanged */ />
```

The sidekick needs a theme: a `ShortRoundProvider` at the app's root (`@shortround/react`'s README, "Choosing a theme:
ShortRoundProvider"), or `SidekickComponents` on the sidekick.

The sidekick opens on the states that hold at that moment, with their side panel, and every run brings the list for
the states that hold after it. When your app's state changes outside the palette (a preview closed by its own
button, new results that leave the previewed one out), call `palette.notify()`: the open palette re-reads, and a step
whose command is no longer available returns to the list and says so.

```js
useEffect(() => palette.notify(), [palette, previewed]);
```

The sidekick's input shows how a typed line is read (each word's role, and the rest of the next word as ghost text, which the theme colours); pass
`disableLineHints` to keep the plain input. Without React, a palette store watching the palette gives the same reading
as `store.commandLine()`, one with its rows; in an editor, `palette.commandLine()` gives a line of your own: see
core's README, "The palette, from your own UI" and "The command line".

## 5. Test it

Three tests catch most mistakes:

```js
import {
  buildPalette,
  checkCatalog,
  findExampleFailures,
  findInvalidToolNames,
  findUntypedCommands,
  loadCatalog,
  loadExamples
} from '@shortround/core';

test('the catalog loads against the bindings', () => {
  expect(() => loadCatalog(CATALOG_TEXT, makeCatalogBindings(fakeApp()))).not.toThrow();
});

test('every example runs what it means', () => {
  const palette = buildPalette(loadCatalog(CATALOG_TEXT, makeCatalogBindings(fakeApp())), {
    panels: { sidecar: () => null },
    backIntentionId: 'back'
  });
  expect(findExampleFailures(palette, loadExamples(EXAMPLES_TEXT))).toEqual([]);
});

test('every command can be typed', () => {
  expect(findUntypedCommands(checkCatalog(CATALOG_TEXT))).toEqual([]);
});
```

A command is typed by its name when the name is a plain lowercase word (`search`), by its label when the label is
plain words (`Clear filters` is typed "clear filters"), and by its aliases. `findUntypedCommands` lists the commands
with none of these, such as `exportCsv` labelled `Export (CSV)` with no alias. If one is meant to be picked only, never
typed, list it in the expectation instead of `[]`:
`expect(findUntypedCommands(checkCatalog(CATALOG_TEXT))).toEqual([{ command: 'exportCsv', label: 'Export (CSV)' }])`.

If the catalog drives a chat (`@shortround/chat`), each command is also a tool a model can call, and model providers
take tool names of letters, digits, `_` and `-`, up to 64 characters. Add a fourth test:
`expect(findInvalidToolNames(checkCatalog(CATALOG_TEXT))).toEqual([])`. It lists each command it would refuse as
`{ command, reason }`, such as `{ command: 'notes.archive', reason: 'a tool name has only letters, digits, _ and -' }`;
the runtime leaves those out of its tools, with a warning.

The examples test reads each line against the list the palette was built on (the states that hold for your fake app;
usually the start state's) and the rows your lookups return, so give the fake app
realistic data, with near neighbours (`react` next to `react-native`): tidy data hides ranking mistakes.

An example's `means` writes each arg as your `run` receives it. For a param of `type: integer` or `number`, that is a
number (`means: { showNotes: { limit: 20 } }`, not `'20'`), and a word a `nullable` param names is `null`
(`say: show notes all`, `means: { showNotes: { limit: null } }`).

## Asking an agent to do it

> Add a ShortRound palette to this app from `catalog.yaml`. Follow `ADOPTING-A-CATALOG.md` in `@shortround/core`.
> List every function the catalog names and whether the app has it, needs an adapter, or is missing it. Write the
> bindings in `catalog-bindings.js`, mark any command whose function is missing as `planned`, and add the three tests
> (and the fourth, if the catalog drives a chat).
