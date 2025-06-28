import {
  Maximize,
  Minimize,
  PanelTop,
  X,
  Move,
} from "lucide-react"

import { Button } from "./components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "./components/ui/toggle-group"

import { useIntentionalDialogController } from "./useIntentionalDialogController"
import { IntentionalPalette } from "./IntentionalPalette"

export function IntentionalPaletteFrame({ title, defaultIntentions }) {
  const {
    onClose,
    setSize,
    cycleAnchor,
    size,
  } = useIntentionalDialogController();

  return (
    <div className="bg-background flex flex-col overflow-hidden h-full">
      <div className="flex items-center px-2 py-1 border-b">
        <Button variant="ghost" size="icon" onClick={cycleAnchor}>
          <Move className="h-4 w-4" />
        </Button>
        <h3 className="flex-grow font-semibold px-2">{title}</h3>
        <ToggleGroup type="single" size="sm" value={size} onValueChange={(value) => setSize(value)}>
          <ToggleGroupItem value="minimized">
            <Minimize className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="compact">
            <PanelTop className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="full">
            <Maximize className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      {size !== 'minimized' && (
        <div className="overflow-hidden h-full">
          <IntentionalPalette defaultIntentions={defaultIntentions} />
        </div>
      )}
    </div>
  );
} 