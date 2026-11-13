// The runtime's intentions as tools a model can call (`tools()`), and running a model's call (`runTool()`).
import { afterEach, describe, expect, test, vi } from 'vitest';

import { buildCatalogRuntime } from '../catalog-runtime.js';
import { LOOKUP_WAIT_MS } from '../intention-tools.js';
import { loadCatalog } from '../load-catalog.js';
import { makeAppHeldApp, makeSearchApp } from './fixtures/search-app.js';

const namesOf = (tools) => tools.map((tool) => tool.name);
const call = (runtime, toolName, input) => runtime.runTool({ toolName, input });

describe("the runtime's tools", () => {
  const descriptionsOf = (tools) =>
    Object.fromEntries(tools.map((tool) => [tool.name, tool.description]));

  test('every intention is a tool; one not available now says so', async () => {
    const { runtime } = makeSearchApp();

    expect(descriptionsOf(await runtime.tools())).toEqual({
      search: 'Search',
      preview: 'Preview',
      next: 'Next (not available now)',
      openInService: 'Open in service (not available now)',
      closePreview: 'Close preview (not available now)'
    });
  });

  test('after the state changes, the marks follow it', async () => {
    const { runtime } = makeSearchApp();

    await call(runtime, 'preview', { result: 'w1' });

    expect(descriptionsOf(await runtime.tools())).toEqual({
      search: 'Search (not available now)',
      preview: 'Preview (not available now)',
      next: 'Next',
      openInService: 'Open in service (not available now)',
      closePreview: 'Close preview'
    });
  });

  test('openInService is unmarked only while its own condition holds', async () => {
    const { runtime } = makeSearchApp({ hasServiceLink: true });

    await call(runtime, 'preview', { result: 'w1' });

    expect(descriptionsOf(await runtime.tools()).openInService).toBe('Open in service');
  });

  test('a tool not available now lists no lookup values, and its lookup is not asked', async () => {
    const results = vi.fn(() => [{ value: 'w1', title: '1. Grid layout notes' }]);
    const runtime = buildCatalogRuntime(
      loadCatalog(
        `
version: 3
app: app
states:
  browsing: { start: true, when: '!app.previewing', commands: [preview] }
  previewing: { when: app.previewing, commands: [closePreview] }
commands:
  preview:
    label: Preview
    run: app.preview
    params: { result: { label: Result, default: true, argSource: { lookup: app.results } } }
  closePreview: { label: Close preview, run: app.closePreview, params: {} }
`,
        { app: { previewing: () => true, results, preview: () => ({}), closePreview: () => ({}) } }
      )
    );

    const [preview] = await runtime.tools();

    expect(preview.description).toBe('Preview (not available now)');
    expect(preview.inputSchema.properties.result.description).toBe(
      'Result: one of the app’s values, checked when it runs'
    );
    expect(results).not.toHaveBeenCalled();
  });

  test('a marked tool is still refused when called', async () => {
    const { runtime, log } = makeSearchApp();

    const answer = await call(runtime, 'next', {});

    expect(answer).toEqual({ errorText: '"next" is not available now' });
    expect(log).toEqual([]);
  });

  test('each param becomes a property: free text, a fixed list, a lookup, a list of lookups', async () => {
    const { runtime } = makeSearchApp();

    const search = (await runtime.tools()).find((tool) => tool.name === 'search');

    expect(search.description).toBe('Search');
    expect(search.inputSchema).toEqual({
      type: 'object',
      properties: {
        term: { type: 'string', description: 'Search: free text' },
        match: { type: 'string', enum: ['any'], description: 'Match' },
        sort: {
          type: 'string',
          description: 'Sort: one of the app’s values, checked when it runs. Now: "Relevance"'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tag: the app’s values, checked when it runs. Now: "design", "react"'
        },
        bookmarked_at: {
          type: 'array',
          items: { type: 'string' },
          description: 'Bookmark age: the app’s values, checked when it runs. Now: "last week"'
        }
      },
      additionalProperties: false
    });
  });
});

describe("running a model's call", () => {
  test('runs the intention and answers with its message', async () => {
    const { runtime, log } = makeSearchApp();

    const answer = await call(runtime, 'search', { term: 'grid', tags: ['react'] });

    expect(answer).toEqual({ output: 'Searched for grid, tagged react' });
    expect(log).toEqual(['search.apply({"term":"grid","tags":["react"]})']);
  });

  test('a lookup value can be given by its title or an alias', async () => {
    const { runtime, log } = makeSearchApp();

    await call(runtime, 'preview', { result: '1. Grid layout notes' });
    await call(runtime, 'closePreview', {});
    await call(runtime, 'preview', { result: '2' });

    expect(log).toEqual([
      'results.preview({"result":"w1"})',
      'results.closePreview({})',
      'results.preview({"result":"w2"})'
    ]);
  });

  test('an unknown lookup value is refused with the choices, and nothing runs', async () => {
    const { runtime, log } = makeSearchApp();

    const answer = await call(runtime, 'search', { term: 'grid', tags: ['vue'] });

    expect(answer).toEqual({ errorText: 'No Tag "vue". Choose from: design, react' });
    expect(log).toEqual([]);
  });

  test('a value outside a fixed list is refused', async () => {
    const { runtime, log } = makeSearchApp();

    const answer = await call(runtime, 'search', { term: 'grid', match: 'all' });

    expect(answer).toEqual({ errorText: 'No Match "all". Choose from: any' });
    expect(log).toEqual([]);
  });

  test('a param the intention does not have is refused', async () => {
    const { runtime, log } = makeSearchApp();

    const answer = await call(runtime, 'search', { term: 'grid', colour: 'red' });

    expect(answer).toEqual({ errorText: '"search" has no "colour"' });
    expect(log).toEqual([]);
  });

  test('an intention that is not available now, or does not exist, is refused, and nothing runs', async () => {
    const { runtime, log } = makeSearchApp();

    const answers = [await call(runtime, 'next', {}), await call(runtime, 'launch', {})];

    expect(answers).toEqual([
      { errorText: '"next" is not available now' },
      { errorText: '"launch" is not available now' }
    ]);
    expect(log).toEqual([]);
  });

  test('an intention with no message answers with the placeholder', async () => {
    const { runtime } = makeSearchApp();

    await call(runtime, 'preview', { result: 'w1' });
    const answer = await call(runtime, 'next', {});

    expect(answer).toEqual({ output: 'Ran Next' });
  });
});

const READ_CATALOG = `
version: 3
app: app
states:
  s: { start: true, commands: [findNotes, archive] }
commands:
  findNotes: { label: Find notes, run: app.findNotes, params: {} }
  archive: { label: Archive, run: app.archive, params: {} }
`;

const makeReadApp = (archive = () => ({ message: 'Archived' })) =>
  buildCatalogRuntime(
    loadCatalog(READ_CATALOG, {
      app: {
        findNotes: () => ({
          message: 'Found 2 notes',
          output: { total: 2, ids: ['w1', 'w2'] }
        }),
        archive
      }
    })
  );

describe('a run that answers the model apart from the user', () => {
  test("the model gets the run's output, not its message", async () => {
    const answer = await call(makeReadApp(), 'findNotes', {});

    expect(answer).toEqual({ output: { total: 2, ids: ['w1', 'w2'] } });
  });

  test('a run with only a message answers with the message', async () => {
    const answer = await call(makeReadApp(), 'archive', {});

    expect(answer).toEqual({ output: 'Archived' });
  });

  test('a run with output and no message still answers with the output', async () => {
    const answer = await call(
      makeReadApp(() => ({ output: 0 })),
      'archive',
      {}
    );

    expect(answer).toEqual({ output: 0 });
  });

  test('a run whose output is null counts as having none, and answers with the message', async () => {
    const answer = await call(
      makeReadApp(() => ({ message: 'Nothing found', output: null })),
      'archive',
      {}
    );

    expect(answer).toEqual({ output: 'Nothing found' });
  });
});

const DESCRIBED_CATALOG = `
version: 3
app: app
states:
  browsing: { start: true, when: '!app.previewing', commands: [archive] }
  previewing: { when: app.previewing, commands: [closePreview] }
commands:
  archive:
    label: Archive
    toolDescription: Use only when the user asks to archive by name.
    run: app.archive
    params: {}
  closePreview: { label: Close preview, run: app.closePreview, params: {} }
`;

const makeDescribedApp = (isPreviewing) =>
  buildCatalogRuntime(
    loadCatalog(DESCRIBED_CATALOG, {
      app: { previewing: () => isPreviewing, archive: () => ({}), closePreview: () => ({}) }
    })
  );

describe("a command's description for the model", () => {
  test('follows the label; a command without one is described by its label alone', async () => {
    const tools = await makeDescribedApp(false).tools();

    expect(tools.map((tool) => tool.description)).toEqual([
      'Archive. Use only when the user asks to archive by name.',
      'Close preview (not available now)'
    ]);
  });

  test("a command not available now is marked after its label, before the model's description", async () => {
    const [archive] = await makeDescribedApp(true).tools();

    expect(archive.description).toBe(
      'Archive (not available now). Use only when the user asks to archive by name.'
    );
  });
});

describe('a call for a param the app holds', () => {
  test('left out, it takes the value the app holds', async () => {
    const { app, runtime, log } = makeAppHeldApp();
    app.previewedId = 'w2';

    const answer = await call(runtime, 'share', {});

    expect(answer).toEqual({ output: 'Shared w2' });
    expect(log).toEqual(['share({"result":"w2"})']);
  });

  test('left out while the app holds none, it is refused as needing it, and nothing runs', async () => {
    const { runtime, log } = makeAppHeldApp();

    const answer = await call(runtime, 'share', {});

    expect(answer).toEqual({ errorText: '"share" needs Result' });
    expect(log).toEqual([]);
  });

  test('given by the model, it is checked and used instead', async () => {
    const { app, runtime, log } = makeAppHeldApp();
    app.previewedId = 'w2';

    await call(runtime, 'share', { result: '1' });

    expect(log).toEqual(['share({"result":"w1"})']);
  });
});

const SMALL_CATALOG = `
version: 3
app: app
states:
  s: { start: true, commands: [zoom, label] }
commands:
  zoom:
    label: Zoom
    run: app.zoom
    params:
      level: { label: Level, default: true, argSource: { list: [{ value: 1, title: One }, { value: 2, title: Two }] } }
  label:
    label: Label
    run: app.label
    params:
      names: { label: Names, default: true, list: true, argSource: { freeform: true, type: text } }
`;

function makeSmallApp() {
  const calls = [];
  const bindings = {
    app: {
      zoom: (args) => calls.push(['zoom', args]),
      label: (args) => calls.push(['label', args])
    }
  };
  return { runtime: buildCatalogRuntime(loadCatalog(SMALL_CATALOG, bindings)), calls };
}

const propertyNamed = async (runtime, toolName, paramKey) =>
  (await runtime.tools()).find((tool) => tool.name === toolName).inputSchema.properties[paramKey];

describe('fixes from the review', () => {
  test('a fixed list of numbers is offered as strings, and runs with the number', async () => {
    const { runtime, calls } = makeSmallApp();

    const level = await propertyNamed(runtime, 'zoom', 'level');
    await call(runtime, 'zoom', { level: '2' });

    expect(level.enum).toEqual(['1', '2']);
    expect(calls).toEqual([['zoom', { level: 2 }]]);
  });

  test('a free-text list param is an array of strings, and a lone string becomes a list of one', async () => {
    const { runtime, calls } = makeSmallApp();

    const names = await propertyNamed(runtime, 'label', 'names');
    await call(runtime, 'label', { names: 'a' });

    expect(names).toEqual({
      type: 'array',
      items: { type: 'string' },
      description: 'Names: free text'
    });
    expect(calls).toEqual([['label', { names: ['a'] }]]);
  });

  test("an inherited key such as toString is refused as a param the intention doesn't have", async () => {
    const { runtime, log } = makeSearchApp();

    const answer = await call(runtime, 'search', { term: 'grid', toString: 'x' });

    expect(answer).toEqual({ errorText: '"search" has no "toString"' });
    expect(log).toEqual([]);
  });

  test('several values for a one-value param are refused', async () => {
    const { runtime, log } = makeSearchApp();

    const answer = await call(runtime, 'preview', { result: ['1', '2'] });

    expect(answer).toEqual({ errorText: '"preview" takes one Result' });
    expect(log).toEqual([]);
  });
});

const PICK_CATALOG = `
version: 3
app: app
states:
  s: { start: true, commands: [pick, label] }
commands:
  pick:
    label: Pick
    run: app.pick
    params:
      item: { label: Item, default: true, argSource: { lookup: app.items.rows } }
  label:
    label: Label
    run: app.label
    params:
      names: { label: Names, default: true, argSource: { freeform: true, type: text } }
`;

const makePickApp = (rows) =>
  buildCatalogRuntime(
    loadCatalog(PICK_CATALOG, { app: { pick: () => {}, label: () => {}, items: { rows } } })
  );

const itemDescription = async (runtime) =>
  (await runtime.tools()).find((tool) => tool.name === 'pick').inputSchema.properties.item
    .description;

describe('the values a lookup param offers the model', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('are listed by title, with the aliases a call may use too', async () => {
    const { runtime } = makeSearchApp();

    const tools = await runtime.tools();
    const result = tools.find((tool) => tool.name === 'preview').inputSchema.properties.result;

    expect(result.description).toBe(
      'Result: one of the app’s values, checked when it runs. Now: "1. Grid layout notes" (or "1"), "2. CSS grid guide" (or "2")'
    );
  });

  test('are quoted so a title with quotes stays one value', async () => {
    const description = await itemDescription(
      makePickApp(() => [{ value: 'g', title: 'The "grid" guide', aliases: ['g"1'] }])
    );

    expect(description).toBe(
      'Item: one of the app’s values, checked when it runs. Now: "The \\"grid\\" guide" (or "g\\"1")'
    );
  });

  test('are cut after twenty, saying how many more there are', async () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({
      value: `i${index}`,
      title: `Item ${index}`
    }));

    const description = await itemDescription(makePickApp(() => rows));

    expect(description).toContain('"Item 19", and 5 more');
    expect(description).not.toContain('"Item 20"');
  });

  test("aren't listed when the lookup fails, and the other tools are still built", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const runtime = makePickApp(() => {
      throw new Error('down');
    });

    const tools = await runtime.tools();

    expect(namesOf(tools)).toEqual(['pick', 'label']);
    expect(tools[0].inputSchema.properties.item.description).toBe(
      'Item: one of the app’s values, checked when it runs'
    );
    expect(console.error).toHaveBeenCalledWith(
      'Lookup for the tool "pick" failed',
      expect.anything()
    );
  });

  test("aren't listed when the lookup's promise rejects", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const description = await itemDescription(makePickApp(() => Promise.reject(new Error('down'))));

    expect(description).toBe('Item: one of the app’s values, checked when it runs');
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  test("aren't waited for past a short time", async () => {
    vi.useFakeTimers();
    const runtime = makePickApp(() => new Promise(() => {}));

    const described = itemDescription(runtime);
    await vi.advanceTimersByTimeAsync(LOOKUP_WAIT_MS);

    expect(await described).toBe('Item: one of the app’s values, checked when it runs');
  });
});

const NOTES_CATALOG = `
version: 3
app: app
states:
  s: { start: true, commands: [goTo, label, archive, rename, filter, resize, mark] }
commands:
  mark:
    label: Mark
    run: app.mark
    params:
      words: { label: Words, default: true, list: true, required: true, argSource: { freeform: true, type: text } }
  filter:
    label: Filter
    run: app.filter
    params:
      tags: { label: Tag, default: true, list: true, required: true, argSource: { lookup: app.tags } }
  resize:
    label: Resize
    run: app.resize
    params:
      sizes:
        label: Size
        default: true
        list: true
        minItems: 2
        argSource: { list: [{ value: 1, title: one }, { value: 2, title: two }, { value: 3, title: three }] }
  goTo:
    label: Go to
    run: app.goTo
    params:
      page: { label: Page, default: true, argSource: { freeform: true, type: text } }
  label:
    label: Label
    run: app.label
    params:
      names: { label: Names, default: true, list: true, argSource: { freeform: true, type: text } }
  archive:
    label: Archive notes
    run: app.archive
    params:
      tags: { label: Tag, default: true, list: true, minItems: 1, argSource: { lookup: app.tags } }
      folders: { label: Folder, list: true, argSource: { freeform: true, type: text } }
  rename:
    label: Rename
    run: app.rename
    params:
      name: { label: Name, default: true, required: true, argSource: { freeform: true, type: text } }
      note:
        label: Note
        aliases: [note]
        required: true
        argSource: { lookup: app.notes, current: app.openNote }
`;

function makeNotesApp() {
  const app = { openNoteId: 'n1' };
  const runs = [];
  const tags = vi.fn(() => [
    { value: 'work', title: 'work' },
    { value: 'home', title: 'home' }
  ]);
  const ran = (name) => (args) => {
    runs.push([name, args]);
  };
  const runtime = buildCatalogRuntime(
    loadCatalog(NOTES_CATALOG, {
      app: {
        goTo: ran('goTo'),
        label: ran('label'),
        archive: ran('archive'),
        rename: ran('rename'),
        filter: ran('filter'),
        mark: ran('mark'),
        resize: ran('resize'),
        tags,
        notes: () => [{ value: 'n1', title: 'Groceries' }],
        openNote: () => app.openNoteId
      }
    })
  );
  return { app, runtime, runs, tags };
}

const schemaOf = async (runtime, toolName) =>
  (await runtime.tools()).find((tool) => tool.name === toolName).inputSchema;

describe('CP-39: free text from a model arrives as text', () => {
  test('a number or a boolean becomes its text', async () => {
    const { runtime, runs } = makeNotesApp();

    await call(runtime, 'goTo', { page: 2 });
    await call(runtime, 'goTo', { page: true });

    expect(runs).toEqual([
      ['goTo', { page: '2' }],
      ['goTo', { page: 'true' }]
    ]);
  });

  test('each item of a free-text list too', async () => {
    const { runtime, runs } = makeNotesApp();

    await call(runtime, 'label', { names: [2, 'b'] });

    expect(runs).toEqual([['label', { names: ['2', 'b'] }]]);
  });

  test('an object is refused, naming the param, and nothing runs', async () => {
    const { runtime, runs } = makeNotesApp();

    const answers = [
      await call(runtime, 'goTo', { page: { n: 2 } }),
      await call(runtime, 'label', { names: ['a', { n: 2 }] })
    ];

    expect(answers).toEqual([
      { errorText: '"goTo" takes Page as text' },
      { errorText: '"label" takes Names as text' }
    ]);
    expect(runs).toEqual([]);
  });

  test('null counts as left out', async () => {
    const { runtime, runs } = makeNotesApp();

    await call(runtime, 'goTo', { page: null });

    expect(runs).toEqual([['goTo', {}]]);
  });
});

describe('CP-40: a list param can require items', () => {
  test("the tool's schema shows minItems on that param only", async () => {
    const { runtime } = makeNotesApp();

    const schema = await schemaOf(runtime, 'archive');

    expect(schema.properties.tags.minItems).toBe(1);
    expect(schema.properties.folders).not.toHaveProperty('minItems');
  });

  test('fewer items are refused, naming the param, before the lookup is asked, and nothing runs', async () => {
    const { runtime, runs, tags } = makeNotesApp();
    tags.mockClear();

    const answer = await call(runtime, 'archive', { tags: [] });

    expect(answer).toEqual({ errorText: '"archive" needs at least 1 of Tag' });
    expect(tags).not.toHaveBeenCalled();
    expect(runs).toEqual([]);
  });

  test('left out, the command runs; a list without minItems takes an empty list', async () => {
    const { runtime, runs } = makeNotesApp();

    await call(runtime, 'archive', {});
    await call(runtime, 'archive', { tags: ['work'], folders: [] });

    expect(runs).toEqual([
      ['archive', {}],
      ['archive', { tags: ['work'], folders: [] }]
    ]);
  });
});

describe('CP-41: a required param the model leaves out is refused before the app sees it', () => {
  test("the tool's schema lists the required params the app doesn't hold, and none for a command without", async () => {
    const { runtime } = makeNotesApp();

    expect((await schemaOf(runtime, 'rename')).required).toEqual(['name']);
    expect(await schemaOf(runtime, 'goTo')).not.toHaveProperty('required');
  });

  test('left out or null, it is refused with what the command needs, and nothing runs', async () => {
    const { runtime, runs } = makeNotesApp();

    const answers = [
      await call(runtime, 'rename', {}),
      await call(runtime, 'rename', { name: null })
    ];

    expect(answers).toEqual([
      { errorText: '"rename" needs Name' },
      { errorText: '"rename" needs Name' }
    ]);
    expect(runs).toEqual([]);
  });

  test('given, it runs with the param the app holds filled in', async () => {
    const { runtime, runs } = makeNotesApp();

    await call(runtime, 'rename', { name: 'Notes' });

    expect(runs).toEqual([['rename', { name: 'Notes', note: 'n1' }]]);
  });

  test('a required param the app holds none of is refused as before', async () => {
    const { app, runtime, runs } = makeNotesApp();
    app.openNoteId = null;

    const answer = await call(runtime, 'rename', { name: 'Notes' });

    expect(answer).toEqual({ errorText: '"rename" needs Note' });
    expect(runs).toEqual([]);
  });
});

describe('the tool boundary, after review', () => {
  test('a required list given [] counts as left out, and its schema asks for at least one', async () => {
    const { runtime, runs } = makeNotesApp();

    const answer = await call(runtime, 'filter', { tags: [] });
    const schema = await schemaOf(runtime, 'filter');

    expect(answer).toEqual({ errorText: '"filter" needs Tag' });
    expect(schema.required).toEqual(['tags']);
    expect(schema.properties.tags.minItems).toBe(1);
    expect(runs).toEqual([]);
  });

  test('required free text that is blank counts as left out', async () => {
    const { runtime, runs } = makeNotesApp();

    const answers = [
      await call(runtime, 'rename', { name: '' }),
      await call(runtime, 'rename', { name: '   ' })
    ];

    expect(answers).toEqual([
      { errorText: '"rename" needs Name' },
      { errorText: '"rename" needs Name' }
    ]);
    expect(runs).toEqual([]);
  });

  test('a required free-text list given only blank items counts as left out', async () => {
    const { runtime, runs } = makeNotesApp();

    const answers = [
      await call(runtime, 'mark', { words: ['   '] }),
      await call(runtime, 'mark', { words: ['', ' '] }),
      await call(runtime, 'mark', { words: '  ' })
    ];
    await call(runtime, 'mark', { words: ['', 'urgent'] });

    expect(answers).toEqual([
      { errorText: '"mark" needs Words' },
      { errorText: '"mark" needs Words' },
      { errorText: '"mark" needs Words' }
    ]);
    expect(runs).toEqual([['mark', { words: ['', 'urgent'] }]]);
  });

  test('optional free text that is blank arrives as given', async () => {
    const { runtime, runs } = makeNotesApp();

    await call(runtime, 'goTo', { page: '' });

    expect(runs).toEqual([['goTo', { page: '' }]]);
  });

  test('every missing required param is named in one refusal, and the schema lists one the app holds none of now', async () => {
    const { app, runtime, runs } = makeNotesApp();
    app.openNoteId = null;

    const answer = await call(runtime, 'rename', {});
    const schema = await schemaOf(runtime, 'rename');

    expect(answer).toEqual({ errorText: '"rename" needs Name, Note' });
    expect(schema.required).toEqual(['name', 'note']);
    expect(runs).toEqual([]);
  });

  test('minItems on a fixed list: the schema shows it, a shorter list or a lone value is refused', async () => {
    const { runtime, runs } = makeNotesApp();

    const schema = await schemaOf(runtime, 'resize');
    const answers = [
      await call(runtime, 'resize', { sizes: ['one'] }),
      await call(runtime, 'resize', { sizes: 'one' })
    ];
    await call(runtime, 'resize', { sizes: ['one', 3] });

    expect(schema.properties.sizes).toMatchObject({
      type: 'array',
      items: { type: 'string', enum: ['1', '2', '3'] },
      minItems: 2
    });
    expect(answers).toEqual([
      { errorText: '"resize" needs at least 2 of Size' },
      { errorText: '"resize" needs at least 2 of Size' }
    ]);
    expect(runs).toEqual([['resize', { sizes: [1, 3] }]]);
  });

  test('null for a list or a lookup param counts as left out', async () => {
    const { runtime, runs } = makeNotesApp();

    await call(runtime, 'archive', { tags: null, folders: null });

    expect(runs).toEqual([['archive', {}]]);
  });

  test('an object or a nested list is refused for a lookup or a fixed list, as for free text', async () => {
    const { runtime, runs } = makeNotesApp();

    const answers = [
      await call(runtime, 'archive', { tags: [['work']] }),
      await call(runtime, 'resize', { sizes: [{ n: 1 }, 'two'] })
    ];

    expect(answers).toEqual([
      { errorText: '"archive" takes Tag as text' },
      { errorText: '"resize" takes Size as text' }
    ]);
    expect(runs).toEqual([]);
  });

  test('a call whose input is null runs as one with no args', async () => {
    const { runtime, runs } = makeNotesApp();

    await runtime.runTool({ toolName: 'goTo', input: null });

    expect(runs).toEqual([['goTo', {}]]);
  });
});
