import { describe, expect, test, vi } from 'vitest';

import { buildPalette, loadCatalog } from '../index.js';
import { readFixture } from './fixtures/read-fixture.js';

const CATALOG = readFixture('search-palette.yaml');

function setup() {
  const bindings = {
    app: {
      sortOptions: {
        rows: () => [
          { value: 'created-newest', title: 'Created (newest)' },
          { value: 'created-oldest', title: 'Created (oldest)' },
          { value: 'relevance', title: 'Relevance' }
        ]
      },
      search: {
        mergeTerms: vi.fn(),
        setMatch: vi.fn(),
        setSort: vi.fn(),
        addFacetValue: vi.fn(),
        facetValueRows: ({ key }) =>
          key === 'tags'
            ? [
                { value: 'react', title: 'react' },
                { value: 'design', title: 'design', aliases: ['ui'] }
              ]
            : [{ value: 'Last 7 days', title: 'Last 7 days' }]
      },
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
  const palette = buildPalette(loadCatalog(CATALOG, bindings), {
    panels: { sidecar: () => 'panel' },
    backIntentionId: 'back'
  });
  return { bindings, palette };
}

const titlesFor = (palette, text) => palette.resolveInput(text).map((row) => row.title);

describe('resolving one typed line', () => {
  test('command words and a value resolve to one row for that value', () => {
    const { palette } = setup();

    expect(titlesFor(palette, 'tag rea')).toEqual(['Tag: react']);
  });

  test('command words match in any case, by alias too', () => {
    const { palette } = setup();

    expect(titlesFor(palette, 'TAGGED react')).toEqual(['Tag: react']);
  });

  test('every typed value word must start a word of the row or its aliases', () => {
    const { palette } = setup();

    expect(titlesFor(palette, 'sort created new')).toEqual(['Sort: Created (newest)']);
    expect(titlesFor(palette, 'sort created')).toEqual([
      'Sort: Created (newest)',
      'Sort: Created (oldest)'
    ]);
    expect(titlesFor(palette, 'tag ui')).toEqual(['Tag: design']);
  });

  test('command words and a space list every value; without the space they list nothing yet', () => {
    const { palette } = setup();

    expect(titlesFor(palette, 'sort ')).toEqual([
      'Sort: Created (newest)',
      'Sort: Created (oldest)',
      'Sort: Relevance'
    ]);
    expect(titlesFor(palette, 'sort')).toEqual([]);
  });

  test('a text command takes the rest of the line as its text', () => {
    const { palette } = setup();

    expect(palette.resolveInput('search React Grid').map(({ id, title }) => [id, title])).toEqual([
      ['app.search::text', 'Search: React Grid']
    ]);
  });

  test('a multi-word facet title is matched whole', () => {
    const { palette } = setup();

    expect(titlesFor(palette, 'bookmark age last 7')).toEqual(['Bookmark age: Last 7 days']);
  });

  test('text that starts no command resolves to nothing', () => {
    const { palette } = setup();

    expect(titlesFor(palette, 'react grid')).toEqual([]);
    expect(titlesFor(palette, '   ')).toEqual([]);
  });

  test('a command without a step adds no rows', () => {
    const { palette } = setup();

    expect(titlesFor(palette, 'match any ')).toEqual([]);
  });
});

describe('choosing a resolved row', () => {
  test('runs the command with the row value and returns to the state list', async () => {
    const { bindings, palette } = setup();
    const [row] = palette.resolveInput('tag react');

    const result = await row.action('tag react');

    expect(bindings.app.search.addFacetValue).toHaveBeenCalledWith('tags', 'react');
    expect(result.intentions.map((item) => item.title)).toContain('Sort');
  });

  test('runs a text command with the typed text', async () => {
    const { bindings, palette } = setup();
    const [row] = palette.resolveInput('search react grid');

    await row.action('search react grid');

    expect(bindings.app.search.mergeTerms).toHaveBeenCalledWith('react grid');
  });

  test('ids name the command and the row, and group and icon come from the command', () => {
    const { palette } = setup();

    expect(palette.resolveInput('sort relevance')[0]).toMatchObject({
      id: 'app.sort::relevance',
      group: 'Refine',
      icon: 'settings'
    });
  });
});

describe('resolvers travel with their lists', () => {
  test('each state result carries the resolver for the state it shows', async () => {
    const { palette } = setup();
    const [row] = palette.resolveInput('sort relevance');

    const result = await row.action('');

    expect(result.resolveInput('tag react').map((item) => item.title)).toEqual(['Tag: react']);
  });

  test('picker lists and typed-text steps carry no resolver', async () => {
    const { palette } = setup();
    const sort = palette.intentions.find((item) => item.title === 'Sort');
    const search = palette.intentions.find((item) => item.title === 'Search');

    expect((await sort.action('')).resolveInput).toBeUndefined();
    expect((await search.action('')).resolveInput).toBeUndefined();
  });
});

describe('overlapping command words', () => {
  const overlapping = () => {
    const bindings = {
      app: {
        results: {
          rows: () => [{ value: 'c1', title: '2. Chat about tables' }],
          openAddress: vi.fn(),
          openInService: vi.fn()
        }
      }
    };
    return buildPalette(loadCatalog(readFixture('overlapping-words.yaml'), bindings), {
      backIntentionId: 'back'
    });
  };

  test('the longest command words win', () => {
    expect(titlesFor(overlapping(), 'open in service 2')).toEqual([
      'Open in service: 2. Chat about tables'
    ]);
  });

  test('the shorter command still matches when its words are all that start the line', () => {
    expect(titlesFor(overlapping(), 'open example.com')).toEqual(['Open: example.com']);
  });
});

test('a picker whose source answers asynchronously resolves nothing while typing', () => {
  const bindings = {
    app: {
      results: {
        rows: async () => [{ value: 'c1', title: '2. Chat' }],
        openAddress: vi.fn(),
        openInService: vi.fn()
      }
    }
  };
  const palette = buildPalette(loadCatalog(readFixture('overlapping-words.yaml'), bindings), {
    backIntentionId: 'back'
  });

  expect(palette.resolveInput('open in service ')).toEqual([]);
});

describe('near neighbours (code review findings 1, 2, 9)', () => {
  const withRows = ({ tags = [], results = [] }) => {
    const bindings = {
      app: {
        sortOptions: { rows: () => [] },
        search: {
          mergeTerms: vi.fn(),
          setMatch: vi.fn(),
          setSort: vi.fn(),
          addFacetValue: vi.fn(),
          facetValueRows: () => tags
        },
        results: {
          rows: () => results,
          preview: vi.fn(),
          next: vi.fn(),
          openInService: vi.fn(),
          closePreview: vi.fn(),
          previewedHasServiceLink: () => false
        }
      }
    };
    const palette = buildPalette(loadCatalog(CATALOG, bindings), {
      panels: { sidecar: () => 'panel' },
      backIntentionId: 'back'
    });
    return { bindings, palette };
  };

  test('an exact value comes before values it only starts', () => {
    const { palette } = withRows({
      tags: [
        { value: 'react-native', title: 'react-native' },
        { value: 'react', title: 'react' }
      ]
    });

    expect(titlesFor(palette, 'tag react')).toEqual(['Tag: react', 'Tag: react-native']);
  });

  test('whole words come before prefixes, keeping the source order within each', () => {
    const { palette } = withRows({
      results: [
        { value: 'r1', title: '1. 2024 review', aliases: ['1'] },
        { value: 'r2', title: '2. Chat about tables', aliases: ['2'] }
      ]
    });

    expect(titlesFor(palette, 'preview 2')[0]).toBe('Preview: 2. Chat about tables');
  });

  test('a value typed with a hyphen or a dot matches the row', () => {
    const { palette } = withRows({
      tags: [
        { value: 'react-native', title: 'react-native' },
        { value: 'next.js', title: 'next.js' }
      ]
    });

    expect(titlesFor(palette, 'tag react-native')).toEqual(['Tag: react-native']);
    expect(titlesFor(palette, 'tag next.js')).toEqual(['Tag: next.js']);
  });

  test('a text command keeps the text as typed, inner spaces included', () => {
    const { palette } = withRows({});

    expect(palette.resolveInput('search react   grid')[0].title).toBe('Search: react   grid');
  });
});

test('an async source that fails while typing leaves no unhandled rejection', async () => {
  const bindings = {
    app: {
      results: {
        rows: async () => {
          throw new Error('network down');
        },
        openAddress: vi.fn(),
        openInService: vi.fn()
      }
    }
  };
  const palette = buildPalette(loadCatalog(readFixture('overlapping-words.yaml'), bindings), {
    backIntentionId: 'back'
  });

  expect(palette.resolveInput('open in service ')).toEqual([]);
  await new Promise((resolve) => setTimeout(resolve, 0));
});
