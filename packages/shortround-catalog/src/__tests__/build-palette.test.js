import { describe, expect, test, vi } from 'vitest';

import { buildPalette, loadCatalog } from '../index.js';
import { readFixture } from './fixtures/read-fixture.js';

const CATALOG = readFixture('search-palette.yaml');

const PANEL = () => 'panel';
const BACK = 'palette-back';

function setup({ hasServiceLink = false, sortRows, facetRows, preview } = {}) {
  const bindings = {
    app: {
      sortOptions: {
        rows: vi.fn(
          () =>
            sortRows ?? [
              { value: 'relevance', title: 'Relevance' },
              { value: 'created-newest', title: 'Created (newest)', subtitle: 'Current' }
            ]
        )
      },
      search: {
        mergeTerms: vi.fn(),
        setMatch: vi.fn(),
        setSort: vi.fn(),
        addFacetValue: vi.fn(),
        facetValueRows: vi.fn(() => facetRows ?? [{ value: 'design', title: 'design' }])
      },
      results: {
        rows: vi.fn(() => [{ value: 'w2', title: '3. CSS grid guide', aliases: ['3'] }]),
        preview: vi.fn(preview),
        next: vi.fn(),
        openInService: vi.fn(),
        closePreview: vi.fn(),
        previewedHasServiceLink: () => hasServiceLink
      }
    }
  };
  const catalog = loadCatalog(CATALOG, bindings);
  const intentions = buildPalette(catalog, {
    panels: { sidecar: PANEL },
    backIntentionId: BACK
  }).intentions;
  return { bindings, intentions };
}

const byTitle = (intentions, title) => intentions.find((item) => item.title === title);

async function choose(intentions, title, { row, input = '' } = {}) {
  const result = await byTitle(intentions, title).action(input);
  return row === undefined ? result : byTitle(result.intentions, row).action(input);
}

const titlesOf = (result) => result.intentions.map((item) => item.title);

describe('the start state', () => {
  test('lists its commands, one per facet for a forEach command, with ids from the catalog', () => {
    const { intentions } = setup();

    expect(intentions.map(({ id, title, group }) => [id, title, group])).toEqual([
      ['app.search', 'Search', 'Search'],
      ['app.matchAny', 'Match any', 'Refine'],
      ['app.sort', 'Sort', 'Refine'],
      ['app.facet.tags', 'Tag', 'Refine'],
      ['app.facet.bookmarked_at', 'Bookmark age', 'Refine'],
      ['app.preview', 'Preview', 'Results']
    ]);
    expect(byTitle(intentions, 'Search')).toMatchObject({ icon: 'search', aliases: ['find'] });
    expect(byTitle(intentions, 'Tag')).toMatchObject({ icon: 'folder', aliases: ['tagged'] });
  });
});

describe('a command without a step', () => {
  test('runs with its `args` and returns to its state, without touching the side panel', async () => {
    const { bindings, intentions } = setup();

    const result = await choose(intentions, 'Match any');

    expect(bindings.app.search.setMatch).toHaveBeenCalledWith('any');
    expect(titlesOf(result)).toContain('Preview');
    expect(result.sideEffects).toBeUndefined();
  });
});

describe('the fallback, and what kind of list a result brings', () => {
  const buildWith = (options) =>
    buildPalette(loadCatalog(CATALOG, setup().bindings), {
      panels: { sidecar: PANEL },
      backIntentionId: BACK,
      ...options
    });
  const makeFallback = () => vi.fn(() => []);

  test('the start list gets the fallback, which is told the state', () => {
    const fallback = makeFallback();
    const palette = buildWith({ fallback });

    palette.resolveFallbackInput('why', { matches: [] });

    expect(fallback).toHaveBeenCalledWith('why', { matches: [], stateName: 'browsing' });
  });

  test("every state's result gets it, told its own state", async () => {
    const fallback = makeFallback();
    const palette = buildWith({ fallback });

    const result = await choose(palette.intentions, 'Preview', { row: '3. CSS grid guide' });
    result.resolveFallbackInput('why', { matches: [] });

    expect(fallback).toHaveBeenCalledWith('why', { matches: [], stateName: 'previewing' });
    expect(result.listKind).toBe('state');
  });

  test("a picker's and a text step's results get none, and say what they are", async () => {
    const palette = buildWith({ fallback: makeFallback() });

    const picker = await choose(palette.intentions, 'Sort');
    const textStep = await choose(palette.intentions, 'Search');

    expect(picker.resolveFallbackInput).toBeUndefined();
    expect(picker.listKind).toBe('picker');
    expect(textStep.resolveFallbackInput).toBeUndefined();
    expect(textStep.listKind).toBe('text');
  });

  test('without the option, no fallback anywhere', async () => {
    const palette = buildWith({});

    const result = await choose(palette.intentions, 'Match any');

    expect(palette.resolveFallbackInput).toBeUndefined();
    expect(result.resolveFallbackInput).toBeUndefined();
    expect(result.listKind).toBe('state');
  });
});

describe('side effects a run returns', () => {
  const CHAT = () => 'chat';

  test('are passed on, so a command can open the side panel', async () => {
    const { bindings, intentions } = setup();
    bindings.app.search.setMatch.mockReturnValue({ sideEffects: { sidecarRenderer: CHAT } });

    const result = await choose(intentions, 'Match any');

    expect(result.sideEffects).toEqual({ sidecarRenderer: CHAT });
  });

  test("win over the state's own panel", async () => {
    const { intentions } = setup({ preview: () => ({ sideEffects: { closeSidecar: true } }) });

    const result = await choose(intentions, 'Preview', { row: '3. CSS grid guide' });

    expect(result.sideEffects).toEqual({ closeSidecar: true });
  });

  test('apply even when the run is cancelled', async () => {
    const { bindings, intentions } = setup();
    bindings.app.search.setMatch.mockReturnValue({
      isCancelled: true,
      sideEffects: { sidecarRenderer: CHAT }
    });

    const result = await choose(intentions, 'Match any');

    expect(result.sideEffects).toEqual({ sidecarRenderer: CHAT });
  });
});

describe('a command that asks to choose', () => {
  test('lists the picker rows with Back, in the command group and icon', async () => {
    const { intentions } = setup();

    const result = await choose(intentions, 'Sort');

    expect(result.includeRevertIntentions).toEqual([BACK]);
    expect(
      result.intentions.map(({ id, title, subtitle, group, icon }) => [
        id,
        title,
        subtitle,
        group,
        icon
      ])
    ).toEqual([
      ['app.sort::relevance', 'Relevance', undefined, 'Refine', 'settings'],
      ['app.sort::created-newest', 'Created (newest)', 'Current', 'Refine', 'settings']
    ]);
  });

  test('a row with an object value uses its key in the row id and passes the whole value to run', async () => {
    const { bindings, intentions } = setup({
      sortRows: [
        { key: 'tags::react', value: { facet: 'tags', value: 'react' }, title: 'Tag: react' }
      ]
    });

    const rows = (await choose(intentions, 'Sort')).intentions;
    await rows[0].action('');

    expect(rows[0].id).toBe('app.sort::tags::react');
    expect(bindings.app.search.setSort).toHaveBeenCalledWith({ facet: 'tags', value: 'react' });
  });

  test('runs with the chosen value and returns to the state list', async () => {
    const { bindings, intentions } = setup();

    const result = await choose(intentions, 'Sort', { row: 'Created (newest)' });

    expect(bindings.app.search.setSort).toHaveBeenCalledWith('created-newest');
    expect(titlesOf(result)).toContain('Match any');
  });

  test('a forEach command passes its facet to the picker and to run, before the chosen value', async () => {
    const { bindings, intentions } = setup();

    await choose(intentions, 'Tag', { row: 'design' });

    expect(bindings.app.search.facetValueRows).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'tags' })
    );
    expect(bindings.app.search.addFacetValue).toHaveBeenCalledWith('tags', 'design');
  });

  test('picker sources receive the catalog facets, for labelling rows', async () => {
    const { bindings, intentions } = setup();

    await choose(intentions, 'Sort');

    expect(bindings.app.sortOptions.rows).toHaveBeenCalledWith({
      key: undefined,
      facets: {
        tags: { title: 'Tag', aliases: ['tagged'] },
        bookmarked_at: { title: 'Bookmark age' }
      }
    });
  });

  test('an empty picker stays in the state list with its message, naming a facet in lower case', async () => {
    const { intentions } = setup({ facetRows: [] });

    const result = await choose(intentions, 'Bookmark age');

    expect(result.message).toBe('No bookmark age values for this search');
    expect(titlesOf(result)).toContain('Sort');
    expect(result.includeRevertIntentions).toBeUndefined();
  });
});

describe('a command that asks for text', () => {
  test('offers one typed-text step with Back, matching disabled', async () => {
    const { intentions } = setup();

    const result = await choose(intentions, 'Search');

    expect(result.disableInputMatching).toBe(true);
    expect(result.includeRevertIntentions).toEqual([BACK]);
    expect(result.intentions.map(({ id, title, disabled }) => [id, title, disabled])).toEqual([
      ['app.search::text', 'Search for the typed words', undefined]
    ]);
  });

  test('runs with the trimmed text', async () => {
    const { bindings, intentions } = setup();
    const [step] = (await choose(intentions, 'Search')).intentions;

    const result = await step.action('  react grid ');

    expect(bindings.app.search.mergeTerms).toHaveBeenCalledWith('react grid');
    expect(titlesOf(result)).toContain('Sort');
  });

  test('a blank entry asks again with the required message', async () => {
    const { bindings, intentions } = setup();
    const [step] = (await choose(intentions, 'Search')).intentions;

    const result = await step.action('   ');

    expect(bindings.app.search.mergeTerms).not.toHaveBeenCalled();
    expect(result.message).toBe('Type some words first');
    expect(titlesOf(result)).toEqual(['Search for the typed words']);
    expect(result.disableInputMatching).toBe(true);
  });
});

describe('moving between states', () => {
  test('entering a panel state opens the side panel and shows only that state', async () => {
    const { intentions } = setup();

    const result = await choose(intentions, 'Preview', { row: '3. CSS grid guide' });

    expect(result.sideEffects).toEqual({ sidecarRenderer: PANEL });
    expect(titlesOf(result)).toEqual(['Next', 'Close preview']);
  });

  test('a command in a panel state keeps the side panel open', async () => {
    const { intentions } = setup();
    const previewing = await choose(intentions, 'Preview', { row: '3. CSS grid guide' });

    const result = await choose(previewing.intentions, 'Next');

    expect(result.sideEffects).toEqual({ sidecarRenderer: PANEL });
  });

  test('leaving a panel state closes the side panel', async () => {
    const { intentions } = setup();
    const previewing = await choose(intentions, 'Preview', { row: '3. CSS grid guide' });

    const result = await choose(previewing.intentions, 'Close preview');

    expect(result.sideEffects).toEqual({ closeSidecar: true });
    expect(titlesOf(result)).toContain('Preview');
  });

  test('a `when` command is listed only while its condition holds', async () => {
    const withLink = await choose(setup({ hasServiceLink: true }).intentions, 'Preview', {
      row: '3. CSS grid guide'
    });
    const withoutLink = await choose(setup().intentions, 'Preview', { row: '3. CSS grid guide' });

    expect(titlesOf(withLink)).toEqual(['Next', 'Open in service', 'Close preview']);
    expect(titlesOf(withoutLink)).toEqual(['Next', 'Close preview']);
  });
});

describe('what run returns', () => {
  test('a message is passed on to the palette', async () => {
    const { intentions } = setup({ preview: () => ({ message: 'Previewing' }) });

    const result = await choose(intentions, 'Preview', { row: '3. CSS grid guide' });

    expect(result.message).toBe('Previewing');
  });

  test('a cancelled run stays in the state the command was listed in', async () => {
    const { intentions } = setup({
      preview: () => ({ message: 'That result is no longer in the list', isCancelled: true })
    });

    const result = await choose(intentions, 'Preview', { row: '3. CSS grid guide' });

    expect(result.message).toBe('That result is no longer in the list');
    expect(titlesOf(result)).toContain('Sort');
    expect(result.sideEffects).toBeUndefined();
  });
});

describe('starting in a state the app names', () => {
  const buildFrom = (startState) =>
    buildPalette(loadCatalog(CATALOG, setup().bindings), {
      panels: { sidecar: PANEL },
      backIntentionId: BACK,
      startState
    });

  // A typed line resolves only commands that ask for a value; Sort does, in browsing only.
  test("lists that state's commands, and resolves typed lines against them", () => {
    const palette = buildFrom('previewing');

    expect(palette.intentions.map((item) => item.title)).toEqual(['Next', 'Close preview']);
    expect(buildFrom(undefined).resolveInput('sort ')).not.toEqual([]);
    expect(palette.resolveInput('sort ')).toEqual([]);
  });

  // The app hands it to ShortRoundSidekick as defaultSidecarRenderer, so the palette opens with its panel (FU-8).
  test("a panel state's palette carries its panel", () => {
    expect(buildFrom('previewing').sidecarRenderer).toBe(PANEL);
  });

  test('a start state without a panel carries none', () => {
    expect(buildFrom(undefined).sidecarRenderer).toBeUndefined();
  });

  test('moves on from there as from any state', async () => {
    const palette = buildFrom('previewing');

    const result = await choose(palette.intentions, 'Close preview');

    expect(titlesOf(result)).toContain('Preview');
  });

  test('a state the catalog does not have throws, naming it', () => {
    expect(() => buildFrom('reviewing')).toThrow(
      'buildPalette: start state "reviewing" is not a built state of the catalog'
    );
  });

  test('a planned state throws, naming it', () => {
    const catalog = loadCatalog(
      [
        'version: 2',
        'app: demo',
        'states:',
        '  home:',
        '    start: true',
        '    commands:',
        '      go: { title: Go, run: app.go }',
        '  later:',
        '    planned: true',
        '    commands:',
        '      wait: { title: Wait, planned: true }'
      ].join('\n'),
      { app: { go: () => {} } }
    );

    expect(() => buildPalette(catalog, { backIntentionId: BACK, startState: 'later' })).toThrow(
      'buildPalette: start state "later" is not a built state of the catalog'
    );
  });
});

describe('what the app must supply', () => {
  const loadForBuild = () => loadCatalog(CATALOG, setupBindingsForBuild());
  const setupBindingsForBuild = () => {
    const noop = () => {};
    const rows = () => [];
    return {
      app: {
        sortOptions: { rows },
        search: {
          mergeTerms: noop,
          setMatch: noop,
          setSort: noop,
          addFacetValue: noop,
          facetValueRows: rows
        },
        results: {
          rows,
          preview: noop,
          next: noop,
          openInService: noop,
          closePreview: noop,
          previewedHasServiceLink: noop
        }
      }
    };
  };

  test('a renderer for every panel the catalog uses', () => {
    expect(
      () => buildPalette(loadForBuild(), { panels: {}, backIntentionId: BACK }).intentions
    ).toThrow(
      'Catalog state "previewing" shows panel "sidecar", but the app supplies no renderer for it'
    );
  });

  test('the id of the Back row', () => {
    expect(() => buildPalette(loadForBuild(), { panels: { sidecar: PANEL } }).intentions).toThrow(
      'buildPalette needs backIntentionId'
    );
  });
});
