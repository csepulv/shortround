# The catalog

Builds a ShortRound palette from a declarative **catalog**: a YAML file that says which states your app has, which
commands apply in each, what each command takes, and which of your functions it runs. One catalog drives two ways of
using the palette: rows to pick from, and typed whole commands such as `search grid with tags react` or
`sort created newest`, read by the command builder and run once.

> Part of `@shortround/core` from 0.5.0 (`npm install @shortround/core`), in catalog format version 3. Version 2 (0.3
> and 0.4, when it was `@shortround/catalog`) no longer loads; see
> [`MIGRATING.md`, "From a v2 catalog"](https://github.com/csepulv/shortround/blob/main/MIGRATING.md#from-a-v2-catalog).

## A small catalog

```yaml
version: 3
app: app

groups:
  refine: { label: Refine, icon: settings }

states:
  browsing:
    start: true
    commands: [search]

commands:
  search:
    label: Search
    group: refine
    run: app.search.apply # your function, called once with the args: { sort: 'relevance', match: 'any' }
    params:
      sort:
        label: Sort
        aliases: [sort by, order by]
        argSource: { lookup: app.sortOptions.rows } # your function: returns rows { value, title, ... }
      match:
        label: Match
        argSource: { list: [{ value: any, title: any }] }
        path: { rows: each value, title: 'Match {title}' } # one picking row per value: "Match any"
```

Code is referenced by name: every `run`, `lookup`, `current` and condition in `when` is a dotted path into the
bindings you pass in. Bindings are plain objects, and each path must end at a function the object owns: a class
instance's methods live on its prototype, so put them in an object (`{ apply: (args) => search.apply(args) }`).

## Making a catalog

The repository's [`catalog-discovery` skill](https://github.com/csepulv/shortround/tree/main/skills/catalog-discovery)
guides a coding agent through mapping an existing app into a catalog, from its code, docs and recordings, asking you
only where the evidence is ambiguous. It produces the catalog, an examples file, a discovery log, and a local review
page; its review script checks the catalog with this engine's own checks and needs only Node. To use it with Claude
Code, copy the folder into `~/.claude/skills/` (or a project's `.claude/skills/`).

## API

To add a palette to an app from a catalog (bindings, building the palette, wiring the sidekick, tests), see
[ADOPTING-A-CATALOG.md](./ADOPTING-A-CATALOG.md).

- `loadCatalog(text, bindings)` parses and checks the catalog. A misspelled field, an unknown group or command, a
  `when` clause that compares, or a path your bindings don't provide fails here, naming the command (and param) and
  the reason, not later when a user picks the command. A `version: 2` catalog fails with a pointer to `MIGRATING.md`.
- `checkCatalog(text)` makes every check `loadCatalog` makes except resolving code paths, so a catalog can be checked
  without the app (while it is written or reviewed). It checks each `when` clause's shape too. It returns the catalog
  as written, planned items included.
- `buildPalette(catalog, { panels, backIntentionId, fallback })` returns the palette for the states that hold when it
  is built: `{ intentions, resolveInput, resolveFallbackInput, sidecarRenderer }`, plus
  - `current()`, the same four for the states that hold when it is called;
  - `notify()`, which your app calls when something the palette depends on changed outside it (a preview closed,
    results arrived): it drops cached lookups and tells subscribers;
  - `subscribe(listener)`, `isAvailable(commandName)` and `listNow()`;
  - `commandLine()`, a command line for the commands available now (core's README, "The command line").

  Hand the whole palette to the sidekick (`<ShortRoundSidekick palette={palette} />`): it opens on `current()`, and
  follows `notify()` while open. A result that brings a list says which kind: `listKind` is `'state'`, `'picker'` or
  `'text'`; a picker or text step also says which command it belongs to (`command: { name, label }`). With
  `fallback: (text, { matches, stateName }) => rows`, every state's list adds rows after its matches. The engine has
  no dependency on React; you pass the Back row id and any panel renderers. Build the palette once (memoize it).
- `makeCommandBuilder({ commands, lookups })` is the command builder on its own, for a host that isn't the palette:
  `read(text, caret?)` returns readings (each with its `call`), next steps, and what a line still needs.

## Catalog fields

| Field | Meaning |
|---|---|
| `version: 3`, `app` | The format, and the prefix of every row id (`app.search.sort`) |
| `groups.<key>` | `label` and `icon`. Rows sort by group, in the order groups are declared, then in the order the states that hold list them; a row takes its group's icon unless it names its own |
| `states.<name>.when` | A condition: the state holds while it does. No `then`: after every run, the list is whatever the app's state says |
| `states.<name>.commands` | The commands that apply while the state holds, by name |
| `states.<name>.panel` | A panel the app renders (`panels: { sidecar: render }`): the side panel is open while the state holds, unless a run returns side effects of its own |
| `states.<name>.start` | Where the palette starts, for readers and the skill (at most one) |
| `commands.<name>.label`, `aliases`, `group`, `icon` | How the row reads. The aliases are the phrases people type (`clear filters`); a command's name is typed only if it is a plain lowercase word (`next`). `findUntypedCommands(catalog)` lists commands with neither |
| `run` | The function the command calls, once, with `{ <param>: arg }` for the params filled. It may return `{ message }`, and `sideEffects` (`{ sidecarRenderer }` or `{ closeSidecar: true }`) to open or close the side panel |
| `when` | A condition: the command is offered only while it holds |
| `params.<key>` | What the command takes: `label` (also a word that starts the param in a typed line), `aliases`, `hints` (connector words such as `with` or `for` that introduce it), `default: true` (takes bare words), `list: true` (several args), `required`, `priority` (breaks ties) |
| `params.<key>.argSource` | Where args come from: `freeform` (with `type`: `text`, `range` for dates, `url`), a `list` of `{ value, title, subtitle?, aliases? }`, a `lookup` (your function, called with `{ command, filled, key }`, returning rows), and `current` (your function returning the arg your app holds now, such as the previewed result; it comes with one of the others, for when your app holds none). While your app holds an arg for each param, a typed line runs the command by its name alone (`open`); while it holds none (`current` returns `undefined` or `null`), the command waits for the arg, and a `default` param offers the other source's values. A typed line asks `current` as each word is read, so keep it cheap and synchronous. A row with `isApplied: true` isn't offered again; typed in full, it still runs |
| `params.<key>.path` | Overrides for a compound command's param rows (`id`, `title`, `aliases`, `group`, `icon`, `rows: each value`), and for any param's steps: `prompt` (default "Type the {label}"), `required` (the message for a blank entry), `empty` (default "No {label} to choose from"; a typed line says it too, when the param has nothing to choose from) |

A condition is a dotted path to your function returning a boolean, combined with `!`, `&&`, `||` and parentheses:
`'!app.conditions.previewed || app.results.previewedHasServiceLink'`. Anything that compares belongs inside a
condition function. Top-level keys starting with `x-` hold shared definitions: `x-facet: &facet { ... }`, merged in
with `<<: *facet`.

How rows come from commands: a command with no params is one row that runs it; a command with one param is one row
that runs with the app's `current` arg, or asks for the arg (a picker, or a typed-text step); a command with several
params is one row per param. A row's id is `<app>.<command>`, or `<app>.<command>.<param>` for a param's row.

### Planned items and design notes

A catalog can also hold what isn't built yet, so one file is both the palette and its design. The engine checks these
fields, then leaves planned items out: the palette never offers them, and their functions don't have to exist.

| Field | Meaning |
|---|---|
| `planned: true` (state or command) | Designed, not built. A planned command may leave out `run`; a built state's list drops planned commands |
| `summary` (state, command or param) | One plain sentence, for the review page |
| `states.<name>.steps` | A guided flow for a planned state: a list of `{ ask }` and `{ run, then }` steps |
| `tier: common \| full` (state or command) | The everyday view or the full catalog |
| `review` (state or command) | An open question, for whoever reviews the catalog |
| `workflows.<name>` | A named path: `title`, then `steps` (in order) or `options` (places to start), each `{ question, state, do, then }` |

References are still checked on planned commands: their groups must exist.

## Typed lines

A typed line is one command, run once. It starts with a command's name or alias, or with a param's label, alias or
hint, which implies the only command that has it (`kind library` is Search with Kind: library). A value alias implies
its param too. The row reads the line back (`Search: grid · Kind: library`) and runs the command with every arg it
names; a command with one param reads back by its own label (`Preview: 3. CSS grid guide`).

- **List and lookup values** match by exact title, value or alias first, then by the starts of words, then by a near
  spelling. Typing a param's words and a space offers its values as next steps (Tab or Enter completes the line). So
  does a command's name and a space, when its `default` param has values: `preview ` offers the results.
- **Freeform text** runs until a reserved word (a hint such as `with`): `search notes with machine illy` is the words
  "notes" and Machine: illy. Inside the text, other params' words are ordinary words. Right after the command's name, a
  param's word starts the param (`search sort created` is Sort), and quotes keep words as text
  (`search "sort algorithms"`). The closing quote ends the text, so whatever may follow a value may follow it: a
  param's word (`search "react grid" kind library`; a hint works too) or a value's alias (`search "react grid" every`).
- **Dates** (`type: range`) read single expressions and ranges: `last week`, `July`, `Jun-Sep 2025`, `newer than a
  year`.
- **Lookups may be asynchronous**: the line says it is loading after a short delay, and an error says the values
  couldn't load.

A line that names two commands (`clear filters kind library`) doesn't run: chains are not supported yet.

## Examples files

An examples file is the catalog's grammar test: each typed line must run, first, the call it means (one command and
its args).

```yaml
examples:
  - say: sort relevance
    means: { search: { sort: relevance } }
  - say: sort relevance match any
    means: { search: { sort: relevance, match: any } }
```

```js
import { findExampleFailures, loadExamples } from '@shortround/core';

expect(findExampleFailures(palette, loadExamples(EXAMPLES_TEXT))).toEqual([]);
```

Each `say` is checked against the list the palette was built on (the states that hold for the app you pass in;
usually the start state's); a failure names the example and what the line ran instead (`undefined` when it runs
nothing). The args' order doesn't matter.
