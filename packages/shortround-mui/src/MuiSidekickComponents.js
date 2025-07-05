import { IntentionItem } from './components/intention-palette/IntentionItem.jsx';
import { NoMatches } from './components/intention-palette/NoMatches.jsx';
import { IntentionInput } from './components/intention-palette/IntentionInput.jsx';
import { IntentionGroup } from './components/intention-palette/IntentionGroup.jsx';
import { IntentionPaletteFrame } from './components/intention-palette/IntentionPaletteFrame.jsx';
import { SidecarContent } from './components/SidecarContent.jsx';
import { SidekickControlBar } from './components/sidekick/SidekickControlBar.jsx';

import { SidekickFrame } from './components/sidekick/SidekickFrame.jsx';
import { SidekickPopover } from './components/sidekick/SidekickPopover.jsx';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material';

export const theme = createTheme({
  shape: { borderRadius: 2 }
});

function ThemeProvider({ children }) {
  return <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>;
}

export const MuiSidekickComponents = {
  IntentionPalette: {
    Item: IntentionItem,
    NoMatches,
    Input: IntentionInput,
    Group: IntentionGroup,
    Frame: IntentionPaletteFrame
  },
  Sidekick: {
    ControlBar: SidekickControlBar,
    Frame: SidekickFrame,
    Popover: SidekickPopover
  },
  SidecarContent,
  ThemeProvider
};
