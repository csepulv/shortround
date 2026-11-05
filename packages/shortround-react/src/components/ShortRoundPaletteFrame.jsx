import { ControlLabels } from '@shortround/core';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

import { useShortRoundTheme } from '../hooks/useShortRoundTheme.js';
import { useSidekick } from '../hooks/useSidekick.js';
import { ANIMATION_DURATION, DEFAULT_SIDEKICK_NAME } from '../utils.js';
import { ShortRoundPalette } from './ShortRoundPalette.jsx';

export function ShortRoundPaletteFrame({
  title,
  palette,
  defaultIntentions,
  resolveDefaultInput,
  resolveDefaultFallbackInput,
  SidekickComponents,
  showToast,
  defaultSidecarRenderer,
  disableLineHints
}) {
  const { onClose, setSize, anchorOrigin, cycleAnchorOrigin, height, size, commandWidth } =
    useSidekick();
  const { Sidekick, IntentionPalette } = SidekickComponents;
  // The app's registry comes from the provider; the theme's icons travel with its slots, so an app wired without
  // a provider keeps them.
  const registry = useShortRoundTheme()?.icons;
  const iconSources = useMemo(
    () => ({ registry, themeIcons: SidekickComponents.icons }),
    [registry, SidekickComponents.icons]
  );

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
            defaultSidecarRenderer={defaultSidecarRenderer}
            disableLineHints={disableLineHints}
            iconSources={iconSources}
            label={title ?? DEFAULT_SIDEKICK_NAME}
            palette={palette}
            resolveDefaultFallbackInput={resolveDefaultFallbackInput}
            resolveDefaultInput={resolveDefaultInput}
            showToast={showToast}
          />
        )}
      </Sidekick.Frame>
    </motion.div>
  );
}
