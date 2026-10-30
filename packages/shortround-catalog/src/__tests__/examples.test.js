import { describe, expect, test } from 'vitest';

import { buildPalette, findExampleFailures, loadCatalog, loadExamples } from '../index.js';
import { readFixture } from './fixtures/read-fixture.js';

const noop = () => {};

function buildSearchPalette() {
  const bindings = {
    app: {
      sortOptions: { rows: () => [{ value: 'created-newest', title: 'Created (newest)' }] },
      search: {
        mergeTerms: noop,
        setMatch: noop,
        setSort: noop,
        addFacetValue: noop,
        facetValueRows: () => [{ value: 'react', title: 'react' }]
      },
      results: {
        rows: () => [],
        preview: noop,
        next: noop,
        openInService: noop,
        closePreview: noop,
        previewedHasServiceLink: () => false
      }
    }
  };
  return buildPalette(loadCatalog(readFixture('search-palette.yaml'), bindings), {
    panels: { sidecar: noop },
    backIntentionId: 'back'
  });
}

describe('catalog examples', () => {
  test('every example in the fixture resolves to its meaning', () => {
    const examples = loadExamples(readFixture('search-palette.examples.yaml'));

    expect(findExampleFailures(buildSearchPalette(), examples)).toEqual([]);
  });

  test('an example that resolves to something else is reported with what it got', () => {
    const examples = loadExamples(
      'examples:\n  - say: tag react\n    means: app.facet.tags::design\n'
    );

    expect(findExampleFailures(buildSearchPalette(), examples)).toEqual([
      { say: 'tag react', means: 'app.facet.tags::design', got: 'app.facet.tags::react' }
    ]);
  });

  test('an example that resolves to nothing is reported', () => {
    const examples = loadExamples(
      'examples:\n  - say: colour blue\n    means: app.facet.colour::blue\n'
    );

    expect(findExampleFailures(buildSearchPalette(), examples)).toEqual([
      { say: 'colour blue', means: 'app.facet.colour::blue', got: undefined }
    ]);
  });

  test("an example of a line names each command's row, in order", () => {
    const examples = loadExamples(
      [
        'examples:',
        '  - say: tag react sort created newest',
        '    means: [app.facet.tags::react, app.sort::created-newest]'
      ].join('\n')
    );

    expect(findExampleFailures(buildSearchPalette(), examples)).toEqual([]);
  });

  test('a line example that resolves to something else is reported as written', () => {
    const examples = loadExamples(
      [
        'examples:',
        '  - say: tag react sort created newest',
        '    means: [app.sort::created-newest, app.facet.tags::react]'
      ].join('\n')
    );

    expect(findExampleFailures(buildSearchPalette(), examples)).toEqual([
      {
        say: 'tag react sort created newest',
        means: ['app.sort::created-newest', 'app.facet.tags::react'],
        got: 'app.facet.tags::react + app.sort::created-newest'
      }
    ]);
  });

  test('a malformed examples file says which field is wrong', () => {
    expect(() => loadExamples('examples:\n  - say: tag react\n    meaning: x\n')).toThrow(
      /Examples are malformed.*mean/s
    );
  });
});
