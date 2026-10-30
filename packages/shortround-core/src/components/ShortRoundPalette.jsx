import { Command as CmdkCommand, useCommandState } from 'cmdk';
import { useMemo, useRef, useState } from 'react';

import { useShortRound } from '../hooks/useShortRound.js';
import { useSidekick } from '../hooks/useSidekick.js';
import { makeRevertIntentionsFor } from '../utils.js';

const PLACEHOLDER = 'Type a intention or search...';

// A click on a row leaves focus on cmdk's list (the row isn't focusable; the list is), where typing doesn't
// reach the input. Before an intention runs, put focus back on the input, so the intention can still move
// it elsewhere.
function returnFocusToInput(input) {
  const active = document.activeElement;
  if (input && active !== input && input.closest('[cmdk-root]')?.contains(active)) {
    input.focus();
  }
}

// Core owns cmdk's elements; the theme's Item only draws, and learns whether its row is highlighted.
function IntentionRow({ intention, onSelect, Item }) {
  const isSelected = useCommandState((state) => state.value) === intention.id;
  return (
    <CmdkCommand.Item
      data-testid={`shortround-item-${intention.id}`}
      disabled={intention.disabled}
      keywords={intention.keywords}
      onSelect={onSelect}
      value={intention.id}
    >
      <Item intention={intention} isSelected={isSelected} />
    </CmdkCommand.Item>
  );
}

export function ShortRoundPalette({
  defaultIntentions,
  resolveDefaultInput,
  IntentionPalette,
  showToast,
  label
}) {
  const { inputValue, onInputChange, intentions, dispatch, inputMessage } = useShortRound({
    defaultIntentions,
    resolveDefaultInput
  });
  const { height, setSidecarRenderer, closeSidecar, onClose } = useSidekick();

  const [includedRevertIntentions, setIncludedRevertIntentions] = useState([]);
  const inputRef = useRef(null);

  const intentionGroups = useMemo(
    () =>
      [...includedRevertIntentions, ...intentions].reduce((acc, intention) => {
        const groupName = intention.group;
        let group = acc.find((g) => g.name === groupName);
        if (!group) {
          group = { name: groupName, intentions: [] };
          acc.push(group);
        }
        group.intentions.push(intention);
        return acc;
      }, []),
    [intentions, includedRevertIntentions]
  );

  const onSelect = async (id) => {
    returnFocusToInput(inputRef.current);
    const result = await dispatch(id);
    if (result.isRejected) {
      return;
    }

    if (result?.sideEffects?.sidecarRenderer) {
      setSidecarRenderer(result.sideEffects?.sidecarRenderer);
    } else if (result?.sideEffects?.closeSidecar) {
      closeSidecar();
    }
    if (result?.message) {
      showToast?.({ message: result.message });
    }

    setIncludedRevertIntentions(makeRevertIntentionsFor(result?.includeRevertIntentions));

    if (result?.shouldReset) {
      onClose();
    }
  };

  const input = (
    <CmdkCommand.Input
      data-testid="shortround-input"
      onValueChange={onInputChange}
      placeholder={PLACEHOLDER}
      ref={inputRef}
      value={inputValue}
    />
  );

  return (
    <IntentionPalette.Frame height={height}>
      <CmdkCommand label={label} shouldFilter={false}>
        <IntentionPalette.Input input={input} inputMessage={inputMessage} />

        <CmdkCommand.List
          style={{
            height: `calc(${height} - 107px)`, // not sure why 107 works
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
                <IntentionRow
                  Item={IntentionPalette.Item}
                  intention={intention}
                  key={intention.id}
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
