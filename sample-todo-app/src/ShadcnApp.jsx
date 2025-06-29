import { Button } from '@/components/ui/button';
import {
  IntentionalDialog,
  IntentionalPalette,
  useIntentionalDialogController
} from '@shortround/shadcnui';
import { helpIntent } from '@/help-intent.js';
import { saveItemIntent } from '@/save-item-intent.js';

function ToggleIntentionPalette() {
  const { setIsOpen, isOpen } = useIntentionalDialogController();
  return <Button onClick={() => setIsOpen(!isOpen)}>Click Me</Button>;
}

function ShadcnApp() {
  return (
    <div className="m-auto">
      <ToggleIntentionPalette />
      <div className="m-auto">
        <IntentionalDialog defaultIntentions={[helpIntent, saveItemIntent]} />
      </div>
    </div>
  );
}

export default ShadcnApp;
