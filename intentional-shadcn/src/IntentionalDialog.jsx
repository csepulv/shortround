import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./components/ui/popover"

import { IntentionalProvider, useIntentionalDialogController } from "./useIntentionalDialogController"

function IntentionalDialogContent({ children }) {
  const { isOpen, setIsOpen } = useIntentionalDialogController();

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <PopoverTrigger asChild>
        {/* The trigger can be anything, but it's controlled by the isOpen state */}
        <button style={{ display: 'none' }} />
      </PopoverTrigger>
      <PopoverContent>
        {children}
      </PopoverContent>
    </Popover>
  )
}

export function IntentionalDialog({ children }) {
  return (
    <IntentionalProvider>
      <IntentionalDialogContent>
        {children}
      </IntentionalDialogContent>
    </IntentionalProvider>
  )
} 