import { Maximize, Minimize, Move, PanelTop, X } from 'lucide-react';

import { Button } from './components/ui/button';
import { ToggleGroup, ToggleGroupItem } from './components/ui/toggle-group';
import { ShortRoundPalette } from './ShortRoundPalette.jsx';
import { useShortRoundShadcnSidekick } from './useShortRoundShadcnSidekick.js';

export function ShortRoundPaletteFrame({ title, defaultIntentions }) {
  const { onClose, setSize, cycleAnchor, size } = useShortRoundShadcnSidekick();

  return (
    <div className="bg-background flex flex-col overflow-hidden h-full">
      <div className="flex items-center px-2 py-1 border-b">
        <Button onClick={cycleAnchor} size="icon" variant="ghost">
          <Move className="h-4 w-4" />
        </Button>
        <h3 className="flex-grow font-semibold px-2">{title}</h3>
        <ToggleGroup onValueChange={(value) => setSize(value)} size="sm" type="single" value={size}>
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
        <Button onClick={onClose} size="icon" variant="ghost">
          <X className="h-4 w-4" />
        </Button>
      </div>
      {size !== 'minimized' && (
        <div className="overflow-hidden h-full">
          <ShortRoundPalette defaultIntentions={defaultIntentions} />
        </div>
      )}
    </div>
  );
}
