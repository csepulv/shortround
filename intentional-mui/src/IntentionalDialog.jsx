import { Box, Popover } from '@mui/material';
import { motion } from 'framer-motion';

import { IntentionalPaletteFrame } from './IntentionalPaletteFrame.jsx';
import { ANIMATION_DURATION } from './mui-styles.js';
import { SidecarDrawer } from './SidecarDrawer.jsx';
import {
  IntentionalDialogProvider,
  useIntentionalDialogController
} from './useIntentionalDialogController.js';

function IntentionalDialogContent({ title, defaultIntentions }) {
  const { isOpen, onClose, anchorOrigin, anchorPosition, transformOrigin, height, totalWidth } =
    useIntentionalDialogController();
  return (
    <motion.div
      animate={{
        width: totalWidth
      }}
      layout
      transition={{ duration: ANIMATION_DURATION, ease: 'easeInOut' }}
    >
      <Popover
        PaperProps={{
          sx: {
            height,
            width: totalWidth,
            backgroundColor: 'transparent',
            boxShadow: 'none',
            backgroundImage: 'none'
          }
        }}
        anchorPosition={anchorPosition}
        anchorReference="anchorPosition"
        onClose={onClose}
        open={isOpen}
        transformOrigin={transformOrigin}
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
      </Popover>
    </motion.div>
  );
}

export function IntentionalDialog({ title, defaultIntentions }) {
  return (
    <IntentionalDialogProvider>
      <IntentionalDialogContent title={title} defaultIntentions={defaultIntentions} />
    </IntentionalDialogProvider>
  );
}
