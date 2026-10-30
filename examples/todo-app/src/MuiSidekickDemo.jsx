import { createTheme } from '@mui/material';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ShortRoundProvider, SidekickStoreProvider } from '@shortround/core';
import { muiTheme } from '@shortround/mui';

import SidekickPalette from './SidekickPalette.jsx';

export const theme = createTheme({
  spacing: 4,
  shape: { borderRadius: 2 }
});

// The MUI demo's composition root: the one place its concrete ShortRound theme is chosen.
function MuiSidekickDemo() {
  return (
    <SidekickStoreProvider initial={{ isOpen: false }}>
      <MuiThemeProvider theme={theme}>
        <ShortRoundProvider theme={muiTheme}>
          <SidekickPalette />
        </ShortRoundProvider>
      </MuiThemeProvider>
    </SidekickStoreProvider>
  );
}

export default MuiSidekickDemo;
