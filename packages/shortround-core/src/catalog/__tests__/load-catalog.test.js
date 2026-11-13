// Catalog format version 3: one catalog for picking rows and typed whole commands. Loading replaces every code path
// (run, lookup, current, when) with the app's function, and a mistake fails here, naming where it is.
import { describe, expect, test, vi } from 'vitest';

import { checkCatalog, loadCatalog } from '../load-catalog.js';
import { readFixture } from './fixtures/read-fixture.js';

const LINKS = readFixture('links-search.yaml');

// Every path the links app's catalog names, as the app's functions.
function makeLinksBindings() {
  return {
    links: {
      conditions: { previewed: vi.fn(() => false) },
      search: {
        apply: vi.fn(),
        replaceWith: vi.fn(),
        clearFilters: vi.fn(),
        clearSearch: vi.fn(),
        dropFilter: vi.fn(),
        facetValueRows: vi.fn(() => []),
        activeFilterRows: vi.fn(() => [])
      },
      sortOptions: { rows: vi.fn(() => []) },
      searchResults: {
        previewById: vi.fn(),
        openById: vi.fn(),
        openInServiceById: vi.fn(),
        rows: vi.fn(() => []),
        chatWithServiceLinkRows: vi.fn(() => []),
        previewedId: vi.fn(() => undefined),
        previewedHasServiceLink: vi.fn(() => false),
        showNext: vi.fn(),
        showPrevious: vi.fn(),
        closePreview: vi.fn()
      }
    }
  };
}

// The smallest valid catalog; each mistake below changes one thing in it.
const minimal = ({
  groups = 'search: { label: Search, icon: search }',
  states = 'browsing: { when: app.conditions.browsing, commands: [find] }',
  command = 'find: { label: Find, group: search, run: app.find, params: { term: { label: Term, default: true, argSource: { freeform: true, type: text } } } }',
  extra = ''
} = {}) => `version: 3
app: app
groups:
  ${groups}
states:
  ${states}
commands:
  ${command}
${extra}`;

const appBindings = () => ({
  app: { conditions: { browsing: () => true }, find: vi.fn(), tags: vi.fn(() => []) }
});

describe("the links app's catalog", () => {
  test('loads, with every path replaced by the app function it names', () => {
    const bindings = makeLinksBindings();
    const catalog = loadCatalog(LINKS, bindings);

    expect(catalog.app).toBe('links');
    expect(catalog.commands.search.call).toBe(bindings.links.search.apply);
    expect(catalog.commands.search.params.tags.source).toBe(bindings.links.search.facetValueRows);
    expect(catalog.commands.open.params.result.currentOf).toBe(
      bindings.links.searchResults.previewedId
    );
  });

  test('keeps its groups in order, and its states and commands by name', () => {
    const catalog = loadCatalog(LINKS, makeLinksBindings());

    expect(Object.keys(catalog.groups)).toEqual(['search', 'refine', 'preview', 'results']);
    expect(Object.keys(catalog.states)).toEqual(['browsing', 'previewing']);
    expect(catalog.states.previewing.commands).toEqual([
      'next',
      'previous',
      'open',
      'openInService',
      'closePreview'
    ]);
  });

  test('a state holds while its `when` holds, by asking the app', () => {
    const bindings = makeLinksBindings();
    const catalog = loadCatalog(LINKS, bindings);

    expect(catalog.states.browsing.holds()).toBe(true);
    expect(catalog.states.previewing.holds()).toBe(false);
    bindings.links.conditions.previewed.mockReturnValue(true);
    expect(catalog.states.browsing.holds()).toBe(false);
    expect(catalog.states.previewing.holds()).toBe(true);
  });

  test("a command's `when` combines the app's conditions", () => {
    const bindings = makeLinksBindings();
    const { openInService } = loadCatalog(LINKS, bindings).commands;

    expect(openInService.isAvailable()).toBe(true);
    bindings.links.conditions.previewed.mockReturnValue(true);
    expect(openInService.isAvailable()).toBe(false);
    bindings.links.searchResults.previewedHasServiceLink.mockReturnValue(true);
    expect(openInService.isAvailable()).toBe(true);
  });

  test('shared definitions merge in (YAML merge keys), and `x-` keys are left out', () => {
    const catalog = loadCatalog(LINKS, makeLinksBindings());
    const { tags } = catalog.commands.search.params;

    expect(tags).toMatchObject({
      label: 'Tag',
      list: true,
      hints: ['with'],
      aliases: ['tagged', 'tag', 'tags'],
      path: { group: 'refine', icon: 'folder' }
    });
    expect(tags).not.toHaveProperty('<<');
    expect(catalog).not.toHaveProperty('x-facet');
  });
});

describe('a mistake fails when the catalog loads, naming where it is', () => {
  test('a command in a group the catalog does not declare', () => {
    const text = minimal({
      command:
        'find: { label: Find, group: serch, run: app.find, params: { term: { label: Term, default: true, argSource: { freeform: true } } } }'
    });
    expect(() => loadCatalog(text, appBindings())).toThrow(
      'Catalog command "find": no group "serch" in the catalog'
    );
  });

  test("a param's row in a group the catalog does not declare", () => {
    const text = minimal({
      command:
        'find: { label: Find, group: search, run: app.find, params: { term: { label: Term, default: true, argSource: { freeform: true }, path: { group: refine } } } }'
    });
    expect(() => loadCatalog(text, appBindings())).toThrow(
      'Catalog command "find" param "term": no group "refine" in the catalog'
    );
  });

  test('a run the app does not provide', () => {
    const text = minimal({
      command:
        'find: { label: Find, group: search, run: app.seek, params: { term: { label: Term, default: true, argSource: { freeform: true } } } }'
    });
    expect(() => loadCatalog(text, appBindings())).toThrow(
      'Catalog command "find": the app does not provide "app.seek"'
    );
  });

  test('a lookup the app does not provide', () => {
    const text = minimal({
      command:
        'find: { label: Find, group: search, run: app.find, params: { tags: { label: Tags, list: true, argSource: { lookup: app.tagRows } } } }'
    });
    expect(() => loadCatalog(text, appBindings())).toThrow(
      'Catalog command "find" param "tags": the app does not provide "app.tagRows"'
    );
  });

  test('a `when` clause that compares', () => {
    const text = minimal({
      states: "browsing: { when: 'app.conditions.count > 0', commands: [find] }"
    });
    expect(() => loadCatalog(text, appBindings())).toThrow(
      /^Catalog state "browsing": when "app.conditions.count > 0" may use only condition names/
    );
  });

  test('a condition the app does not provide', () => {
    const text = minimal({
      states: 'browsing: { when: app.conditions.idle, commands: [find] }'
    });
    expect(() => loadCatalog(text, appBindings())).toThrow(
      'Catalog state "browsing": the app does not provide "app.conditions.idle"'
    );
  });

  test('a state that lists a command the catalog does not have', () => {
    const text = minimal({
      states: 'browsing: { when: app.conditions.browsing, commands: [find, sort] }'
    });
    expect(() => loadCatalog(text, appBindings())).toThrow(
      'Catalog state "browsing": no command "sort" in the catalog'
    );
  });

  // With nothing current, such a param has no way to ask, and the palette would throw.
  test('a param whose only `argSource` is `current`', () => {
    const text = minimal({
      command:
        'find: { label: Find, group: search, run: app.find, params: { item: { label: Item, default: true, argSource: { current: app.tags } } } }'
    });
    expect(() => loadCatalog(text, appBindings())).toThrow(
      /Catalog is malformed[\s\S]*current needs a way to ask too: freeform, list or lookup[\s\S]*commands\.find\.params\.item\.argSource/
    );
  });

  test('a param without `argSource`', () => {
    const text = minimal({
      command:
        'find: { label: Find, group: search, run: app.find, params: { term: { label: Term, default: true } } }'
    });
    expect(() => loadCatalog(text, appBindings())).toThrow(
      /Catalog is malformed[\s\S]*commands\.find\.params\.term\.argSource/
    );
  });

  test('`minItems` on a param that takes one value', () => {
    const text = minimal({
      command:
        'find: { label: Find, group: search, run: app.find, params: { term: { label: Term, default: true, minItems: 1, argSource: { freeform: true } } } }'
    });
    expect(() => loadCatalog(text, appBindings())).toThrow(
      /Catalog is malformed[\s\S]*minItems is for a list param \(list: true\)[\s\S]*commands\.find\.params\.term\.minItems/
    );
    expect(() => checkCatalog(text)).toThrow(
      /Catalog is malformed[\s\S]*minItems is for a list param \(list: true\)[\s\S]*commands\.find\.params\.term\.minItems/
    );
  });

  test('`minItems` below 1, or not a whole number', () => {
    const withMinItems = (value) =>
      minimal({
        command: `find: { label: Find, group: search, run: app.find, params: { tags: { label: Tag, default: true, list: true, minItems: ${value}, argSource: { freeform: true } } } }`
      });
    expect(() => loadCatalog(withMinItems(0), appBindings())).toThrow(
      /Catalog is malformed[\s\S]*commands\.find\.params\.tags\.minItems/
    );
    expect(() => loadCatalog(withMinItems(1.5), appBindings())).toThrow(
      /Catalog is malformed[\s\S]*commands\.find\.params\.tags\.minItems/
    );
  });

  test('`minItems` on a list param loads', () => {
    const text = minimal({
      command:
        'find: { label: Find, group: search, run: app.find, params: { tags: { label: Tag, default: true, list: true, minItems: 2, argSource: { freeform: true } } } }'
    });
    expect(loadCatalog(text, appBindings()).commands.find.params.tags.minItems).toBe(2);
  });

  describe('typed params', () => {
    const withParam = (param) =>
      minimal({
        command: `find: { label: Find, group: search, run: app.find, params: { p: ${param} } }`
      });
    const loads = (param) => loadCatalog(withParam(param), appBindings()).commands.find.params.p;

    test('a number type with bounds, text with maxLength, and nullable params load', () => {
      expect(
        loads(
          '{ label: Limit, default: true, nullable: [all, every], argSource: { freeform: true, type: integer, minimum: 1, maximum: 50 } }'
        )
      ).toMatchObject({
        nullable: ['all', 'every'],
        argSource: { type: 'integer', minimum: 1, maximum: 50 }
      });
      expect(
        loads(
          '{ label: Scale, nullable: true, argSource: { freeform: true, type: number, minimum: 0.5 } }'
        ).argSource.type
      ).toBe('number');
      expect(
        loads('{ label: Name, argSource: { freeform: true, maxLength: 40 } }').argSource.maxLength
      ).toBe(40);
    });

    test.each([
      [
        'a bound on text',
        '{ label: Name, argSource: { freeform: true, type: text, minimum: 1 } }',
        /minimum and maximum are for a number type \(integer or number\)/
      ],
      [
        'maxLength on a number',
        '{ label: Limit, argSource: { freeform: true, type: integer, maxLength: 3 } }',
        /maxLength is for text/
      ],
      [
        'a number type without freeform',
        '{ label: Limit, argSource: { type: integer, lookup: app.tags } }',
        /a number type is freeform only, with no list or lookup/
      ],
      [
        'a minimum above the maximum',
        '{ label: Limit, argSource: { freeform: true, type: integer, minimum: 5, maximum: 2 } }',
        /minimum is above maximum/
      ],
      [
        'nullable on a list param',
        '{ label: Tag, list: true, nullable: true, argSource: { freeform: true } }',
        /nullable is for a param that takes one value/
      ],
      [
        'nullable with no words',
        '{ label: Limit, nullable: [], argSource: { freeform: true, type: integer } }',
        />=1 items[\s\S]*commands\.find\.params\.p\.nullable/
      ],
      [
        'nullable on a lookup param',
        '{ label: Tag, nullable: [none], argSource: { lookup: app.tags } }',
        /nullable is for a param with no list or lookup/
      ],
      [
        'nullable on a fixed list',
        '{ label: Kind, nullable: [none], argSource: { list: [{ value: a, title: A }] } }',
        /nullable is for a param with no list or lookup/
      ],
      [
        'nullable on free text with a lookup',
        '{ label: Tag, nullable: true, argSource: { freeform: true, lookup: app.tags } }',
        /nullable is for a param with no list or lookup/
      ],
      [
        'a number type with a fixed list',
        '{ label: Limit, argSource: { freeform: true, type: integer, list: [{ value: 1, title: One }] } }',
        /a number type is freeform only, with no list or lookup/
      ],
      [
        'a fractional bound on an integer',
        '{ label: Limit, argSource: { freeform: true, type: integer, minimum: 0.5 } }',
        /an integer type's minimum and maximum are whole numbers/
      ]
    ])('%s is refused, naming it', (_, param, message) => {
      expect(() => loadCatalog(withParam(param), appBindings())).toThrow(message);
      expect(() => checkCatalog(withParam(param))).toThrow(message);
    });

    const withParams = (params) =>
      minimal({
        command: `find: { label: Find, group: search, run: app.find, params: { ${params} } }`
      });
    const LIMIT =
      'limit: { label: Limit, default: true, nullable: [all], argSource: { freeform: true, type: integer } }';

    test.each([
      [
        "another param's value alias",
        'scope: { label: Scope, argSource: { list: [{ value: everything, title: Everything, aliases: [all] }] } }'
      ],
      ['a hint', 'page: { label: Page, hints: [All], argSource: { freeform: true } }'],
      ['a param word', 'page: { label: Page, aliases: [all], argSource: { freeform: true } }']
    ])('a null word that is also %s of the command is refused, naming it', (_, other) => {
      const text = withParams(`${LIMIT}, ${other}`);
      const message =
        /"all" is already a word of this command[\s\S]*commands\.find\.params\.limit\.nullable/;

      expect(() => loadCatalog(text, appBindings())).toThrow(message);
      expect(() => checkCatalog(text)).toThrow(message);
    });
  });

  test('a misspelled field (fields are strict)', () => {
    const text = minimal({
      command:
        'find: { label: Find, group: search, run: app.find, alias: [seek], params: { term: { label: Term, default: true, argSource: { freeform: true } } } }'
    });
    expect(() => loadCatalog(text, appBindings())).toThrow(/Catalog is malformed[\s\S]*alias/);
  });

  test('a built command without `run`', () => {
    const text = minimal({
      command:
        'find: { label: Find, group: search, params: { term: { label: Term, default: true, argSource: { freeform: true } } } }'
    });
    expect(() => loadCatalog(text, appBindings())).toThrow(
      /Catalog is malformed[\s\S]*a built command needs run/
    );
  });

  test("a path must name the app's own function, not an inherited one", () => {
    const text = minimal({
      command:
        'find: { label: Find, group: search, run: app.toString, params: { term: { label: Term, default: true, argSource: { freeform: true } } } }'
    });
    expect(() => loadCatalog(text, appBindings())).toThrow(
      'Catalog command "find": the app does not provide "app.toString"'
    );
  });

  test('a command needs a label', () => {
    const text = minimal({
      command:
        'find: { group: search, run: app.find, params: { term: { label: Term, default: true, argSource: { freeform: true } } } }'
    });
    expect(() => loadCatalog(text, appBindings())).toThrow(
      /Catalog is malformed[\s\S]*commands\.find\.label/
    );
  });

  test('only one state can be the start', () => {
    const text = minimal({
      states:
        'browsing: { start: true, when: app.conditions.browsing, commands: [find] }\n  other: { start: true, commands: [find] }'
    });
    expect(() => loadCatalog(text, appBindings())).toThrow(
      'Catalog has more than one start state: browsing, other'
    );
  });

  test('a tier is common or full', () => {
    const text = minimal({
      command:
        'find: { label: Find, group: search, run: app.find, tier: everyday, params: { term: { label: Term, default: true, argSource: { freeform: true } } } }'
    });
    expect(() => loadCatalog(text, appBindings())).toThrow(/Catalog is malformed[\s\S]*tier/);
  });

  test('steps (a guided flow) belong to planned states', () => {
    const text = minimal({
      states:
        'browsing: { when: app.conditions.browsing, commands: [find] }\n  flow: { steps: [{ run: app.find }] }'
    });
    expect(() => loadCatalog(text, appBindings())).toThrow(
      /Catalog is malformed[\s\S]*steps \(a guided flow\) belong to a planned state/
    );
  });

  // With the public link: a catalog author outside the repository has no MIGRATING.md beside them.
  test('a version 2 catalog says how to move it to version 3', () => {
    expect(() => loadCatalog(minimal().replace('version: 3', 'version: 2'), appBindings())).toThrow(
      'This is a version 2 catalog; ShortRound 0.5.0 reads version 3. See "From a v2 catalog" in MIGRATING.md: ' +
        'https://github.com/csepulv/shortround/blob/main/MIGRATING.md#from-a-v2-catalog'
    );
  });

  test('a version this release does not read', () => {
    expect(() => loadCatalog(minimal().replace('version: 3', 'version: 4'), appBindings())).toThrow(
      /Catalog is malformed[\s\S]*version/
    );
  });
});

describe('planned items (design notes for the catalog-discovery skill)', () => {
  const withPlanned = minimal({
    states:
      'browsing: { when: app.conditions.browsing, commands: [find, label] }\n  editing: { planned: true, summary: Editing one item, commands: [label] }',
    command:
      'find: { label: Find, group: search, run: app.find, params: { term: { label: Term, default: true, argSource: { freeform: true } } } }\n  label: { label: Label, planned: true, summary: Add a label, group: search }'
  });

  test('load without their functions, and are left out of what the palette sees', () => {
    const catalog = loadCatalog(withPlanned, appBindings());

    expect(Object.keys(catalog.commands)).toEqual(['find']);
    expect(Object.keys(catalog.states)).toEqual(['browsing']);
    expect(catalog.states.browsing.commands).toEqual(['find']);
  });

  test('are still checked for their references', () => {
    const text = withPlanned.replace('summary: Add a label, group: search', 'group: tagging');
    expect(() => loadCatalog(text, appBindings())).toThrow(
      'Catalog command "label": no group "tagging" in the catalog'
    );
  });
});

describe('checkCatalog, without the app', () => {
  test('makes every check except resolving paths, and keeps planned items and paths as written', () => {
    const catalog = checkCatalog(LINKS);

    expect(catalog.commands.search.run).toBe('links.search.apply');
    expect(catalog.commands.search.params.tags.hints).toEqual(['with']);
  });

  test('still finds a mistake that needs no app', () => {
    const text = minimal({
      states: 'browsing: { when: app.conditions.browsing, commands: [find, sort] }'
    });
    expect(() => checkCatalog(text)).toThrow(
      'Catalog state "browsing": no command "sort" in the catalog'
    );
  });

  test("checks a `when` clause's shape, though not that the app has its conditions", () => {
    const comparing = minimal({
      states: "browsing: { when: 'app.conditions.count > 0', commands: [find] }"
    });
    expect(() => checkCatalog(comparing)).toThrow(
      /^Catalog state "browsing": when "app.conditions.count > 0" may use only condition names/
    );
    const unknownCondition = minimal({
      states: 'browsing: { when: app.conditions.idle, commands: [find] }'
    });
    expect(() => checkCatalog(unknownCondition)).not.toThrow();
  });
});
