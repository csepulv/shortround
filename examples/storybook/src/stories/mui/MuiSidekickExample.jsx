import { Box, Button, createTheme } from '@mui/material';
import { MuiSidekickComponents, MuiToastProvider, useMuiToast } from '@shortround/mui';
import { helpIntent } from './help-intent.js';
import { saveItemIntent } from './save-item-intent.js';
import { ShortRoundSidekick, SidekickStoreProvider, useSidekick } from '@shortround/core';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';

function ToggleIntentionPalette() {
  const { setIsOpen, isOpen } = useSidekick();
  return <Button onClick={() => setIsOpen(!isOpen)}>Click Me</Button>;
}

export const theme = createTheme({
  spacing: 4,
  shape: { borderRadius: 2 }
});

function SidekickWrapper({ title }) {
  const { showToast } = useMuiToast();

  return (
    <ShortRoundSidekick
      title={title}
      defaultIntentions={[helpIntent, saveItemIntent]}
      SidekickComponents={MuiSidekickComponents}
      showToast={showToast}
    />
  );
}

function MuiSidekickExample({ isOpen, title }) {
  return (
    <SidekickStoreProvider initial={{ isOpen }}>
      <MuiThemeProvider theme={theme}>
        <Box sx={{ m: 'auto' }}>
          <ToggleIntentionPalette />
          <Box sx={{ m: 'auto' }}>
            <MuiToastProvider>
              <SidekickWrapper title={title} />
            </MuiToastProvider>
          </Box>
        </Box>
      </MuiThemeProvider>
    </SidekickStoreProvider>
  );
}

export default MuiSidekickExample;
