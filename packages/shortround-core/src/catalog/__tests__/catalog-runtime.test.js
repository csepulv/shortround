// The catalog at run time (`buildCatalogRuntime`): the states that hold, what is available, the app's one signal, and
// a command line. The palette and the chat are views over it.
import { describe, expect, test, vi } from 'vitest';

import { makeChatLine } from '../../command-builder/chat-line.js';
import { buildPalette } from '../build-palette.js';
import { buildCatalogRuntime } from '../catalog-runtime.js';
import { loadCatalog } from '../load-catalog.js';
import { readFixture } from './fixtures/read-fixture.js';
import { makeAppHeldApp, makeSearchApp } from './fixtures/search-app.js';

const SEARCH_CATALOG = readFixture('search-palette-v3.yaml');
const PALETTE_SUPPLIES = { panels: { sidecar: () => 'panel' }, backIntentionId: 'palette-back' };

function setup() {
  const app = { previewedId: null, sortRows: [{ value: 'relevance', title: 'Relevance' }] };
  const bindings = {
    app: {
      conditions: { previewed: () => app.previewedId !== null },
      sortOptions: { rows: () => app.sortRows },
      search: {
        apply: vi.fn(({ term }) => ({ message: `Searched for ${term}` })),
        facetValueRows: () => []
      },
      results: {
        rows: () => [{ value: 'w1', title: '1. Grid layout notes', aliases: ['1'] }],
        preview: vi.fn(({ result }) => {
          app.previewedId = result;
        }),
        next: vi.fn(),
        openInService: vi.fn(),
        closePreview: vi.fn(() => {
          app.previewedId = null;
        }),
        previewedHasServiceLink: () => false
      }
    }
  };
  const runtime = buildCatalogRuntime(loadCatalog(SEARCH_CATALOG, bindings));
  return { app, bindings, runtime };
}

const titlesOf = (rows) => rows.map((row) => row.title);

describe('a runtime', () => {
  test('needs no palette supplies', () => {
    expect(() => setup()).not.toThrow();
  });

  test('says which commands are available in the states that hold', () => {
    const { app, runtime } = setup();

    const browsing = ['search', 'preview', 'next'].map(runtime.isAvailable);
    app.previewedId = 'w1';
    const previewing = ['search', 'next', 'openInService'].map(runtime.isAvailable);

    expect(browsing).toEqual([true, true, false]);
    expect(previewing).toEqual([false, true, false]);
  });

  test('runs a command and gives back what the app returned', async () => {
    const { runtime, bindings } = setup();

    const outcome = await runtime.run('search', { term: 'grid' });

    expect(bindings.app.search.apply).toHaveBeenCalledWith({ term: 'grid' });
    expect(outcome).toEqual({ message: 'Searched for grid' });
  });

  test('a run that returns nothing gives back an empty outcome', async () => {
    const { runtime } = setup();

    expect(await runtime.run('preview', { result: 'w1' })).toEqual({});
  });

  test('notify tells subscribers until they unsubscribe', () => {
    const { runtime } = setup();
    const heard = vi.fn();

    const unsubscribe = runtime.subscribe(heard);
    runtime.notify();
    unsubscribe();
    runtime.notify();

    expect(heard).toHaveBeenCalledTimes(1);
  });
});

describe("a runtime's command line", () => {
  test('follows the app: the same text reads again after notify', () => {
    const { app, runtime } = setup();
    const line = runtime.commandLine();

    line.change('next');
    const before = line.getState().canRun;
    app.previewedId = 'w1';
    runtime.notify();

    expect([before, line.getState().canRun]).toEqual([false, true]);
  });

  test("drops a lookup's cached values on notify", () => {
    const { app, runtime } = setup();
    const line = runtime.commandLine();

    line.change('search grid with sort ');
    const before = line.getState().nextSteps.map((step) => step.label);
    app.sortRows = [{ value: 'oldest', title: 'Oldest' }];
    runtime.notify();
    const after = line.getState().nextSteps.map((step) => step.label);

    expect(before).toContain('Relevance');
    expect(after).toContain('Oldest');
    expect(after).not.toContain('Relevance');
  });

  test('stops following after dispose', () => {
    const { app, runtime } = setup();
    const line = runtime.commandLine();
    line.change('next');

    line.dispose();
    app.previewedId = 'w1';
    runtime.notify();

    expect(line.getState().canRun).toBe(false);
  });

  test('runs a typed line and gives back the outcome', async () => {
    const { runtime, bindings } = setup();
    const line = runtime.commandLine();

    line.change('search grid');
    const outcome = await line.submit();

    expect(bindings.app.search.apply).toHaveBeenCalledWith({ term: 'grid' });
    expect(outcome).toEqual({ message: 'Searched for grid' });
  });
});

describe('a palette and a command line over one runtime', () => {
  test('one notify keeps a palette, a chat line and the tools in step', async () => {
    const { app, runtime } = setup();
    const palette = buildPalette(runtime, PALETTE_SUPPLIES);
    const line = makeChatLine({ runtime, onIntentionRun: () => {}, onSendAsChat: () => {} });
    line.change('next');

    app.previewedId = 'w1';
    runtime.notify();

    expect(titlesOf(palette.listNow())).toEqual(['Next', 'Close preview']);
    expect(line.getState().canRun).toBe(true);
    expect(
      (await runtime.tools())
        .filter((tool) => !tool.description.endsWith('(not available now)'))
        .map((tool) => tool.name)
    ).toEqual(['next', 'closePreview']);
  });

  test("the palette's notify is the runtime's", () => {
    const { runtime } = setup();
    const palette = buildPalette(runtime, PALETTE_SUPPLIES);
    const heard = vi.fn();
    runtime.subscribe(heard);

    palette.notify();

    expect(heard).toHaveBeenCalledTimes(1);
  });

  test('a palette subscribed before the change re-reads the new state', () => {
    const { app, runtime } = setup();
    const palette = buildPalette(runtime, PALETTE_SUPPLIES);
    const seen = [];
    palette.subscribe(() => seen.push(titlesOf(palette.current().intentions)));

    app.previewedId = 'w1';
    palette.notify();

    expect(seen).toEqual([['Next', 'Close preview']]);
  });

  test("the palette's subscribers read typed lines with the app's new values", () => {
    const { app, runtime } = setup();
    const palette = buildPalette(runtime, PALETTE_SUPPLIES);
    const readSortRows = () => titlesOf(palette.current().resolveInput('search grid with sort '));
    readSortRows();
    const seen = [];
    palette.subscribe(() => seen.push(readSortRows()));

    app.sortRows = [{ value: 'oldest', title: 'Oldest' }];
    palette.notify();

    expect(seen[0]).toContain('Oldest');
    expect(seen[0]).not.toContain('Relevance');
  });

  test("the palette's line asks for a missing app-held value with a picker, where the runtime's line says it needs it", async () => {
    const { runtime, log } = makeAppHeldApp();
    const paletteLine = buildPalette(runtime, PALETTE_SUPPLIES).commandLine();
    const runtimeLine = runtime.commandLine();

    paletteLine.change('share hello');
    runtimeLine.change('share hello');
    const [paletteRow] = paletteLine.rows();
    const [runtimeRow] = runtimeLine.rows();
    const step = await paletteLine.submit();

    expect(paletteRow).toMatchObject({ disabled: false, subtitle: undefined });
    expect(runtimeRow).toMatchObject({ disabled: true, subtitle: 'Needs Result' });
    expect(step).toMatchObject({ listKind: 'picker', includeRevertIntentions: ['palette-back'] });
    expect(titlesOf(step.intentions)).toEqual(['1. Grid layout notes', '2. CSS grid guide']);
    expect(log).toEqual([]);
  });

  test("the palette's typed rows still say what a hint word waits for, as before", () => {
    const { runtime } = setup();
    const line = buildPalette(runtime, PALETTE_SUPPLIES).commandLine();

    line.change('search grid with');

    expect(titlesOf(line.rows())).toContain('After "with": Sort');
    expect(line.rows().some((row) => row.missing)).toBe(false);
  });

  test("the palette's typed line runs a command by its label too", async () => {
    const { runtime, log } = makeSearchApp();
    await runtime.run('preview', { result: 'w1' });
    runtime.notify();
    const line = buildPalette(runtime, PALETTE_SUPPLIES).commandLine();

    line.change('close preview');
    await line.submit();

    expect(log).toEqual(['results.preview({"result":"w1"})', 'results.closePreview({})']);
  });

  test('the palette still needs its supplies', () => {
    const { runtime } = setup();

    expect(() => buildPalette(runtime, { panels: PALETTE_SUPPLIES.panels })).toThrow(
      'buildPalette needs backIntentionId'
    );
  });
});

describe('fixes from the review', () => {
  test('Enter on a line that needs an app-held value keeps the text and runs nothing', async () => {
    const { runtime, log } = makeAppHeldApp();
    const line = runtime.commandLine();

    line.change('share hello');
    const canRun = line.getState().canRun;
    await line.submit();

    expect(canRun).toBe(false);
    expect(line.getState().text).toBe('share hello');
    expect(log).toEqual([]);
  });

  test("a palette's line follows notify in the order the palette's subscribers came", () => {
    const { app, runtime } = setup();
    const palette = buildPalette(runtime, PALETTE_SUPPLIES);
    const line = palette.commandLine();
    line.change('next');
    const seen = [];
    palette.subscribe(() => seen.push(line.getState().canRun));

    app.previewedId = 'w1';
    palette.notify();

    expect(seen).toEqual([true]);
  });

  test('run with no args gives the app an empty object', async () => {
    const { runtime, bindings } = setup();

    await runtime.run('preview');

    expect(bindings.app.results.preview).toHaveBeenCalledWith({});
  });
});
