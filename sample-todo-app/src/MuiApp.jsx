import { Box, Button } from '@mui/material';
import {
  IntentionalDialog,
  IntentionalProvider,
  useIntentionalDialogController
} from '@shortround/mui';
import { helpIntent } from '@/help-intent.js';
import { saveItemIntent } from '@/save-item-intent.js';

function ToggleIntentionPalette() {
  const { setIsOpen, isOpen } = useIntentionalDialogController();
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
