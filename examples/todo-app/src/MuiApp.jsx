import { Box, Button } from '@mui/material';
import { MuiSidekickComponents, MuiToastProvider, useMuiToast } from '@shortround/mui';
import { helpIntent } from '@/help-intent.js';
import { saveItemIntent } from '@/save-item-intent.js';
import { ShortRoundSidekick, SidekickStoreProvider, useSidekick } from '@shortround/core';

function ToggleIntentionPalette() {
  const { setIsOpen, isOpen } = useSidekick();
  return <Button onClick={() => setIsOpen(!isOpen)}>Click Me</Button>;
}

function SidekickWrapper() {
  const { showToast } = useMuiToast();
  return (
    <ShortRoundSidekick
      title="Short Round"
      defaultIntentions={[helpIntent, saveItemIntent]}
      SidekickComponents={MuiSidekickComponents}
      showToast={showToast}
    />
  );
}

function MuiApp() {
  return (
    <SidekickStoreProvider initial={{ isOpen: false }}>
      <Box sx={{ m: 'auto' }}>
        <ToggleIntentionPalette />
        <Box sx={{ m: 'auto' }}>
          <MuiToastProvider>
            <SidekickWrapper />
          </MuiToastProvider>
        </Box>
      </Box>
    </SidekickStoreProvider>
  );
}

export default MuiApp;
