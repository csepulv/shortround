import { createTheme } from '@mui/material';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { muiTheme } from '@shortround/mui';
import { ShortRoundProvider, SidekickStoreProvider } from '@shortround/react';
import { LifeBuoy, Save } from 'lucide-react';

import SidekickPalette from './SidekickPalette.jsx';

export const theme = createTheme({
  spacing: 4,
  shape: { borderRadius: 2 }
});

// The demo's own icons, for the names its intentions use (MUI's theme has no `help` or `save`). Back and Cancel keep
// the theme's.
const EXAMPLE_ICONS = { help: LifeBuoy, save: Save };
const ExampleIcon = ({ name }) => {
  const Icon = EXAMPLE_ICONS[name];
  return Icon ? <Icon size={18} /> : null;
};
const icons = { Icon: ExampleIcon };

// The MUI demo's composition root: the one place its concrete ShortRound theme, and its icons, are chosen.
function MuiSidekickDemo() {
  return (
    <SidekickStoreProvider initial={{ isOpen: false }}>
      <MuiThemeProvider theme={theme}>
        <ShortRoundProvider icons={icons} theme={muiTheme}>
          <SidekickPalette />
        </ShortRoundProvider>
      </MuiThemeProvider>
    </SidekickStoreProvider>
  );
}

export default MuiSidekickDemo;
