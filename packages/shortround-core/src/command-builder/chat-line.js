import { isTypedName, typedLabelOf } from './readings.js';
import { firstEnabledIndex } from './row-highlight.js';
import { joinOr } from './state.js';

export const SEND_AS_CHAT_ROW_ID = 'chat:send';

const SEND_AS_CHAT_ROW = {
  id: SEND_AS_CHAT_ROW_ID,
  title: 'Send as chat',
  group: 'Chat',
  icon: 'chat'
};

const readsAsChat = (state) => state.text.includes('\n') || state.roles[0]?.role === 'broken';

const HELP_WORDS = new Set(['help', '?']);

const asksForHelp = (state) =>
  HELP_WORDS.has(state.text.trim().toLowerCase()) && state.roles[0]?.role !== 'verb';

/**
 * The line as the input draws it. A line whose first word starts no command, or that has a line break, is a chat
 * message, not a broken command, so its words are drawn plain; a command that breaks later keeps its marked words.
 */
export const drawnLineState = (state) => (readsAsChat(state) ? { ...state, roles: [] } : state);

/**
 * A chat's input line over a catalog runtime: its command line, plus sending as chat. Enter acts on the highlighted
 * row (the first that can be chosen, unless the arrows moved it): it runs a command, completes a next step, or sends
 * as chat. Cmd+Enter (Ctrl+Enter off a Mac) always sends the line as chat; Shift+Enter is left to the input, for a new
 * line. An empty line shows no rows; ArrowDown or Tab there lists the commands available now, one row each by label,
 * and choosing one (Enter or Tab) puts it in the line; typing or Escape closes the list, and Enter on an empty line
 * with no list does nothing. The "Send as chat" row is last whenever the line has text, and the only row when the line reads as chat.
 * What a command is missing (a value the app holds, a param a hint word waits for) reads "Missing <label>" on a
 * disabled row that carries `missing`; with `showHintForMissing` off, those rows are hidden. While the top command
 * misses a value only the app can hold, or a typed value breaks its param's rule, Enter does nothing. No DOM and no
 * React.
 */
export function makeChatLine({ runtime, onIntentionRun, onSendAsChat, showHintForMissing = true }) {
  const line = runtime.commandLine();
  const commandList = makeCommandList();
  const getState = makeStateWithList(line, commandList);
  const labelOf = (call) => runtime.catalog.commands[call.command].label;
  const isEmpty = () => !line.getState().text.trim();

  function rows() {
    const state = line.getState();
    if (isEmpty()) {
      return commandList.isOpen() ? commandRows(runtime) : [];
    }
    if (asksForHelp(state)) {
      return [...commandRows(runtime), SEND_AS_CHAT_ROW];
    }
    const typedRows = withMissing(line.rows(), state).map(withoutRepeatedSubtitle);
    return readsAsChat(state) ? [SEND_AS_CHAT_ROW] : [...typedRows, SEND_AS_CHAT_ROW];
  }

  function withMissing(typedRows, state) {
    const missingOf = missingByRowId(state);
    return typedRows.flatMap((row) => {
      const missing = missingOf.get(row.id);
      if (!missing) {
        return [row];
      }
      return showHintForMissing ? [markMissing(row, missing)] : [];
    });
  }

  const missesAppValue = () => Boolean(line.getState().readings[0]?.appNeeds?.length);
  const breaksTypedRule = () => Boolean(line.getState().brokenRules?.length);
  const isHeld = () => missesAppValue() || breaksTypedRule();

  // While the top command misses a value only the app can supply, or a typed value breaks its param's rule, Enter does
  // nothing, so no row is drawn as its target.
  const defaultHighlightIndex = (shownRows) => (isHeld() ? -1 : firstEnabledIndex(shownRows));

  function sendAsChat() {
    const { text } = line.getState();
    if (!text.trim()) {
      return;
    }
    line.cancel();
    onSendAsChat(text);
  }

  // A row drawn before the app changed may no longer run (`needs`): nothing ran, so the line stays. Text typed while
  // a run is in progress is the user's next line, so only the submitted text is cleared.
  async function runRow(row) {
    const { text } = line.getState();
    const outcome = await row.action();
    if (outcome.needs) {
      return;
    }
    if (line.getState().text === text) {
      line.cancel();
    }
    const message = outcome.message ?? `Ran ${labelOf(row.call)}`;
    onIntentionRun(
      outcome.output == null
        ? { line: text, message }
        : { line: text, message, output: outcome.output }
    );
  }

  function pressKey({ key, metaKey = false, ctrlKey = false, shiftKey = false, highlightedRow }) {
    if (key === 'Enter' && (metaKey || ctrlKey)) {
      sendAsChat();
      return true;
    }
    if (key === 'Enter' && shiftKey) {
      return false;
    }
    if (isEmpty()) {
      return !shiftKey && pressKeyOnEmptyLine(key, highlightedRow);
    }
    if (key === 'Enter' && isHeld()) {
      return true;
    }
    if (key === 'Enter') {
      const currentRows = rows();
      const row = highlightedRow ?? currentRows[defaultHighlightIndex(currentRows)];
      return Promise.resolve(row && chooseRow(row)).then(() => true);
    }
    if (key === 'Tab') {
      return line.acceptCompletion();
    }
    return false;
  }

  function pressKeyOnEmptyLine(key, highlightedRow) {
    if (LIST_OPENING_KEYS.has(key) && !commandList.isOpen()) {
      commandList.open();
      return true;
    }
    if (key === 'Escape' && commandList.isOpen()) {
      commandList.close();
      return true;
    }
    if (key === 'Enter' || key === 'Tab') {
      const row = highlightedRow ?? rows()[0];
      return Promise.resolve(row && chooseRow(row)).then(() => true);
    }
    return false;
  }

  function chooseRow(row) {
    if (row.id === SEND_AS_CHAT_ROW_ID) {
      return sendAsChat();
    }
    if (row.disabled) {
      return undefined;
    }
    if (row.completion !== undefined) {
      commandList.close();
      return line.acceptCompletion({ insertText: row.completion });
    }
    return runRow(row);
  }

  function change(text, caret) {
    commandList.close();
    line.change(text, caret);
  }

  return {
    getState,
    subscribe: (listener) => {
      const stopLine = line.subscribe(listener);
      const stopList = commandList.subscribe(listener);
      return () => {
        stopLine();
        stopList();
      };
    },
    change,
    dispose: () => {
      line.dispose();
      commandList.dispose();
    },
    rows,
    defaultHighlightIndex,
    pressKey,
    chooseRow
  };
}

const LIST_OPENING_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Tab']);
const COMMANDS_GROUP = 'Commands';

function makeCommandList() {
  let isOpen = false;
  const listeners = new Set();
  const setOpen = (next) => {
    if (isOpen !== next) {
      isOpen = next;
      listeners.forEach((listener) => listener());
    }
  };
  return {
    isOpen: () => isOpen,
    open: () => setOpen(true),
    close: () => setOpen(false),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: () => listeners.clear()
  };
}

function makeStateWithList(line, commandList) {
  let last = { lineState: null, isOpen: false, state: null };
  return () => {
    const lineState = line.getState();
    const isOpen = commandList.isOpen();
    if (last.lineState !== lineState || last.isOpen !== isOpen) {
      last = { lineState, isOpen, state: { ...lineState, isCommandListOpen: isOpen } };
    }
    return last.state;
  };
}

function commandRows(runtime) {
  return Object.values(runtime.catalog.commands)
    .filter((command) => runtime.isAvailable(command.name))
    .flatMap((command) => {
      const phrase = typedPhraseOf(command);
      if (!phrase) {
        return [];
      }
      return [
        {
          id: `command-list:${command.name}`,
          title: command.label,
          group: COMMANDS_GROUP,
          completion: `${phrase} `,
          action: () => ({})
        }
      ];
    });
}

const typedPhraseOf = (command) =>
  typedLabelOf(command.label) ?? (isTypedName(command.name) ? command.name : command.aliases?.[0]);

const withoutRepeatedSubtitle = (row) =>
  row.subtitle?.trim() === row.title ? { ...row, subtitle: undefined } : row;

// What each typed row is missing, by row id: a command row by the values only the app can supply (`appNeeds`), a
// Status row by the param a hint word waits for (`awaiting`, keyed by the message the row shows). A required param
// still to be typed keeps its row as the engine reads it.
function missingByRowId(state) {
  const byReading = state.readings
    .filter((reading) => reading.appNeeds?.length)
    .map((reading) => [`command:${reading.title}`, { labels: reading.appNeeds, onSubtitle: true }]);
  const byHint = (state.awaiting ?? []).map(({ message, labels }) => [
    `keep-typing:${message}`,
    { labels, onSubtitle: false }
  ]);
  return new Map([...byReading, ...byHint]);
}

function markMissing(row, { labels, onSubtitle }) {
  const text = `Missing ${joinOr(labels.map((label) => label.toLowerCase()))}`;
  const marked = { ...row, missing: labels, disabled: true };
  return onSubtitle ? { ...marked, subtitle: text } : { ...marked, title: text };
}
