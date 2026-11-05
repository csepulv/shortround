# Worked example: a small issue tracker

A hypothetical app, taken through all seven steps. The app, its code and its operator are invented. The shape of each
step, and the kind of thing each source turns up, follow real discovery runs.

## The app

**Tracker** is a single-team issue tracker with a web UI. Issues have a title, a status (`new`, `open`, `closed`),
labels and an assignee. The operator wants a keyboard palette on the issues page.

## Before you start

One exchange with the operator, recorded at the top of the log:

- **Scope:** the issues page (`/issues` and its side panel). Settings are out of scope except as a way out.
- **Surfaces:** "There's a small CLI for imports; leave it out."
- **Boundaries:** the operator's own app; code and names may be quoted.
- **Existing catalog:** none.

## Step 1: map the app

Sources read: the route list, the issues store, the API schemas, the list page's filter bar and row menu, the issue
panel, the new-issue form, the settings pages.

```markdown
## Section map

| Section | Surfaces | Nouns | In scope? | Values from (fast? all or current?) |
|---|---|---|---|---|
| Issues | list (/issues), side panel, row menu | issue, label, assignee, status | yes | store: issues (in memory; the current list) |
| Bulk edit | checkbox selection on the list, bulk toolbar | selection | yes | store: selection (in memory) |
| New issue | form (/issues/new) | issue | entry only | api: labels, members (network; all) |
| Saved views | sidebar list | view (filters + sort) | yes | api: views (network; all; no store action) |
| Settings | labels, members, notifications | label, member | no | api |

Existing functions (store): issues.open(id), issues.current (the open issue, or null), issues.closeIssue(),
issues.next(), issues.previous(), issue.close(), issue.reopen(), issue.assign(memberId), issue.addLabel(name),
filters.add(facet, value), filters.drop(facet, value), sort.set(id), selection.isActive, selection.start(),
selection.toggle(id), selection.clear(), bulk.close(), bulk.addLabel(name) (the bulk actions apply to the store's
current selection).
In components only: the row menu's "Copy link"; the form's submit. Labels and members are fetched over the network,
and the store caches both after the first fetch.
```

## Step 2: contexts the UI offers

Read from the UI code, not the store:

- **The list** offers the filter bar (status, label, assignee), sort, a "Select" button, a row click that opens the
  side panel, and a "New issue" button that goes to the form.
- **The side panel** offers Add label, Assign, Close, Next and Previous arrows, and a close (×) button. The filter bar
  stays visible but greyed out while the panel is open.
- **Selection mode** (after "Select") shows checkboxes and a bulk toolbar: Close selected, Label selected, Done.
- **The new-issue form** is a separate page with its own Cancel and Create.

So: three candidate states (list, panel, selection), and the form is a way out of the palette's area. Each state's
condition comes from the store: the panel is open while `issues.current` isn't null, and selection mode while
`selection.isActive` is true. The greyed-out filter bar is evidence that refining isn't offered while an issue is
open, but greyed-out could also mean "not yet built" (clarify).

An end-to-end test (`triage.spec.js`) walks list → panel → label → next → close, which confirms the panel's loop. It
becomes the catalog's `triage` workflow: the catalog's only record of how a user moves between states.

## Step 3: the graph

```text
browsing   holds while no issue is open and not selecting
viewing    holds while an issue is open (the side panel)
selecting  holds while selection mode is on

Moves (from the UI, recorded in the log and the triage workflow):
browsing ──open issue──▶ viewing ──back──▶ browsing
browsing ──select issues──▶ selecting ──done / close selected──▶ browsing
browsing ──new issue──▶ (leaves for the form)
```

The filter bar's three filters and the sort change one thing, the list, so they are one command, Refine, with a param
each: `status new sort newest` becomes one call, `{ status: [new], sort: newest }`.

Functions, as the catalog calls them (once, with one object):

- **existing:** `issues.closeIssue`, `issues.next`, `issues.previous`, `issue.close`, `selection.start`,
  `selection.clear`, `bulk.close` (they take nothing).
- **adapter:**
  - `list.refine({ status, label, assignee, sort })`, which makes one change from `filters.add` and `sort.set`;
  - `filters.dropOne({ filter })` over `filters.drop(facet, value)`;
  - `issues.openById({ issue })`, `issue.addLabel({ label })`, `issue.assign({ member })`,
    `selection.toggle({ issue })` and `bulk.addLabel({ label })`, over the positional store functions;
  - the two conditions, over `issues.current` and `selection.isActive`;
  - every lookup's rows (the store holds issues, filters and options; a lookup returns display rows);
  - two navigation functions, `issues.openNewForm` and `settings.open` (they navigate inside components).

Smell checked: "Go to settings" appears in the app's header on every page; asked about in step 4.

## Step 4: clarify

Asked, two at a time, most consequential first:

> **C1.** The filter bar is greyed out while the side panel is open. Should the palette offer filters while an issue is
> open, or only commands about that issue?
> *"Only the issue. When I'm in an issue I'm deciding about it."*

> **C2.** "Close" closes the issue in the panel, and × closes the panel. Which does the word "close" mean to you?
> *"The issue. The panel is back or done."*

> **C3.** The header has "Settings" on every page. Should the palette offer it?
> *"Rarely. Put it in the list only, and not in the everyday view."*

> **C4.** Anything planned the catalog should carry? Other surfaces?
> *"Saved views are coming to the palette; the sidebar list exists but the store has no action yet. And I'd like to
> add an issue from the palette one field at a time, someday. The CLI stays out."*

Not asked, recorded as assumed: the param labels are the filter bar's labels; "dupe" is a word the team uses for
closing (from the docs' glossary).

## Step 5: the catalog

As first written; step 6 drops one alias (`close panel`). Every command whose name isn't a plain word has an alias
phrase (`close issue`, `select issues`), since a typed line names a command by its name or an alias, not its label.
Refine has no free-text param, so its params need no hints; a Search command with a typed term would need them
(`search crash with status new`).

```yaml
version: 3
app: tracker

groups:
  refine: { label: Refine, icon: settings }
  issues: { label: Issues, icon: file }
  issue: { label: This issue }
  selection: { label: Selection }

states:
  browsing:
    summary: The issue list; where the palette starts
    start: true
    when: '!tracker.conditions.issueOpen && !tracker.conditions.selecting'
    tier: common
    commands: [refine, dropFilter, open, selectIssues, newIssue, savedViews, settings]
  viewing:
    summary: One issue is open in the side panel; only commands about it apply
    when: tracker.conditions.issueOpen
    panel: sidecar
    tier: common
    commands: [addLabel, assign, closeIssue, next, previous, back]
  selecting:
    summary: Picking issues for a bulk action
    when: tracker.conditions.selecting
    tier: common
    commands: [toggle, closeSelected, labelSelected, doneSelecting]
  adding:
    planned: true
    summary: Filing a new issue from the palette, one field at a time (operator, someday)
    steps:
      - { ask: { text: Title } }
      - { ask: { choose: label } }
      - { ask: { choose: member } }
      - { run: tracker.issues.create, then: browsing }

commands:
  refine:
    label: Refine
    summary: Narrow and order the list (the filter bar and sort)
    group: refine
    run: tracker.list.refine
    params:
      status:
        label: Status
        list: true
        argSource: { lookup: tracker.filters.valueRows, key: status }
      label:
        label: Label
        aliases: [tagged]
        list: true
        argSource: { lookup: tracker.filters.valueRows, key: label }
      assignee:
        label: Assignee
        aliases: [assigned to]
        list: true
        argSource: { lookup: tracker.filters.valueRows, key: assignee }
      sort:
        label: Sort
        aliases: [sort by]
        argSource: { lookup: tracker.sort.rows }
        path: { empty: No sort options }
  dropFilter:
    label: Drop filter
    aliases: [drop filter, remove filter]
    group: refine
    run: tracker.filters.dropOne
    params:
      filter:
        label: Filter
        default: true
        argSource: { lookup: tracker.filters.activeRows }
        path: { empty: No filters applied }
  open:
    label: Open issue
    aliases: [open issue]
    group: issues
    run: tracker.issues.openById
    params:
      issue:
        label: Issue
        default: true
        argSource: { lookup: tracker.issues.rows }
        path: { empty: No issues match }
  selectIssues:
    label: Select issues
    aliases: [select issues, select]
    group: issues
    run: tracker.selection.start
  newIssue:
    label: New issue
    aliases: [new issue]
    summary: Go to the new-issue form
    group: issues
    run: tracker.issues.openNewForm
    review: Leaves the palette's area; operator would like a field-by-field version someday (see adding)
  savedViews:
    planned: true
    label: Saved views
    aliases: [saved view, view]
    summary: Replace the current filters and sort with a saved view
    params:
      view: { label: View, default: true, argSource: { lookup: tracker.views.rows } }
    review: The sidebar calls the API directly; the store needs a views action first
  settings:
    label: Go to settings
    aliases: [go to settings]
    summary: Open a settings page
    tier: full
    run: tracker.settings.open

  addLabel:
    label: Add label
    aliases: [add label, label]
    group: issue
    run: tracker.issue.addLabel
    params:
      label: { label: Label, default: true, argSource: { lookup: tracker.labels.rows } }
  assign:
    label: Assign
    aliases: [assign to]
    group: issue
    run: tracker.issue.assign
    params:
      member: { label: Member, default: true, argSource: { lookup: tracker.members.rows } }
  closeIssue:
    label: Close issue
    aliases: [close issue, close, dupe]
    group: issue
    run: tracker.issue.close
  next:
    label: Next issue
    group: issue
    run: tracker.issues.next
  previous:
    label: Previous issue
    aliases: [prev]
    group: issue
    run: tracker.issues.previous
  back:
    label: Back to the list
    aliases: [done, close panel]
    group: issue
    run: tracker.issues.closeIssue

  toggle:
    label: Toggle issue
    group: selection
    run: tracker.selection.toggle
    params:
      issue: { label: Issue, default: true, argSource: { lookup: tracker.issues.rows } }
  closeSelected:
    label: Close selected
    aliases: [close selected]
    group: selection
    run: tracker.bulk.close
  labelSelected:
    label: Label selected
    aliases: [label selected]
    group: selection
    run: tracker.bulk.addLabel
    params:
      label: { label: Label, default: true, argSource: { lookup: tracker.labels.rows } }
  doneSelecting:
    label: Done selecting
    aliases: [done, back]
    group: selection
    run: tracker.selection.clear

workflows:
  triage:
    title: Triage new issues (triage.spec.js)
    steps:
      - question: What came in?
        state: browsing
        do: status new sort newest
        then: [open the first one]
      - question: Is it a real bug?
        state: viewing
        do: add label bug
      - question: Next one
        state: viewing
        do: next
      - question: Not a bug after all
        state: viewing
        do: close
```

The planned items are exactly what the operator named in C4: saved views, and the field-by-field add. Everything
else is what the app does today.

## The examples file

```yaml
examples:
  - say: status new
    means: { refine: { status: [new] } }
  - say: status open
    means: { refine: { status: [open] } }
  - say: open 42
    means: { open: { issue: '42' } }
  - say: status new sort newest
    means: { refine: { status: [new], sort: newest } }
  - say: tagged bug
    means: { refine: { label: [bug] } }
```

## Step 6: check and review

The review script's checks pass. Its collision check finds one word that means two things:

- **viewing:** `close` (Close issue) is also the start of `close panel` (Back to the list).

The engine resolves it (the longest phrase wins, so `close panel` is Back to the list), but two meanings for one word
in the same list is worth a decision rather than an accident. Per C2, `close` means the issue: the `close panel`
alias is dropped. "Words nobody can type" is empty: every command has a name that is a word, or an alias.

Walking the page with the operator surfaced one overlap the check can't see, because it checks command and param
words, not values: `open` names Open issue in browsing, but the operator also types `status open` to filter. The line
`status open` starts with Status, a param's label, so it reads as Refine; `open 42` reads as Open issue. Recorded as a
deliberate overlap, with an example for each, so a change that breaks either line fails.

The map shows the four states with their conditions (the planned one has none). It draws no arrows between the built
states, since the catalog doesn't say which command changes a condition; its only arrows are where the palette opens
and the planned add flow's return to browsing. The operator checked the moves against the triage workflow instead.

## Step 7: the service layer

| Function | Status |
|---|---|
| issues.closeIssue, issues.next, issues.previous, issue.close, selection.start, selection.clear, bulk.close | existing |
| list.refine | adapter: one change from filters.add and sort.set |
| filters.dropOne, issues.openById, issue.addLabel, issue.assign, selection.toggle, bulk.addLabel | adapter: take the args object, call the positional store function |
| conditions.issueOpen, conditions.selecting | adapter: `issues.current !== null`, `selection.isActive` |
| issues.rows, filters.valueRows, filters.activeRows, sort.rows, members.rows, labels.rows | adapter: display rows from store data (members and labels from the cache) |
| issues.openNewForm, settings.open | adapter: navigation that lives in components today |
| views.rows (savedViews); issues.create (field by field) | planned |

## The discovery log

```markdown
# Tracker catalog: discovery log

**Scope:** the issues page and its side panel. **Surfaces:** UI only (CLI out, operator).
**Boundaries:** operator's own app; code may be quoted. **Existing catalog:** none.

## Round 1 (2026-10-29)

**Read:** routes, issues store, API schemas, filter bar, row menu, issue panel, new-issue form, settings pages,
`triage.spec.js` → section map (above).

**Decisions (with evidence):**
- Three states: browsing, viewing (side panel), selecting (bulk toolbar). Evidence: each surface has its own actions.
  Conditions from the store: `issues.current`, `selection.isActive`.
- Moves: list → panel by Open issue, back by Back; list → selection by Select issues, back by Done selecting or
  Close selected; New issue leaves for the form. Evidence: UI handlers, `triage.spec.js` (the triage workflow).
- The filter bar and sort are one command, Refine (they change one thing, the list).
- No filters in viewing. Evidence: greyed-out filter bar; confirmed C1.
- `close` in viewing closes the issue; `close panel` alias dropped (collision check, C2).
- Settings: browsing only, `full` tier (C3).
- `status open` vs `open 42`: deliberate overlap; one example each.

**Assumed, not yet confirmed:** param labels = filter bar labels; "dupe" as an alias for Close issue (docs glossary).

**Asked:** C1–C4 (answers above, operator's words).

**Planned (operator, C4):** saved views; field-by-field add.

**Service layer:** 7 existing; 1 refine adapter, 6 argument adapters, 2 conditions, 6 row adapters, 2 navigation
adapters; 2 planned (see step 7).
```
