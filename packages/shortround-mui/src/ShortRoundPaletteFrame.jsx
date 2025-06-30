import { CircleX as CloseIcon } from 'lucide-react';
import { Maximize as FullscreenIcon } from 'lucide-react';
import { Minimize as MinimizeIcon } from 'lucide-react';
import { Grip as ViewCompactIcon } from 'lucide-react';

import { Box, Button, ButtonGroup, IconButton, Paper, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import {
  TbBoxAlignBottomLeftFilled as AnchorBottomLeftIcon,
  TbBoxAlignBottomRightFilled as AnchorBottomRightIcon,
  TbBoxAlignTopLeftFilled as AnchorTopLeftIcon,
  TbBoxAlignTopRightFilled as AnchorTopRightIcon,
  TbBoxMargin as AnchorCenterIcon
} from 'react-icons/tb';

import { ShortRoundPalette } from './ShortRoundPalette.jsx';
import { ANIMATION_DURATION } from './mui-styles.js';
import { useShortRoundSidekick } from './useShortRoundSidekick.js';

const anchorIcons = {
  center: AnchorCenterIcon,
  'top-left': AnchorTopLeftIcon,
  'top-right': AnchorTopRightIcon,
  'bottom-left': AnchorBottomLeftIcon,
  'bottom-right': AnchorBottomRightIcon
};

function ChangeAnchorPosition({ onCycleAnchorOrigin, position }) {
  const AnchorIcon = anchorIcons[position];
  return (
    <IconButton onClick={onCycleAnchorOrigin} sx={{ mr: 2 }}>
      <AnchorIcon />
    </IconButton>
  );
}

function ShortRoundPaletteWrapper({ width, height, defaultIntentions }) {
  return (
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
      <ShortRoundPalette defaultIntentions={defaultIntentions} />
    </Paper>
  );
}

export function ShortRoundPaletteFrame({ title, defaultIntentions }) {
  const { onClose, setSize, anchorOrigin, cycleAnchorOrigin, height, size, commandWidth } =
    useShortRoundSidekick();
  return (
    <motion.div layout transition={{ duration: ANIMATION_DURATION, ease: 'easeInOut' }}>
      <Paper
        elevation={3}
        sx={{
          width: commandWidth, // `calc(${commandWidth} - 20px)`,
          backgroundColor: 'paperGray.main',
          overflow: 'hidden',
          height,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flex: '0 0 auto',
            alignItems: 'center',
            px: 2,
            py: 1,
            borderBottom: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'paperGray.main'
          }}
        >
          <ChangeAnchorPosition onCycleAnchorOrigin={cycleAnchorOrigin} position={anchorOrigin} />
          <Typography
            component="div"
            sx={{ flexGrow: 1, color: 'surfaceHeader.contrastText' }}
            variant="h6"
          >
            {title}
          </Typography>
          <ButtonGroup size="small" sx={{ mr: 1 }} variant="text">
            <Button onClick={() => setSize('minimized')}>
              <MinimizeIcon fontSize="small" />
            </Button>
            <Button onClick={() => setSize('compact')}>
              <ViewCompactIcon fontSize="small" />
            </Button>
            <Button onClick={() => setSize('full')}>
              <FullscreenIcon fontSize="small" />
            </Button>
          </ButtonGroup>
          <IconButton onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        {size !== 'minimized' && (
          <Box sx={{ overflow: 'hidden', height: 'calc(100% - 49px)' }}>
            <ShortRoundPaletteWrapper
              height={height}
              width={commandWidth}
              defaultIntentions={defaultIntentions}
            />
          </Box>
        )}
      </Paper>
    </motion.div>
  );
}
