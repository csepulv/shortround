import { describe, expect, test, vi } from 'vitest';

import { buildPalette, loadCatalog } from '../index.js';
import { readFixture } from './fixtures/read-fixture.js';

const CATALOG = readFixture('several-commands.yaml');

const FACET_ROWS = {
  content_format: [
    { value: 'chat', title: 'chat' },
    { value: 'link', title: 'link' }
  ],
  kinds: [
    { value: 'library', title: 'library' },
    { value: 'tool', title: 'tool' }
  ],
  tags: [
    { value: 'react-native', title: 'react-native' },
    { value: 'react', title: 'react' },
    { value: 'design', title: 'design' }
  ]
};

// Named the way a real app names them: with another command's words in front.
const ACTIVE_FILTER_ROWS = [
  { key: 'tags::react', value: { facet: 'tags', value: 'react' }, title: 'Tag: react' },
  { key: 'kinds::tool', value: { facet: 'kinds', value: 'tool' }, title: 'Kind: tool' }
];

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
        facetValueRows: ({ key }) => FACET_ROWS[key],
        activeFilterRows: () => ACTIVE_FILTER_ROWS,
        dropFilter: vi.fn()
      },
      results: {
        rows: () => [{ value: 'w2', title: '3. CSS grid guide', aliases: ['3'] }],
        preview: vi.fn(),
        closePreview: vi.fn()
      }
    }
  };
  const palette = buildPalette(loadCatalog(CATALOG, bindings), {
    panels: { sidecar: () => 'panel' },
    backIntentionId: 'back'
  });
  return { bindings, palette };
}

const titlesFor = (text) =>
  setup()
    .palette.resolveInput(text)
    .map((row) => row.title);

describe('a line of several commands resolves to one row that reads it back', () => {
  test('two commands, in the order typed', () => {
    expect(titlesFor('kind library sort created newest')).toEqual([
      'Kind: library · Sort: Created (newest)'
    ]);
    expect(titlesFor('sort created newest kind library')).toEqual([
      'Sort: Created (newest) · Kind: library'
    ]);
  });

  test('quotes end a search text, so more commands can follow it', () => {
    expect(titlesFor('search "react grid" kind library')).toEqual([
      'Search: react grid · Kind: library'
    ]);
  });

  test('an unquoted search text takes the rest of the line, as one command', () => {
    expect(titlesFor('search react grid kind library')).toEqual([
      'Search: react grid kind library'
    ]);
  });

  test('a single command with a quoted value reads without the quotes', () => {
    expect(titlesFor('search "react grid"')).toEqual(['Search: react grid']);
    expect(titlesFor('tag "react"')).toEqual(['Tag: react', 'Tag: react-native']);
  });

  test('words inside quotes never start a command', () => {
    expect(titlesFor('search "sort algorithms" kind library')).toEqual([
      'Search: sort algorithms · Kind: library'
    ]);
  });

  test('a quoted value works for a picker command too', () => {
    expect(titlesFor('tag "react" kind library')).toEqual(['Tag: react · Kind: library']);
  });

  test('when two commands share their words, the value decides', () => {
    expect(titlesFor('type library tag design')).toEqual(['Kind: library · Tag: design']);
    expect(titlesFor('type chat tag design')).toEqual(['Type: chat · Tag: design']);
  });

  test('an earlier command takes its best match: an exact value before values it starts', () => {
    expect(titlesFor('tag react kind library')).toEqual(['Tag: react · Kind: library']);
  });

  test('a command without a step can be part of a line', () => {
    expect(titlesFor('match any tag design')).toEqual(['Match any · Tag: design']);
  });
});

describe("a value may contain another command's words", () => {
  test('one command whose value holds them reads as one command, as before lines existed', () => {
    expect(titlesFor('drop tag react')).toEqual(['Drop filter: Tag: react']);
  });

  test('such a command can still be part of a line', () => {
    expect(titlesFor('drop tag react kind library')).toEqual([
      'Drop filter: Tag: react · Kind: library'
    ]);
  });

  test('an unquoted search text that starts with command words takes the rest of the line', () => {
    expect(titlesFor('search sort algorithms')).toEqual(['Search: sort algorithms']);
  });

  test('when both readings work, the line splits at the command words', () => {
    const { bindings } = setup();
    bindings.app.search.facetValueRows = ({ key }) =>
      key === 'tags'
        ? [...FACET_ROWS.tags, { value: 'design kind library', title: 'design kind library' }]
        : FACET_ROWS[key];
    const palette = buildPalette(loadCatalog(CATALOG, bindings), {
      panels: { sidecar: () => 'panel' },
      backIntentionId: 'back'
    });

    expect(palette.resolveInput('tag design kind library')[0].title).toBe(
      'Tag: design · Kind: library'
    );
  });
});

describe('the last command lists its values while it is typed', () => {
  test('its words and a space list every value, each with the commands before it', () => {
    expect(titlesFor('kind library sort ')).toEqual([
      'Kind: library · Sort: Created (newest)',
      'Kind: library · Sort: Created (oldest)',
      'Kind: library · Sort: Relevance'
    ]);
  });

  test('more words narrow them', () => {
    expect(titlesFor('kind library sort created')).toEqual([
      'Kind: library · Sort: Created (newest)',
      'Kind: library · Sort: Created (oldest)'
    ]);
  });
});

describe('choosing a line row', () => {
  // Records each call in order; `outcomes` lets a command return a message or cancel.
  function setupRecording(outcomes = {}) {
    const calls = [];
    const record =
      (name) =>
      (...args) => {
        calls.push([name, ...args]);
        return outcomes[name];
      };
    const { bindings } = setup();
    Object.assign(bindings.app.search, {
      mergeTerms: record('mergeTerms'),
      setMatch: record('setMatch'),
      setSort: record('setSort'),
      addFacetValue: record('addFacetValue')
    });
    const palette = buildPalette(loadCatalog(CATALOG, bindings), {
      panels: { sidecar: () => 'panel' },
      backIntentionId: 'back'
    });
    return { calls, palette };
  }

  test('runs every command, in the order typed, each with its value', async () => {
    const { calls, palette } = setupRecording();
    const [row] = palette.resolveInput('search "react grid" kind library sort created newest');

    await row.action('');

    expect(calls).toEqual([
      ['mergeTerms', 'react grid'],
      ['addFacetValue', 'kinds', 'library'],
      ['setSort', 'created-newest']
    ]);
  });

  test('a command without a step runs with its fixed arguments', async () => {
    const { calls, palette } = setupRecording();
    const [row] = palette.resolveInput('match any tag design');

    await row.action('');

    expect(calls).toEqual([
      ['setMatch', 'any'],
      ['addFacetValue', 'tags', 'design']
    ]);
  });

  test("returns to the state's list, with the commands' messages", async () => {
    const { palette } = setupRecording({
      addFacetValue: { message: 'Added library' },
      setSort: { message: 'Sorted' }
    });
    const [row] = palette.resolveInput('kind library sort relevance');

    const result = await row.action('');

    expect(result.message).toBe('Added library; Sorted');
    expect(result.intentions.map((item) => item.title)).toContain('Sort');
    expect(result.resolveInput('tag design').map((item) => item.title)).toEqual(['Tag: design']);
  });

  test('a cancelled command stops the line', async () => {
    const { calls, palette } = setupRecording({
      setMatch: { message: 'Match is locked', isCancelled: true }
    });
    const [row] = palette.resolveInput('match any tag design');

    const result = await row.action('');

    expect(calls).toEqual([['setMatch', 'any']]);
    expect(result.message).toBe('Match is locked');
  });

  test('the id names every command and row; group and icon come from the first command', () => {
    const { palette } = setup();

    expect(palette.resolveInput('search "react grid" kind library')[0]).toMatchObject({
      id: 'app.search::text + app.facet.kinds::library',
      group: 'Search',
      icon: 'search'
    });
  });
});

describe('applied values (the cart rule)', () => {
  // created-newest is the current sort and library is already in the Kind filter.
  function setupApplied() {
    const calls = [];
    const record =
      (name) =>
      (...args) => {
        calls.push([name, ...args]);
      };
    const appliedSort = [
      { value: 'created-newest', title: 'Created (newest)', isApplied: true },
      { value: 'created-oldest', title: 'Created (oldest)' },
      { value: 'relevance', title: 'Relevance' }
    ];
    const appliedFacets = {
      ...FACET_ROWS,
      content_format: FACET_ROWS.content_format.map((row) => ({ ...row, isApplied: true })),
      kinds: [
        { value: 'library', title: 'library', isApplied: true },
        { value: 'tool', title: 'tool' }
      ]
    };
    const bindings = {
      app: {
        sortOptions: { rows: () => appliedSort },
        search: {
          mergeTerms: record('mergeTerms'),
          setMatch: record('setMatch'),
          setSort: record('setSort'),
          addFacetValue: record('addFacetValue'),
          facetValueRows: ({ key }) => appliedFacets[key],
          activeFilterRows: () => ACTIVE_FILTER_ROWS,
          dropFilter: record('dropFilter')
        },
        results: { rows: () => [], preview: vi.fn(), closePreview: vi.fn() }
      }
    };
    const palette = buildPalette(loadCatalog(CATALOG, bindings), {
      panels: { sidecar: () => 'panel' },
      backIntentionId: 'back'
    });
    return { calls, palette };
  }

  const titles = (rows) => rows.map((row) => row.title);

  test("a picker doesn't offer applied values", async () => {
    const { palette } = setupApplied();
    const sort = palette.intentions.find((item) => item.title === 'Sort');

    const result = await sort.action('');

    expect(titles(result.intentions)).toEqual(['Created (oldest)', 'Relevance']);
  });

  test('a picker whose values are all applied says so', async () => {
    const { palette } = setupApplied();
    const type = palette.intentions.find((item) => item.title === 'Type');

    const result = await type.action('');

    expect(result.message).toBe('No type values for this search');
  });

  test("a single command doesn't offer applied values either", () => {
    const { palette } = setupApplied();

    expect(titles(palette.resolveInput('sort '))).toEqual([
      'Sort: Created (oldest)',
      'Sort: Relevance'
    ]);
    expect(titles(palette.resolveInput('sort created newest'))).toEqual([]);
  });

  // An earlier command can undo what is applied ("clear filters kind library"), so every command runs;
  // the app's commands change nothing for a value already in effect (code review M2, operator: option 1).
  test('in a line, an applied value reads "(already set)" and still runs', async () => {
    const { calls, palette } = setupApplied();
    const [row] = palette.resolveInput('tag design sort created newest');

    expect(row.title).toBe('Tag: design · Sort: Created (newest) (already set)');

    await row.action('');

    expect(calls).toEqual([
      ['addFacetValue', 'tags', 'design'],
      ['setSort', 'created-newest']
    ]);
  });

  test('an applied value earlier in the line reads the same', () => {
    const { palette } = setupApplied();

    expect(titles(palette.resolveInput('kind library tag design'))).toEqual([
      'Kind: library (already set) · Tag: design'
    ]);
  });

  test('the last command lists only values not yet applied, until one is typed', () => {
    const { palette } = setupApplied();

    expect(titles(palette.resolveInput('tag design sort '))).toEqual([
      'Tag: design · Sort: Created (oldest)',
      'Tag: design · Sort: Relevance'
    ]);
  });
});

describe('a line with any command it cannot read resolves to nothing', () => {
  test('words that start no command', () => {
    expect(titlesFor('kind library colour blue')).toEqual([]);
  });

  test('a picker command with no value before the next command', () => {
    expect(titlesFor('kind sort created')).toEqual([]);
  });

  test('a value that matches nothing, last or earlier in the line', () => {
    expect(titlesFor('kind library tag nothing')).toEqual([]);
    expect(titlesFor('tag nothing kind library')).toEqual([]);
  });

  test('words after a quoted value that start no command', () => {
    expect(titlesFor('search "react grid" colour blue')).toEqual([]);
    expect(titlesFor('search "react grid" kind nothing')).toEqual([]);
  });

  test('a quoted value with more value words around it', () => {
    expect(titlesFor('tag "react" design kind library')).toEqual([]);
    expect(titlesFor('tag design "react" kind library')).toEqual([]);
  });

  test('a command without a step, followed by words of its own', () => {
    expect(titlesFor('match any extra tag design')).toEqual([]);
  });

  test('a command that leaves the state', () => {
    expect(titlesFor('kind library preview 3')).toEqual([]);
  });
});

describe('typing in progress (code review)', () => {
  test('a quoted value is read without its outer spaces (L1)', () => {
    expect(titlesFor('search " react "')).toEqual(['Search: react']);
  });

  test('an opening quote lists the values, as a space does (L2)', () => {
    expect(titlesFor('tag "')).toEqual(['Tag: react-native', 'Tag: react', 'Tag: design']);
    expect(titlesFor('kind library sort "')).toHaveLength(3);
  });

  test('a long line that never reads stays cheap: each piece is read once, not once per split (M1)', () => {
    const { bindings } = setup();
    let pickerCalls = 0;
    const facetValueRows = bindings.app.search.facetValueRows;
    bindings.app.search.facetValueRows = (options) => {
      pickerCalls += 1;
      return facetValueRows(options);
    };
    const palette = buildPalette(loadCatalog(CATALOG, bindings), {
      panels: { sidecar: () => 'panel' },
      backIntentionId: 'back'
    });

    expect(palette.resolveInput(`${'kind library '.repeat(12)}colour`)).toEqual([]);
    expect(pickerCalls).toBeLessThan(300);
  });
});
