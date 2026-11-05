import { Box, Button } from '@mui/material';
import { ShortRoundSidekick, useSidekick } from '@shortround/react';

import { helpIntent } from '@/help-intent.js';
import { saveItemIntent } from '@/save-item-intent.js';

function ToggleIntentionPalette() {
  const { setIsOpen, isOpen } = useSidekick();
  return <Button onClick={() => setIsOpen(!isOpen)}>Click Me</Button>;
}

// App code: depends only on ShortRound's interface; the theme comes from the root (MuiSidekickDemo).
export default function SidekickPalette() {
  return (
    <Box sx={{ m: 'auto' }}>
      <ToggleIntentionPalette />
      <Box sx={{ m: 'auto' }}>
        <ShortRoundSidekick defaultIntentions={[helpIntent, saveItemIntent]} title="Short Round" />
      </Box>
    </Box>
  );
}
