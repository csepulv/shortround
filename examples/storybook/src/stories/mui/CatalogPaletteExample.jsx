import { Box, Typography } from '@mui/material';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { buildPalette, loadCatalog, RevertIntentionIds } from '@shortround/core';
import { muiTheme } from '@shortround/mui';
import { ShortRoundProvider, ShortRoundSidekick, SidekickStoreProvider } from '@shortround/react';
import { useState } from 'react';

import { theme } from './MuiSidekickExample.jsx';
import { makeNotesBindings, NOTES_CATALOG } from './notes-catalog.js';

// A palette from a catalog: rows to pick, and typed whole commands. The input shows how the line is being read (each
// word coloured by its role, the rest of the next word in grey); Tab completes it, Enter runs it.
const makeNotesPalette = (log) =>
  buildPalette(loadCatalog(NOTES_CATALOG, makeNotesBindings({ log })), {
    backIntentionId: RevertIntentionIds.BACK
  });

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
