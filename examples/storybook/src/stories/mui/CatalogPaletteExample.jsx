import { Box, Typography } from '@mui/material';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { buildPalette, loadCatalog, RevertIntentionIds } from '@shortround/core';
import { muiTheme } from '@shortround/mui';
import { ShortRoundProvider, ShortRoundSidekick, SidekickStoreProvider } from '@shortround/react';
import { useState } from 'react';

import { theme } from './MuiSidekickExample.jsx';

// A palette from a catalog: rows to pick, and typed whole commands. The input shows how the line is being read (each
// word coloured by its role, the rest of the next word in grey); Tab completes it, Enter runs it.
const CATALOG = `
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

const asRows = (values) => values.map((value) => ({ value, title: value }));
const SLOW_LOOKUP_MS = 800;

function makeNotesPalette(log) {
  const notes = { previewed: null };
  const record = (name) => (args) => log(`${name}(${JSON.stringify(args ?? {})})`);
  const bindings = {
    notes: {
      previewing: () => notes.previewed !== null,
      search: record('search'),
      // Like an API call: the values answer after a moment, so the palette says it is loading.
      tags: () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(asRows(['design', 'react', 'recipes'])), SLOW_LOOKUP_MS);
        }),
      results: () => [
        { value: 'n1', title: '1. Grid layout notes', aliases: ['1'] },
        { value: 'n2', title: '2. CSS grid guide', aliases: ['2'] }
      ],
      preview: ({ note }) => {
        notes.previewed = note;
        log(`preview(${JSON.stringify({ note })})`);
      },
      next: record('next'),
      closePreview: () => {
        notes.previewed = null;
        log('closePreview()');
      }
    }
  };
  return buildPalette(loadCatalog(CATALOG, bindings), {
    backIntentionId: RevertIntentionIds.BACK
  });
}

function CatalogPaletteExample({ isOpen, title, disableLineHints }) {
  const [runs, setRuns] = useState([]);
  const [palette] = useState(() => makeNotesPalette((line) => setRuns((all) => [...all, line])));

  return (
    <SidekickStoreProvider initial={{ isOpen }}>
      <MuiThemeProvider theme={theme}>
        <ShortRoundProvider theme={muiTheme}>
          <Box sx={{ m: 'auto', minWidth: 480 }}>
            <Typography variant="body2">
              Try: search grid with sort new · tagged re · preview 1
            </Typography>
            <ShortRoundSidekick
              disableLineHints={disableLineHints}
              palette={palette}
              title={title}
            />
            <Box data-testid="runs" sx={{ mt: 2 }}>
              {runs.map((run, index) => (
                <Typography display="block" key={index} variant="caption">
                  {run}
                </Typography>
              ))}
            </Box>
          </Box>
        </ShortRoundProvider>
      </MuiThemeProvider>
    </SidekickStoreProvider>
  );
}

export default CatalogPaletteExample;
