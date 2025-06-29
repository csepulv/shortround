import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./components/ui/command"
import { useIntentional } from '@intentional-ui/core';
import { useIntentionalDialogController } from './useIntentionalDialogController.js';
import { useMemo } from "react";
import { File } from "lucide-react";


export function IntentionalPalette({ defaultIntentions }) {
  const { inputValue, updateInputValue, intentions, dispatch } = useIntentional({
    defaultIntentions
  });
  const { setSidecarRenderer, closeSidecar } = useIntentionalDialogController();

  const intentionGroups = useMemo(() => {
    return intentions.reduce((acc, intention) => {
      const groupName = intention.group;
      let group = acc.find((g) => g.name === groupName);
      if (!group) {
        group = { name: groupName, intentions: [] };
        acc.push(group);
      }
      group.intentions.push(intention);
      return acc;
    }, []);
  }, [intentions]);

  return (
    <Command shouldFilter={false} className="h-full">
      <CommandInput 
        onValueChange={updateInputValue}
        placeholder="Type a intention or search..."
        value={inputValue}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {intentionGroups.map((group) => (
          <CommandGroup key={group.name} heading={group.name}>
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
                  {intention.subtitle && <span className="text-muted-foreground text-xs">{intention.subtitle}</span>}
                </div>
              </CommandItem>
            ))}
            <CommandSeparator />
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  )
} 