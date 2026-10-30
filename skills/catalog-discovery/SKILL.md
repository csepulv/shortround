---
name: catalog-discovery
description: Use when mapping what an app's users can do, as a command catalog — the intentions the app offers today, organised by the context (state) the user is in, and the functions that carry them out — from the app's code, docs and recordings, asking the operator only where the evidence is ambiguous. The catalog drives a context-aware command palette (ShortRound's `@shortround/catalog`) and is the basis for an intent-level service layer or DSL. Also use when someone asks to "map an app's commands", "build a palette catalog", "find the app's intentions or actions", add a host app to ShortRound, or update an existing catalog after the app changed, even if they don't say "catalog".
---

# catalog-discovery

A **catalog** is a YAML file that maps what users can do in an app, organised by where they are. It lists the app's
**states** (contexts such as "browsing the list", "one item is open", "several items selected"), the **commands**
(intentions) each state offers, what each command asks for (typed text, or a choice from a **picker** list), and which
state the user is in afterwards. Every `run`, `when` and `from` names a function the app provides. So the catalog is
two things at once: the map a context-aware palette runs from, and the interface of the app's intent-level service
layer.

This skill is **discovery, not design**. You map the app as it is today, from the evidence it gives you, and you ask
the operator only where that evidence is ambiguous or conflicting. You don't ask what the app should do, which
features matter most, or what comes next; if the operator volunteers planned work, you record it as planned.

## Before you start

Settle these with the operator in one short exchange, and write the answers at the top of the discovery log:

- **Scope.** Which app, and which part of it? A catalog has one start state, so it usually covers one area where the
  palette lives (a search page, an admin console). Map the whole app anyway (step 1), but mark what the catalog covers.
- **Surfaces.** Intentions are what a user can do in the UI. If the app also has a CLI or an API, ask whether its
  actions count.
- **Boundaries.** What may be copied, quoted or named from the sources? Work code or a client's app may be readable for
  shape only; then describe structure in your own words and refer to the app generically. Ask before step 1, because
  step 1 is where you read the code.
- **An existing catalog or palette.** If one exists, you are revising: read it, then check it against the app, and
  record what changed. If you were told to discover from scratch, leave out the palette's own definition (its catalog
  or intention files), but use the app's code, including a controller built for the palette: its functions and its
  shape are evidence (step 2). List in the log the files you read that mention the palette, so a reviewer can judge.
  Don't search the repo for them: that can surface the very files you were told to leave out.

If the operator can't settle all of these now, go on: record each as **assumed, not yet confirmed**, and ask again in
step 4.

## What you produce

- **The catalog** (`catalog.yaml` by default), in the format in `references/catalog-format.md`. Present tense: what the
  app does today. Mark something `planned` only when the operator says it is.
- **An examples file** (`catalog.examples.yaml` beside the catalog): typed lines and what each means. Examples are the
  narrative a reviewer reads, the grammar test an engine runs, and later the corpus for evaluating looser phrasing.
- **A discovery log** (`catalog.discovery.md` beside the catalog): scope and boundaries; what you read, and which
  UI behaviour you read in code rather than saw running; each decision with its evidence; what you **assumed, not yet
  confirmed**; questions asked and the operator's answers in their words; and the service-layer gaps (step 7). Without it, the next round re-asks settled questions, and nobody can tell
  which parts of the catalog are evidence and which are guesses.
- **A review page**, generated from the catalog (step 6). It stays local: don't publish it, because it describes the
  app's internals.

## The process

Seven steps, usually over more than one round. One rule shapes them: **a command belongs where the app offers it**.
Listing what the code *can* do, without where the user can do it, produces a catalog where every command is
available almost everywhere: that reads fine in YAML and is hard to use in a palette. The first real catalog made that
mistake. Where the UI offers each action, and how the app's controller is shaped, are the evidence for states.

### 1. Map the app

Survey the whole app: routes, screens, panels, drawers, dialogs, menus, the controller or store, API schemas, filter
and sort declarations, admin and settings areas. Include the built-in actions of UI library components (a search box,
filter chips, a "clear all" button) and their defaults: they offer actions the app's own code never names. Write a
**section map**: each section, its screens and surfaces, the nouns it works on, whether it's in the catalog's scope,
and where its values come from.

For each value source, note whether it answers **synchronously** and whether it lists **all values or only those in
the current results**. A palette picker must answer synchronously to resolve while the user types; an API call needs a
cache before it can back a picker. That shapes which commands are cheap to build.

List the app's existing functions under the map: controller or store actions, and handlers that live inside
components. These become the `run` names.

### 2. Find the contexts the UI offers

For each screen, panel, drawer, selection mode and dialog in scope, record which actions the UI offers there, and how
the user gets in and out. Then read the controller the same way. Both are evidence for states:

- A **surface with its own set of actions** (a detail panel, a bulk-selection mode) is a candidate state.
- **A controller with a current item** (`preview`, `next`, `closePreview`) is a candidate state too, even if no
  pointer surface shows it. Where the UI and the controller disagree, that is a clarification question.
- **Where an action appears** (a toolbar, a row's menu, a panel's buttons) says which states it belongs to.
- **Per-item actions with no current item** (a card grid where each card has its own menu): either each command asks
  which item, or a current-item state holds them. If neither the UI nor the controller has a current item, ask; don't
  invent the state.
- **How a surface opens and closes** gives the moves between states, and each state's way out.
- **Actions that differ by item type** (a chat has "view conversation", a web page doesn't) are usually a `when`
  condition on one state; make them separate states only if they lead to different states.
- **A dialog** the app opens (add, edit, confirm delete) is how the app does that today: record a command whose
  function opens it. A dialog that belongs to each item needs the item as well. Whether the palette should instead ask
  field by field is a design choice for the operator; note it in the log, don't decide it.

Run the app if you can. If you can't (a sign-in, a missing service), say in the log which behaviour you read in code
or in a library's source rather than saw. Docs, end-to-end tests and recordings help when the code is unclear: they
show the order in which a user actually moves. A narrated **sekko** recording ([sekko](https://savethetokens.com/tools/sekko/), from
[save-the-tokens](https://github.com/csepulv/save-the-tokens)) is the strongest, because the narration says why; use
the `sekko` skill to record and extract one if the operator offers. An old or silent recording can confirm which screens are
visited and in what order; don't take vocabulary from it.

### 3. Draft the graph

Read `references/catalog-format.md` first: its "How `run` is called" decides what counts as existing.

Draft the states and the moves between them, then attach each action to the states where the app offers it. For each
command's `run`, each picker's `from` and each `when`, note its function:

- **existing** — the app has it, callable as the catalog will call it: by default (`addFacetValue(facet, value)`
  fits a per-facet command that asks for a value), or with `args` describing the shape (`merge({ terms })` with
  `args: [{ terms: $value }]`);
- **adapter** — the app does it, but inside a component, or it needs logic `args` can't express, so the catalog needs
  a small wrapping function: `open(index)` when a picker row carries an id; most picker row functions, which turn app
  data into display rows;
- **missing** — the app offers it but no callable function exists (a dialog whose open state lives in a component).

Name functions after the app's methods where one exists, so the catalog, the code and the palette's ids read the same.

A UI **toggle** (a star, dark mode) usually becomes two commands (set and unset) or a choice: a command must change
nothing when asked to apply a value already in effect. Note which you chose. Where the app offers the same outcome in
more than one way (remove one value, one filter, or all), don't assume: ask the operator whether to offer each as
its own command (step 4).

Then check the draft for two smells: a command offered in most states (often app chrome such as theme or profile; ask
whether it belongs in the palette at all), and a state with no way out.

### 4. Clarify

List what you couldn't settle from the evidence, and ask the operator about those only. A good clarification
question names the evidence and the two readings:

> The controller keeps the previewed result when the search is refined. Should refining be offered while a result is
> previewed, or does previewing offer only next, previous, open and back?

> The controller has `merge` (keep filters) and `replace` (start fresh). Are both things a user does from the search
> box, and if so, what do you call each?

Ask a few at a time, most consequential first: questions that move a state or a move between states come before
questions about one command's words. For everything you don't ask about, write your assumption in the log as
**assumed, not yet confirmed**; the review page will surface it.

Also ask anything from "Before you start" still open, including: are there other surfaces (CLI, API) whose actions
count, and is anything planned that the catalog should carry as `planned`?

### 5. Write the catalog

Write the YAML in the format in `references/catalog-format.md`. For each command, give a one-sentence `summary` in
plain words. Write examples for the start state's commands: an engine checks examples only in the start state, so
a command in another state can't have one yet. Use the user's words for titles and aliases where the UI or docs give them: the
words on a palette row are also the words a user can type. Record open questions as `review:` notes on the state or
command they concern, so they appear on the review page.

Quote YAML values that contain a comma or `[`; unquoted, they break or truncate silently.

See `references/worked-example.md` for a complete small catalog, examples file and discovery log.

### 6. Check and review with the operator

1. Run the review script: `node <this skill>/scripts/catalog-review.js <catalog.yaml> [out.html]`. It needs only
   Node, no install. It checks the catalog with the palette engine's own checks: a mistake stops it with a message
   naming the field or the command, exactly as the engine would. Fix it and run again. Otherwise it writes
   `<name>-review.html` beside the catalog. The page loads its diagram library from a CDN, so its map of states
   needs a network connection to draw; the rest of the page doesn't.

   Examples (`<name>.examples.yaml` beside the catalog) are checked less: their shape, and that each `means` names a
   start-state command (the summary line counts those that don't; usually a mistyped id). The script doesn't
   resolve the typed lines: that needs the app's functions and data, so it happens when the app runs the engine's
   example check. A wrong facet key or value passes here.
2. Read the **words that mean two things** list. The check runs within each state, because a palette shows one
   state's list at a time. Each collision is either a mistake or a deliberate overlap worth writing down.
3. Walk the operator through the page: the map of states first, then each state's commands. Where the map surprises
   either of you, that is a clarification question.
4. Record answers and decisions in the log, update the catalog, and regenerate.

### 7. Hand over the service layer

The catalog's `run`, `when` and `from` names are the service layer's interface; the review page lists every one,
with where it's used. Summarise in the log which exist, which need an adapter, and which are missing: that list is the work needed before a palette (or any other
caller) can run the catalog. When an app adopts a palette engine, the built part runs as written, and the examples
file becomes its grammar test.

To turn the catalog into a running palette, the steps are in `ADOPTING-A-CATALOG.md`, beside the README of
`@shortround/catalog`. A user can hand that over to an agent:

> Add a ShortRound palette to this app from `catalog.yaml`. Follow `ADOPTING-A-CATALOG.md` in `@shortround/catalog`.
> The function list and its existing / adapter / missing status are in `catalog.discovery.md`.

## Pitfalls from earlier runs

- **Everything everywhere.** Listing commands from the controller, without where the UI offers them, made nearly
  every command available in every context.
- **The richest source sets the shape.** Drafting from the most detailed docs first produced a catalog of one area.
  Map all sections from code first.
- **Interviewing instead of mapping.** Asking about priorities and future features turns discovery into design. Ask
  only what the evidence leaves open.
- **Titles and aliases are a grammar.** A missing alias ("type" for a facet called Kind) makes a natural line fail;
  add examples for the lines people actually type.
- **Tidy test data hides ranking bugs.** Example values need near neighbours (`react` next to `react-native`).
- **Review pages describe internals.** Keep generated pages local.

## References

- `references/catalog-format.md` — the catalog format, field by field. Read before classifying functions (step 3).
- `references/worked-example.md` — a small hypothetical app taken through all seven steps. Read when starting a
  first catalog.
- `scripts/catalog-review.js` — the review script: the engine's checks, the collision check and the review page.
  Run in step 6. It is generated (source: `scripts/src/`); `scripts/vendor/` holds the YAML and schema libraries it
  imports, minified, with their licences. Don't edit either; keep them together.
- The `sekko` skill — recording and extracting narrated sessions (step 2):
  <https://github.com/csepulv/save-the-tokens>.
