import { motion } from 'framer-motion';

import { ShortRoundPaletteFrame } from './ShortRoundPaletteFrame.jsx';
import { ANIMATION_DURATION } from '../utils.js';
import { SidecarDrawer } from './SidecarDrawer.jsx';
import {
  SidekickStoreProvider,
  useShortRoundKeyboardShortcuts,
  useSidekick
} from '../hooks/useSidekick.js';

function SidekickContent({
  title,
  defaultIntentions,
  SidekickComponents,
  showToast,
  installKeyboardShortcuts
}) {
  const {
    isSidecarOpen,
    anchorOrigin,
    renderSidecar,
    height,
    sidecarWidth,
    isOpen,
    anchorPosition,
    totalWidth,
    onOpen,
    onClose
  } = useSidekick();

  const { Sidekick, SidecarContent } = SidekickComponents;

  // TODO: might allow for custom shortcuts

  useShortRoundKeyboardShortcuts({
    onOpen,
    onClose,
    installKeyboardShortcuts
  });

  if (!isOpen) return null;

  return (
    <motion.div
      animate={{
        width: totalWidth
      }}
      layout
      transition={{ duration: ANIMATION_DURATION, ease: 'easeInOut' }}
    >
      <Sidekick.Popover
        anchorPosition={anchorPosition}
        height={height}
        totalWidth={totalWidth}
        anchorOrigin={anchorOrigin}
      >
        <ShortRoundPaletteFrame
          title={title}
          defaultIntentions={defaultIntentions}
          SidekickComponents={SidekickComponents}
          showToast={showToast}
        />
        <SidecarDrawer
          renderSidecar={renderSidecar}
          isOpen={isSidecarOpen}
          height={height}
          width={sidecarWidth}
          Content={SidecarContent}
        />
      </Sidekick.Popover>
    </motion.div>
  );
}

export function ShortRoundSidekick({
  title,
  defaultIntentions,
  SidekickComponents,
  showToast,
  installKeyboardShortcuts,
  sidekickStore,
  initialSidekickState
}) {
  return (
    <SidekickStoreProvider store={sidekickStore} initial={initialSidekickState}>
      <SidekickContent
        title={title}
        defaultIntentions={defaultIntentions}
        SidekickComponents={SidekickComponents}
        showToast={showToast}
        installKeyboardShortcuts={installKeyboardShortcuts}
      />
    </SidekickStoreProvider>
  );
}
