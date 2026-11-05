import { LOADING_DELAY_MS } from '../loading-delay.js';
import { makePaletteAdapter, rowsFor } from '../palette-adapter.js';
import { makeDemoEngine } from './fixtures/demo-engine.js';

const run = vi.fn((call) => ({ message: call.run }));

const titlesAndGroups = (rows) => rows.map(({ title, group }) => `${group}: ${title}`);

describe('rows from the engine state', () => {
  test('when the top command can run, commands come first (Enter sends)', () => {
    const rows = rowsFor(
      {
        readings: [
          { title: 'Search: owl', needs: [], call: { run: 'links.search.apply', args: {} } }
        ],
        nextSteps: [{ label: 'with', insertText: 'search owl with ' }]
      },
      run
    );
    expect(titlesAndGroups(rows)).toEqual(['Commands: Search: owl', 'Next: with']);
    expect(rows[1].completion).toBe('search owl with ');
  });

  test('when it cannot run yet, next steps come first (Enter completes) and the command is disabled', () => {
    const rows = rowsFor(
      {
        readings: [{ title: 'Add bookmark · Tags: react (needs URL)', needs: ['URL'], call: {} }],
        nextSteps: [{ label: 'react-native', insertText: 'with tags react-native ' }]
      },
      run
    );
    expect(titlesAndGroups(rows)).toEqual([
      'Next: react-native',
      'Commands: Add bookmark · Tags: react (needs URL)'
    ]);
    expect(rows[1]).toEqual(expect.objectContaining({ disabled: true, subtitle: 'Needs URL' }));
  });

  // These rows share the Status group with "Loading …", since they also include "nothing to choose from", which
  // typing can't change.
  test('an unfinished value is explained first, in a disabled Status row', () => {
    const rows = rowsFor(
      {
        readings: [],
        nextSteps: [{ label: 'last week', insertText: 'search from last week ' }],
        incomplete: ['Keep typing a date for Bookmarked']
      },
      run
    );
    expect(titlesAndGroups(rows)).toEqual([
      'Status: Keep typing a date for Bookmarked',
      'Next: last week'
    ]);
    expect(rows[0].disabled).toBe(true);
  });

  test('a broken line adds a disabled problem row', () => {
    const rows = rowsFor(
      { readings: [], nextSteps: [], problem: 'Search is already "tools"' },
      run
    );
    expect(rows).toEqual([
      expect.objectContaining({
        title: 'Search is already "tools"',
        group: 'Problem',
        disabled: true
      })
    ]);
  });

  test("running a command row hands its call to the app's run function", () => {
    const call = { run: 'links.search.apply', args: { term: 'owl' } };
    const [row] = rowsFor(
      { readings: [{ title: 'Search: owl', needs: [], call }], nextSteps: [] },
      run
    );
    expect(row.action()).toEqual({ message: 'links.search.apply' });
    expect(run).toHaveBeenCalledWith(call);
  });

  test('a command row carries the call it would run, so a check can read it without running it', () => {
    const call = { command: 'search', run: 'links.search.apply', args: { term: 'owl' } };
    const [row] = rowsFor(
      { readings: [{ title: 'Search: owl', needs: [], call }], nextSteps: [] },
      run
    );
    expect(row.call).toEqual(call);
  });
});

describe('the adapter around a real engine', () => {
  const adapter = makePaletteAdapter({ engine: makeDemoEngine({ tagsMode: 'normal' }), run });

  test('an empty line starts with the commands as completions', () => {
    expect(adapter.defaultIntentions.map(({ completion }) => completion)).toEqual(
      expect.arrayContaining(['search ', 'find ', 'add '])
    );
  });

  test('a typed line becomes rows; the resolver carries the engine subscribe', () => {
    const rows = adapter.resolveInput('search owl with tags react');
    expect(rows[0]).toEqual(
      expect.objectContaining({ group: 'Commands', title: 'Search: owl · Tags: react' })
    );
    expect(typeof adapter.resolveInput.subscribe).toBe('function');
  });
});

describe('loading and failed lookups', () => {
  const TAGS = { param: 'tags', label: 'Tags' };
  const stateWith = (status) => ({ readings: [], nextSteps: [], ...status });

  // An engine stand-in whose state the test sets, and a clock and timer the test controls.
  function setup(state) {
    let time = 1000;
    const scheduled = [];
    const engine = { read: () => state, subscribe: vi.fn() };
    const adapter = makePaletteAdapter({
      engine,
      run,
      now: () => time,
      schedule: (callback, ms) => scheduled.push({ callback, ms })
    });
    const advance = (ms) => {
      time += ms;
    };
    return { adapter, scheduled, advance };
  }

  test('"Loading" shows only once a lookup has been pending for the delay', () => {
    const { adapter, scheduled, advance } = setup(stateWith({ pending: [TAGS] }));
    const listener = vi.fn();
    adapter.resolveInput.subscribe(listener);

    expect(titlesAndGroups(adapter.resolveInput('search with tags '))).toEqual([]);
    expect(scheduled.map(({ ms }) => ms)).toEqual([LOADING_DELAY_MS]);

    advance(LOADING_DELAY_MS);
    scheduled[0].callback();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(titlesAndGroups(adapter.resolveInput('search with tags '))).toEqual([
      'Status: Loading tags…'
    ]);
  });

  test('a failed lookup says so at once', () => {
    const { adapter } = setup(stateWith({ failed: [TAGS] }));
    expect(titlesAndGroups(adapter.resolveInput('search with tags rea'))).toEqual([
      "Status: Couldn't load tags"
    ]);
  });
});
