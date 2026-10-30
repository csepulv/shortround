# @shortround/catalog

## 0.3.0

### Minor Changes

- 6d716e6: First release. Builds a ShortRound palette from a declarative catalog: a YAML file of the app's states, the commands
  each offers, what each asks for (a typed value or a choice from a list), and which of the app's functions it runs.
  `loadCatalog` checks the catalog and finds each function in the app's bindings; `buildPalette` returns the start
  list and an input resolver, so a typed line such as `kind lib sort created newest` runs as one row. `checkCatalog`
  makes the same checks without the app. A catalog can also hold planned states and commands, workflows and review
  notes; the palette leaves them out. `args` says how a function is called when its shape isn't the default. Setup:
  `ADOPTING-A-CATALOG.md`.
