# Catalog format

One format holds what an app can do today and what is planned. A palette engine (ShortRound's `@shortround/catalog`)
runs the built part; the planned part documents intended paths until their functions exist.

> **runs** fields drive the palette. **design** fields are checked by the engine but don't change what the palette
> offers: planned items are left out, and `tier`, `review` and `workflows` are notes. (`@shortround/catalog` accepts
> design fields from 0.3.0, its first release.) The review script checks a
> catalog with the engine's own code, so a catalog that passes review passes the engine, apart from the app's
> functions, which only the app can supply.

## Contents

- A small catalog
- Top level
- States
- Commands
- Pickers and facets
- Workflows
- The examples file
- Names and ids
- YAML gotchas

## A small catalog

```yaml
version: 2
app: tracker

pickers:
  issue:
    from: tracker.issues.rows        # your function: returns rows { value, title, subtitle?, aliases?, key? }
    empty: No issues match
  label:
    planned: true                    # no `from` yet: the function doesn't exist
    empty: No labels

states:
  browsing:
    summary: The issue list; where the palette starts
    start: true
    commands:
      issues.open:
        title: Open issue
        aliases: [show issue]
        ask: { choose: issue }
        run: tracker.issues.open
        then: viewing
  viewing:
    summary: One issue is open; only commands about it apply
    panel: sidecar
    commands:
      issue.close:
        title: Close issue
        run: tracker.issue.close
      issue.addLabel:
        planned: true
        title: Add label
        ask: { choose: label }
        summary: Add a label to this issue
      viewing.back:
        title: Back to the list
        aliases: [back, done]
        run: tracker.issues.closeIssue
        then: browsing
```

## Top level

| Field | Status | Meaning |
|---|---|---|
| `version` | runs | `2` |
| `app` | runs | The app's id; the prefix of every intention id |
| `pickers` | runs | Lists a command can ask the user to choose from (below) |
| `facets` | runs | Named filters that `forEach: facets` turns into one command each (below) |
| `states` | runs | The contexts a user can be in, each with its commands |
| `workflows` | design | Named paths through the states (below) |

## States

A state is a context: what the user is looking at and what applies to it. Exactly one built state has `start: true`.

| Field | Status | Meaning |
|---|---|---|
| `summary` | runs | One plain sentence: what this context is |
| `start` | runs | The state the palette opens in |
| `panel: sidecar` | runs | The side panel is open in this state and closes on leaving it |
| `commands` | runs | The commands offered in this state, by name |
| `planned` | design | `true`: designed, not built. The engine skips the state and every command in it |
| `steps` | design | A guided flow instead of a command list, for a planned state: a list of `{ ask }` and `{ run, then }` steps |
| `tier` | design | `common` (the everyday view) or `full`. Commands without their own tier take the state's |
| `review` | design | An open question about this state, shown on the review page |

There is no `enter` or `leave`. A command's `then` says where it leads, so the ways in and out of a state are
read from the commands, and the review map draws them.

## Commands

| Field | Status | Meaning |
|---|---|---|
| `title` | runs | The palette row's text, and words the user can type. Required unless `forEach` |
| `aliases` | runs | Other words that name the command. They are also typed words, so they are part of the grammar |
| `summary` | runs | One plain sentence on what the command does, for the review page |
| `group`, `icon` | runs | How the row is grouped and decorated in the palette |
| `ask` | runs | What the command needs before it runs: `{ choose: <picker> }` or `{ text: <prompt>, required?: <message> }` |
| `run` | runs | The function it calls. Required on built commands; optional on planned ones (name it when known) |
| `args` | runs | The call's arguments, when they aren't the default: literals and references (`$key`, `$value`, `$value.<field>`), also inside objects and lists |
| `when` | runs | A condition function; the command is offered only while it returns true |
| `then` | runs | The state after the command (default: the same state) |
| `forEach: facets` | runs | One command per facet, each named by the facet's title and aliases |
| `planned` | design | `true`: designed, not built. The engine skips it |
| `tier` | design | `common` or `full`; overrides the state's tier |
| `review` | design | An open question about this command |

**How `run` is called:** by default, with the `forEach` key, then the asked value, each only if the command has one:
a per-facet command that asks calls `(facet, value)`, a text command `(text)`, a command with neither `()`. When the
app's function wants another shape, `args` lists the arguments: `args: [any]` (a fixed value), `args: [{ terms:
$value }]` (an object built from the typed text), `args: [$value.facet, $value.value]` (fields of a picked row's
object value). A string that is exactly `$key`, `$value` or `$value.<field>` is a reference; any other is a literal,
except one that starts with `$key` or `$value` without being a reference (`$values`, `$value.0`): a likely typo, so
the catalog fails to load.
`$value` needs `ask` and `$key` needs `forEach`, or the catalog fails to load. The function may return `{ message }`, or `{ message, isCancelled: true }` to stay in the current state. Commands
must change nothing when asked to apply a value already in effect.

## Pickers and facets

| Field | Status | Meaning |
|---|---|---|
| `pickers.<name>.from` | runs | The rows function, called with `{ key, facets }`. Required unless planned |
| `pickers.<name>.empty` | runs | The message when there are no rows; `{title}` is the command's title, lower case |
| `pickers.<name>.planned` | design | `true`: the rows function doesn't exist yet |
| `facets.<name>.title` | runs | The facet's name; the title of its command |
| `facets.<name>.aliases` | runs | Other words for the facet |

A row is `{ value, title, subtitle?, aliases?, key?, isApplied? }`. A row with `isApplied: true` (a value already in
effect) isn't offered; a typed line that names it reads "(already set)" and still runs.

Picker sources must answer synchronously for typed lines to resolve while the user types.

## Workflows

Design only. A workflow is a named path a user follows, often taken from a playbook or a recording. Each step names
the state it happens in and the typed line that does it.

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

`catalog.examples.yaml`, beside the catalog. Each example is a typed line and what it should mean. The engine resolves
each in the start state when the app runs its example check (it needs the app's functions and data); the review
script checks only their shape and that each `means` names a start-state command, and shows them beside it.

```yaml
examples:
  - say: open issue 42
    means: tracker.issues.open::42
  - say: status open sort newest
    means: [tracker.filter.status::open, tracker.sort.set::newest]   # a line of several commands, in order
```

Write examples for the lines people actually type, including the loose ones. Give values near neighbours (`bug` next
to `bugfix`), or a ranking mistake goes unnoticed.

## Names and ids

- Name commands after the app's methods: `<area>.<action>` (`issues.open`). The intention id is then
  `<app>.<command>` (`tracker.issues.open`), so the catalog, the code and the palette read the same.
- `forEach` commands add the facet: `<app>.<command>.<facet>`. A picker row adds `::<row value or key>`; a typed-text
  step adds `::text`.
- Command names are per state. The same name in two states (`open` in a list and in a detail view) is two commands.
- `run`, `when` and `from` are dotted paths into the functions the app provides. Each must end at a function.

## YAML gotchas

- Quote values that contain a comma or `[`: unquoted flow values break or truncate silently.
