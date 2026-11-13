// A chat's input line over a catalog runtime (`makeChatLine`): typed intentions run, other lines go to chat, and the
// keyboard drives it.
import { describe, expect, test } from 'vitest';

import { makeAppHeldApp, makeSearchApp } from '../../catalog/__tests__/fixtures/search-app.js';
import { buildCatalogRuntime } from '../../catalog/catalog-runtime.js';
import { loadCatalog } from '../../catalog/load-catalog.js';
import { drawnLineState, makeChatLine, SEND_AS_CHAT_ROW_ID } from '../chat-line.js';
import { firstEnabledIndex, moveHighlight } from '../row-highlight.js';

function makeLine(makeApp = makeSearchApp, options = {}) {
  const runs = [];
  const chats = [];
  const { app, runtime, log } = makeApp();
  const line = makeChatLine({
    runtime,
    onIntentionRun: (run) => runs.push(run),
    onSendAsChat: (text) => chats.push(text),
    ...options
  });
  const type = (text) => line.change(text, text.length);
  return { app, runtime, line, type, runs, chats, log };
}

function makeHelpApp() {
  const log = [];
  const catalog = loadCatalog(
    `
version: 3
app: app
states:
  main: { start: true, commands: [help] }
commands:
  help: { label: Help, run: app.help, params: {} }
`,
    { app: { help: () => log.push('help') } }
  );
  return { app: {}, runtime: buildCatalogRuntime(catalog), log };
}

const ENTER = { key: 'Enter' };
const CMD_ENTER = { key: 'Enter', metaKey: true };
const CTRL_ENTER = { key: 'Enter', ctrlKey: true };

test('Enter runs a typed intention and reports its message, with nothing sent as chat', async () => {
  const { line, type, runs, chats, log } = makeLine();

  type('search grid');
  await line.pressKey(ENTER);

  expect(log).toEqual(['search.apply({"term":"grid"})']);
  expect(runs).toEqual([{ line: 'search grid', message: 'Searched for grid' }]);
  expect(chats).toEqual([]);
  expect(line.getState().text).toBe('');
});

function makeReadApp(outcome = { message: 'Found 2 notes', output: { total: 2 } }) {
  const catalog = loadCatalog(
    `
version: 3
app: app
states:
  main: { start: true, commands: [results] }
commands:
  results: { label: Results, run: app.results, params: {} }
`,
    { app: { results: () => outcome } }
  );
  return { app: {}, runtime: buildCatalogRuntime(catalog), log: [] };
}

test('a typed run that returns output reports it beside the message the user sees', async () => {
  const { line, type, runs } = makeLine(makeReadApp);

  type('results');
  await line.pressKey(ENTER);

  expect(runs).toEqual([{ line: 'results', message: 'Found 2 notes', output: { total: 2 } }]);
});

test('a typed run whose output is null reports the message alone, as a model call would', async () => {
  const { line, type, runs } = makeLine(() =>
    makeReadApp({ message: 'Nothing found', output: null })
  );

  type('results');
  await line.pressKey(ENTER);

  expect(runs).toEqual([{ line: 'results', message: 'Nothing found' }]);
});

test('Cmd+Enter sends the line as chat even when an intention matches', async () => {
  const { line, type, runs, chats, log } = makeLine();

  type('search grid');
  await line.pressKey(CMD_ENTER);

  expect(chats).toEqual(['search grid']);
  expect(runs).toEqual([]);
  expect(log).toEqual([]);
  expect(line.getState().text).toBe('');
});

test('Ctrl+Enter sends the line as chat too', async () => {
  const { line, type, chats } = makeLine();

  type('what can I do here?');
  await line.pressKey(CTRL_ENTER);

  expect(chats).toEqual(['what can I do here?']);
});

test('Enter on a chat line sends it as chat', async () => {
  const { line, type, runs, chats, log } = makeLine();

  type('what can I do here?');
  await line.pressKey(ENTER);

  expect(chats).toEqual(['what can I do here?']);
  expect(runs).toEqual([]);
  expect(log).toEqual([]);
});

test('Enter on a line that cannot run yet completes it', async () => {
  const { line, type, chats } = makeLine();

  type('se');
  await line.pressKey(ENTER);

  expect(line.getState().text).toBe('search ');
  expect(chats).toEqual([]);
});

test('Enter acts on the highlighted row', async () => {
  const { line, type, runs, chats } = makeLine();

  type('search grid');
  const sendAsChatRow = line.rows().at(-1);
  await line.pressKey({ ...ENTER, highlightedRow: sendAsChatRow });

  expect(chats).toEqual(['search grid']);
  expect(runs).toEqual([]);
});

test('Shift+Enter is left to the input, for a new line', () => {
  const { line, type, chats } = makeLine();

  type('first line');
  const handled = line.pressKey({ key: 'Enter', shiftKey: true });

  expect(handled).toBe(false);
  expect(chats).toEqual([]);
});

test('a line with a line break reads as chat', () => {
  const { line, type } = makeLine();

  type('search grid\nand more');

  expect(line.rows().map((row) => row.id)).toEqual([SEND_AS_CHAT_ROW_ID]);
  expect(drawnLineState(line.getState()).roles).toEqual([]);
});

test('"Send as chat" is the last row, in the Chat group, whenever the line has text', () => {
  const { line, type } = makeLine();

  type('search grid');
  const withMatch = line.rows();
  type('what can I do here?');
  const withoutMatch = line.rows();

  for (const rows of [withMatch, withoutMatch]) {
    expect(rows.at(-1)).toMatchObject({
      id: SEND_AS_CHAT_ROW_ID,
      title: 'Send as chat',
      group: 'Chat'
    });
  }
  expect(withMatch.length).toBeGreaterThan(1);
});

test('a line whose first word starts no command reads as chat: no problem, plain words', () => {
  const { line, type } = makeLine();

  type('tell me about desktop gpu');

  expect(line.rows().map((row) => row.id)).toEqual([SEND_AS_CHAT_ROW_ID]);
  expect(drawnLineState(line.getState()).roles).toEqual([]);
});

test('a command that breaks later keeps its problem and its marked words', () => {
  const { line, type } = makeLine();

  type('search grid with color');

  expect(line.rows().map((row) => row.group)).toEqual(['Problem', 'Chat']);
  expect(drawnLineState(line.getState()).roles.map((word) => word.role)).toContain('broken');
});

test('an empty line has no "Send as chat" row', () => {
  const { line, type } = makeLine();

  type('   ');

  expect(line.rows().map((row) => row.id)).not.toContain(SEND_AS_CHAT_ROW_ID);
});

describe('the command list on an empty line', () => {
  const ARROW_DOWN = { key: 'ArrowDown' };
  const titlesOf = (rows) => rows.map((row) => row.title);

  test('an empty line shows no rows', () => {
    const { line, type } = makeLine();

    type('');

    expect(line.rows()).toEqual([]);
  });

  test('ArrowDown on an empty line lists each available command once, by its label, and tells subscribers', () => {
    const { line, type } = makeLine();
    type('');
    let heard = 0;
    line.subscribe(() => {
      heard += 1;
    });

    const handled = line.pressKey(ARROW_DOWN);

    expect(handled).toBe(true);
    expect(heard).toBeGreaterThan(0);
    expect(line.getState().isCommandListOpen).toBe(true);
    expect(titlesOf(line.rows())).toEqual(['Search', 'Preview']);
    expect(line.rows().every((row) => row.group === 'Commands')).toBe(true);
  });

  test('the list follows the app: while previewing, the preview commands', async () => {
    const { line, type, runtime } = makeLine();
    type('preview 2');
    await line.pressKey(ENTER);
    runtime.notify();

    line.pressKey(ARROW_DOWN);

    expect(titlesOf(line.rows())).toEqual(['Next', 'Close preview']);
  });

  test('Enter on the list puts the command in the line, ready for its words', async () => {
    const { line, type, runs, chats } = makeLine();
    type('');
    line.pressKey(ARROW_DOWN);

    await line.pressKey({ ...ENTER, highlightedRow: line.rows()[1] });

    expect(line.getState().text).toBe('preview ');
    expect(line.rows().some((row) => row.id.startsWith('command-list:'))).toBe(false);
    expect([runs, chats]).toEqual([[], []]);
  });

  test('a command chosen from the list and run leaves the emptied line without the list', async () => {
    const { line, type, runtime, log } = makeLine();
    type('preview 2');
    await line.pressKey(ENTER);
    runtime.notify();
    line.pressKey(ARROW_DOWN);

    await line.pressKey({ ...ENTER, highlightedRow: line.rows()[1] });
    await line.pressKey(ENTER);

    expect(log.at(-1)).toBe('results.closePreview({})');
    expect(line.getState().text).toBe('');
    expect(line.rows()).toEqual([]);
  });

  test('typing closes the list, and an emptied line keeps it closed', () => {
    const { line, type } = makeLine();
    type('');
    line.pressKey(ARROW_DOWN);

    type('s');
    type('');

    expect(line.rows()).toEqual([]);
  });

  test.each(['help', '?', ' Help '])(
    '"%s" on its own lists the commands, with "Send as chat" last',
    (text) => {
      const { line, type } = makeLine();

      type(text);

      expect(titlesOf(line.rows())).toEqual(['Search', 'Preview', 'Send as chat']);
    }
  );

  test('Enter on "help" puts the first command in the line', async () => {
    const { line, type, chats } = makeLine();
    type('help');

    await line.pressKey(ENTER);

    expect(line.getState().text).toBe('search ');
    expect(chats).toEqual([]);
  });

  test('"help me find grid notes" is a chat line, not a request for the list', () => {
    const { line, type } = makeLine();

    type('help me find grid notes');

    expect(titlesOf(line.rows())).toEqual(['Send as chat']);
  });

  test("a catalog's own help command answers to help", () => {
    const { line, type } = makeLine(makeHelpApp);

    type('help');

    expect(line.getState().top?.call.command).toBe('help');
    expect(line.rows().some((row) => row.id.startsWith('command-list:'))).toBe(false);
  });

  test('Escape closes the list', () => {
    const { line, type } = makeLine();
    type('');
    line.pressKey(ARROW_DOWN);

    const handled = line.pressKey({ key: 'Escape' });

    expect(handled).toBe(true);
    expect(line.rows()).toEqual([]);
  });

  test('Escape with no list is left to the host', () => {
    const { line, type } = makeLine();
    type('');

    expect(line.pressKey({ key: 'Escape' })).toBe(false);
  });

  test('Tab on an empty line opens the list, keeping the focus in the chat', () => {
    const { line, type } = makeLine();
    type('');

    const handled = line.pressKey({ key: 'Tab' });

    expect(handled).toBe(true);
    expect(titlesOf(line.rows())).toEqual(['Search', 'Preview']);
  });

  test('Tab on the open list puts the highlighted command in the line', async () => {
    const { line, type } = makeLine();
    type('');
    line.pressKey(ARROW_DOWN);

    await line.pressKey({ key: 'Tab', highlightedRow: line.rows()[1] });

    expect(line.getState().text).toBe('preview ');
    expect(line.getState().isCommandListOpen).toBe(false);
  });

  test('Tab on the open list with nothing highlighted puts the first command in the line', async () => {
    const { line, type } = makeLine();
    type('');
    line.pressKey(ARROW_DOWN);

    await line.pressKey({ key: 'Tab' });

    expect(line.getState().text).toBe('search ');
  });

  test('Shift+Tab on an empty line is left to the host, so the focus can leave the chat', () => {
    const { line, type } = makeLine();
    type('');

    expect(line.pressKey({ key: 'Tab', shiftKey: true })).toBe(false);
    expect(line.getState().isCommandListOpen).toBe(false);
  });

  test('once disposed, opening the list tells no one', () => {
    const { line, type } = makeLine();
    type('');
    let heard = 0;
    line.subscribe(() => {
      heard += 1;
    });

    line.dispose();
    line.pressKey(ARROW_DOWN);

    expect(heard).toBe(0);
  });

  test('a next step whose subtitle would repeat its title shows the title only', () => {
    const { line, type } = makeLine();

    type('s');

    const searchStep = line.rows().find((row) => row.title === 'search');
    expect(searchStep).toBeDefined();
    expect(searchStep.subtitle).toBeUndefined();
  });
});

test('choosing the "Send as chat" row sends the line', async () => {
  const { line, type, chats } = makeLine();

  type('what can I do here?');
  await line.chooseRow(line.rows().at(-1));

  expect(chats).toEqual(['what can I do here?']);
  expect(line.getState().text).toBe('');
});

test('choosing a command row runs it and reports the run', async () => {
  const { line, type, runs } = makeLine();

  type('search grid');
  const commandRow = line.rows().find((row) => row.call);
  await line.chooseRow(commandRow);

  expect(runs).toEqual([{ line: 'search grid', message: 'Searched for grid' }]);
});

test('a typed intention with no message reports the placeholder', async () => {
  const { line, type, runs } = makeLine();

  type('preview 1');
  await line.pressKey(ENTER);
  type('next');
  await line.pressKey(ENTER);

  expect(runs).toEqual([
    { line: 'preview 1', message: 'Previewing 1. Grid layout notes' },
    { line: 'next', message: 'Ran Next' }
  ]);
});

test('a typed command missing a value the app holds says what is missing, and does not run', async () => {
  const { line, type, log } = makeLine(makeAppHeldApp);

  type('share hello');
  const [commandRow] = line.rows();
  await line.chooseRow(commandRow);

  expect(commandRow).toMatchObject({
    title: 'Note: hello',
    subtitle: 'Missing result',
    missing: ['Result'],
    disabled: true
  });
  expect(log).toEqual([]);
});

test('once the app holds the value and notifies, the same line runs with it', async () => {
  const { app, runtime, line, type, runs, log } = makeLine(makeAppHeldApp);

  type('share hello');
  app.previewedId = 'w1';
  runtime.notify();
  await line.pressKey(ENTER);

  expect(log).toEqual(['share({"note":"hello","result":"w1"})']);
  expect(runs).toEqual([{ line: 'share hello', message: 'Shared w1' }]);
});

test('Tab completes the line', async () => {
  const { line, type } = makeLine();

  type('se');
  await line.pressKey({ key: 'Tab' });

  expect(line.getState().text).toBe('search ');
});

test('Enter on an empty line does nothing', async () => {
  const { line, type, runs, chats } = makeLine();

  type('');
  const handled = await line.pressKey(ENTER);

  expect(handled).toBe(true);
  expect(line.getState().text).toBe('');
  expect([runs, chats]).toEqual([[], []]);
});

test('ArrowDown then Enter chooses the highlighted row', async () => {
  const { line, type, chats } = makeLine();

  type('se');
  const rows = line.rows();
  const highlighted = moveHighlight(rows, firstEnabledIndex(rows), 1);
  await line.pressKey({ ...ENTER, highlightedRow: rows[highlighted] });

  expect(rows[highlighted].id).toBe(SEND_AS_CHAT_ROW_ID);
  expect(chats).toEqual(['se']);
});

test('a row drawn before the app dropped its value runs nothing, reports nothing, and keeps the line', async () => {
  const { app, runtime, line, type, runs, log } = makeLine(makeAppHeldApp);
  app.previewedId = 'w1';
  runtime.notify();
  type('share hello');
  const [drawnRow] = line.rows();

  app.previewedId = null;
  runtime.notify();
  await line.chooseRow(drawnRow);

  expect(drawnRow.disabled).toBe(false);
  expect([runs, log]).toEqual([[], []]);
  expect(line.getState().text).toBe('share hello');
});

const SAVE_CATALOG = `
version: 3
app: app
states:
  s: { start: true, commands: [save] }
commands:
  save: { label: Save, run: app.save }
`;

test('text typed while a run is in progress stays as the next line', async () => {
  let finishSave;
  const bindings = { app: { save: () => new Promise((resolve) => (finishSave = resolve)) } };
  const runtime = buildCatalogRuntime(loadCatalog(SAVE_CATALOG, bindings));
  const runs = [];
  const line = makeChatLine({
    runtime,
    onIntentionRun: (run) => runs.push(run),
    onSendAsChat: () => {}
  });

  line.change('save');
  const pressed = line.pressKey(ENTER);
  line.change('next thing');
  finishSave({ message: 'Saved' });
  await pressed;

  expect(runs).toEqual([{ line: 'save', message: 'Saved' }]);
  expect(line.getState().text).toBe('next thing');
});

test('a command with no alias is typed by its label: "close preview" runs, with nothing sent as chat', async () => {
  const { line, type, runtime, runs, chats, log } = makeLine();
  type('preview 2');
  await line.pressKey(ENTER);
  runtime.notify();

  type('close preview');
  await line.pressKey(ENTER);

  expect(log).toEqual(['results.preview({"result":"w2"})', 'results.closePreview({})']);
  expect(runs.at(-1)).toEqual({ line: 'close preview', message: 'Closed the preview' });
  expect(chats).toEqual([]);
});

describe('the hint for what is missing (showHintForMissing)', () => {
  test('Enter does nothing while the top command misses a value the app holds', async () => {
    const { line, type, runs, chats, log } = makeLine(makeAppHeldApp);

    type('share hello');
    const handled = await line.pressKey(ENTER);

    expect(handled).toBe(true);
    expect(line.getState().text).toBe('share hello');
    expect([runs, chats, log]).toEqual([[], [], []]);
  });

  test('Cmd+Enter still sends that line as chat', async () => {
    const { line, type, chats } = makeLine(makeAppHeldApp);

    type('share hello');
    await line.pressKey(CMD_ENTER);

    expect(chats).toEqual(['share hello']);
  });

  test('turned off, a command missing an app-held value is hidden, leaving only "Send as chat"', () => {
    const { line, type } = makeLine(makeAppHeldApp, { showHintForMissing: false });

    type('share hello');

    expect(line.rows().map((row) => row.id)).toEqual([SEND_AS_CHAT_ROW_ID]);
  });

  test('a param awaited after a hint word reads "Missing sort", and Enter still completes', async () => {
    const { line, type } = makeLine();

    type('search grid with');
    const rows = line.rows();
    await line.pressKey(ENTER);

    expect(rows.find((row) => row.missing)).toMatchObject({
      title: 'Missing sort',
      missing: ['Sort'],
      disabled: true
    });
    expect(rows.map((row) => row.title)).not.toContain('After "with": Sort');
    expect(line.getState().text).toBe('search grid with ');
  });

  test('turned off, the awaited param is not mentioned', () => {
    const { line, type } = makeLine(makeSearchApp, { showHintForMissing: false });

    type('search grid with');

    expect(line.rows().filter((row) => row.disabled)).toEqual([]);
  });
});

const SEND_CATALOG = `
version: 3
app: app
states:
  s: { start: true, commands: [send] }
commands:
  send:
    label: Send
    run: app.send
    params:
      note: { label: Note, default: true, argSource: { freeform: true, type: text } }
      to: { label: Recipient, required: true, aliases: [to], argSource: { freeform: true, type: text } }
`;

const makeSendApp = () => ({
  runtime: buildCatalogRuntime(loadCatalog(SEND_CATALOG, { app: { send: () => {} } })),
  log: []
});

describe('only what the app holds, or a hint waits for, is "missing"', () => {
  test('a required param still to be typed keeps its row, as before', () => {
    const { line, type } = makeLine(makeSendApp);

    type('send hello');
    const [commandRow] = line.rows();

    expect(commandRow).toMatchObject({ subtitle: 'Needs Recipient', disabled: true });
    expect(commandRow.missing).toBeUndefined();
  });

  test('with the hint off, that row still shows', () => {
    const { line, type } = makeLine(makeSendApp, { showHintForMissing: false });

    type('send hello');

    expect(line.rows().map((row) => row.subtitle)).toContain('Needs Recipient');
  });
});

describe('the default highlight', () => {
  test('is the first row that can be chosen', () => {
    const { line, type } = makeLine();

    type('se');
    const rows = line.rows();

    expect(line.defaultHighlightIndex(rows)).toBe(firstEnabledIndex(rows));
  });

  test('is none while the top command misses a value the app holds', () => {
    const { line, type } = makeLine(makeAppHeldApp);

    type('share hello');

    expect(line.defaultHighlightIndex(line.rows())).toBe(-1);
  });
});
