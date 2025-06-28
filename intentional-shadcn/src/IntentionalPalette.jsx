import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./components/ui/command"
import { useIntentional } from '@intentional-ui/core/src/useIntentional.js';
import { useIntentionalDialogController } from './useIntentionalDialogController.js';
import { useMemo } from "react";


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
    <Command shouldFilter={false}>
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
                {intention.title}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  )
} 