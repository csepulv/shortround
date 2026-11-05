import { NAVIGATE_GROUP } from '@shortround/core';
import { Command as CmdkCommand, useCommandState } from 'cmdk';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import { useLineHints } from '../hooks/useLineHints.js';
import { usePalette } from '../hooks/usePalette.js';
import { useSidekick, useSidekickStore } from '../hooks/useSidekick.js';
import { resolveIcon } from '../icons.js';
import { LineInput } from './LineInput.jsx';

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
// highlighted. cmdk trims an item's value, so the row reports its own id when selected and compares the trimmed id
// for its highlight: an id with surrounding spaces (a completion's text, say) still selects and highlights.
function IntentionRow({ intention, onSelect, Item, iconSources }) {
  const isSelected = useCommandState((state) => state.value) === intention.id.trim();
  return (
    <CmdkCommand.Item
      data-testid={`shortround-item-${intention.id}`}
      disabled={intention.disabled}
      keywords={intention.keywords}
      onSelect={() => onSelect(intention.id)}
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

// After Tab rewrites the input, put the caret where the line says (React has just set the new value).
function useCaretAfterCompletion(inputRef) {
  const caretRef = useRef(null);
  useLayoutEffect(() => {
    if (caretRef.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(caretRef.current, caretRef.current);
      caretRef.current = null;
    }
  });
  return caretRef;
}

export function ShortRoundPalette({
  palette,
  defaultIntentions,
  resolveDefaultInput,
  resolveDefaultFallbackInput,
  defaultSidecarRenderer,
  IntentionPalette,
  iconSources = {},
  showToast,
  label,
  disableLineHints = false
}) {
  const { store, state, intentions } = usePalette({
    palette,
    defaultIntentions,
    resolveDefaultInput,
    resolveDefaultFallbackInput
  });
  const { inputValue, inputMessage, revertIntentions } = state;
  const { height, onClose } = useSidekick();
  const sidekickStore = useSidekickStore();

  const inputRef = useRef(null);
  const navigateGroupRef = useRef(null);
  const caretRef = useCaretAfterCompletion(inputRef);
  const lineHints = useLineHints({ palette, disableLineHints, store });

  const appGroups = useMemo(() => groupByName(intentions), [intentions]);
  // The highlight is the store's: it moves to the first enabled row when the rows change, a lookup landing included,
  // so Enter runs what an instant lookup would have. cmdk's own moves (arrows, its first row after a swap) go back to
  // the store. cmdk trims an item's value, so the store's id is trimmed to match it.
  const highlight = state.highlightedId?.trim() ?? '';
  // cmdk reports its moves with the trimmed value; the store keeps the row's own id.
  const highlightRow = (value) => {
    const row = [...intentions, ...revertIntentions].find(({ id }) => id.trim() === value);
    store.highlight(row?.id ?? value);
  };

  // Typing goes to the store with the caret: the store's line reads its next steps there.
  const onInputChange = (value) => store.changeInput(value, inputRef.current?.selectionStart);
  // A caret moved without typing (arrows, a click): the line reads at the new place. Only the caret moves: React's
  // `onSelect` can arrive late, carrying text the store has since replaced (Tab, a completion row), so an event whose
  // text isn't the store's input is stale and ignored.
  const onInputSelect = (event) => {
    const { value, selectionStart } = event.target;
    const lineState = store.commandLine()?.getState();
    if (lineState && value === store.getState().inputValue && lineState.caret !== selectionStart) {
      store.changeInput(value, selectionStart);
    }
  };

  // Tab completes through the store's line when it has one (hints drawn or not); otherwise with the first completion
  // row, if the list has one. The input keeps focus, nothing runs.
  const completeOnTab = () => {
    const caret = lineHints.complete();
    if (caret !== null) {
      caretRef.current = caret;
      return true;
    }
    return store.completeFirst();
  };
  const onInputKeyDown = (event) => {
    if (event.key === 'Tab' && completeOnTab()) {
      event.preventDefault();
      inputRef.current?.focus();
    }
  };

  // Core's store decides what choosing a row does (a completion, a dispatch, the side panel, Back and Cancel); the
  // palette adds its own: focus, the toast for a result's message, and closing on shouldReset.
  const onSelect = async (id) => {
    returnFocusToInput(inputRef.current);
    const result = await store.select(id, { sidekickStore, defaultSidecarRenderer });
    if (result.isCompletion) {
      inputRef.current?.focus();
      return;
    }
    if (result.isRejected) {
      return;
    }
    if (result.message) {
      showToast?.({ message: result.message });
    }
    if (result.shouldReset) {
      onClose();
    }
  };

  const cmdkInput = (
    <CmdkCommand.Input
      data-testid="shortround-input"
      onKeyDown={onInputKeyDown}
      onSelect={onInputSelect}
      onValueChange={onInputChange}
      placeholder={PLACEHOLDER}
      ref={inputRef}
      value={inputValue}
    />
  );
  // When hints can show, the input sits in the line's wrapper from the first render, so React never replaces it: the
  // dialog focuses it on that render, and a replaced input takes focus with it. The same holds when a step turns the
  // hints off.
  const input = lineHints.canShowHints ? (
    <LineInput inputRef={inputRef} lineState={lineHints.lineState}>
      {cmdkInput}
    </LineInput>
  ) : (
    cmdkInput
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
      <CmdkCommand
        label={label}
        loop
        onValueChange={highlightRow}
        shouldFilter={false}
        value={highlight}
      >
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
            {revertIntentions.length > 0 &&
              renderGroup({
                key: NAVIGATE_GROUP_KEY,
                name: NAVIGATE_GROUP,
                intentions: revertIntentions,
                style: DRAWN_FIRST,
                ref: navigateGroupRef
              })}
          </div>
        </CmdkCommand.List>
        <NavigateHeadingInView
          groupRef={navigateGroupRef}
          rowIds={revertIntentions.map(({ id }) => id)}
        />
      </CmdkCommand>
    </IntentionPalette.Frame>
  );
}
