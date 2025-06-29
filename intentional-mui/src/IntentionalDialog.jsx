import { Box, Paper, Portal } from '@mui/material';
import { motion } from 'framer-motion';

import { IntentionalPaletteFrame } from './IntentionalPaletteFrame.jsx';
import { ANIMATION_DURATION } from './mui-styles.js';
import { SidecarDrawer } from './SidecarDrawer.jsx';
import {
  IntentionalProvider,
  useShortRoundDialogController
} from './useShortRoundDialogController.js';

function IntentionalDialogContent({ title, defaultIntentions }) {
  const { isOpen, anchorPosition, anchorOrigin, height, totalWidth } =
    useShortRoundDialogController();
  if (!isOpen) return null;

  return (
    <motion.div
      animate={{
        width: totalWidth
      }}
      layout
      transition={{ duration: ANIMATION_DURATION, ease: 'easeInOut' }}
    >
      <Portal>
        <Paper
          elevation={1}
          sx={{
            position: 'fixed',
            ...anchorPosition,
            zIndex: (theme) => theme.zIndex.modal + 1,
            height,
            width: totalWidth,
            backgroundColor: 'transparent'
          }}
        >
          <Box
            sx={{
              backgroundColor: 'transparent',
              display: 'flex',
              height,
              width: totalWidth,
              alignItems: 'flex-start',
              flexDirection: anchorOrigin?.toLowerCase()?.endsWith('right') ? 'row-reverse' : 'row'
            }}
          >
            <IntentionalPaletteFrame title={title} defaultIntentions={defaultIntentions} />
            <SidecarDrawer />
          </Box>
        </Paper>
      </Portal>
    </motion.div>
  );
}

export function IntentionalDialog({ title, defaultIntentions }) {
  return (
    <IntentionalProvider>
      <IntentionalDialogContent title={title} defaultIntentions={defaultIntentions} />
    </IntentionalProvider>
  );
}
