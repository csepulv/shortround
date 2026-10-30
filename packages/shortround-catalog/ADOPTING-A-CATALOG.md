# Adopting a catalog

How to add a palette to an app from a finished catalog: the steps from `catalog.yaml` to a running
`ShortRoundSidekick`. The catalog's fields and the way typed lines resolve are in the [README](./README.md); this
document is the setup. To make a catalog in the first place, see "Making a catalog" in the README.

You start with:

- `catalog.yaml` — the app's states, commands, pickers and facets.
- `catalog.examples.yaml` (optional, recommended) — typed lines and what each should mean.
- Optionally, a list of the functions the catalog names (every `run`, `when` and `from`), noting which the app
  already has, which need a small adapter, and which are missing. If your catalog came without one, make it at the
  start of step 2: collect every `run`, `when` and `from` in the catalog's built part, and look each up in the app.

## Before you start

- **Install** `@shortround/catalog` (0.3.0 or later). It brings `yaml` and `zod`, and doesn't depend on React or
  `@shortround/core`.
- **Typed lines need `resolveDefaultInput`** on `ShortRoundSidekick`, in `@shortround/core` 0.3.0 or later.

## 1. Check the catalog

```js
import { checkCatalog } from '@shortround/catalog';

checkCatalog(CATALOG_TEXT); // throws, naming the field, command or picker, if anything is wrong
```

`checkCatalog` makes every check `loadCatalog` will make except finding your functions, so it runs before any
binding exists. Fix what it reports first.

## 2. Write the bindings

Bindings are a plain object whose dotted paths match every `run`, `when` and `from` in the catalog's built part.
Planned states, commands and pickers need nothing: the engine leaves them out.

```js
// catalog-bindings.js
export function makeCatalogBindings({ search, results }) {
  return {
    app: {
      search: {
        setSort: (sortId) => search.setSort(sortId), // existing: passes straight through
        merge: (changes) => search.merge(changes) // existing: the catalog shapes the call (args: [{ terms: $value }])
      },
      sortOptions: {
        rows: () => SORT_OPTIONS.map((option) => ({ value: option.id, title: option.label })) // picker rows
      }
    }
  };
}
```

Work through the function list:

- **Existing** functions pass straight through. Each path must end at a function the object *owns*: a class
  instance's methods live on its prototype, so wrap them (`setSort: (id) => search.setSort(id)`).
- **Shape first, in the catalog.** By default `run` is called with the `forEach` key and the asked value, each only
  if the command has one: a per-facet command that asks calls `(facet, value)`, a text command `(text)`. When your
  method wants another shape, say so with `args` rather than writing a wrapper: `args: [{ terms: $value }]` calls
  `merge({ terms })`, `args: [$value.facet, $value.value]` splits a row's object value into two arguments.
- **Adapters** are for what `args` can't say: logic, such as finding a result by id, or turning "nothing loaded"
  into a message.
- **Picker rows** (`from`) return `{ value, title, subtitle?, aliases?, key?, isApplied? }`, synchronously: a typed
  line resolves while the user types. Mark a value already in effect `isApplied: true`; it isn't offered again.
- **Conditions** (`when`) return a boolean, read each time the list is built.
- **Outcomes:** a `run` may return `{ message }`, or `{ message, isCancelled: true }` to stay in the current state
  instead of following `then`. A command must change nothing when asked to apply a value already in effect.
- **Missing** functions have to be written in the app before the command can be built. Until then, mark the command
  `planned: true` in the catalog; the palette leaves it out.

## 3. Build the palette

```js
import { buildPalette, loadCatalog } from '@shortround/catalog';
import { RevertIntentionIds } from '@shortround/core';

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
  command and the path.
- `panels` needs a renderer for each `panel:` the catalog's states use (today, `sidecar`).
- **Memoize the palette.** ShortRound resets its list and input when the intentions or the resolver change, so a new
  palette on every render clears what the user typed.

## 4. Wire the sidekick

```jsx
<ShortRoundSidekick
  defaultIntentions={palette.intentions}
  resolveDefaultInput={palette.resolveInput}
  /* the app's other props, unchanged */
/>
```

`intentions` is the start state's list; `resolveInput` turns a typed line into a runnable row. Every state the
palette moves to brings its own list and resolver.

## 5. Test it

Two tests catch most mistakes:

```js
import { buildPalette, findExampleFailures, loadCatalog, loadExamples } from '@shortround/catalog';

test('the catalog loads against the bindings', () => {
  expect(() => loadCatalog(CATALOG_TEXT, makeCatalogBindings(fakeApp()))).not.toThrow();
});

test('every example resolves to what it means', () => {
  const palette = buildPalette(loadCatalog(CATALOG_TEXT, makeCatalogBindings(fakeApp())), {
    panels: { sidecar: () => null },
    backIntentionId: 'back'
  });
  expect(findExampleFailures(palette, loadExamples(EXAMPLES_TEXT))).toEqual([]);
});
```

The examples test resolves each line in the start state against the rows your picker functions return, so give the
fake app realistic data, with near neighbours (`react` next to `react-native`): tidy data hides ranking mistakes.

## Asking an agent to do it

> Add a ShortRound palette to this app from `catalog.yaml`. Follow `ADOPTING-A-CATALOG.md` in `@shortround/catalog`.
> List every function the catalog names and whether the app has it, needs an adapter, or is missing it. Write the
> bindings in `catalog-bindings.js`, mark any command whose function is missing as `planned`, and add the two tests.
