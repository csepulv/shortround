# Catalog format

One format holds what an app can do today and what is planned, in catalog format version 3. A palette engine
(ShortRound's, in `@shortround/core` 0.5.0 and later) runs the built part two ways: as rows to pick from, and as
typed whole commands (`search grid with tag react`). The planned part documents intended paths until their functions
exist.

> **runs** fields drive the palette. **design** fields are checked by the engine but don't change what the palette
> offers: planned items are left out, and `tier`, `review`, `steps` and `workflows` are notes. The review script checks
> a catalog with the engine's own code, so a catalog that passes review passes the engine, apart from the app's
> functions, which only the app can supply. A version 2 catalog (`pickers`, `facets`, `then`) no longer loads; see
> ShortRound's `MIGRATING.md`, "From a v2 catalog".

## Contents

- A small catalog
- Top level
- States
- Commands
- Params
- Where args come from
- How typed lines are read
- Workflows
- The examples file
- Names and ids
- YAML gotchas

## A small catalog

```yaml
version: 3
app: tracker

groups:
  issues: { label: Issues, icon: file }
  issue: { label: This issue }

states:
  browsing:
    summary: The issue list; where the palette starts
    start: true
    when: '!tracker.conditions.issueOpen'   # your function: returns a boolean
    commands: [open]
  viewing:
    summary: One issue is open; only commands about it apply
    when: tracker.conditions.issueOpen
    panel: sidecar
    commands: [closeIssue, addLabel, back]

commands:
  open:
    label: Open issue
    aliases: [open, show issue]
    group: issues
    run: tracker.issues.openById          # your function, called once: { issue: '42' }
    params:
      issue:
        label: Issue
        default: true                      # `open 42`: the bare words after the command are the issue
        argSource: { lookup: tracker.issues.rows }   # your function: returns rows { value, title, ... }
        path: { empty: No issues match }
  closeIssue:
    label: Close issue
    aliases: [close issue, close]
    group: issue
    run: tracker.issue.close
  addLabel:
    planned: true                          # designed, not built: no `run` yet
    label: Add label
    aliases: [add label, label]
    summary: Add a label to this issue
    params:
      label: { label: Label, default: true, argSource: { lookup: tracker.labels.rows } }
  back:
    label: Back to the list
    aliases: [back, done]
    group: issue
    run: tracker.issues.closeIssue
```

## Top level

| Field | Status | Meaning |
|---|---|---|
| `version` | runs | `3` |
| `app` | runs | The app's id; the prefix of every row id |
| `groups` | runs | `<key>: { label, icon? }`. Rows sort by group, in the order groups are declared |
| `states` | runs | The contexts a user can be in, each with the commands it offers |
| `commands` | runs | Every command, declared once; states list them by name |
| `workflows` | design | Named paths through the states (below) |
| `x-<name>` | — | Shared definitions for YAML anchors (`x-facet: &facet {...}`, then `<<: *facet`); the engine drops them |

## States

A state is a context: what the user is looking at and what applies to it. **A state holds while its `when` holds**:
there is no `then`, and nothing in the catalog moves the user between states. After every run, the palette shows the
states that hold. So each state's condition is a function the app provides, and part of the service layer.

| Field | Status | Meaning |
|---|---|---|
| `summary` | design | One plain sentence: what this context is. The part before a semicolon labels the review map |
| `when` | runs | A condition (below). A state without one always holds |
| `commands` | runs | The commands offered while the state holds, by name. When several states hold, their lists join |
| `panel: sidecar` | runs | The side panel is open while the state holds |
| `start` | design | The state the palette opens in, for readers and the review page (at most one) |
| `planned` | design | `true`: designed, not built. The engine skips the state and drops planned commands from built states |
| `steps` | design | A guided flow instead of a command list, for a planned state: a list of `{ ask }` and `{ run, then }` steps |
| `tier` | design | `common` (the everyday view) or `full`. Commands without their own tier take the state's |
| `review` | design | An open question about this state, shown on the review page |

**Conditions** are dotted paths to the app's functions returning a boolean, combined with `!`, `&&`, `||` and
parentheses: `'!tracker.conditions.issueOpen || tracker.issue.hasLink'`. Anything that compares (`status == open`)
belongs inside a condition function; the engine rejects it in the clause. Quote a clause that starts with `!`.

## Commands

| Field | Status | Meaning |
|---|---|---|
| `label` | runs | The row's text, and how the line reads back. Required. **Not** a word anyone can type: see aliases |
| `aliases` | runs | The phrases people type to name the command (`close issue`, `clear filters`). A command's own name is typed only if it is a plain lowercase word (`next`, `open`); `closeIssue` is not |
| `summary` | design | One plain sentence on what the command does, for the review page |
| `group`, `icon` | runs | A key into `groups`, and the row's icon (default: the group's) |
| `run` | runs | The function it calls. Required on built commands; optional on planned ones (name it when known) |
| `when` | runs | A condition: the command is offered only while it holds, within the states that list it |
| `params` | runs | What the command takes (below). None: one row that runs at once |
| `planned` | design | `true`: designed, not built. The engine skips it |
| `tier` | design | `common` or `full`; overrides the state's tier |
| `review` | design | An open question about this command |

**How `run` is called:** once, with one object holding the args of the params that were filled: `{}` for a command
with no params, `{ issue: '42' }`, or `{ term: 'grid', sort: 'newest', label: ['bug'] }` (a `list: true` param's arg
is a list). It may return `{ message }`, and `sideEffects` (`{ sidecarRenderer }` or `{ closeSidecar: true }`). A
command must change nothing when asked to apply a value already in effect. This decides the service-layer status of
each function:

- **existing** — the app has a function that takes that object (or nothing, for a command with no params);
- **adapter** — the app does it, but positionally (`filters.add(facet, value)`), inside a component, or in several
  calls where the command makes one change; a small wrapper takes the object. Most `lookup` functions are adapters
  too: they turn app data into display rows;
- **missing** — the app offers it, but no callable function exists (a dialog whose open state lives in a component).

## Params

A param is one thing a command takes. A command with one param is one row that asks for it (or uses the app's
current one); a command with several params is a row per param, and one typed line can fill them all.

| Field | Status | Meaning |
|---|---|---|
| `label` | runs | The param's name. Also a word that starts it in a typed line (`tag react`) |
| `aliases` | runs | Other words that start it (`tagged`) |
| `hints` | runs | Connector words that introduce it after other words (`with`, `sort by`, `for`) |
| `default` | runs | `true`: takes the bare words after the command (`search grid` is the term "grid", `open 42` the issue). Without it, a line must name the param (`open issue 42`). Usually set on a one-param command's param, and on a compound command's term |
| `list` | runs | `true`: takes several args |
| `required`, `priority` | runs | Must be given; breaks ties between readings |
| `summary` | design | One plain sentence, for the review page |
| `argSource` | runs | Where its args come from (below). Required |
| `path` | runs | Overrides for a compound command's param rows (`id`, `title`, `aliases`, `group`, `icon`, `rows: each value`: a row per list value), and for any param's steps (`prompt`, `required`: the message for a blank entry, `empty`: `{label}` names the param; a typed line says it too when the param has nothing to choose from) |

## Where args come from

| `argSource` | Meaning |
|---|---|
| `freeform: true`, `type` | Typed: `text` (default), `range` (dates: `last week`, `Jun-Sep 2025`), `url` |
| `list: [{ value, title, aliases? }]` | A fixed set of values, written in the catalog |
| `lookup: <path>`, `key?` | The app's function, called with `{ command, filled, key }`, returning rows `{ value, title, subtitle?, aliases?, key?, isApplied? }`. `key` lets one function serve several params |
| `current: <path>` | The app's function returning the arg it holds now (the open issue's id), or `undefined` (or `null`) when it holds none. A one-param command's row runs at once with it, and asks when there is none; a typed line that leaves the param out takes it, and while there is none the line waits for the arg (a default param offers the other source's values). A typed line asks it as each word is read, so keep it cheap. It comes with `freeform`, `list` or `lookup`, so there is a way to ask |

A row with `isApplied: true` (a value already in effect) isn't offered again; typed in full, it still runs.

Lookups may be asynchronous: a typed line says it is loading after a short delay, and a failure says the values
couldn't load. A picker waits for its rows, so a slow source (an API call) needs a time limit or a cache in the app.
Note in the log which sources are slow.

## How typed lines are read

A typed line is one command, run once with every arg it names. Knowing how it is read tells you what to propose:

- **The command is named by its name (if a word) or an alias.** Propose an alias phrase for every command whose name
  isn't a plain word: the words people say for it (`clear filters`, `close preview`, `open in service`).
- **A param's label, aliases and hints imply its command**, if only one command in the state has them: `tag react`
  is Search with Tag: react. Two commands with a param labelled `Result` make `result 3` ambiguous.
- **A `default` freeform text param reads up to a hint.** In `search notes with tag react`, the term is "notes"; without
  the hint, "tag react" would be part of the term. Propose hints (`with`, `sort by`) for every other param of a command
  with such a term.
- Values match by title, value or alias, then by the starts of words, then by a near spelling.

The review page lists what breaks these rules ("Words nobody can type") and words that mean two things in one state.

## Workflows

Design only. A workflow is a named path a user follows, often taken from a playbook or a recording. Each step names
the state it happens in and the typed line that does it. Workflows are the catalog's only record of moves between
states, so write one for each path the evidence shows.

```yaml
workflows:
  triage:
    title: Triage new issues
    steps:                               # in order; use `options` instead for "places to start"
      - question: What came in since yesterday?
        state: browsing
        do: status new sort newest
        then: [open the first one, or keep scanning]
      - question: Is it a real bug?
        state: viewing
        do: add label bug
```

| Field | Meaning |
|---|---|
| `title` | The workflow's name |
| `steps` / `options` | An ordered path, or a set of alternative starting points |
| `question` | What the user is trying to find out at this step |
| `state` | The state the step happens in |
| `do` | The typed line, in the palette's own language |
| `then` | What the user decides next (free text) |

## The examples file

`catalog.examples.yaml`, beside the catalog. Each example is a typed line and the call it must run: one command and
its args. The engine reads each line against the list the palette was built on (the states that hold for the app's
functions and data; usually the start state's) when the app runs its example check; the review script checks only
their shape and that each names a start-state command.

```yaml
examples:
  - say: open 42
    means: { open: { issue: '42' } }
  - say: search crash with status new sort newest
    means: { search: { term: crash, status: [new], sort: newest } }
```

(The second example is from a catalog with a Search command; the small catalog above has none.)

Write examples for the lines people actually type, including the loose ones. Give values near neighbours (`bug` next
to `bugfix`), or a ranking mistake goes unnoticed. The args' order doesn't matter; a list's order does.

## Names and ids

- Name commands after the app's methods where one exists (`closeIssue`), and give each an alias phrase people say
  (`close issue`). A command's name is unique in the catalog; a command offered in two states is listed by both.
- Row ids follow the names: `<app>.<command>` for a command with no params or one; `<app>.<command>.<param>` for each
  param of a command with several; `.<value>` added for a `rows: each value` param's rows. `path.id` overrides a
  param's or value's id.
- `run`, `lookup`, `current` and each condition are dotted paths into the functions the app provides. Each must end
  at a function.

## YAML gotchas

- Quote values that contain a comma or `[`, and clauses that start with `!`: unquoted, they break or change meaning
  silently.
- Merges (`<<: *facet`) are shallow: a key written beside the merge replaces the shared one whole.
