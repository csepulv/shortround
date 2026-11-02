import { Box, Button, createTheme } from '@mui/material';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import {
  ShortRoundProvider,
  ShortRoundSidekick,
  SidekickStoreProvider,
  useSidekick
} from '@shortround/core';
import { muiTheme } from '@shortround/mui';
import { LifeBuoy, Save } from 'lucide-react';

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

// The story's own icons, for the names its intentions use (MUI's theme has no `help` or `save`). Back and Cancel
// keep the theme's.
const EXAMPLE_ICONS = { help: LifeBuoy, save: Save };
const ExampleIcon = ({ name }) => {
  const Icon = EXAMPLE_ICONS[name];
  return Icon ? <Icon size={18} /> : null;
};
const icons = { Icon: ExampleIcon };

// The story is its own root: the MUI theme, ShortRound's theme and its icons are chosen here, and the palette below
// uses only core.
function MuiSidekickExample({ isOpen, title }) {
  return (
    <SidekickStoreProvider initial={{ isOpen }}>
      <MuiThemeProvider theme={theme}>
        <ShortRoundProvider icons={icons} theme={muiTheme}>
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
