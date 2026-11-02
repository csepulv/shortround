# @shortround/catalog

## 0.4.0

### Minor Changes

- ca97237: A command can open or close the side panel.
  - A `run` may return `sideEffects` (`{ sidecarRenderer }` or `{ closeSidecar: true }`); they win over the ones its
    state's `panel` would set, apply even when the run is cancelled, and in a line of several commands the last one that
    returns them decides.
  - `buildPalette` returns `sidecarRenderer` when the start state has a `panel`; pass it as `ShortRoundSidekick`'s
    `defaultSidecarRenderer` and the palette opens with that panel.

- 699cf3e: `buildPalette(catalog, { startState })` opens the palette in the state you name, such as the page the user is on;
  left out, it is the catalog's start state. A name with no built state in the catalog throws when the palette is
  built.
- 53937ec: `buildPalette(catalog, { fallback })` adds rows after a state's matches (give them a `group` of their own to draw
  them last).
  - `fallback(text, { matches, stateName })` is set on the start list (returned as `palette.resolveFallbackInput`) and on
    every state's list, told that state; never on a picker's or a text step's list.
  - Every result that brings a list says which kind: `listKind` is `'state'`, `'picker'` or `'text'`.
  - Types: `ResolveFallbackInput`, `MatchedRow` (the fields a fallback sees of a listed row, shared with core's rows).

## 0.3.0

### Minor Changes

- 6d716e6: First release. Builds a ShortRound palette from a declarative catalog: a YAML file of the app's states, the commands
  each offers, what each asks for (a typed value or a choice from a list), and which of the app's functions it runs.
  `loadCatalog` checks the catalog and finds each function in the app's bindings; `buildPalette` returns the start
  list and an input resolver, so a typed line such as `kind lib sort created newest` runs as one row. `checkCatalog`
  makes the same checks without the app. A catalog can also hold planned states and commands, workflows and review
  notes; the palette leaves them out. `args` says how a function is called when its shape isn't the default. Setup:
  `ADOPTING-A-CATALOG.md`.
