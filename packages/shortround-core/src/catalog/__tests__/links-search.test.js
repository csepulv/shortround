// A real search app's catalog, unified. The catalog is YAML (fixtures/links-search.yaml), so
// tests that change it parse it, change the object and write it back ([adapted], setup only); row ids follow the
// catalog's names.
import { describe, expect, test, vi } from 'vitest';
import { parse, stringify } from 'yaml';

import { LOADING_DELAY_MS } from '../../command-builder/loading-delay.js';
import * as core from '../../index.js';
import { buildPalette } from '../build-palette.js';
import { loadCatalog } from '../load-catalog.js';
import { readFixture } from './fixtures/read-fixture.js';

const LINKS_CATALOG = readFixture('links-search.yaml');

// The links app's catalog with one change, as catalog text.
const linksCatalogWith = (change) => stringify(change(parse(LINKS_CATALOG, { merge: true })));

// Stubs shaped like the app's bindings, plus the functions the unified form
// needs that a version 2 app didn't have (apply, replaceWith, dropFilter, conditions.previewed, previewedId). Its `open`
// and `openInService` adapters are gone: the merged commands call openById and openInServiceById.
// `noneAs`: what `previewedId` returns while nothing is previewed (an app may return undefined or null).
function setup({ catalog = LINKS_CATALOG, noneAs = undefined } = {}) {
  const app = {
    previewedId: null,
    hasServiceLink: false,
    results: [{ value: 'b1', title: '1. Grid guide', aliases: ['1'] }]
  };
  const rows = (values) => values.map((value) => ({ value, title: value }));
  const bindings = {
    links: {
      conditions: { previewed: () => app.previewedId !== null },
      sortOptions: { rows: () => rows(['relevance', 'bookmarked-newest', 'created-newest']) },
      search: {
        apply: vi.fn(),
        replaceWith: vi.fn(),
        clearFilters: vi.fn(),
        clearSearch: vi.fn(),
        dropFilter: vi.fn(),
        facetValueRows: vi.fn(
          ({ key }) =>
            ({
              tags: rows(['react', 'design']),
              kinds: rows(['library']),
              content_format: rows(['web', 'chat'])
            })[key] ?? []
        ),
        activeFilterRows: vi.fn(() => [])
      },
      searchResults: {
        rows: () => app.results,
        chatWithServiceLinkRows: () => [],
        previewById: vi.fn(({ result }) => {
          app.previewedId = result;
        }),
        previewedId: () => app.previewedId ?? noneAs,
        openById: vi.fn(),
        openInServiceById: vi.fn(),
        showNext: vi.fn(),
        showPrevious: vi.fn(),
        previewedHasServiceLink: () => app.hasServiceLink,
        closePreview: vi.fn(() => {
          app.previewedId = null;
        })
      }
    }
  };
  const palette = buildPalette(loadCatalog(catalog, bindings), {
    panels: { sidecar: () => 'panel' },
    backIntentionId: 'back'
  });
  return { app, bindings, palette };
}

// The app's browsing list, in its order, from its catalog.
const TODAY_BROWSING = [
  'Search',
  'New search',
  'Clear filters',
  'Clear search',
  'Sort',
  'Match all',
  'Match any',
  'Type',
  'Kind',
  'Tag',
  'Plugin',
  'Service',
  'Machine',
  'Project',
  'Bookmark age',
  'Created age',
  'Drop filter',
  'Preview',
  'Open',
  'Open in service'
];

describe('a real catalog, unified', () => {
  test('loads against the app-shaped bindings', () => {
    expect(() => setup()).not.toThrow();
  });

  test("core's buildPalette gives a version 3 catalog this palette", () => {
    const { bindings } = setup();
    const palette = core.buildPalette(core.loadCatalog(LINKS_CATALOG, bindings), {
      panels: { sidecar: () => 'panel' },
      backIntentionId: 'back'
    });
    expect(palette.intentions.map(({ title }) => title)).toEqual(TODAY_BROWSING);
    expect(palette.notify).toEqual(expect.any(Function));
  });

  // The order comes from ordered groups.
  test("derives today's browsing rows, in today's order", () => {
    const titles = setup().palette.intentions.map(({ title }) => title);
    expect(titles).toEqual(TODAY_BROWSING);
  });

  test("rows take today's groups and icons, mostly from the group", () => {
    const rowOf = (title) => setup().palette.intentions.find((row) => row.title === title);
    expect(['Search', 'Clear search', 'Sort', 'Tag', 'Drop filter', 'Preview'].map(rowOf)).toEqual([
      expect.objectContaining({ group: 'Search', icon: 'search' }),
      expect.objectContaining({ group: 'Search', icon: 'search' }),
      expect.objectContaining({ group: 'Refine', icon: 'settings' }),
      expect.objectContaining({ group: 'Refine', icon: 'folder' }),
      expect.objectContaining({ group: 'Refine', icon: 'settings' }),
      expect.objectContaining({ group: 'Results', icon: 'file' })
    ]);
  });

  // Each value's row has its own id and aliases. [adapted] Ids follow the catalog's names, not
  // version 2's (links.search.matchAll), since the catalog no longer names them.
  test('the Match rows have their own ids and aliases', () => {
    const rows = setup().palette.intentions.filter(({ title }) => title.startsWith('Match'));
    expect(rows.map(({ id, title, aliases }) => ({ id, title, aliases }))).toEqual([
      { id: 'links.search.match.all', title: 'Match all', aliases: ['every'] },
      { id: 'links.search.match.any', title: 'Match any', aliases: ['either'] }
    ]);
  });

  // [adapted] The message names the catalog, as version 2's messages do.
  test('a command naming a group the catalog lacks fails at load', () => {
    const { bindings } = setup();
    const catalog = linksCatalogWith((raw) => {
      raw.commands.next.group = 'nowhere';
      return raw;
    });
    expect(() => loadCatalog(catalog, bindings)).toThrow(
      'Catalog command "next": no group "nowhere" in the catalog'
    );
  });

  // Open moves under Results, after Close preview: one command has one group.
  test('previewing follows from the app; "Open in service" waits for a service link', async () => {
    const previewing = await previewFirstResult(setup().palette);
    expect(previewing.intentions.map(({ title }) => title)).toEqual([
      'Next',
      'Previous',
      'Close preview',
      'Open'
    ]);
  });
});

// A param can take the arg the app holds now. "Open" is one command in both states.
describe('args from the app', () => {
  test('while previewing, the Open row opens the previewed result at once', async () => {
    const { bindings, palette } = setup();
    const previewing = await previewFirstResult(palette);

    await rowTitled(previewing, 'Open').action('');
    expect(bindings.links.searchResults.openById).toHaveBeenCalledWith({ result: 'b1' });
  });

  test('while browsing, the Open row asks for a result', async () => {
    const step = await rowTitled(setup().palette, 'Open').action('');
    expect(step.listKind).toBe('picker');
    expect(step.intentions.map(({ title }) => title)).toEqual(['1. Grid guide']);
  });

  test('typed "open" while previewing runs with the previewed result', async () => {
    const { bindings, palette } = setup();
    const previewing = await previewFirstResult(palette);
    const [open] = commandRows(previewing.resolveInput('open'));

    await open.action('');
    expect(bindings.links.searchResults.openById).toHaveBeenCalledWith({ result: 'b1' });
  });

  // With nothing previewed, typed "open" has no result to run on, so it gives no command row; it offers the results as
  // completions, as "preview " does, and the list's own Open row still asks for a result.
  test('typed "open " while browsing offers the results; the Open row asks for one', async () => {
    const { bindings, palette } = setup();
    const typed = palette.resolveInput('open ');
    expect(commandRows(typed)).toEqual([]);
    expect(typed.map(({ completion }) => completion)).toContain('open b1 ');

    const step = await rowTitled(palette, 'Open').action('');
    expect(step.listKind).toBe('picker');
    expect(bindings.links.searchResults.openById).not.toHaveBeenCalled();
  });
});

// The app signals what it knows; ShortRound drops its caches and tells subscribers.
describe("the app's signal", () => {
  test('after the preview closes outside the palette, a subscriber hears once and the list is browsing', async () => {
    const { bindings, palette } = setup();
    await previewFirstResult(palette);
    const listener = vi.fn();
    palette.subscribe(listener);

    bindings.links.searchResults.closePreview();
    palette.notify();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(palette.listNow().map(({ title }) => title)).toEqual(TODAY_BROWSING);
  });

  test('new results show in typed lines only after notify()', () => {
    const { app, palette } = setup();
    const previewRows = () => commandRows(palette.resolveInput('preview 2 '));
    expect(previewRows()).toEqual([]);

    app.results = [...app.results, { value: 'b2', title: '2. Flexbox guide', aliases: ['2'] }];
    expect(previewRows()).toEqual([]);

    palette.notify();
    // [adapted] A one-param command reads back by its own label.
    expect(previewRows().map(({ title }) => title)).toEqual(['Preview: 2. Flexbox guide']);
  });
});

// What a palette store needs to follow the app.
describe('the palette as the app is now', () => {
  test('current() gives the states that hold now: their list, resolver and panel', async () => {
    const { palette } = setup();
    const browsing = palette.current();
    expect(browsing.intentions.map(({ title }) => title)).toEqual(TODAY_BROWSING);
    expect(commandRows(browsing.resolveInput('clear filters ')).map(({ title }) => title)).toEqual([
      'Clear filters'
    ]);
    expect(browsing.sidecarRenderer).toBeUndefined();

    await previewFirstResult(palette);
    const previewing = palette.current();
    expect(previewing.intentions.map(({ title }) => title)).toEqual([
      'Next',
      'Previous',
      'Close preview',
      'Open'
    ]);
    expect(previewing.sidecarRenderer()).toBe('panel');
  });

  test("isAvailable(name) asks whether a command's state and `when` hold now", async () => {
    const { palette } = setup();
    expect(palette.isAvailable('openInService')).toBe(true);
    expect(palette.isAvailable('next')).toBe(false);

    await previewFirstResult(palette);
    expect(palette.isAvailable('next')).toBe(true);
    // While previewing, Open in service waits for a service link, which this result lacks.
    expect(palette.isAvailable('openInService')).toBe(false);
  });

  // Typed lines offer what the list offers. A command whose `when` is false doesn't read.
  test("a command the list hides isn't offered or run by a typed line", async () => {
    const { bindings, palette } = setup();
    const previewing = await previewFirstResult(palette);

    const rows = commandRows(previewing.resolveInput('open in service '));
    await Promise.all(rows.filter((row) => !row.disabled).map((row) => row.action('')));

    expect(rows.map(({ title }) => title)).not.toContain('Open in service');
    expect(bindings.links.searchResults.openInServiceById).not.toHaveBeenCalled();
  });

  test('a typed line offers the command again once its `when` holds', async () => {
    const { app, palette } = setup();
    await previewFirstResult(palette);

    app.hasServiceLink = true;
    const rows = commandRows(palette.current().resolveInput('open in service '));

    expect(rows.map(({ title }) => title)).toEqual(['Open in service']);
  });

  test('a picker or text step says which command it belongs to', async () => {
    const { palette } = setup();
    const picker = await rowTitled(palette, 'Preview').action('');
    const text = await rowTitled(palette, 'New search').action('');
    expect(picker.command).toEqual({ name: 'preview', label: 'Preview' });
    expect(text.command).toEqual({ name: 'newSearch', label: 'New search' });
  });
});

// `path` holds overrides only. Without it, the derivation words the steps from the label.
describe('path defaults', () => {
  const withoutPath = (commandName) =>
    linksCatalogWith((raw) => {
      Object.values(raw.commands[commandName].params).forEach((param) => delete param.path);
      return raw;
    });

  test('a text step prompts from the label', async () => {
    const { palette } = setup({ catalog: withoutPath('newSearch') });
    const step = await rowTitled(palette, 'New search').action('');
    expect(step.intentions.map(({ title }) => title)).toEqual(['Type the new search']);
  });

  test('an empty picker says so from the label', async () => {
    const { palette } = setup({ catalog: withoutPath('drop') });
    const result = await rowTitled(palette, 'Drop filter').action('');
    expect(result.message).toBe('No filter to choose from');
  });
});

// Command keys ("clearFilters") aren't words; the translation adds the phrases people type.
describe('typed command phrases', () => {
  test('clear filters runs with nothing to type', async () => {
    const { bindings, palette } = setup();
    const [clear] = commandRows(palette.resolveInput('clear filters '));

    await clear.action('');
    expect(bindings.links.search.clearFilters).toHaveBeenCalledWith({});
  });

  // A whole-line alias reads before its trailing space, as a host's Enter sends it.
  test('clear filters runs without a trailing space', async () => {
    const { bindings, palette } = setup();
    const [clear] = commandRows(palette.resolveInput('clear filters'));

    await clear.action('');
    expect(bindings.links.search.clearFilters).toHaveBeenCalledWith({});
  });

  test("a command line's Enter runs a whole-line alias once", async () => {
    const { bindings, palette } = setup();
    const line = palette.commandLine();

    line.change('clear filters');
    expect(line.getState().canRun).toBe(true);
    await line.submit();

    expect(bindings.links.search.clearFilters).toHaveBeenCalledTimes(1);
    line.dispose();
  });

  test('new search takes its term', async () => {
    const { bindings, palette } = setup();
    const [fresh] = commandRows(palette.resolveInput('new search grid'));

    await fresh.action('');
    expect(bindings.links.search.replaceWith).toHaveBeenCalledWith({ term: 'grid' });
  });

  // The command named "open" no longer hides the longer phrase.
  // Read while previewing a chat with a service link: a command runs by its name only while the app holds its current
  // arg (the previewed result).
  test('open in service is reached, though "open" is another command', async () => {
    const { app, palette } = setup();
    app.hasServiceLink = true;
    await previewFirstResult(palette);
    const [row] = commandRows(palette.current().resolveInput('open in service '));
    expect(row.title).toBe('Open in service');
  });
});

describe('a real catalog, typed lines', () => {
  test("a typed line in the app's vocabulary runs the compound search once", async () => {
    const { bindings, palette } = setup();
    // was: search grid type library tagged react sort created (a hint ends the term)
    const [top] = commandRows(
      palette.resolveInput('search grid with type library tagged react sort created')
    );

    await top.action('');

    expect(bindings.links.search.apply).toHaveBeenCalledTimes(1);
    expect(bindings.links.search.apply).toHaveBeenCalledWith({
      term: 'grid',
      kinds: ['library'],
      tags: ['react'],
      sort: 'created-newest'
    });
  });

  test('a hint may come before a param alias', () => {
    const [top] = commandRows(setup().palette.resolveInput('search grid with tagged react'));
    expect(top.title).toBe('Search: grid · Tag: react');
  });

  // The version 2 catalog gave Tag only "tagged"; the translation adds "tag" and "tags", since command-builder matches
  // aliases, not labels.
  test.each(['search grid with tags react', 'search grid with tag react'])('%s', (line) => {
    const [top] = commandRows(setup().palette.resolveInput(line));
    expect(top.title).toBe('Search: grid · Tag: react');
  });

  test('right after the command name, "tags" starts the Tag param', () => {
    const [top] = commandRows(setup().palette.resolveInput('search tags react'));
    expect(top.title).toBe('Search · Tag: react');
  });

  // Once the term has started, a param word is part of it.
  test('search grid tags react is one term', () => {
    const [top] = commandRows(setup().palette.resolveInput('search grid tags react'));
    expect(top.title).toBe('Search: grid tags react');
  });
});

// The palette hands out a command line for the commands available now (a custom UI's, or an editor's slash command's),
// which follows the app and runs as a typed line does.
describe("the palette's command line", () => {
  test('a typed line runs once, and after the run changes the app the line offers the new commands', async () => {
    const { bindings, palette } = setup();
    const line = palette.commandLine();

    line.change('preview 1');
    expect(line.getState()).toMatchObject({
      canRun: true,
      top: { title: 'Preview: 1. Grid guide' }
    });
    await line.submit();
    expect(bindings.links.searchResults.previewById).toHaveBeenCalledTimes(1);
    expect(bindings.links.searchResults.previewById).toHaveBeenCalledWith({ result: 'b1' });

    line.change('ne');
    expect(line.getState().ghost).toBe('xt ');
  });

  test('a param the app holds (`current`) is filled when the line leaves it out', async () => {
    const { bindings, palette } = setup();
    await previewFirstResult(palette);
    const line = palette.commandLine();

    line.change('open');
    await line.submit();
    expect(bindings.links.searchResults.openById).toHaveBeenCalledTimes(1);
    expect(bindings.links.searchResults.openById).toHaveBeenCalledWith({ result: 'b1' });
  });

  test("a command the list hides isn't offered or run", async () => {
    const { bindings, palette } = setup();
    await previewFirstResult(palette);
    const line = palette.commandLine();

    // With the trailing space, as the typed-row tests above: the phrase is finished, not still being typed.
    line.change('open in service ');
    expect(line.getState().top?.call.command).not.toBe('openInService');
    await line.submit();
    expect(bindings.links.searchResults.openInServiceById).not.toHaveBeenCalled();
  });

  // A command line reads with its own engine: a reader with other text on a shared engine cut its stack, and a pending
  // lookup's result was dropped (the tag values never arrived).
  test("a command line reading other text doesn't lose the rows' pending lookup", async () => {
    const { bindings, palette } = setup();
    let land;
    const tagRows = new Promise((resolve) => {
      land = () => resolve([{ value: 'react', title: 'react' }]);
    });
    bindings.links.search.facetValueRows.mockImplementation(({ key }) =>
      key === 'tags' ? tagRows : []
    );
    const resolveInput = palette.current().resolveInput;
    const line = palette.commandLine();

    resolveInput('tag ');
    line.change('preview');
    land();
    await tagRows;

    expect(resolveInput('tag ').map(({ title }) => title)).toContain('react');
  });

  test('the line is told when its own slow lookup lands, and reads the values', async () => {
    const { bindings, palette } = setup();
    let land;
    const tagRows = new Promise((resolve) => {
      land = () => resolve([{ value: 'react', title: 'react' }]);
    });
    bindings.links.search.facetValueRows.mockImplementation(({ key }) =>
      key === 'tags' ? tagRows : []
    );
    const line = palette.commandLine();
    line.change('tag ');
    const listener = vi.fn();
    line.subscribe(listener);

    land();
    await vi.waitFor(() => expect(listener).toHaveBeenCalled());
    expect(line.getState().nextSteps.map(({ label }) => label)).toContain('react');
  });

  test("notify() drops the line's cached lookups, so it reads the app's new data", () => {
    const { app, palette } = setup();
    const line = palette.commandLine();
    line.change('preview 2');
    expect(line.getState().top).toBeUndefined();

    app.results = [...app.results, { value: 'b2', title: '2. CSS guide', aliases: ['2'] }];
    palette.notify();

    expect(line.getState().top?.title).toBe('Preview: 2. CSS guide');
  });

  test('notify() makes it read again, and after dispose() it no longer follows', async () => {
    const { app, palette } = setup();
    const line = palette.commandLine();
    line.change('nex');
    expect(line.getState().ghost).toBeUndefined();

    app.previewedId = 'b1';
    palette.notify();
    expect(line.getState().ghost).toBe('t ');

    line.dispose();
    app.previewedId = null;
    palette.notify();
    expect(line.getState().ghost).toBe('t ');
  });
});

// Right after a command's name, a default param with values offers its values, not its own label: after "preview " the
// user is choosing a result. Freeform params and param words keep what they offered before.
describe("a command's default param, right after its name", () => {
  const nextOf = (palette, text) => {
    const line = palette.commandLine();
    line.change(text);
    return line;
  };
  const labelsOf = (line) => line.getState().nextSteps.map(({ label }) => label);

  test('"preview " offers the results, and Tab then Enter previews the first, once', async () => {
    const { app, bindings, palette } = setup();
    app.results = [...app.results, { value: 'b2', title: '2. Flex notes', aliases: ['2'] }];
    const line = nextOf(palette, 'preview ');

    expect(labelsOf(line)).toEqual(['1. Grid guide', '2. Flex notes']);
    expect(line.getState().ghost).toBe('b1 ');

    line.acceptCompletion();
    expect(line.getState().text).toBe('preview b1 ');
    await line.submit();
    expect(bindings.links.searchResults.previewById).toHaveBeenCalledTimes(1);
    expect(bindings.links.searchResults.previewById).toHaveBeenCalledWith({ result: 'b1' });
  });

  test('"drop " offers the filters in effect', () => {
    const { bindings, palette } = setup();
    bindings.links.search.activeFilterRows.mockReturnValue([
      { value: 'tags:react', title: 'Tag: react' }
    ]);

    expect(labelsOf(nextOf(palette, 'drop '))).toEqual(['Tag: react']);
  });

  // While the app holds the param's current value (the previewed result), "open" runs on it, so offering the results
  // would let Tab turn "open the previewed one" into "open the first result".
  test("a default param that takes the app's current value isn't offered as if open", async () => {
    const { palette } = setup();
    await previewFirstResult(palette);
    const line = nextOf(palette, 'open ');

    expect(labelsOf(line)).not.toContain('1. Grid guide');
    expect(line.getState().ghost).not.toBe('b1 ');
  });

  test('while a result is previewed, Enter on "open " opens it, once', async () => {
    const { bindings, palette } = setup();
    await previewFirstResult(palette);
    const line = nextOf(palette, 'open ');

    expect(line.getState().canRun).toBe(true);
    await line.submit();
    expect(bindings.links.searchResults.openById).toHaveBeenCalledTimes(1);
    expect(bindings.links.searchResults.openById).toHaveBeenCalledWith({ result: 'b1' });
  });

  // With nothing previewed, "open" has no result to run on, so it reads like "preview ": it offers the results, and
  // Enter completes the first instead of returning a picker no host shows.
  test('while nothing is previewed, "open " offers the results, and Enter completes the first', async () => {
    const { bindings, palette } = setup();
    const line = nextOf(palette, 'open ');

    expect(line.getState().canRun).toBe(false);
    expect(labelsOf(line)).toEqual(['1. Grid guide']);
    expect(line.getState().ghost).toBe('b1 ');
    await line.submit();
    expect(line.getState().text).toBe('open b1 ');
    expect(bindings.links.searchResults.openById).not.toHaveBeenCalled();
  });

  // A typed result wins over the previewed one, and runs while nothing is previewed.
  test('"open b2 " opens b2, whether or not another result is previewed', async () => {
    const { app, bindings, palette } = setup();
    app.results = [...app.results, { value: 'b2', title: '2. Flex notes', aliases: ['2'] }];

    const browsing = nextOf(palette, 'open b2 ');
    expect(browsing.getState().canRun).toBe(true);
    await browsing.submit();
    expect(bindings.links.searchResults.openById).toHaveBeenLastCalledWith({ result: 'b2' });

    await previewFirstResult(palette);
    const previewing = nextOf(palette, 'open b2 ');
    await previewing.submit();
    expect(bindings.links.searchResults.openById).toHaveBeenCalledTimes(2);
    expect(bindings.links.searchResults.openById).toHaveBeenLastCalledWith({ result: 'b2' });
  });

  // A slow lookup behind the default param says it is loading, as one behind a param word does.
  test("the default param's slow lookup says it is loading", () => {
    vi.useFakeTimers();
    try {
      const line = nextOf(
        paintPalette(() => new Promise(() => {})),
        'paint '
      );
      expect(line.getState().loading).toEqual([]);

      vi.advanceTimersByTime(LOADING_DELAY_MS);

      expect(line.getState().loading).toEqual([{ param: 'item', label: 'Item' }]);
      // A lookup still loading isn't empty.
      expect(line.getState().incomplete).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  // The default's values come first; hints and other params' words still follow; only the default param's own label
  // goes.
  test("the default's values come first, and hints and other params' words still follow", () => {
    expect(
      labelsOf(
        nextOf(
          paintPalette(() => [{ value: 'fence', title: 'fence' }]),
          'paint '
        )
      )
    ).toEqual(['fence', 'with', 'color']);
  });

  // Only right after the name: while another param has words, its values come next, not the default's.
  test("while another param is being filled, the default's values aren't offered", () => {
    const palette = paintPalette(() => [{ value: 'fence', title: 'fence' }]);

    expect(labelsOf(nextOf(palette, 'paint with color red '))).not.toContain('fence');
  });

  // Pins: these offered the same as before.
  test('a freeform term, a param word and a reserved word offer what they did', () => {
    const { palette } = setup();

    expect(labelsOf(nextOf(palette, 'search '))).toEqual([
      'for',
      'about',
      'with',
      'sort by',
      'order by',
      'search',
      'sort',
      'match',
      'type',
      'kind',
      'tag',
      'plugin',
      'service',
      'machine',
      'project',
      'bookmark age',
      'created age'
    ]);
    expect(labelsOf(nextOf(palette, 'new search '))).toEqual([]);
    expect(labelsOf(nextOf(palette, 'sort '))).toEqual([
      'relevance',
      'bookmarked-newest',
      'created-newest'
    ]);
    expect(labelsOf(nextOf(palette, 'search with '))).toContain('tagged');
  });
});

// When the values offered at the caret come from a lookup with nothing to offer, and nothing is typed for the param,
// the line says so with the picker's own empty text.
describe('a param with nothing to offer', () => {
  const incompleteOf = (palette, text) => {
    const line = palette.commandLine();
    line.change(text);
    return line.getState().incomplete;
  };
  test('"drop " with no filters says there are none to drop', () => {
    const { palette } = setup();
    expect(incompleteOf(palette, 'drop ')).toEqual(['No filters to drop']);
  });

  test('"preview " with no results says none are loaded', () => {
    const { app, palette } = setup();
    app.results = [];
    expect(incompleteOf(palette, 'preview ')).toEqual(['No results loaded']);
  });

  test("a param with no `path.empty` says so from its label, and the command's other words still follow", () => {
    const line = paintPalette([]).commandLine();
    line.change('paint ');
    expect(line.getState().incomplete).toEqual(['No item to choose from']);
    expect(line.getState().nextSteps.map(({ label }) => label)).toEqual(['with', 'color']);
  });

  // Pins: these read the same as before.
  test('"drop " with filters in effect says nothing', () => {
    const { bindings, palette } = setup();
    bindings.links.search.activeFilterRows.mockReturnValue([
      { value: 'tags:react', title: 'Tag: react' }
    ]);
    expect(incompleteOf(palette, 'drop ')).toEqual([]);
  });

  test('a typed value with no match reads as before', () => {
    const { palette } = setup();
    expect(incompleteOf(palette, 'preview zz')).toEqual([]);
  });

  // "wi" matches no item, but may still become "with": the items aren't empty.
  test('a word still being typed that matches no value says nothing', () => {
    expect(incompleteOf(paintPalette([{ value: 'fence', title: 'fence' }]), 'paint wi')).toEqual(
      []
    );
  });

  // The guards' other cases.
  test('after a hint, the line says what the hint introduces, not that the default has nothing', () => {
    expect(incompleteOf(paintPalette([]), 'paint with ')).toEqual(['After "with": Color']);
  });

  test("a failed lookup says it couldn't load, not that it is empty", async () => {
    const line = paintPalette(() => Promise.reject(new Error('down'))).commandLine();
    line.change('paint ');

    await vi.waitFor(() =>
      expect(line.getState().failed).toEqual([{ param: 'item', label: 'Item' }])
    );
    expect(line.getState().incomplete).toEqual([]);
  });

  test('when every value is already applied, the line says the empty text', () => {
    const { bindings, palette } = setup();
    bindings.links.search.activeFilterRows.mockReturnValue([
      { value: 'tags:react', title: 'Tag: react', isApplied: true }
    ]);
    expect(incompleteOf(palette, 'drop ')).toEqual(['No filters to drop']);
  });

  // In a palette, the text is a disabled row under Status, not "Keep typing".
  test('in the palette, the empty text is a disabled Status row', () => {
    const rows = setup().palette.resolveInput('drop ');
    expect(rows.map(({ group, title, disabled }) => ({ group, title, disabled }))).toEqual([
      { group: 'Status', title: 'No filters to drop', disabled: true }
    ]);
  });

  // An app that returns null when it holds nothing (rather than undefined) holds nothing.
  test('a `current` that returns null holds nothing: "open " offers the results and runs nothing', async () => {
    const { bindings, palette } = setup({ noneAs: null });
    const line = palette.commandLine();
    line.change('open ');

    expect(line.getState().canRun).toBe(false);
    await line.submit();
    expect(line.getState().text).toBe('open b1 ');
    const step = await rowTitled(palette, 'Open').action('');
    expect(step.listKind).toBe('picker');
    expect(bindings.links.searchResults.openById).not.toHaveBeenCalled();
  });
});

// The closing quote ends a quoted term, so a param word right after it starts that param, as after a matched list
// value. An unquoted term still runs until a reserved word.
describe('a param word after a quoted term', () => {
  const stateOf = (palette, text) => {
    const line = palette.commandLine();
    line.change(text);
    return line.getState();
  };

  test('starts its param: the quoted phrase is the term', () => {
    const { palette } = setup();
    const state = stateOf(palette, 'search "react grid" kind library');

    expect(state.canRun).toBe(true);
    expect(state.top.call).toMatchObject({
      command: 'search',
      args: { term: 'react grid', kinds: ['library'] }
    });
    // A value alias may follow too, as after a matched list value ("every" is Match: all).
    expect(stateOf(palette, 'search "react grid" every ').top.call.args).toEqual({
      term: 'react grid',
      match: 'all'
    });
  });

  test('after a quoted term, param words come next, not only reserved words', () => {
    const { palette } = setup();

    expect(stateOf(palette, 'search "react grid" ').nextSteps.map(({ label }) => label)).toContain(
      'kind'
    );
  });

  // Pins: these read the same as before.
  test('an unquoted term still runs until a reserved word, and a bare word after a quote is no param', () => {
    const { palette } = setup();

    expect(stateOf(palette, 'search react grid kind library ').top.call.args).toEqual({
      term: 'react grid kind library'
    });
    expect(stateOf(palette, 'search "react grid" grid ').problem).toBe(
      '"grid" isn\'t part of Search'
    );
  });
});

const commandRows = (rows) => rows.filter(({ group }) => group === 'Commands');
const rowTitled = ({ intentions }, title) => intentions.find((row) => row.title === title);

async function previewFirstResult(palette) {
  const picker = await rowTitled(palette, 'Preview').action('');
  return picker.intentions[0].action('');
}

// A command with a default lookup param (`item`) and another param introduced by "with". `items`: the lookup's rows,
// or the lookup itself (a slow or failing one).
const paintPalette = (items) =>
  buildPalette(
    loadCatalog(
      `
version: 3
app: app
states:
  working: { commands: [paint] }
commands:
  paint:
    label: Paint
    run: app.paint
    params:
      item: { label: Item, default: true, argSource: { lookup: app.items } }
      color:
        label: Color
        hints: [with]
        argSource: { list: [{ value: red, title: red }] }
`,
      { app: { paint: vi.fn(), items: typeof items === 'function' ? items : () => items } }
    ),
    { backIntentionId: 'back' }
  );
