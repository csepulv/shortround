import { Button } from '@/components/ui/button';
import {
  IntentionalDialog,
  IntentionalPalette,
  useShortRoundDialogController
} from '@shortround/shadcnui';
import { helpIntent } from '@/help-intent.js';
import { saveItemIntent } from '@/save-item-intent.js';

function ToggleIntentionPalette() {
  const { setIsOpen, isOpen } = useShortRoundDialogController();
  return <Button onClick={() => setIsOpen(!isOpen)}>Click Me</Button>;
}

function ShadcnUIApp() {
  return (
    <div className="m-auto">
      <ToggleIntentionPalette />
      <div className="m-auto">
        <IntentionalDialog defaultIntentions={[helpIntent, saveItemIntent]} />
      </div>
    </div>
  );
}

export default ShadcnUIApp;
