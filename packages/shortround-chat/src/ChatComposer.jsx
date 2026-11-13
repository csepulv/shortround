import { moveHighlight } from '@shortround/core';
import { LineInput } from '@shortround/react';
import { useLayoutEffect, useRef, useState } from 'react';

const MAX_INPUT_LINES = 6;
const ARROW_STEPS = { ArrowDown: 1, ArrowUp: -1 };

/**
 * The rows and the input. The arrows move the highlight over the rows that can be chosen; every other key goes to the
 * chat line (Enter, Cmd/Ctrl+Enter, Tab), and what it leaves (Shift+Enter, letters) goes to the textarea. A line with a
 * break is drawn without line hints.
 */
export function ChatComposer({ Chat, line, lineState, rows, placeholder }) {
  const inputRef = useCaretFollowing(lineState.caret);
  const highlight = useRowHighlight(rows, line);
  const lineCount = lineState.text.split('\n').length;
  const isMultiline = lineCount > 1;

  const onKeyDown = (event) => {
    if (ARROW_STEPS[event.key] && !isMultiline && rows.length > 0) {
      event.preventDefault();
      highlight.move(ARROW_STEPS[event.key]);
      return;
    }
    const handled = line.pressKey({
      key: event.key,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      highlightedRow: rows[highlight.index]
    });
    if (handled) {
      event.preventDefault();
    }
    if (typeof handled?.then === 'function') {
      handled.catch((error) =>
        console.error('IntentionChat: a typed intention failed', { text: lineState.text, error })
      );
    }
  };

  const drawnRows = rows.map((row, index) => (
    <Chat.Row
      isHighlighted={index === highlight.index}
      key={row.id}
      onChoose={() => line.chooseRow(row)}
      row={row}
    />
  ));
  const input = (
    <LineInput inputRef={inputRef} lineState={isMultiline ? null : lineState}>
      <textarea
        aria-label="Type an intention, or a message to send as chat"
        data-testid="shortround-chat-input"
        onChange={(event) => line.change(event.target.value, event.target.selectionStart)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        ref={inputRef}
        rows={Math.min(lineCount, MAX_INPUT_LINES)}
        value={lineState.text}
        wrap={isMultiline ? 'soft' : 'off'}
      />
    </LineInput>
  );

  return (
    <Chat.Composer input={<Chat.Input input={input} />} rows={rows.length ? drawnRows : null} />
  );
}

// The highlight starts where the line says (none while Enter would do nothing), and returns there whenever the rows
// change or the row the arrows moved to can no longer be chosen.
function useRowHighlight(rows, line) {
  const rowsKey = rows.map((row) => row.id).join('\n');
  const [moved, setMoved] = useState({ rowsKey: null, index: -1 });
  const isMovedHere = moved.rowsKey === rowsKey && !rows[moved.index]?.disabled;
  const index = isMovedHere ? moved.index : line.defaultHighlightIndex(rows);
  const move = (step) => setMoved({ rowsKey, index: moveHighlight(rows, index, step) });
  return { index, move };
}

// A completion moves the caret; the textarea follows while it has focus.
function useCaretFollowing(caret) {
  const inputRef = useRef(null);
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input && input === document.activeElement && input.selectionStart !== caret) {
      input.setSelectionRange(caret, caret);
    }
  }, [caret]);
  return inputRef;
}
