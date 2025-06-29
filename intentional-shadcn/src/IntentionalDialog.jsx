import { Popover, PopoverContent, PopoverTrigger } from './components/ui/popover';

import {
  IntentionalProvider,
  useShortRoundDialogController
} from './useShortRoundDialogController.js';
import { IntentionalPaletteFrame } from './IntentionalPaletteFrame';
import { cn } from './lib/utils';
import { SidecarDrawer } from './SidecarDrawer';
import { motion } from 'framer-motion';

const positionClasses = {
  'top-left': 'top-0 left-0',
  'top-right': 'top-0 right-0',
  'bottom-left': 'bottom-0 left-0',
  'bottom-right': 'bottom-0 right-0',
  center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
};

const sizeClasses = {
  minimized: 'h-auto',
  compact: 'h-[50vh]',
  full: 'h-screen'
};

function DialogContent({ title, defaultIntentions }) {
  const { isOpen, setIsOpen, anchor, size, totalWidth } = useShortRoundDialogController();

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <PopoverTrigger asChild>
        {/* The trigger can be anything, but it's controlled by the isOpen state */}
        <button style={{ display: 'none' }} />
      </PopoverTrigger>
      <PopoverContent
        className={cn('fixed p-0', positionClasses[anchor], sizeClasses[size])}
        asChild
      >
        <motion.div
          animate={{ width: totalWidth }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="flex h-full"
        >
          <IntentionalPaletteFrame title={title} defaultIntentions={defaultIntentions} />
          <SidecarDrawer />
        </motion.div>
      </PopoverContent>
    </Popover>
  );
}

export function IntentionalDialog({ title, defaultIntentions }) {
  return (
    <IntentionalProvider>
      <DialogContent title={title} defaultIntentions={defaultIntentions} />
    </IntentionalProvider>
  );
}
