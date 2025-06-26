import { Box, Paper } from '@mui/material';
import { motion } from 'framer-motion';

import { ANIMATION_DURATION } from './mui-styles.js';
import { useIntentionalDialogController } from './useIntentionalDialogController.js';

export function SidecarDrawer() {
  const { showSidecar, renderSidecar, height, sidecarWidth } = useIntentionalDialogController();

  const variants = {
    open: { width: sidecarWidth, pointerEvents: 'auto' },
    closed: { width: 0, pointerEvents: 'none' }
  };

  return (
    <motion.div
      animate={showSidecar ? 'open' : 'closed'}
      layout
      style={{ display: 'flex', overflow: 'hidden', opacity: 1 }}
      transition={{ duration: ANIMATION_DURATION, ease: 'easeInOut' }}
      variants={variants}
    >
      <Paper
        elevation={8}
        sx={{
          width: '100%',
          height,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <Box sx={{ flex: 1, overflow: 'auto', m: 4 }}>{showSidecar ? renderSidecar() : null}</Box>
      </Paper>
    </motion.div>
  );
}
