import { describe, expect, test } from 'vitest';

import { makeChatLine } from '../../command-builder/chat-line.js';
import { buildPalette } from '../build-palette.js';
import { buildCatalogRuntime } from '../catalog-runtime.js';
import { findExampleFailures, loadExamples } from '../examples.js';
import { loadCatalog } from '../load-catalog.js';

const NOTES_CATALOG = `
version: 3
app: app
states:
  s: { start: true, commands: [showNotes, zoom, rename, cap] }
commands:
  showNotes:
    label: Show notes
    run: app.showNotes
    params:
      limit:
        label: Limit
        default: true
        nullable: [all, every]
        argSource: { freeform: true, type: integer, minimum: 1 }
      page:
        label: Page
        argSource: { freeform: true, type: integer, minimum: 1 }
  zoom:
    label: Zoom
    run: app.zoom
    params:
      scale: { label: Scale, default: true, argSource: { freeform: true, type: number, minimum: 0.5, maximum: 3 } }
  rename:
    label: Rename
    run: app.rename
    params:
      name: { label: Name, default: true, required: true, argSource: { freeform: true, type: text, maxLength: 40 } }
  cap:
    label: Cap
    run: app.cap
    params:
      size: { label: Size, default: true, nullable: true, argSource: { freeform: true, type: integer } }
`;

function makeApp(catalogText, runNames, lookups = {}) {
  const runs = [];
  const ran = (name) => (args) => {
    runs.push([name, args]);
  };
  const runBindings = Object.fromEntries(runNames.map((name) => [name, ran(name)]));
  const runtime = buildCatalogRuntime(
    loadCatalog(catalogText, { app: { ...runBindings, ...lookups } })
  );
  return { runtime, runs };
}

const makeNotesApp = () => makeApp(NOTES_CATALOG, ['showNotes', 'zoom', 'rename', 'cap']);

async function typed(text, makeAppFor = makeNotesApp) {
  const { runtime, runs } = makeAppFor();
  const line = runtime.commandLine();
  line.change(text, text.length);
  const state = line.getState();
  await line.submit();
  line.dispose();
  return { state, runs };
}

const LIMIT_RULE = 'Limit is a whole number from 1, or all';

describe('CP-43: a number typed on the line reaches run as a number', () => {
  test.each([
    ['show notes 20', ['showNotes', { limit: 20 }]],
    ['show notes 20 page 3', ['showNotes', { limit: 20, page: 3 }]],
    ['zoom 1.5', ['zoom', { scale: 1.5 }]],
    ['zoom 0.5', ['zoom', { scale: 0.5 }]]
  ])('%s', async (text, run) => {
    const { runs } = await typed(text);

    expect(runs).toEqual([run]);
  });

  test('the row shows the number as typed', async () => {
    const { runtime } = makeNotesApp();
    const line = runtime.commandLine();
    line.change('zoom 1.5', 8);

    expect(line.rows()[0].title).toBe('Zoom: 1.5');
    line.dispose();
  });

  test.each([
    ['show notes 0', LIMIT_RULE],
    ['show notes 2.5', LIMIT_RULE],
    ['show notes ten', LIMIT_RULE],
    ['show notes 1,000', LIMIT_RULE],
    ['show notes -3', LIMIT_RULE],
    ['show notes 1e3', LIMIT_RULE],
    ['show notes 0x10', LIMIT_RULE],
    ['zoom 4', 'Scale is a number from 0.5 to 3'],
    ['zoom big', 'Scale is a number from 0.5 to 3']
  ])('%s is refused with the rule, and nothing runs', async (text, rule) => {
    const { state, runs } = await typed(text);

    expect(state.incomplete).toEqual([rule]);
    expect(state.canRun).toBe(false);
    expect(runs).toEqual([]);
  });
});

describe('CP-44: "no value" is a word the catalog names, and null is what run gets', () => {
  test.each(['show notes all', 'show notes every', 'show notes ALL'])('%s', async (text) => {
    const { runs } = await typed(text);

    expect(runs).toEqual([['showNotes', { limit: null }]]);
  });

  test('the row shows the word', async () => {
    const { runtime } = makeNotesApp();
    const line = runtime.commandLine();
    line.change('show notes all', 14);

    expect(line.rows()[0].title).toBe('Limit: all');
    line.dispose();
  });

  test('a param nullable with no words takes only numbers when typed', async () => {
    const refused = await typed('cap all');
    const taken = await typed('cap 5');

    expect(refused.state.incomplete).toEqual(['Size is a whole number']);
    expect(refused.runs).toEqual([]);
    expect(taken.runs).toEqual([['cap', { size: 5 }]]);
  });
});

describe('CP-46: text over its maxLength is refused on the line', () => {
  test('41 characters are refused; 40 run', async () => {
    const long = await typed(`rename ${'a'.repeat(41)}`);
    const fits = await typed(`rename ${'a'.repeat(40)}`);

    expect(long.state.incomplete).toEqual(['Name has at most 40 characters']);
    expect(long.runs).toEqual([]);
    expect(fits.runs).toEqual([['rename', { name: 'a'.repeat(40) }]]);
  });
});

describe('through the chat line', () => {
  const makeLine = () => {
    const { runtime, runs } = makeNotesApp();
    const chats = [];
    const line = makeChatLine({
      runtime,
      onIntentionRun: () => {},
      onSendAsChat: (text) => chats.push(text)
    });
    return { line, runs, chats };
  };

  test('a refused number shows its rule, no row is highlighted, and Enter does nothing and keeps the line', async () => {
    const { line, runs, chats } = makeLine();

    line.change('show notes 0', 12);
    const rows = line.rows();
    const handled = await line.pressKey({ key: 'Enter' });

    expect(rows.map((row) => row.title)).toContain(LIMIT_RULE);
    expect(line.defaultHighlightIndex(rows)).toBe(-1);
    expect(line.getState().brokenRules).toEqual([LIMIT_RULE]);
    expect(handled).toBe(true);
    expect(line.getState().text).toBe('show notes 0');
    expect([runs, chats]).toEqual([[], []]);
    line.dispose();
  });

  test('a sentence after a command whose default is a number is chat: Enter sends it', async () => {
    const { line, runs, chats } = makeLine();

    line.change('show notes about my project', 27);
    const rows = line.rows();
    await line.pressKey({ key: 'Enter' });

    expect(line.defaultHighlightIndex(rows)).not.toBe(-1);
    expect(rows.map((row) => row.title)).not.toContain(LIMIT_RULE);
    expect([runs, chats]).toEqual([[], ['show notes about my project']]);
    line.dispose();
  });

  test('Cmd+Enter still sends a refused line as chat; a good value runs on Enter', async () => {
    const { line, runs, chats } = makeLine();

    line.change('show notes 0', 12);
    await line.pressKey({ key: 'Enter', metaKey: true });
    line.change('show notes all', 14);
    await line.pressKey({ key: 'Enter' });

    expect(chats).toEqual(['show notes 0']);
    expect(runs).toEqual([['showNotes', { limit: null }]]);
    line.dispose();
  });
});

describe("through the palette's typed-text step", () => {
  async function entered(rowTitle, text) {
    const { runtime, runs } = makeNotesApp();
    const palette = buildPalette(runtime, { backIntentionId: 'back' });
    const step = await palette.intentions.find((row) => row.title === rowTitle).action('');
    const result = await step.intentions[0].action(text);
    return { result, runs };
  }

  test.each([
    ['Limit', '25', ['showNotes', { limit: 25 }]],
    ['Limit', ' all ', ['showNotes', { limit: null }]],
    ['Zoom', '1.5', ['zoom', { scale: 1.5 }]],
    ['Rename', 'Groceries', ['rename', { name: 'Groceries' }]]
  ])('%s: "%s" runs with its value', async (rowTitle, text, run) => {
    const { runs } = await entered(rowTitle, text);

    expect(runs).toEqual([run]);
  });

  test.each([
    ['Limit', 'abc', LIMIT_RULE],
    ['Limit', '0', LIMIT_RULE],
    ['Zoom', '4', 'Scale is a number from 0.5 to 3'],
    ['Rename', 'a'.repeat(41), 'Name has at most 40 characters'],
    ['Cap', 'all', 'Size is a whole number']
  ])('%s: "%s" asks again with the rule, and nothing runs', async (rowTitle, text, rule) => {
    const { result, runs } = await entered(rowTitle, text);

    expect(result.message).toBe(rule);
    expect(result.listKind).toBe('text');
    expect(runs).toEqual([]);
  });
});

describe("CP-45: the model's tools say the types, and a model's call is held to them", () => {
  const propertiesOf = async (runtime, toolName) =>
    (await runtime.tools()).find((tool) => tool.name === toolName).inputSchema.properties;

  test('the schema shows each type, its bounds, maxLength, and what null means', async () => {
    const { runtime } = makeNotesApp();

    expect(await propertiesOf(runtime, 'showNotes')).toEqual({
      limit: {
        type: ['integer', 'null'],
        minimum: 1,
        description: 'Limit: a whole number from 1, or null for all'
      },
      page: { type: 'integer', minimum: 1, description: 'Page: a whole number from 1' }
    });
    expect((await propertiesOf(runtime, 'zoom')).scale).toEqual({
      type: 'number',
      minimum: 0.5,
      maximum: 3,
      description: 'Scale: a number from 0.5 to 3'
    });
    expect((await propertiesOf(runtime, 'rename')).name).toEqual({
      type: 'string',
      maxLength: 40,
      description: 'Name: free text, at most 40 characters'
    });
    expect((await propertiesOf(runtime, 'cap')).size).toEqual({
      type: ['integer', 'null'],
      description: 'Size: a whole number, or null'
    });
  });

  async function called(toolName, input) {
    const { runtime, runs } = makeNotesApp();
    const answer = await runtime.runTool({ toolName, input });
    return { answer, runs };
  }

  test.each([
    ['showNotes', { limit: 20 }, { limit: 20 }],
    ['showNotes', { limit: '20' }, { limit: 20 }],
    ['showNotes', { limit: null }, { limit: null }],
    ['showNotes', {}, {}],
    ['showNotes', { limit: 5, page: null }, { limit: 5 }],
    ['zoom', { scale: '1.5' }, { scale: 1.5 }],
    ['cap', { size: null }, { size: null }],
    ['rename', { name: 'a'.repeat(40) }, { name: 'a'.repeat(40) }]
  ])('%s with %j runs with %j', async (toolName, input, args) => {
    const { runs } = await called(toolName, input);

    expect(runs).toEqual([[toolName, args]]);
  });

  test.each([
    ['showNotes', { limit: 0 }, `"showNotes": ${LIMIT_RULE}`],
    ['showNotes', { limit: 2.5 }, `"showNotes": ${LIMIT_RULE}`],
    ['showNotes', { limit: 'all' }, `"showNotes": ${LIMIT_RULE}`],
    ['showNotes', { limit: '1e3' }, `"showNotes": ${LIMIT_RULE}`],
    ['zoom', { scale: 4 }, '"zoom": Scale is a number from 0.5 to 3'],
    ['rename', { name: 'a'.repeat(41) }, '"rename": Name has at most 40 characters']
  ])(
    '%s with %j is refused with the rule, and nothing runs',
    async (toolName, input, errorText) => {
      const { answer, runs } = await called(toolName, input);

      expect(answer).toEqual({ errorText });
      expect(runs).toEqual([]);
    }
  );
});

const MORE_CATALOG = `
version: 3
app: app
states:
  s: { start: true, commands: [find, seek, look, pick, list, label] }
commands:
  find:
    label: Find
    run: app.find
    params:
      when: { label: When, default: true, nullable: [anytime], argSource: { freeform: true, type: range } }
  seek:
    label: Seek
    run: app.seek
    params:
      when: { label: When, default: true, argSource: { freeform: true, type: range } }
  look:
    label: Look
    run: app.look
    params:
      term: { label: Term, default: true, hints: [for], argSource: { freeform: true, maxLength: 40 } }
  pick:
    label: Pick
    run: app.pick
    params:
      pages: { label: Pages, default: true, list: true, argSource: { freeform: true, type: integer, minimum: 1 } }
  list:
    label: List
    run: app.list
    params:
      limit: { label: Limit, default: true, nullable: [all, no limit], argSource: { freeform: true, type: integer, minimum: 1 } }
      folder: { label: Folder, aliases: [in], argSource: { lookup: app.folders } }
  label:
    label: Label
    run: app.label
    params:
      names: { label: Names, default: true, list: true, argSource: { freeform: true } }
`;

const makeMoreApp = () =>
  makeApp(MORE_CATALOG, ['find', 'seek', 'look', 'pick', 'list', 'label'], {
    folders: () => [{ value: 'f-all', title: 'all' }]
  });

describe('typed values beside the other kinds of param', () => {
  test('a nullable date range still reaches run as a range, and its word as null', async () => {
    const nullable = await typed('find last week', makeMoreApp);
    const plain = await typed('seek last week', makeMoreApp);
    const anytime = await typed('find anytime', makeMoreApp);

    expect(nullable.runs[0][1].when).toEqual(plain.runs[0][1].when);
    expect(typeof nullable.runs[0][1].when).toBe('object');
    expect(anytime.runs).toEqual([['find', { when: null }]]);
  });

  test('text with maxLength still offers to quote a term that reuses its hint', async () => {
    const { state } = await typed('look tools for react', makeMoreApp);

    expect(state.nextSteps).toContainEqual(
      expect.objectContaining({ insertText: 'look "tools for react"' })
    );
  });

  test('a number list reaches run as a list of numbers from the line, the palette and a model', async () => {
    const { runs: fromLine } = await typed('pick 1, 2', makeMoreApp);
    const { runtime, runs: fromPalette } = makeMoreApp();
    const palette = buildPalette(runtime, { backIntentionId: 'back' });
    const step = await palette.intentions.find((row) => row.title === 'Pick').action('');
    await step.intentions[0].action('3');
    await runtime.runTool({ toolName: 'pick', input: { pages: [4, '5'] } });

    expect(fromLine).toEqual([['pick', { pages: [1, 2] }]]);
    expect(fromPalette).toEqual([
      ['pick', { pages: [3] }],
      ['pick', { pages: [4, 5] }]
    ]);
  });

  test("a number list's model description says each item's rule", async () => {
    const { runtime } = makeMoreApp();
    const tool = (await runtime.tools()).find((each) => each.name === 'pick');

    expect(tool.inputSchema.properties.pages).toEqual({
      type: 'array',
      items: { type: 'integer', minimum: 1 },
      description: 'Pages: each a whole number from 1'
    });
  });

  test("a null word that is also a row of another param's lookup still means null for the open param", async () => {
    const { runs } = await typed('list all', makeMoreApp);

    expect(runs).toEqual([['list', { limit: null }]]);
  });

  test('a number param takes a null word of two words', async () => {
    const { runs } = await typed('list no limit', makeMoreApp);

    expect(runs).toEqual([['list', { limit: null }]]);
  });

  test("a text list's palette step gives a list, as the line does", async () => {
    const { runs: fromLine } = await typed('label urgent', makeMoreApp);
    const { runtime, runs: fromPalette } = makeMoreApp();
    const palette = buildPalette(runtime, { backIntentionId: 'back' });
    const step = await palette.intentions.find((row) => row.title === 'Label').action('');
    await step.intentions[0].action('urgent');

    expect(fromPalette).toEqual(fromLine);
    expect(fromPalette).toEqual([['label', { names: ['urgent'] }]]);
  });

  test('a number takes the value role on the line', async () => {
    const { state } = await typed('show notes 20');

    expect(state.roles.map(({ text, role }) => [text, role])).toEqual([
      ['show', 'verb'],
      ['notes', 'verb'],
      ['20', 'value']
    ]);
  });
});

describe('an examples file writes typed values as they reach run', () => {
  test('a number and null match; a number written as text no longer does', () => {
    const { runtime } = makeNotesApp();
    const palette = buildPalette(runtime, { backIntentionId: 'back' });
    const examples = loadExamples(`
examples:
  - say: show notes 20
    means: { showNotes: { limit: 20 } }
  - say: show notes all
    means: { showNotes: { limit: null } }
  - say: zoom 1.5
    means: { zoom: { scale: 1.5 } }
  - say: show notes 30
    means: { showNotes: { limit: '30' } }
`);

    expect(findExampleFailures(palette, examples)).toEqual([
      {
        say: 'show notes 30',
        means: { showNotes: { limit: '30' } },
        got: { showNotes: { limit: 30 } }
      }
    ]);
  });
});
