import { useShortRound } from '@shortround/core';
import { File } from 'lucide-react';
import { useMemo } from 'react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from './components/ui/command';
import { useShortRoundShadcnSidekick } from './useShortRoundShadcnSidekick.js';

export function ShortRoundPalette({ defaultIntentions }) {
  const { inputValue, onInputChange, intentions, dispatch } = useShortRound({
    defaultIntentions
  });
  const { setSidecarRenderer, closeSidecar } = useShortRoundShadcnSidekick();

  const intentionGroups = useMemo(
    () =>
      intentions.reduce((acc, intention) => {
        const groupName = intention.group;
        let group = acc.find((g) => g.name === groupName);
        if (!group) {
          group = { name: groupName, intentions: [] };
          acc.push(group);
        }
        group.intentions.push(intention);
        return acc;
      }, []),
    [intentions]
  );

  return (
    <Command className="h-full" shouldFilter={false}>
      <CommandInput
        onValueChange={onInputChange}
        placeholder="Type a intention or search..."
        value={inputValue}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {intentionGroups.map((group) => (
          <CommandGroup heading={group.name} key={group.name}>
            {group.intentions.map((intention) => (
              <CommandItem
                key={intention.id}
                onSelect={async (id) => {
                  const result = await dispatch(id);
                  if (result?.sideEffects?.sidecarRenderer) {
                    setSidecarRenderer(result.sideEffects?.sidecarRenderer);
                  } else {
                    closeSidecar();
                  }
                  // TODO: showToast
                }}
                value={intention.id}
              >
                <File className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span>{intention.title}</span>
                  {intention.subtitle && (
                    <span className="text-muted-foreground text-xs">{intention.subtitle}</span>
                  )}
                </div>
              </CommandItem>
            ))}
            <CommandSeparator />
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  );
}
