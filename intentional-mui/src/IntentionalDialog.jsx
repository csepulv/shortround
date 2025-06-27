import { Box, Paper, Popover, Popper } from '@mui/material';
import { motion } from 'framer-motion';

import { IntentionalPaletteFrame } from './IntentionalPaletteFrame.jsx';
import { ANIMATION_DURATION } from './mui-styles.js';
import { SidecarDrawer } from './SidecarDrawer.jsx';
import {
  IntentionalProvider,
  useIntentionalDialogController
} from './useIntentionalDialogController.js';
import { useMemo } from 'react';

function IntentionalDialogContent({ title, defaultIntentions }) {
  const { isOpen, onClose, anchorOrigin, anchorPosition, transformOrigin, height, totalWidth } =
    useIntentionalDialogController();

  const anchor = useMemo(
    () => ({
      getBoundingClientRect: () => new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 0, 0),
      contextElement: document.body
    }),
    []
  );

  return (
    <motion.div
      animate={{
        width: totalWidth
      }}
      layout
      transition={{ duration: ANIMATION_DURATION, ease: 'easeInOut' }}
    >
      <Popper open={isOpen} anchorEl={anchor} placement="auto">
        <Paper
          sx={{
            height,
            width: totalWidth,
            backgroundColor: 'transparent',
            boxShadow: 'none',
            backgroundImage: 'none'
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
      </Popper>
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
