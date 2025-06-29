import { AnimatePresence, motion } from 'framer-motion';
import { useShortRoundDialogController } from './useShortRoundDialogController.js';

export function SidecarDrawer() {
  const { showSidecar, renderSidecar, sidecarWidth } = useShortRoundDialogController();

  return (
    <AnimatePresence>
      {showSidecar && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: sidecarWidth, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="bg-background border-l"
        >
          <div className="h-full w-full">{renderSidecar()}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
