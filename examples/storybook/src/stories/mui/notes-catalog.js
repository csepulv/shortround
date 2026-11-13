export const NOTES_CATALOG = `
version: 3
app: notes
groups:
  find: { label: Find }
  results: { label: Results }
  preview: { label: Preview }
states:
  browsing: { start: true, when: '!notes.previewing', commands: [search, preview] }
  previewing: { when: notes.previewing, commands: [next, closePreview] }
commands:
  search:
    label: Search
    group: find
    run: notes.search
    params:
      term: { label: Search, default: true, argSource: { freeform: true, type: text } }
      sort:
        label: Sort
        hints: [with]
        argSource:
          list:
            - { value: newest, title: Newest }
            - { value: oldest, title: Oldest }
            - { value: relevance, title: Relevance }
      tags:
        label: Tag
        aliases: [tagged]
        hints: [with]
        list: true
        argSource: { lookup: notes.tags }
  preview:
    label: Preview
    group: results
    run: notes.preview
    params: { note: { label: Note, default: true, argSource: { lookup: notes.results } } }
  next: { label: Next, group: preview, run: notes.next }
  closePreview: { label: Close preview, aliases: [close], group: preview, run: notes.closePreview }
`;

export const NOTES = [
  { value: 'n1', title: '1. Grid layout notes', aliases: ['1'] },
  { value: 'n2', title: '2. CSS grid guide', aliases: ['2'] }
];

const SLOW_LOOKUP_MS = 800;
const asRows = (values) => values.map((value) => ({ value, title: value }));
const titleOf = (value) => NOTES.find((note) => note.value === value)?.title ?? value;

export function makeNotesBindings({ log, onChange = () => {} }) {
  const notes = { previewed: null };
  const record = (name) => (args) => log(`${name}(${JSON.stringify(args ?? {})})`);
  return {
    notes: {
      previewing: () => notes.previewed !== null,
      search: (args) => {
        record('search')(args);
        return { message: `Searched for ${args.term ?? 'everything'}` };
      },
      // Like an API call: the values answer after a moment, so the line says it is loading.
      tags: () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(asRows(['design', 'react', 'recipes'])), SLOW_LOOKUP_MS);
        }),
      results: () => NOTES,
      preview: ({ note }) => {
        notes.previewed = note;
        log(`preview(${JSON.stringify({ note })})`);
        onChange();
        return { message: `Previewing ${titleOf(note)}` };
      },
      next: record('next'),
      closePreview: () => {
        notes.previewed = null;
        log('closePreview()');
        onChange();
        return { message: 'Closed the preview' };
      }
    }
  };
}
