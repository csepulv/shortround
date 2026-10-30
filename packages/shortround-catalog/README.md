# @shortround/catalog

Builds a ShortRound palette from a declarative **catalog**: a YAML file that says which states your app has, which
commands belong to each, what each command asks for, and which of your functions it runs. The engine turns the catalog
into the intentions `@shortround/core` shows, plus an **input resolver** so a typed line such as `kind lib` or
`sort created newest` becomes one runnable row.

> `npm install @shortround/catalog` (from 0.3.0). Typed lines need `@shortround/core` 0.3.0 or later.

## A small catalog

```yaml
version: 2
app: app

pickers:
  sortOption:
    from: app.sortOptions.rows # your function: returns rows { value, title, subtitle?, aliases?, key? }
    empty: No sort options

states:
  browsing:
    start: true
    commands:
      search.setSort:
        title: Sort
        group: Refine
        icon: settings
        aliases: [sort by, order by]
        ask: { choose: sortOption }
        run: app.search.setSort # your function, called with the chosen value
      search.matchAny:
        title: Match any
        group: Refine
        run: app.search.setMatch
        args: [any] # the call's arguments, when they aren't the default
```

Code is referenced by name: every `run`, `when` and `from` is a dotted path into the bindings you pass in. Name
commands after the methods they call where one exists (`search.setSort`), so the intention id (`app.search.setSort`),
the catalog and your code read the same. Bindings are plain objects, and each path must end at a function the object
owns: a class instance's methods live on its prototype, so put them in an object (`{ setSort: (id) =>
search.setSort(id) }`).

## Making a catalog

The repository's [`catalog-discovery` skill](https://github.com/csepulv/shortround/tree/main/skills/catalog-discovery)
guides a coding agent through mapping an existing app into a catalog, from its code, docs and recordings, asking you
only where the evidence is ambiguous. It produces the catalog, an examples file, a discovery log, and a local review
page; its review script checks the catalog with this engine's own checks and needs only Node. To use it with Claude
Code, copy the folder into `~/.claude/skills/` (or a project's `.claude/skills/`).

## API

To add a palette to an app from a catalog (bindings, building the palette, wiring the sidekick, tests), see
[ADOPTING-A-CATALOG.md](./ADOPTING-A-CATALOG.md).

- `loadCatalog(text, bindings)` parses and checks the catalog. A misspelled field, a missing title, an unknown picker
  or state, or a path your bindings don't provide fails here, naming the command and the path, not later when a user
  picks the command.
- `checkCatalog(text)` makes every check `loadCatalog` makes except resolving code paths, so a catalog can be checked
  without the app (while it is written or reviewed). It returns the catalog as written, planned items included.
- `buildPalette(catalog, { panels, backIntentionId })` returns `{ intentions, resolveInput }` for the start state.
  Every state the palette moves to carries its own resolver; a picker's list and a text step use ShortRound's fuzzy
  matching only. The engine has no dependency on React or `@shortround/core`; you pass the Back row id and any panel
  renderers. Memoize the palette: ShortRound resets its list when the intentions or the resolver change.

## Catalog fields

| Field | Meaning |
|---|---|
| `states.<name>.start` | The state the palette opens in (exactly one) |
| `states.<name>.panel: sidecar` | The side panel is open while in this state, and closes on leaving it |
| `commands.<name>.title`, `aliases`, `group`, `icon` | How the row reads; title and aliases are also the words you can type |
| `run` | The function the command calls, with `args` if given, else with the `forEach` key and the asked value (each only if the command has one). It may return `{ message }`, or `{ message, isCancelled: true }` to stay in the current state |
| `args` | The call's arguments, in order, when they aren't just the default. Each is a literal, or a reference: `$key` (the `forEach` facet key), `$value` (the chosen or typed value), `$value.<field>` (a field of an object value). References work inside objects and lists: `args: [{ terms: $value }]`, `args: [$value.facet, $value.value]`, `args: [any]`. Any other string is a literal, except one that starts with `$key` or `$value` without being a reference (`$values`, `$value.0`, `$key.length`): the catalog fails to load, naming the command |
| `ask: { choose: <picker> }` | A list to pick the value from |
| `ask: { text, required }` | A typed-text step; `required` asks again with that message on a blank entry |
| `when` | A condition function; the command is listed only while it returns true |
| `then` | The state after the command (default: the same state) |
| `forEach: facets` | One command per entry in `facets`, each named by its title and aliases |
| `pickers.<name>.from`, `empty` | The rows function (called with `{ key, facets }`) and the message when it returns none; `{title}` in the message is the command's title, in lower case. A row with `isApplied: true` (a value already in effect) isn't offered; a line that names it reads "(already set)" and still runs it, so the command must change nothing for a value already in effect |

### Planned items and design notes

A catalog can also hold what isn't built yet, so one file is both the palette and its design. The engine checks these
fields, then leaves planned items out: the palette never offers them, and their functions don't have to exist.

| Field | Meaning |
|---|---|
| `planned: true` (state, command or picker) | Designed, not built. A planned command or picker may leave out `run` or `from`; every command in a planned state is planned |
| `states.<name>.steps` | A guided flow for a planned state: a list of `{ ask }` and `{ run, then }` steps |
| `tier: common \| full` (state or command) | The everyday view or the full catalog; a command without one takes its state's |
| `review` (state or command) | An open question, for whoever reviews the catalog |
| `workflows.<name>` | A named path: `title`, then `steps` (in order) or `options` (places to start), each `{ question, state, do, then }` |

References are still checked on planned commands: a `then` or `choose` must name a state or picker that exists, and
`args` may use `$value` only on a command that asks, and `$key` only on a `forEach` command. The steps of a planned
state and the states named in `workflows` are not checked yet. A built
command can't lead into a planned state or choose from a planned picker, and the start state must be built.

## Typed lines

A typed line resolves when it starts with a command's title or an alias (whole words, any case; the longest match
wins). For a picker command, the rest of the line picks rows: an exact title or alias first, then rows containing every
typed word, then rows whose words start with the typed words. Typing the command's words and a space (or an opening
quote) lists every value not yet applied.
For a text command, the rest of the line is the text. Picker sources must answer synchronously to resolve while typing.

A line may hold several commands, each starting with its own words, in any order: `kind library sort created newest`.
Quotes end a value anywhere, so text can come first: `search "react grid" kind library`. The line resolves to one row
that reads it back ("Search: react grid · Kind: library") and runs the commands in order, stopping at a cancelled
one. Every command in the line must be understood, and only commands that stay in the current state can join one.
While the last command is being typed, its values are listed, each with the commands before it.

Where another command's words appear, a new command starts, unless that leaves one unreadable; then the words belong
to the value before them. So `drop tag react` drops the "Tag: react" filter, and `drop tag react kind library` drops it
and adds a kind. A quoted value is the whole value: `tag "react" design` is not understood. Quote a value to keep
words that are also commands: `search "sort algorithms"`.

## Examples files

An examples file is the catalog's grammar test:

```yaml
examples:
  - say: sort relevance
    means: app.search.setSort::relevance
  - say: sort relevance match any
    means: [app.search.setSort::relevance, app.search.matchAny] # a line: each command's row, in order
```

```js
import { findExampleFailures, loadExamples } from '@shortround/catalog';

expect(findExampleFailures(palette, loadExamples(EXAMPLES_TEXT))).toEqual([]);
```

Each `say` is checked in the start state; a failure names the example and the row it resolved to instead.
