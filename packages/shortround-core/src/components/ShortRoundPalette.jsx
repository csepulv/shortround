import { Command as CmdkCommand, useCommandState } from 'cmdk';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useShortRound } from '../hooks/useShortRound.js';
import { useSidekick, useSidekickStore } from '../hooks/useSidekick.js';
import { resolveIcon } from '../icons.js';
import {
  bringsList,
  makeRevertIntentionsFor,
  NAVIGATE_GROUP,
  RevertIntentionIds
} from '../utils.js';

const PLACEHOLDER = 'Type a intention or search...';

// cmdk highlights the first row in DOM order, after every list swap, and moves through rows in DOM order. So Back
// and Cancel come last in the DOM, where Enter after a swap reaches the app's first row, and are drawn first with
// CSS `order`; `loop` lets ArrowUp from the first app row reach them.
const GROUP_COLUMN = { display: 'flex', flexDirection: 'column' };
const DRAWN_FIRST = { order: -1 };
const NAVIGATE_GROUP_KEY = 'shortround::navigate';
// Rows with no `group` share one group; React needs a key for it all the same.
const NO_GROUP_KEY = 'shortround::no-group';

// A click on a row leaves focus on cmdk's list (the row isn't focusable; the list is), where typing doesn't
// reach the input. Before an intention runs, put focus back on the input, so the intention can still move
// it elsewhere.
function returnFocusToInput(input) {
  const active = document.activeElement;
  if (input && active !== input && input.closest('[cmdk-root]')?.contains(active)) {
    input.focus();
  }
}

// Core owns cmdk's elements and chooses the row's icon; the theme's Item only draws, and learns whether its row is
// highlighted.
function IntentionRow({ intention, onSelect, Item, iconSources }) {
  const isSelected = useCommandState((state) => state.value) === intention.id;
  return (
    <CmdkCommand.Item
      data-testid={`shortround-item-${intention.id}`}
      disabled={intention.disabled}
      keywords={intention.keywords}
      onSelect={onSelect}
      value={intention.id}
    >
      <Item
        icon={resolveIcon(intention, iconSources)}
        intention={intention}
        isSelected={isSelected}
      />
    </CmdkCommand.Item>
  );
}

const groupByName = (intentions) =>
  intentions.reduce((groups, intention) => {
    // `group: null` is no group, as a missing one is; otherwise the two groups would share NO_GROUP_KEY.
    const name = intention.group ?? undefined;
    let group = groups.find((candidate) => candidate.name === name);
    if (!group) {
      group = { name, intentions: [] };
      groups.push(group);
    }
    group.intentions.push(intention);
    return groups;
  }, []);

// cmdk scrolls the highlighted row into view, but not the theme's heading above it. When a Navigate row is
// highlighted, bring the whole group into view; it runs after cmdk's own scroll.
function NavigateHeadingInView({ groupRef, rowIds }) {
  const highlightedId = useCommandState((state) => state.value);
  const isNavigateHighlighted = rowIds.includes(highlightedId);

  useEffect(() => {
    if (!isNavigateHighlighted) {
      return;
    }
    const frame = requestAnimationFrame(() =>
      groupRef.current?.scrollIntoView({ block: 'nearest' })
    );
    return () => cancelAnimationFrame(frame);
  }, [highlightedId, isNavigateHighlighted, groupRef]);

  return null;
}

// Why the sidecar may change, decided before dispatch: Back from the first step lands on the start list.
function sidecarReasonFor(intentionId, stepsTaken) {
  if (intentionId === RevertIntentionIds.RESET) {
    return 'reset';
  }
  if (intentionId === RevertIntentionIds.BACK) {
    return stepsTaken <= 1 ? 'start' : 'back';
  }
  return 'result';
}

// What core proposes: the start list's panel when returning to it; otherwise what the result asks for, or nothing.
function proposedSidecar(reason, result, defaultSidecarRenderer) {
  if (reason === 'start' || reason === 'reset') {
    return { renderer: defaultSidecarRenderer ?? null };
  }
  if (result?.sideEffects?.sidecarRenderer) {
    return { renderer: result.sideEffects.sidecarRenderer };
  }
  if (result?.sideEffects?.closeSidecar) {
    return { renderer: null };
  }
  return undefined;
}

export function ShortRoundPalette({
  defaultIntentions,
  resolveDefaultInput,
  resolveDefaultFallbackInput,
  defaultSidecarRenderer,
  IntentionPalette,
  iconSources = {},
  showToast,
  label
}) {
  const { inputValue, onInputChange, intentions, dispatch, inputMessage, dispatchedStack } =
    useShortRound({ defaultIntentions, resolveDefaultInput, resolveDefaultFallbackInput });
  const { height, onClose } = useSidekick();
  const store = useSidekickStore();

  const [includedRevertIntentions, setIncludedRevertIntentions] = useState([]);
  const inputRef = useRef(null);
  const navigateGroupRef = useRef(null);

  const appGroups = useMemo(() => groupByName(intentions), [intentions]);

  const onSelect = async (id) => {
    returnFocusToInput(inputRef.current);
    const reason = sidecarReasonFor(id, dispatchedStack.filter(bringsList).length);
    const result = await dispatch(id);
    if (result.isRejected) {
      return;
    }

    const proposed = proposedSidecar(reason, result, defaultSidecarRenderer);
    if (proposed) {
      store.changeSidecar(proposed, reason);
    }
    if (result?.message) {
      showToast?.({ message: result.message });
    }

    // Back and Cancel belong to the list: a result that brings neither a list nor its own leaves them as they are.
    if (result.intentions || result.includeRevertIntentions) {
      setIncludedRevertIntentions(makeRevertIntentionsFor(result.includeRevertIntentions));
    }

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

  const renderGroup = ({ key, name, intentions: rows, style, ref }) => (
    <CmdkCommand.Group key={key} ref={ref} style={style}>
      <IntentionPalette.Group name={name} />
      {rows.map((intention) => (
        <IntentionRow
          Item={IntentionPalette.Item}
          iconSources={iconSources}
          intention={intention}
          key={intention.id}
          onSelect={onSelect}
        />
      ))}
    </CmdkCommand.Group>
  );

  return (
    <IntentionPalette.Frame height={height}>
      <CmdkCommand label={label} loop shouldFilter={false}>
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

          <div style={GROUP_COLUMN}>
            {appGroups.map((group) => renderGroup({ key: group.name ?? NO_GROUP_KEY, ...group }))}
            {includedRevertIntentions.length > 0 &&
              renderGroup({
                key: NAVIGATE_GROUP_KEY,
                name: NAVIGATE_GROUP,
                intentions: includedRevertIntentions,
                style: DRAWN_FIRST,
                ref: navigateGroupRef
              })}
          </div>
        </CmdkCommand.List>
        <NavigateHeadingInView
          groupRef={navigateGroupRef}
          rowIds={includedRevertIntentions.map(({ id }) => id)}
        />
      </CmdkCommand>
    </IntentionPalette.Frame>
  );
}
