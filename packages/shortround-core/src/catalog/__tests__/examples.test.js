// A version 3 catalog's examples: each typed line must run, first, the call it means (one command and its args).
import { describe, expect, test, vi } from 'vitest';

import { buildPalette, findExampleFailures, loadCatalog, loadExamples } from '../index.js';
import { readFixture } from './fixtures/read-fixture.js';

function buildSearchPalette() {
  const bindings = {
    app: {
      conditions: { previewed: () => false },
      sortOptions: {
        rows: () => [
          { value: 'relevance', title: 'Relevance' },
          { value: 'created-newest', title: 'Created (newest)' }
        ]
      },
      search: { apply: vi.fn(), facetValueRows: () => [{ value: 'design', title: 'design' }] },
      results: {
        rows: () => [{ value: 'w2', title: '3. CSS grid guide', aliases: ['3'] }],
        preview: vi.fn(),
        next: vi.fn(),
        openInService: vi.fn(),
        closePreview: vi.fn(),
        previewedHasServiceLink: () => false
      }
    }
  };
  return buildPalette(loadCatalog(readFixture('search-palette-v3.yaml'), bindings), {
    panels: { sidecar: () => 'panel' },
    backIntentionId: 'back'
  });
}

const examplesOf = (lines) => loadExamples(['examples:', ...lines].join('\n'));

describe('version 3 examples', () => {
  test('every example in the fixture runs what it means', () => {
    const examples = loadExamples(readFixture('search-palette-v3.examples.yaml'));

    expect(findExampleFailures(buildSearchPalette(), examples)).toEqual([]);
  });

  test("the args' order doesn't matter", () => {
    const examples = examplesOf([
      '  - say: search grid with sort created',
      '    means: { search: { sort: created-newest, term: grid } }'
    ]);

    expect(findExampleFailures(buildSearchPalette(), examples)).toEqual([]);
  });

  // The palette's rows for a line, given exactly: a status row (loading, keep typing) or a next step has no call.
  const paletteShowing = (rows) => ({ resolveInput: () => rows });
  const searchGrid = { command: 'search', run: 'app.search.apply', args: { term: 'grid' } };
  const searchGridExample = examplesOf([
    '  - say: search grid',
    '    means: { search: { term: grid } }'
  ]);

  test('rows above the command row (loading, keep typing) are passed over', () => {
    const palette = paletteShowing([
      { id: 'status:tags', title: 'Loading tags…', disabled: true },
      { id: 'command:Search: grid', title: 'Search: grid', call: searchGrid }
    ]);
    expect(findExampleFailures(palette, searchGridExample)).toEqual([]);
  });

  test("a disabled command row runs nothing (Enter completes instead), so it doesn't count", () => {
    const palette = paletteShowing([
      { id: 'next:with', title: 'with', completion: 'search grid with ' },
      { id: 'command:Search: grid', title: 'Search: grid', disabled: true, call: searchGrid }
    ]);
    expect(findExampleFailures(palette, searchGridExample)).toEqual([
      { say: 'search grid', means: { search: { term: 'grid' } }, got: undefined }
    ]);
  });

  test('an example that runs something else is reported with what it runs', () => {
    const examples = examplesOf([
      '  - say: search react grid',
      '    means: { search: { term: react } }'
    ]);

    expect(findExampleFailures(buildSearchPalette(), examples)).toEqual([
      {
        say: 'search react grid',
        means: { search: { term: 'react' } },
        got: { search: { term: 'react grid' } }
      }
    ]);
  });

  test('an example that runs nothing is reported', () => {
    const examples = examplesOf([
      '  - say: colour blue',
      '    means: { search: { colour: blue } }'
    ]);

    expect(findExampleFailures(buildSearchPalette(), examples)).toEqual([
      { say: 'colour blue', means: { search: { colour: 'blue' } }, got: undefined }
    ]);
  });

  test('`means` names one command', () => {
    expect(() =>
      examplesOf([
        '  - say: search grid',
        '    means: { search: { term: grid }, preview: { result: w2 } }'
      ])
    ).toThrow(/Examples are malformed[\s\S]*one command/);
  });
});
