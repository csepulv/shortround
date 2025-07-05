import { Command as CmdkCommand } from 'cmdk';
import { useMemo, useState } from 'react';
import { useSidekick } from '../hooks/useSidekick.js';
import { useShortRound } from '../hooks/useShortRound.js';
import { makeRevertIntentionsFor } from '../utils.js';

export function ShortRoundPalette({ defaultIntentions, IntentionPalette, showToast }) {
  const { inputValue, onInputChange, intentions, dispatch, inputMessage } = useShortRound({
    defaultIntentions
  });
  const { height, setSidecarRenderer, closeSidecar, onClose } = useSidekick();

  const [includedRevertIntentions, setIncludedRevertIntentions] = useState([]);

  const intentionGroups = useMemo(() => {
    return [...includedRevertIntentions, ...intentions].reduce((acc, intention) => {
      const groupName = intention.group;
      let group = acc.find((g) => g.name === groupName);
      if (!group) {
        group = { name: groupName, intentions: [] };
        acc.push(group);
      }
      group.intentions.push(intention);
      return acc;
    }, []);
  }, [intentions, includedRevertIntentions]);

  const onSelect = async (id) => {
    const result = await dispatch(id);
    if (result?.sideEffects?.sidecarRenderer) {
      setSidecarRenderer(result.sideEffects?.sidecarRenderer);
    } else {
      closeSidecar();
    }
    if (result?.message) {
      showToast?.({ message: result.message });
    }

    setIncludedRevertIntentions(makeRevertIntentionsFor(result?.includeRevertIntentions));

    if (result.shouldReset) {
      onClose();
    }
  };

  return (
    <IntentionPalette.Frame height={height}>
      <CmdkCommand shouldFilter={false}>
        <IntentionPalette.Input
          inputMessage={inputMessage}
          inputValue={inputValue}
          onInputChange={onInputChange}
        />

        <CmdkCommand.List
          style={{
            height: `calc(${height} - 107px`, // not sure why 107 works
            overflowY: 'auto',
            padding: '8px 0'
          }}
        >
          <CmdkCommand.Empty>
            <IntentionPalette.NoMatches inputValue={inputValue} />
          </CmdkCommand.Empty>

          {intentionGroups.map((group) => (
            <CmdkCommand.Group key={group.name}>
              <IntentionPalette.Group name={group.name} />
              {group.intentions.map((intention) => (
                <IntentionPalette.Item
                  key={intention.id}
                  intention={intention}
                  onSelect={onSelect}
                />
              ))}
            </CmdkCommand.Group>
          ))}
        </CmdkCommand.List>
      </CmdkCommand>
    </IntentionPalette.Frame>
  );
}
