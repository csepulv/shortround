import { motion } from 'framer-motion';

import { useSidekick } from '../hooks/useSidekick.js';
import { ANIMATION_DURATION, ControlLabels, DEFAULT_SIDEKICK_NAME } from '../utils.js';
import { ShortRoundPalette } from './ShortRoundPalette.jsx';

export function ShortRoundPaletteFrame({
  title,
  defaultIntentions,
  resolveDefaultInput,
  SidekickComponents,
  showToast
}) {
  const { onClose, setSize, anchorOrigin, cycleAnchorOrigin, height, size, commandWidth } =
    useSidekick();
  const { Sidekick, IntentionPalette } = SidekickComponents;

  return (
    <motion.div layout transition={{ duration: ANIMATION_DURATION, ease: 'easeInOut' }}>
      <Sidekick.Frame commandWidth={commandWidth} height={height}>
        <Sidekick.ControlBar
          anchorOrigin={anchorOrigin}
          cycleAnchorOrigin={cycleAnchorOrigin}
          labels={ControlLabels}
          onClose={onClose}
          setSize={setSize}
          size={size}
          title={title}
        />
        {size !== 'compact' && (
          <ShortRoundPalette
            IntentionPalette={IntentionPalette}
            defaultIntentions={defaultIntentions}
            label={title ?? DEFAULT_SIDEKICK_NAME}
            resolveDefaultInput={resolveDefaultInput}
            showToast={showToast}
          />
        )}
      </Sidekick.Frame>
    </motion.div>
  );
}
