import { Box, Button } from '@mui/material';
import { ShortRoundDialog, ShortRoundProvider, useShortRoundSidekick } from '@shortround/mui';
import { helpIntent } from '@/help-intent.js';
import { saveItemIntent } from '@/save-item-intent.js';

function ToggleIntentionPalette() {
  const { setIsOpen, isOpen } = useShortRoundSidekick();
  return <Button onClick={() => setIsOpen(!isOpen)}>Click Me</Button>;
}

function MuiApp() {
  return (
    <ShortRoundProvider>
      <Box sx={{ m: 'auto' }}>
        <ToggleIntentionPalette />
        <Box sx={{ m: 'auto' }}>
          <ShortRoundDialog defaultIntentions={[helpIntent, saveItemIntent]} />
        </Box>
      </Box>
    </ShortRoundProvider>
  );
}

export default MuiApp;
