import { Box, Button, createTheme } from '@mui/material';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import {
  ShortRoundProvider,
  ShortRoundSidekick,
  SidekickStoreProvider,
  useSidekick
} from '@shortround/core';
import { muiTheme } from '@shortround/mui';

import { helpIntent } from './help-intent.js';
import { saveItemIntent } from './save-item-intent.js';

function ToggleIntentionPalette() {
  const { setIsOpen, isOpen } = useSidekick();
  return <Button onClick={() => setIsOpen(!isOpen)}>Click Me</Button>;
}

export const theme = createTheme({
  spacing: 4,
  shape: { borderRadius: 2 }
});

// The story is its own root: the MUI theme and ShortRound's theme are chosen here, and the palette below
// uses only core.
function MuiSidekickExample({ isOpen, title }) {
  return (
    <SidekickStoreProvider initial={{ isOpen }}>
      <MuiThemeProvider theme={theme}>
        <ShortRoundProvider theme={muiTheme}>
          <Box sx={{ m: 'auto' }}>
            <ToggleIntentionPalette />
            <Box sx={{ m: 'auto' }}>
              <ShortRoundSidekick defaultIntentions={[helpIntent, saveItemIntent]} title={title} />
            </Box>
          </Box>
        </ShortRoundProvider>
      </MuiThemeProvider>
    </SidekickStoreProvider>
  );
}

export default MuiSidekickExample;
