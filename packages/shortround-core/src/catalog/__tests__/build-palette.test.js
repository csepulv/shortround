// buildPalette over a version 3 catalog (fixtures/search-palette-v3.yaml): the picking rows, steps and state lists.
// Ported from version 2's build-palette tests. Each ported test notes how it came across:
//   [same]     passes as written, apart from setup
//   [adapted]  the assertion changed, and why
//   [dropped]  listed at the end, with the reason
import { afterEach, describe, expect, test, vi } from 'vitest';

import { LOADING_DELAY_MS } from '../../command-builder/loading-delay.js';
import { buildPalette } from '../build-palette.js';
import { loadCatalog } from '../load-catalog.js';
import { readFixture } from './fixtures/read-fixture.js';

const UNIFIED = readFixture('search-palette-v3.yaml');

const PANEL = () => 'panel';
const BACK = 'palette-back';

// The app holds real state: previewing a result makes it "previewed", and states follow from that (no `then`). With
// `refusesPreview`, the app's preview leaves nothing previewed (the result was gone, say).
function setup({
  hasServiceLink = false,
  sortRows,
  facetRows,
  preview,
  refusesPreview = false,
  isPreviewed = false
} = {}) {
  const app = { previewedId: isPreviewed ? 'w2' : null };
  const bindings = {
    app: {
      conditions: { previewed: () => app.previewedId !== null },
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
        apply: vi.fn(),
        facetValueRows: vi.fn(() => facetRows ?? [{ value: 'design', title: 'design' }])
      },
      results: {
        rows: vi.fn(() => [{ value: 'w2', title: '3. CSS grid guide', aliases: ['3'] }]),
        preview: vi.fn((args) => {
          if (!refusesPreview) {
            app.previewedId = args.result;
          }
          return preview?.(args);
        }),
        next: vi.fn(),
        openInService: vi.fn(),
        closePreview: vi.fn(() => {
          app.previewedId = null;
        }),
        previewedHasServiceLink: () => hasServiceLink
      }
    }
  };
  const palette = buildPalette(loadCatalog(UNIFIED, bindings), {
    panels: { sidecar: PANEL },
    backIntentionId: BACK
  });
  return { app, bindings, intentions: palette.intentions, palette };
}

const byTitle = (intentions, title) => intentions.find((item) => item.title === title);

async function choose(intentions, title, { row, input = '' } = {}) {
  const result = await byTitle(intentions, title).action(input);
  return row === undefined ? result : byTitle(result.intentions, row).action(input);
}

const titlesOf = (result) => result.intentions.map((item) => item.title);

describe('the start state', () => {
  // [same] Ids, titles and groups match today's, through `path` (id, title, group) on each param of the compound Search.
  test('lists its commands, a row per param for a compound command, with ids from the catalog', () => {
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
  // [adapted] The call: `apply({ match: 'any' })` instead of `setMatch('any')`.
  test('runs with its `args` and returns to its state, without touching the side panel', async () => {
    const { bindings, intentions } = setup();

    const result = await choose(intentions, 'Match any');

    expect(bindings.app.search.apply).toHaveBeenCalledWith({ match: 'any' });
    expect(titlesOf(result)).toContain('Preview');
    expect(result.sideEffects).toBeUndefined();
  });
});

describe('the fallback, and what kind of list a result brings', () => {
  const buildWith = (options) =>
    buildPalette(loadCatalog(UNIFIED, setup().bindings), {
      panels: { sidecar: PANEL },
      backIntentionId: BACK,
      ...options
    });
  const makeFallback = () => vi.fn(() => []);

  // [same]
  test('the start list gets the fallback, which is told the state', () => {
    const fallback = makeFallback();
    const palette = buildWith({ fallback });

    palette.resolveFallbackInput('why', { matches: [] });

    expect(fallback).toHaveBeenCalledWith('why', { matches: [], stateName: 'browsing' });
  });

  // [same]
  test("every state's result gets it, told its own state", async () => {
    const fallback = makeFallback();
    const palette = buildWith({ fallback });

    const result = await choose(palette.intentions, 'Preview', { row: '3. CSS grid guide' });
    result.resolveFallbackInput('why', { matches: [] });

    expect(fallback).toHaveBeenCalledWith('why', { matches: [], stateName: 'previewing' });
    expect(result.listKind).toBe('state');
  });

  // [same]
  test("a picker's and a text step's results get none, and say what they are", async () => {
    const palette = buildWith({ fallback: makeFallback() });

    const picker = await choose(palette.intentions, 'Sort');
    const textStep = await choose(palette.intentions, 'Search');

    expect(picker.resolveFallbackInput).toBeUndefined();
    expect(picker.listKind).toBe('picker');
    expect(textStep.resolveFallbackInput).toBeUndefined();
    expect(textStep.listKind).toBe('text');
  });

  // [same]
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

  // [adapted] The mocked function is `apply`, not `setMatch`.
  test('are passed on, so a command can open the side panel', async () => {
    const { bindings, intentions } = setup();
    bindings.app.search.apply.mockReturnValue({ sideEffects: { sidecarRenderer: CHAT } });

    const result = await choose(intentions, 'Match any');

    expect(result.sideEffects).toEqual({ sidecarRenderer: CHAT });
  });

  // [same]
  test("win over the state's own panel", async () => {
    const { intentions } = setup({ preview: () => ({ sideEffects: { closeSidecar: true } }) });

    const result = await choose(intentions, 'Preview', { row: '3. CSS grid guide' });

    expect(result.sideEffects).toEqual({ closeSidecar: true });
  });
});

describe('a command that asks to choose', () => {
  // [same]
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

  // [adapted] The call: `apply({ sort: <the object> })` instead of `setSort(<the object>)`.
  test('a row with an object value uses its key in the row id and passes the whole value to run', async () => {
    const { bindings, intentions } = setup({
      sortRows: [
        { key: 'tags::react', value: { facet: 'tags', value: 'react' }, title: 'Tag: react' }
      ]
    });

    const rows = (await choose(intentions, 'Sort')).intentions;
    await rows[0].action('');

    expect(rows[0].id).toBe('app.sort::tags::react');
    expect(bindings.app.search.apply).toHaveBeenCalledWith({
      sort: { facet: 'tags', value: 'react' }
    });
  });

  // [adapted] The call: `apply({ sort: 'created-newest' })`.
  test('runs with the chosen value and returns to the state list', async () => {
    const { bindings, intentions } = setup();

    const result = await choose(intentions, 'Sort', { row: 'Created (newest)' });

    expect(bindings.app.search.apply).toHaveBeenCalledWith({ sort: 'created-newest' });
    expect(titlesOf(result)).toContain('Match any');
  });

  // [adapted] The facet is now a param: the lookup still gets its `key`, and run gets `{ tags: ['design'] }` (a list
  // param's arg is a list) instead of `addFacetValue('tags', 'design')`.
  test('a facet param passes its key to the lookup, and run gets the chosen value as a list', async () => {
    const { bindings, intentions } = setup();

    await choose(intentions, 'Tag', { row: 'design' });

    expect(bindings.app.search.facetValueRows).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'tags' })
    );
    expect(bindings.app.search.apply).toHaveBeenCalledWith({ tags: ['design'] });
  });

  // [same]
  test('an empty picker stays in the state list with its message, naming a facet in lower case', async () => {
    const { intentions } = setup({ facetRows: [] });

    const result = await choose(intentions, 'Bookmark age');

    expect(result.message).toBe('No bookmark age values for this search');
    expect(titlesOf(result)).toContain('Sort');
    expect(result.includeRevertIntentions).toBeUndefined();
  });
});

describe('a command that asks for text', () => {
  // [same]
  test('offers one typed-text step with Back, matching disabled', async () => {
    const { intentions } = setup();

    const result = await choose(intentions, 'Search');

    expect(result.disableInputMatching).toBe(true);
    expect(result.includeRevertIntentions).toEqual([BACK]);
    expect(result.intentions.map(({ id, title, disabled }) => [id, title, disabled])).toEqual([
      ['app.search::text', 'Search for the typed words', undefined]
    ]);
  });

  // [adapted] The call: `apply({ term: 'react grid' })` instead of `mergeTerms('react grid')`.
  test('runs with the trimmed text', async () => {
    const { bindings, intentions } = setup();
    const [step] = (await choose(intentions, 'Search')).intentions;

    const result = await step.action('  react grid ');

    expect(bindings.app.search.apply).toHaveBeenCalledWith({ term: 'react grid' });
    expect(titlesOf(result)).toContain('Sort');
  });

  // [adapted] The function not called is `apply`.
  test('a blank entry asks again with the required message', async () => {
    const { bindings, intentions } = setup();
    const [step] = (await choose(intentions, 'Search')).intentions;

    const result = await step.action('   ');

    expect(bindings.app.search.apply).not.toHaveBeenCalled();
    expect(result.message).toBe('Type some words first');
    expect(titlesOf(result)).toEqual(['Search for the typed words']);
    expect(result.disableInputMatching).toBe(true);
  });
});

describe('moving between states', () => {
  // [same] With no `then`: preview sets the app's previewed result, and the list follows.
  test('entering a panel state opens the side panel and shows only that state', async () => {
    const { intentions } = setup();

    const result = await choose(intentions, 'Preview', { row: '3. CSS grid guide' });

    expect(result.sideEffects).toEqual({ sidecarRenderer: PANEL });
    expect(titlesOf(result)).toEqual(['Next', 'Close preview']);
  });

  // [same]
  test('a command in a panel state keeps the side panel open', async () => {
    const { intentions } = setup();
    const previewing = await choose(intentions, 'Preview', { row: '3. CSS grid guide' });

    const result = await choose(previewing.intentions, 'Next');

    expect(result.sideEffects).toEqual({ sidecarRenderer: PANEL });
  });

  // [same] Close preview clears the app's previewed result; no `then: browsing`.
  test('leaving a panel state closes the side panel', async () => {
    const { intentions } = setup();
    const previewing = await choose(intentions, 'Preview', { row: '3. CSS grid guide' });

    const result = await choose(previewing.intentions, 'Close preview');

    expect(result.sideEffects).toEqual({ closeSidecar: true });
    expect(titlesOf(result)).toContain('Preview');
  });

  // [same]
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
  // [same]
  test('a message is passed on to the palette', async () => {
    const { intentions } = setup({ preview: () => ({ message: 'Previewing' }) });

    const result = await choose(intentions, 'Preview', { row: '3. CSS grid guide' });

    expect(result.message).toBe('Previewing');
  });

  // [adapted] Was "a cancelled run": version 3 has no `isCancelled`; the app didn't change state, so the list is the
  // one it was.
  test('a run that leaves the app as it was stays in the state the command was listed in', async () => {
    const { intentions } = setup({
      refusesPreview: true,
      preview: () => ({ message: 'That result is no longer in the list' })
    });

    const result = await choose(intentions, 'Preview', { row: '3. CSS grid guide' });

    expect(result.message).toBe('That result is no longer in the list');
    expect(titlesOf(result)).toContain('Sort');
    expect(result.sideEffects).toBeUndefined();
  });
});

describe('starting in a state the app names', () => {
  // [adapted] There is no `startState` option: the palette starts in whatever state the app is in. "Starting in
  // previewing" means the app has a result previewed. And where today's resolver returned no rows for a line that
  // doesn't read, the command builder says why (a disabled problem row).
  test("lists that state's commands, and resolves typed lines against them", () => {
    const previewing = setup({ isPreviewed: true }).palette;

    expect(previewing.intentions.map((item) => item.title)).toEqual(['Next', 'Close preview']);
    expect(setup().palette.resolveInput('sort ')).not.toEqual([]);
    expect(previewing.resolveInput('sort ')).toEqual([
      expect.objectContaining({
        group: 'Problem',
        title: '"sort" doesn\'t start a command',
        disabled: true
      })
    ]);
  });

  // [adapted] As above, through the app's state.
  test("a panel state's palette carries its panel", () => {
    expect(setup({ isPreviewed: true }).palette.sidecarRenderer).toBe(PANEL);
  });

  // [same]
  test('a start state without a panel carries none', () => {
    expect(setup().palette.sidecarRenderer).toBeUndefined();
  });

  // [adapted] As above, through the app's state.
  test('moves on from there as from any state', async () => {
    const { palette } = setup({ isPreviewed: true });

    const result = await choose(palette.intentions, 'Close preview');

    expect(titlesOf(result)).toContain('Preview');
  });
});

describe('what the app must supply', () => {
  const load = () => loadCatalog(UNIFIED, setup().bindings);

  // [same]
  test('a renderer for every panel the catalog uses', () => {
    expect(() => buildPalette(load(), { panels: {}, backIntentionId: BACK })).toThrow(
      'Catalog state "previewing" shows panel "sidecar", but the app supplies no renderer for it'
    );
  });

  // [adapted] The message names the derivation instead of buildPalette.
  test('the id of the Back row', () => {
    expect(() => buildPalette(load(), { panels: { sidecar: PANEL } })).toThrow(
      'buildPalette needs backIntentionId'
    );
  });
});

// [dropped] "picker sources receive the catalog facets, for labelling rows": there are no `facets`; a param carries
//   its own label, and a lookup receives `{ command, filled, key }`.
// [dropped] "a state the catalog does not have throws, naming it": there is no `startState` to name.
// [dropped] "a planned state throws, naming it": the same; planned states aren't in the unified sketch.
// [dropped] "side effects apply even when the run is cancelled": version 3 has no `isCancelled`, so it passed by
//   construction, repeating "side effects … are passed on".

// The documented delay, on the path buildPalette ships, so a fast lookup doesn't flash "Loading".
describe('a typed line while its lookup is pending', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('says it is loading only after the delay, and tells subscribers when the delay passes', () => {
    vi.useFakeTimers();
    const { palette } = setup({ facetRows: new Promise(() => {}) });
    const listener = vi.fn();
    palette.resolveInput.subscribe(listener);
    const loadingRows = () =>
      palette.resolveInput('tagged de').filter(({ title }) => title.startsWith('Loading'));

    expect(loadingRows()).toEqual([]);

    vi.advanceTimersByTime(LOADING_DELAY_MS);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(loadingRows().map(({ title }) => title)).toEqual(['Loading tag…']);
  });
});

describe('new: the app changes state on its own', () => {
  // Today a palette in "previewing" stays there if the app closes the preview by itself (an app could keep them in step with
  // `onClose`). Derived from the app's state, the list follows.
  test('the list follows when the preview closes outside the palette', async () => {
    const { app, palette } = setup();
    await choose(palette.intentions, 'Preview', { row: '3. CSS grid guide' });
    expect(palette.listNow().map((item) => item.title)).toEqual(['Next', 'Close preview']);

    app.previewedId = null;

    expect(palette.listNow().map((item) => item.title)).toContain('Preview');
  });
});
