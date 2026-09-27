import { motion } from 'framer-motion';
import { ANIMATION_DURATION } from '../utils.js';

export function SidecarDrawer({ isOpen, renderSidecar, height, width, Content }) {
  const variants = {
    open: { width, pointerEvents: 'auto' },
    closed: { width: 0, pointerEvents: 'none' }
  };
  return (
    <motion.div
      animate={isOpen ? 'open' : 'closed'}
      layout
      style={{ display: 'flex', overflow: 'hidden', opacity: 1 }}
      transition={{ duration: ANIMATION_DURATION, ease: 'easeInOut' }}
      variants={variants}
    >
      <Content isOpen={isOpen} renderSidecar={renderSidecar} height={height} />
    </motion.div>
  );
}
