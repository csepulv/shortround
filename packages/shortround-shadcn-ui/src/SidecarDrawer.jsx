import { AnimatePresence, motion } from 'framer-motion';

import { useShortRoundShadcnSidekick } from './useShortRoundShadcnSidekick.js';

export function SidecarDrawer() {
  const { isSidecarOpen, renderSidecar, sidecarWidth } = useShortRoundShadcnSidekick();

  return (
    <AnimatePresence>
      {isSidecarOpen && (
        <motion.div
          animate={{ width: sidecarWidth, opacity: 1 }}
          className="bg-background border-l"
          exit={{ width: 0, opacity: 0 }}
          initial={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          <div className="h-full w-full">{renderSidecar()}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
