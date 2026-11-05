import { describe, expect, test, vi } from 'vitest';

import { buildPalette } from '../build-palette.js';
import { readFixture } from './fixtures/read-fixture.js';

const UNIFIED = readFixture('search-palette-v3.yaml');
import { loadCatalog } from '../load-catalog.js';

// The same unified catalog, read by the command-builder engine (typed lines), in the states the app is in.
function setup({ isPreviewed = false } = {}) {
  const app = { previewedId: isPreviewed ? 'w2' : null };
  const bindings = {
    app: {
      conditions: { previewed: () => app.previewedId !== null },
      sortOptions: {
        rows: () => [
          { value: 'relevance', title: 'Relevance' },
          { value: 'created-newest', title: 'Created (newest)' }
        ]
      },
      search: { apply: vi.fn(), facetValueRows: () => [{ value: 'design', title: 'design' }] },
      results: {
        rows: () => [{ value: 'w2', title: '3. CSS grid guide', aliases: ['3'] }],
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
  const palette = buildPalette(loadCatalog(UNIFIED, bindings), {
    panels: { sidecar: () => 'panel' },
    backIntentionId: 'back'
  });
  return { app, bindings, palette };
}

const commandRows = (rows) => rows.filter((row) => row.group === 'Commands');

describe('command-builder on the unified catalog', () => {
  test('one typed line fills several args of the compound command, and runs it once', async () => {
    const { bindings, palette } = setup();
    // was: search react sort created tagged design (a hint ends the term)
    const [top] = commandRows(palette.resolveInput('search react with sort created tagged design'));

    expect(top.title).toBe('Search: react · Sort: Created (newest) · Tag: design');
    await top.action('');

    expect(bindings.app.search.apply).toHaveBeenCalledTimes(1);
    expect(bindings.app.search.apply).toHaveBeenCalledWith({
      term: 'react',
      sort: 'created-newest',
      tags: ['design']
    });
  });

  test('a run that changes the app state brings the other state, in both modes', async () => {
    const { palette } = setup();
    const [preview] = commandRows(palette.resolveInput('preview 3'));

    const result = await preview.action('');

    expect(result.intentions.map(({ title }) => title)).toEqual(['Next', 'Close preview']);
    expect(commandRows(result.resolveInput('sort created'))).toEqual([]);
  });
});

// A command with nothing to type is complete by its name.
describe('commands with no params', () => {
  test('are runnable typed-line rows', async () => {
    const { bindings, palette } = setup({ isPreviewed: true });
    const [next] = commandRows(palette.resolveInput('next'));

    expect(next).toEqual(expect.objectContaining({ title: 'Next', disabled: false }));
    await next.action('');
    expect(bindings.app.results.next).toHaveBeenCalledWith({});
  });
});
