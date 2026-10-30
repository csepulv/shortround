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

| Section | Surfaces | Nouns | In scope? | Values from (sync? all or current?) |
|---|---|---|---|---|
| Issues | list (/issues), side panel, row menu | issue, label, assignee, status | yes | store: issues (sync; the current list) |
| Bulk edit | checkbox selection on the list, bulk toolbar | selection | yes | store: selection (sync) |
| New issue | form (/issues/new) | issue | entry only | api: labels, members (async; all) |
| Saved views | sidebar list | view (filters + sort) | yes | api: views (async; all; no store action) |
| Settings | labels, members, notifications | label, member | no | api |

Existing functions (store): issues.open(id), issues.closeIssue(), issues.next(), issues.previous(), issue.close(),
issue.reopen(), issue.assign(memberId), issue.addLabel(name), filters.add(facet, value), filters.drop(facet, value),
sort.set(id), selection.start(), selection.toggle(id), selection.clear(), bulk.close(), bulk.addLabel(name) (the
bulk actions apply to the store's current selection).
In components only: the row menu's "Copy link"; the form's submit. Labels and members are fetched (async), and the
store caches both after the first fetch.
```

## Step 2: contexts the UI offers

Read from the UI code, not the store:

- **The list** offers the filter bar (status, label, assignee), sort, a "Select" button, a row click that opens the
  side panel, and a "New issue" button that goes to the form.
- **The side panel** offers Add label, Assign, Close, Next and Previous arrows, and a close (×) button. The filter bar
  stays visible but greyed out while the panel is open.
- **Selection mode** (after "Select") shows checkboxes and a bulk toolbar: Close selected, Label selected, Done.
- **The new-issue form** is a separate page with its own Cancel and Create.

So: three candidate states (list, panel, selection), and the form is a way out of the palette's area. The greyed-out
filter bar is evidence that refining isn't offered while an issue is open, but greyed-out could also mean "not yet
built" (clarify).

An end-to-end test (`triage.spec.js`) walks list → panel → label → next → close, which confirms the panel's loop.

## Step 3: the graph

```text
browsing ──open issue──▶ viewing ──back──▶ browsing
viewing ──next / previous──▶ viewing
browsing ──select issues──▶ selecting ──done / close selected──▶ browsing
browsing ──new issue──▶ (leaves for the form)
```

Functions: everything in the panel and selection mode exists in the store, callable as the catalog will call it.
`filters.drop(facet, value)` takes two arguments, while its picker's rows carry one `{ facet, value }` value, so the
command splits it with `args`. Adapters: every picker's rows function (the store holds issues, filters and options; a
picker wants display rows), and two navigation functions, `issues.openNewForm` and `settings.open` (they navigate
inside components).
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

Not asked, recorded as assumed: the facet titles are the filter bar's labels; "dupe" is a word the team uses for
closing (from the docs' glossary).

## Step 5: the catalog

As first written; step 6 drops one alias (`close panel`).

```yaml
version: 2
app: tracker

pickers:
  issue:
    from: tracker.issues.rows
    empty: No issues match
  facetValue:
    from: tracker.filters.valueRows
    empty: No {title} values
  activeFilter:
    from: tracker.filters.activeRows
    empty: No filters applied
  sortOption:
    from: tracker.sort.rows
    empty: No sort options
  member:
    from: tracker.members.rows
    empty: No members
  label:
    from: tracker.labels.rows
    empty: No labels
  savedView:
    planned: true
    empty: No saved views

facets:
  status:   { title: Status }
  label:    { title: Label, aliases: [tagged] }
  assignee: { title: Assignee, aliases: [assigned to] }

states:
  browsing:
    summary: The issue list; where the palette starts
    start: true
    tier: common
    commands:
      filter:
        summary: Add a value to one of the list's filters (one command per facet)
        forEach: facets
        ask: { choose: facetValue }
        run: tracker.filters.add
        group: Refine
      filters.drop:
        title: Drop filter
        aliases: [remove filter]
        ask: { choose: activeFilter }
        run: tracker.filters.drop
        args: [$value.facet, $value.value]
        group: Refine
      sort.set:
        title: Sort
        aliases: [sort by]
        ask: { choose: sortOption }
        run: tracker.sort.set
        group: Refine
      issues.open:
        title: Open issue
        aliases: [open]
        ask: { choose: issue }
        run: tracker.issues.open
        then: viewing
        group: Issues
      selection.start:
        title: Select issues
        aliases: [select]
        run: tracker.selection.start
        then: selecting
        group: Issues
      issues.openNewForm:
        title: New issue
        summary: Go to the new-issue form
        run: tracker.issues.openNewForm
        review: Leaves the palette's area; operator would like a field-by-field version someday (see adding)
      views.open:
        planned: true
        title: Saved views
        ask: { choose: savedView }
        summary: Replace the current filters and sort with a saved view
        review: The sidebar calls the API directly; the store needs a views action first
      settings.open:
        title: Go to settings
        tier: full
        summary: Open a settings page
        run: tracker.settings.open

  viewing:
    summary: One issue is open in the side panel; only commands about it apply
    panel: sidecar
    tier: common
    commands:
      issue.addLabel:
        title: Add label
        aliases: [label]
        ask: { choose: label }
        run: tracker.issue.addLabel
      issue.assign:
        title: Assign
        aliases: [assign to]
        ask: { choose: member }
        run: tracker.issue.assign
      issue.close:
        title: Close issue
        aliases: [close, dupe]
        run: tracker.issue.close
      issues.next:
        title: Next issue
        aliases: [next]
        run: tracker.issues.next
      issues.previous:
        title: Previous issue
        aliases: [prev]
        run: tracker.issues.previous
      issues.closeIssue:
        title: Back to the list
        aliases: [back, done, close panel]
        run: tracker.issues.closeIssue
        then: browsing

  selecting:
    summary: Picking issues for a bulk action
    tier: common
    commands:
      selection.toggle:
        title: Toggle issue
        ask: { choose: issue }
        run: tracker.selection.toggle
      bulk.close:
        title: Close selected
        run: tracker.bulk.close
        then: browsing
      bulk.addLabel:
        title: Label selected
        ask: { choose: label }
        run: tracker.bulk.addLabel
      selection.clear:
        title: Done selecting
        aliases: [done, back]
        run: tracker.selection.clear
        then: browsing

  adding:
    planned: true
    summary: Filing a new issue from the palette, one field at a time (operator, someday)
    steps:
      - { ask: { text: Title } }
      - { ask: { choose: label } }
      - { ask: { choose: member } }
      - { run: tracker.issues.create, then: browsing }
```

The planned items are exactly what the operator named in C4: saved views, and the field-by-field add. Everything
else is what the app does today.

## The examples file

```yaml
examples:
  - say: status new
    means: tracker.filter.status::new
  - say: status open
    means: tracker.filter.status::open
  - say: open 42
    means: tracker.issues.open::42
  - say: status new sort newest
    means: [tracker.filter.status::new, tracker.sort.set::newest]
  - say: tagged bug
    means: tracker.filter.label::bug
```

## Step 6: check and review

The review script's checks pass, and its collision check finds one word that means two things:

- **viewing:** `close` (Close issue) is also the start of `close panel` (Back to the list).

The engine resolves it (the longest match wins, so `close panel` is Back to the list), but two meanings for one word
in the same list is worth a decision rather than an accident. Per C2, `close` means the issue: the `close panel`
alias is dropped.

Walking the map with the operator surfaced one overlap the check can't see, because it checks command words, not
values: `open` opens an issue in browsing, but the operator also types `status open` to filter. The line
`status open` starts with the Status command's words, so it resolves to the filter, and `open 42` resolves to Open
issue. Recorded as a deliberate overlap, with an example for each, so a change that breaks either line fails.

## Step 7: the service layer

| Function | Status |
|---|---|
| filters.add, filters.drop, sort.set, issues.open, issues.closeIssue, issues.next, issues.previous, issue.addLabel, issue.assign, issue.close, selection.*, bulk.* | existing |
| issues.rows, filters.valueRows, filters.activeRows, sort.rows, members.rows, labels.rows | adapter: display rows from store data (members and labels from the cache) |
| issues.openNewForm, settings.open | adapter: navigation that lives in components today |
| views.open, savedView rows; issues.create (field by field) | planned |

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
- No filters in viewing. Evidence: greyed-out filter bar; confirmed C1.
- `close` in viewing closes the issue; `close panel` alias dropped (collision check, C2).
- Settings: browsing only, `full` tier (C3).
- `status open` vs `open 42`: deliberate overlap; one example each.

**Assumed, not yet confirmed:** facet titles = filter bar labels; "dupe" as an alias for Close issue (docs glossary).

**Asked:** C1–C4 (answers above, operator's words).

**Planned (operator, C4):** saved views; field-by-field add.

**Service layer:** 6 row adapters, 2 navigation adapters, 2 planned (see step 7).
```
