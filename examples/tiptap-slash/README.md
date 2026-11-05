# TipTap slash commands

Slash commands in a [TipTap](https://tiptap.dev) editor, read by `@shortround/core`'s command line. There is no
palette UI: the catalog's palette supplies the command line, and a small popup draws its state.

```bash
pnpm install
pnpm --filter @shortround/core build   # the example uses core's built package
pnpm --filter @shortround/example-tiptap-slash dev
```

Type `/` in the editor, then a command. The popup colours each word by its role, shows the rest of the next word in
grey, and says what would run. Tab completes the next word; Enter runs the line when it can, and otherwise completes
like Tab; Escape closes the popup.

## The commands

`src/notes-catalog.yaml` has three kinds of command:

- **Insert text:** `date` inserts a date or range (`/date tomorrow`).
- **Call the app and insert its result:** `search` inserts a link to the first result, optionally by tag
  (`/search grid with tag react`).
- **Change the block, and with it the context:** `type` makes the block a task item or a note (`/type task`). In a
  task item the `task` state holds and offers `due`, which `writing` doesn't.

## The files

- `notes-palette.js`: the app's functions as the catalog names them, and `buildPalette`. Each `run` edits the
  document at the cursor.
- `slash-command.js`: a TipTap extension on `@tiptap/suggestion`. It passes the text after `/` to
  `commandLine.change`, and maps Tab to `acceptCompletion` and Enter to `submit`.
- `SlashPopup.jsx`: draws the command line's state.
- `NotesEditor.jsx`: the editor; it calls `palette.notify()` when the selection or document changes, so the line
  reads the commands available at the cursor.

## The ordering trap

Running a command removes the `/…` text first, and removing it closes the popup. A popup that cancels the line when
it closes would clear the line before `submit()` runs it, and Enter would do nothing. `slash-command.js` keeps a flag
while it submits, so closing the popup then leaves the line alone; `submit()` clears it after the run.
