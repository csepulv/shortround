import { Box, Button } from '@mui/material';
import {
  IntentionalDialog,
  IntentionalProvider,
  useShortRoundDialogController
} from '@shortround/mui';
import { helpIntent } from '@/help-intent.js';
import { saveItemIntent } from '@/save-item-intent.js';

function ToggleIntentionPalette() {
  const { setIsOpen, isOpen } = useShortRoundDialogController();
  return <Button onClick={() => setIsOpen(!isOpen)}>Click Me</Button>;
}

function MuiApp() {
  return (
    <IntentionalProvider>
      <Box sx={{ m: 'auto' }}>
        <ToggleIntentionPalette />
        <Box sx={{ m: 'auto' }}>
          <IntentionalDialog defaultIntentions={[helpIntent, saveItemIntent]} />
        </Box>
      </Box>
    </IntentionalProvider>
  );
}

export default MuiApp;
