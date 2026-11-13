import { Box, Paper, Typography } from '@mui/material';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { IntentionChat } from '@shortround/chat';
import { buildCatalogRuntime, loadCatalog } from '@shortround/core';
import { muiTheme } from '@shortround/mui';
import { ShortRoundProvider } from '@shortround/react';
import { useState } from 'react';

import { theme } from './MuiSidekickExample.jsx';
import { makeNotesBindings, NOTES_CATALOG } from './notes-catalog.js';
import { makeScriptedTransport } from './scripted-notes-chat.js';

function makeNotesRuntime(log) {
  let runtime;
  const bindings = makeNotesBindings({ log, onChange: () => runtime.notify() });
  runtime = buildCatalogRuntime(loadCatalog(NOTES_CATALOG, bindings));
  return runtime;
}

function IntentionChatExample({ showHintForMissing }) {
  const [runs, setRuns] = useState([]);
  const [runtime] = useState(() => makeNotesRuntime((line) => setRuns((all) => [...all, line])));
  const [transport] = useState(makeScriptedTransport);

  return (
    <MuiThemeProvider theme={theme}>
      <ShortRoundProvider theme={muiTheme}>
        <Box sx={{ display: 'flex', gap: 2, m: 'auto' }}>
          <Paper sx={{ width: 560, height: 520 }} variant="outlined">
            <IntentionChat
              runtime={runtime}
              showHintForMissing={showHintForMissing}
              transport={transport}
            />
          </Paper>
          <Box data-testid="runs" sx={{ width: 220 }}>
            <Typography variant="subtitle2">App calls</Typography>
            {runs.map((run, index) => (
              <Typography component="div" key={index} variant="caption">
                {run}
              </Typography>
            ))}
          </Box>
        </Box>
      </ShortRoundProvider>
    </MuiThemeProvider>
  );
}

export default IntentionChatExample;
