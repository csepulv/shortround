// The app's functions, as the catalog names them, and the palette built from them. Each `run` edits the document at
// the cursor: the slash command has already removed the "/…" text that named it. No palette UI is drawn; the palette
// is where the command line comes from.
import { buildPalette, loadCatalog, RevertIntentionIds } from '@shortround/core';

import CATALOG_TEXT from './notes-catalog.yaml?raw';

// A stand-in for an app's search.
const RESULTS = [
  {
    title: 'CSS grid guide',
    href: 'https://example.com/css-grid-guide',
    tags: ['react', 'design']
  },
  { title: 'Grid layout notes', href: 'https://example.com/grid-layout-notes', tags: ['design'] }
];

const formatRange = ({ start, end }) => (start === end ? start : `${start} to ${end}`);

export function makeNotesPalette({ getEditor, log }) {
  const insertText = (text) =>
    getEditor().chain().focus().insertContent({ type: 'text', text }).run();
  const isInTask = () => Boolean(getEditor()?.isActive('taskItem'));

  const bindings = {
    notes: {
      conditions: { inTask: isInTask },
      insert: {
        date: ({ when }) => {
          log(`date ${JSON.stringify(when)}`);
          insertText(formatRange(when));
        },
        searchLink: ({ term, tags = [] }) => {
          log(`search ${JSON.stringify({ term, tags })}`);
          const result =
            RESULTS.find((candidate) => tags.every((tag) => candidate.tags.includes(tag))) ??
            RESULTS[0];
          getEditor()
            .chain()
            .focus()
            .insertContent({
              type: 'text',
              text: result.title,
              marks: [{ type: 'link', attrs: { href: result.href } }]
            })
            .run();
        }
      },
      block: {
        setType: ({ kind }) => {
          log(`type ${kind}`);
          const isTask = isInTask();
          if ((kind === 'task' && !isTask) || (kind === 'note' && isTask)) {
            getEditor().chain().focus().toggleTaskList().run();
          }
        }
      },
      task: {
        setDue: ({ when }) => {
          log(`due ${JSON.stringify(when)}`);
          insertText(`due ${formatRange(when)}`);
        }
      },
      tags: {
        rows: () => [
          { value: 'react', title: 'react' },
          { value: 'design', title: 'design' }
        ]
      }
    }
  };
  return buildPalette(loadCatalog(CATALOG_TEXT, bindings), {
    backIntentionId: RevertIntentionIds.BACK
  });
}
