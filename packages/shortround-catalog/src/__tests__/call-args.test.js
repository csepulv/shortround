import { describe, expect, test, vi } from 'vitest';

import { buildPalette, loadCatalog } from '../index.js';
import { readFixture } from './fixtures/read-fixture.js';

const CATALOG = readFixture('call-args.yaml');

function setup(catalog = CATALOG) {
  const bindings = {
    app: {
      search: {
        merge: vi.fn(),
        drop: vi.fn(),
        setMatch: vi.fn(),
        note: vi.fn(),
        setSort: vi.fn(),
        addFacetValue: vi.fn(),
        clearFilters: vi.fn(),
        activeFilterRows: () => [
          { key: 'tags::react', value: { facet: 'tags', value: 'react' }, title: 'Tag: react' }
        ],
        sortRows: () => [{ value: 'created-newest', title: 'Created newest' }],
        facetValueRows: () => [{ value: 'design', title: 'design' }]
      }
    }
  };
  const palette = buildPalette(loadCatalog(catalog, bindings), { backIntentionId: 'back' });
  return { search: bindings.app.search, palette };
}

async function runLine(palette, line) {
  const [row] = palette.resolveInput(line);
  await row.action(line);
}

// A command that asks for nothing is run from the list, not from a typed line.
async function runFromList(palette, title) {
  await palette.intentions.find((intention) => intention.title === title).action('');
}

describe("a command's `args` say how its function is called", () => {
  test('an object built from the typed text (S1)', async () => {
    const { search, palette } = setup();

    await runLine(palette, 'search react grid');

    expect(search.merge).toHaveBeenCalledExactlyOnceWith({ terms: 'react grid' });
  });

  test("two arguments taken from a picked row's fields (S2)", async () => {
    const { search, palette } = setup();

    await runLine(palette, 'drop filter tag react');

    expect(search.drop).toHaveBeenCalledExactlyOnceWith('tags', 'react');
  });

  test('a fixed value', async () => {
    const { search, palette } = setup();

    await runFromList(palette, 'Match all');

    expect(search.setMatch).toHaveBeenCalledExactlyOnceWith('all');
  });

  test('strings other than $key, $value and $value.<field> are literals', async () => {
    const { search, palette } = setup();

    await runFromList(palette, 'Price note');

    expect(search.note).toHaveBeenCalledExactlyOnceWith('$price', 3, { label: 'plain' });
  });
});

describe('without `args`, the function gets the natural call', () => {
  test('the asked value', async () => {
    const { search, palette } = setup();

    await runLine(palette, 'sort created newest');

    expect(search.setSort).toHaveBeenCalledExactlyOnceWith('created-newest');
  });

  test('the forEach key, then the asked value', async () => {
    const { search, palette } = setup();

    await runLine(palette, 'tag design');

    expect(search.addFacetValue).toHaveBeenCalledExactlyOnceWith('tags', 'design');
  });

  test('nothing, for a command that neither repeats nor asks', async () => {
    const { search, palette } = setup();

    await runFromList(palette, 'Clear filters');

    expect(search.clearFilters).toHaveBeenCalledExactlyOnceWith();
  });
});

describe('references, at their edges', () => {
  test('$key and $value in the order `args` gives, not the default order', async () => {
    const catalog = CATALOG.replace(
      'run: app.search.addFacetValue\n',
      'run: app.search.addFacetValue\n        args: [$value, $key]\n'
    );
    const { search, palette } = setup(catalog);

    await runLine(palette, 'tag design');

    expect(search.addFacetValue).toHaveBeenCalledExactlyOnceWith('design', 'tags');
  });

  test("$value.<field> reads the value's own fields, not inherited ones", async () => {
    const catalog = CATALOG.replace(
      'args: [$value.facet, $value.value]',
      'args: [$value.facet, $value.constructor]'
    );
    const { search, palette } = setup(catalog);

    await runLine(palette, 'drop filter tag react');

    expect(search.drop).toHaveBeenCalledExactlyOnceWith('tags', undefined);
  });
});
