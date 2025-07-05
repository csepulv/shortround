import { motion } from 'framer-motion';

import { ShortRoundPalette } from './ShortRoundPalette.jsx';
import { ANIMATION_DURATION } from '../utils.js';
import { useSidekick } from '../hooks/useSidekick.js';

export function ShortRoundPaletteFrame({
  title,
  defaultIntentions,
  SidekickComponents,
  showToast
}) {
  const { onClose, setSize, anchorOrigin, cycleAnchorOrigin, height, size, commandWidth } =
    useSidekick();
  const { Sidekick, IntentionPalette } = SidekickComponents;

  return (
    <motion.div layout transition={{ duration: ANIMATION_DURATION, ease: 'easeInOut' }}>
      <Sidekick.Frame height={height} commandWidth={commandWidth}>
        <Sidekick.ControlBar
          cycleAnchorOrigin={cycleAnchorOrigin}
          title={title}
          anchorOrigin={anchorOrigin}
          onClose={onClose}
          setSize={setSize}
          size={size}
        />
        {size !== 'compact' && (
          <ShortRoundPalette
            defaultIntentions={defaultIntentions}
            IntentionPalette={IntentionPalette}
            showToast={showToast}
          />
        )}
      </Sidekick.Frame>
    </motion.div>
  );
}
