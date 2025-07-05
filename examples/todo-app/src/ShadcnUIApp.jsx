import { Button } from '@/components/ui/button';
import { ShortRoundDialog, useShortRoundShadcnSidekick } from '@shortround/shadcn-ui';
import { helpIntent } from '@/help-intent.js';
import { saveItemIntent } from '@/save-item-intent.js';

function ToggleIntentionPalette() {
  const { setIsOpen, isOpen } = useShortRoundShadcnSidekick();
  return <Button onClick={() => setIsOpen(!isOpen)}>Click Me</Button>;
}

function ShadcnUIApp() {
  return (
    <div className="m-auto">
      <ToggleIntentionPalette />
      <div className="m-auto">
        <ShortRoundDialog defaultIntentions={[helpIntent, saveItemIntent]} />
      </div>
    </div>
  );
}

export default ShadcnUIApp;
