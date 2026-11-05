// The editor: TipTap with task items, and "/" for ShortRound's command line. The editor tells the palette when the
// cursor or the document changes, so the commands follow the block the cursor is in (a task offers "due").
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useRef, useState } from 'react';

import { makeNotesPalette } from './notes-palette.js';
import { makeSlashCommand } from './slash-command.js';

const START =
  '<p>Type / for a command: /date last week, /search grid with tag react, /type task</p><p></p>';

export function NotesEditor({ log }) {
  const editorRef = useRef(null);
  // The palette and its command line belong to this editor alone, so they go when it goes: no dispose() needed (and
  // under StrictMode an effect's cleanup would dispose a line the slash command still uses).
  const [{ palette, slashCommand }] = useState(() => {
    const made = makeNotesPalette({ getEditor: () => editorRef.current, log });
    return { palette: made, slashCommand: makeSlashCommand({ commandLine: made.commandLine() }) };
  });

  const editor = useEditor({
    extensions: [StarterKit, TaskList, TaskItem.configure({ nested: true }), slashCommand],
    content: START,
    // notify() also drops the line's cached lookups. This catalog's lookups are instant, so telling it on every change
    // is free; with lookups that call an API, tell it only when what the commands depend on changes (the block type).
    onSelectionUpdate: () => palette.notify(),
    onUpdate: () => palette.notify()
  });
  editorRef.current = editor;

  return <EditorContent className="notes-editor" data-testid="editor" editor={editor} />;
}
