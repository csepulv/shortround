import { describe, expect, test } from 'vitest';

import { buildPalette, checkCatalog, loadCatalog } from '../index.js';
import { readFixture } from './fixtures/read-fixture.js';

const CATALOG = readFixture('load-checks.yaml');
const DESIGN_CATALOG = readFixture('design-fields.yaml');

const makeBindings = () => ({
  app: {
    sortOptions: { rows: () => [] },
    search: { clearSearch: () => {}, setSort: () => {}, addFacetValue: () => {} },
    searchResults: { previewedHasServiceLink: () => true, openInService: () => {} }
  }
});

const withoutPath = (bindings, area, action) => {
  delete bindings.app[area][action];
  return bindings;
};

describe('loading a catalog', () => {
  test('reads the states and commands, with each path replaced by the app function', () => {
    const bindings = makeBindings();

    const catalog = loadCatalog(CATALOG, bindings);

    expect(catalog.app).toBe('app');
    expect(Object.keys(catalog.states.browsing.commands)).toEqual(['clearSearch', 'sort', 'facet']);
    expect(catalog.states.browsing.commands.sort.run).toBe(bindings.app.search.setSort);
    expect(catalog.pickers.sortOption.from).toBe(bindings.app.sortOptions.rows);
    expect(catalog.states.previewing.commands.openInService.when).toBe(
      bindings.app.searchResults.previewedHasServiceLink
    );
  });

  test('names the start state', () => {
    expect(loadCatalog(CATALOG, makeBindings()).startState).toBe('browsing');
  });
});

describe('a catalog mistake fails when the catalog loads', () => {
  test('a run path the app does not provide names the command and the path', () => {
    const bindings = withoutPath(makeBindings(), 'search', 'setSort');

    expect(() => loadCatalog(CATALOG, bindings)).toThrow(
      'Catalog command "browsing.sort": the app does not provide "app.search.setSort"'
    );
  });

  test('a when path the app does not provide names the command and the path', () => {
    const bindings = withoutPath(makeBindings(), 'searchResults', 'previewedHasServiceLink');

    expect(() => loadCatalog(CATALOG, bindings)).toThrow(
      'Catalog command "previewing.openInService": the app does not provide "app.searchResults.previewedHasServiceLink"'
    );
  });

  test('a picker source the app does not provide names the picker and the path', () => {
    const bindings = withoutPath(makeBindings(), 'sortOptions', 'rows');

    expect(() => loadCatalog(CATALOG, bindings)).toThrow(
      'Catalog picker "sortOption": the app does not provide "app.sortOptions.rows"'
    );
  });

  test('a command that asks for an unknown picker names it', () => {
    const catalog = CATALOG.replace('choose: sortOption', 'choose: sortOrder');

    expect(() => loadCatalog(catalog, makeBindings())).toThrow(
      'Catalog command "browsing.sort": no picker named "sortOrder"'
    );
  });

  test('a command that leads to an unknown state names it', () => {
    const catalog = CATALOG.replace('then: previewing', 'then: preview');

    expect(() => loadCatalog(catalog, makeBindings())).toThrow(
      'Catalog command "browsing.sort": no state named "preview"'
    );
  });

  test('a malformed catalog says which field is wrong', () => {
    const catalog = CATALOG.replace('app: app', 'app: [app]');

    expect(() => loadCatalog(catalog, makeBindings())).toThrow(/Catalog is malformed.*app/s);
  });

  test('a catalog without a start state says so', () => {
    const catalog = CATALOG.replace('start: true', 'start: false');

    expect(() => loadCatalog(catalog, makeBindings())).toThrow('Catalog has no start state');
  });
});

describe('mistakes the shape check catches', () => {
  test('an unknown field, such as a misspelling, is rejected rather than ignored', () => {
    const catalog = CATALOG.replace('then: previewing', 'thne: previewing');

    expect(() => loadCatalog(catalog, makeBindings())).toThrow(/Catalog is malformed.*thne/s);
  });

  test('a command other than a forEach command needs a title', () => {
    const catalog = CATALOG.replace('        title: Clear search\n', '');

    expect(() => loadCatalog(catalog, makeBindings())).toThrow(/Catalog is malformed.*title/s);
  });

  test('a command asks for text or a choice, not both', () => {
    const catalog = CATALOG.replace(
      'ask: { choose: sortOption }',
      'ask: { choose: sortOption, text: Sort by }'
    );

    expect(() => loadCatalog(catalog, makeBindings())).toThrow(/Catalog is malformed/);
  });

  test('only one state can be the start', () => {
    const catalog = CATALOG.replace('    panel: sidecar', '    start: true\n    panel: sidecar');

    expect(() => loadCatalog(catalog, makeBindings())).toThrow(
      'Catalog has more than one start state: browsing, previewing'
    );
  });

  test("a path must name the app's own function, not an inherited one", () => {
    const catalog = CATALOG.replace('run: app.search.clearSearch', 'run: app.search.toString');

    expect(() => loadCatalog(catalog, makeBindings())).toThrow(
      'Catalog command "browsing.clearSearch": the app does not provide "app.search.toString"'
    );
  });
});

// Only what's built: planned functions don't exist yet.
const makeTrackerBindings = () => ({
  tracker: {
    issues: { rows: () => [], open: () => {}, closeIssue: () => {} }
  }
});

describe('a catalog that also holds its design (planned items, workflows, tiers, review notes)', () => {
  test('loads without the functions its planned commands, states and pickers will need', () => {
    expect(() => loadCatalog(DESIGN_CATALOG, makeTrackerBindings())).not.toThrow();
  });

  test('the palette offers only built commands', () => {
    const catalog = loadCatalog(DESIGN_CATALOG, makeTrackerBindings());

    const { intentions } = buildPalette(catalog, {
      panels: { sidecar: () => null },
      backIntentionId: 'back'
    });

    expect(intentions.map((intention) => intention.id)).toEqual(['tracker.openIssue']);
  });

  test('planned states and pickers are left out of the loaded catalog', () => {
    const catalog = loadCatalog(DESIGN_CATALOG, makeTrackerBindings());

    expect(Object.keys(catalog.states)).toEqual(['browsing', 'viewing']);
    expect(Object.keys(catalog.states.viewing.commands)).toEqual(['back']);
    expect(Object.keys(catalog.pickers)).toEqual(['issue']);
  });

  test('a built command still needs run', () => {
    const catalog = DESIGN_CATALOG.replace('        run: tracker.issues.closeIssue\n', '');

    expect(() => loadCatalog(catalog, makeTrackerBindings())).toThrow(/Catalog is malformed.*run/s);
  });

  test('a built picker still needs from', () => {
    const catalog = DESIGN_CATALOG.replace('    from: tracker.issues.rows\n', '');

    expect(() => loadCatalog(catalog, makeTrackerBindings())).toThrow(
      /Catalog is malformed.*from/s
    );
  });

  test('a planned command that leads to an unknown state names it', () => {
    const catalog = DESIGN_CATALOG.replace('then: adding', 'then: addding');

    expect(() => loadCatalog(catalog, makeTrackerBindings())).toThrow(
      'Catalog command "browsing.newIssue": no state named "addding"'
    );
  });

  test('a planned command that asks for an unknown picker names it', () => {
    const catalog = DESIGN_CATALOG.replace(
      'title: Add label\n        ask: { choose: label }',
      'title: Add label\n        ask: { choose: labels }'
    );

    expect(() => loadCatalog(catalog, makeTrackerBindings())).toThrow(
      'Catalog command "viewing.addLabel": no picker named "labels"'
    );
  });

  test('a built command cannot lead into a planned state', () => {
    const catalog = DESIGN_CATALOG.replace('then: viewing', 'then: adding');

    expect(() => loadCatalog(catalog, makeTrackerBindings())).toThrow(
      'Catalog command "browsing.openIssue": state "adding" is planned, not built'
    );
  });

  test('a built command cannot choose from a planned picker', () => {
    const catalog = DESIGN_CATALOG.replace('choose: issue', 'choose: label');

    expect(() => loadCatalog(catalog, makeTrackerBindings())).toThrow(
      'Catalog command "browsing.openIssue": picker "label" is planned, not built'
    );
  });

  test('the start state must be built', () => {
    const catalog = DESIGN_CATALOG.replace(
      '  browsing:\n    start: true\n',
      '  browsing:\n    start: true\n    planned: true\n'
    );

    expect(() => loadCatalog(catalog, makeTrackerBindings())).toThrow(
      'Catalog start state "browsing" is planned, not built'
    );
  });

  test('a misspelled design field is rejected rather than ignored', () => {
    const catalog = DESIGN_CATALOG.replace(
      '    planned: true\n    empty: No labels',
      '    planed: true\n    empty: No labels'
    );

    expect(() => loadCatalog(catalog, makeTrackerBindings())).toThrow(
      /Catalog is malformed.*planed/s
    );
  });

  test('a tier is common or full', () => {
    const catalog = DESIGN_CATALOG.replace('tier: full', 'tier: rare');

    expect(() => loadCatalog(catalog, makeTrackerBindings())).toThrow(
      /Catalog is malformed.*tier/s
    );
  });

  test('steps belong to planned states: the engine cannot run a guided flow yet', () => {
    const catalog = DESIGN_CATALOG.replace('  adding:\n    planned: true\n', '  adding:\n');

    expect(() => loadCatalog(catalog, makeTrackerBindings())).toThrow(
      /Catalog is malformed.*steps/s
    );
  });
});

describe('checking a catalog without the app (for review and authoring)', () => {
  test('keeps planned states, commands and pickers, and names the start state', () => {
    const catalog = checkCatalog(DESIGN_CATALOG);

    expect(catalog.startState).toBe('browsing');
    expect(Object.keys(catalog.states)).toEqual(['browsing', 'viewing', 'adding', 'savedViews']);
    expect(catalog.states.browsing.commands.newIssue.planned).toBe(true);
    expect(Object.keys(catalog.pickers)).toEqual(['issue', 'label']);
    expect(catalog.workflows.triage.title).toBe('Morning triage');
  });

  test('leaves code paths as written: no functions are needed', () => {
    expect(checkCatalog(DESIGN_CATALOG).states.browsing.commands.openIssue.run).toBe(
      'tracker.issues.open'
    );
  });

  test('reports the same mistakes loading does', () => {
    const catalog = DESIGN_CATALOG.replace('then: viewing', 'then: adding');

    expect(() => checkCatalog(catalog)).toThrow(
      'Catalog command "browsing.openIssue": state "adding" is planned, not built'
    );
  });
});

describe('`args` mistakes stop the load, naming the command (S3)', () => {
  const withArgs = (command, args) =>
    CATALOG.replace(
      `run: app.search.${command}\n`,
      `run: app.search.${command}\n        args: ${args}\n`
    );

  test('`with` is gone: `args` replaced it', () => {
    const catalog = CATALOG.replace(
      'run: app.search.clearSearch\n',
      'run: app.search.clearSearch\n        with: any\n'
    );

    expect(() => loadCatalog(catalog, makeBindings())).toThrow(
      /Catalog is malformed.*with.*clearSearch/s
    );
    expect(() => checkCatalog(catalog)).toThrow(/Catalog is malformed.*with.*clearSearch/s);
  });

  test('$value in a command that asks for nothing', () => {
    const catalog = withArgs('clearSearch', '[$value]');
    const message =
      'Catalog command "browsing.clearSearch": args use $value, but the command asks for nothing';

    expect(() => loadCatalog(catalog, makeBindings())).toThrow(message);
    expect(() => checkCatalog(catalog)).toThrow(message);
  });

  test('$value.<field> nested in an object, in a command that asks for nothing', () => {
    const catalog = withArgs('clearSearch', '[{ terms: $value.text }]');

    expect(() => checkCatalog(catalog)).toThrow(
      'Catalog command "browsing.clearSearch": args use $value, but the command asks for nothing'
    );
  });

  test('$key in a command that is not forEach', () => {
    const catalog = withArgs('setSort', '[$key, $value]');
    const message =
      'Catalog command "browsing.sort": args use $key, but the command is not forEach';

    expect(() => loadCatalog(catalog, makeBindings())).toThrow(message);
    expect(() => checkCatalog(catalog)).toThrow(message);
  });
});

describe('strings that look like references but are not stop the load (R14)', () => {
  const withArgs = (command, args) =>
    CATALOG.replace(
      `run: app.search.${command}\n`,
      `run: app.search.${command}\n        args: ${args}\n`
    );

  test.each([
    ['setSort', '[$values]', 'browsing.sort', '$values'],
    ['setSort', '[$value.0]', 'browsing.sort', '$value.0'],
    ['setSort', '[{ terms: $value.kebab-field }]', 'browsing.sort', '$value.kebab-field'],
    ['addFacetValue', '[$key.length, $value]', 'browsing.facet', '$key.length']
  ])('%s with args %s', (command, args, owner, text) => {
    const message = `Catalog command "${owner}": "${text}" looks like a reference but isn't one ($key, $value or $value.<field>)`;

    expect(() => checkCatalog(withArgs(command, args))).toThrow(message);
  });
});
