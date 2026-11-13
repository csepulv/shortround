import { describe, expect, test, vi } from 'vitest';

import { makeCommandBuilder } from '../engine.js';
import { ADD, makeLookups, SEARCH } from './fixtures/commands.js';
import { makeEngine, now, OPERATOR_LINES } from './fixtures/engines.js';

const LONG_LINE = OPERATOR_LINES[0][0];
const prefixesOf = (line) => [...line].map((_, index) => line.slice(0, index + 1));

describe('work per keystroke', () => {
  test('typing reads one word at a time; a fresh read reads the whole line', () => {
    const engine = makeEngine();
    const perKeystroke = prefixesOf(LONG_LINE).map((text) => ({
      kept: engine.read(text).work.steps,
      fresh: makeEngine().read(text).work.steps
    }));
    const total = (key) => perKeystroke.reduce((sum, counts) => sum + counts[key], 0);
    const most = (key) => Math.max(...perKeystroke.map((counts) => counts[key]));
    console.log(
      `steps over ${perKeystroke.length} keystrokes: kept ${total('kept')} (most ${most('kept')}), fresh ${total('fresh')} (most ${most('fresh')})`
    );
    expect(total('kept')).toBeLessThan(total('fresh') / 3);
  });

  test('each lookup is called once per context while typing', () => {
    const calls = [];
    const engine = makeEngine({ onLookup: (name, context) => calls.push(keyOf(name, context)) });
    prefixesOf(LONG_LINE).forEach((text) => engine.read(text));
    expect(calls.length).toBe(new Set(calls).size);
  });
});

describe('async lookups', () => {
  function makeSlowTags() {
    const waiting = [];
    const lookups = {
      ...makeLookups(),
      'facetValues.tags': () => new Promise((resolve) => waiting.push(resolve))
    };
    const resolveAll = () =>
      waiting.splice(0).forEach((resolve) => resolve([{ value: 'react', title: 'react' }]));
    return { lookups, resolveAll };
  }

  test('pending, then told, then the values are there', async () => {
    const { lookups, resolveAll } = makeSlowTags();
    const engine = makeCommandBuilder({ commands: [SEARCH, ADD], lookups, now });
    const listener = vi.fn();
    engine.subscribe(listener);

    const before = engine.read('search owl with tags rea');
    expect(before.pending).toEqual([{ param: 'tags', label: 'Tags' }]);
    expect(before.readings.some((row) => row.call.args.tags)).toBe(false);

    resolveAll();
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    const after = engine.read('search owl with tags rea');
    expect(after.readings[0].call.args).toEqual({ term: 'owl', tags: ['react'] });
    expect(after.pending).toEqual([]);
  });

  test('a param opened with nothing typed yet is reported as loading too', () => {
    const { lookups } = makeSlowTags();
    const engine = makeCommandBuilder({ commands: [SEARCH, ADD], lookups, now });
    expect(engine.read('search owl with tags ').pending).toEqual([
      { param: 'tags', label: 'Tags' }
    ]);
  });

  test('a lookup that fails is reported as failed, not as "no value matches"', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const lookups = {
      ...makeLookups(),
      'facetValues.tags': () => Promise.reject(new Error('tags service down'))
    };
    const engine = makeCommandBuilder({ commands: [SEARCH, ADD], lookups, now });
    const listener = vi.fn();
    engine.subscribe(listener);

    engine.read('search owl with tags rea');
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    const state = engine.read('search owl with tags rea');

    expect(state.failed).toEqual([{ param: 'tags', label: 'Tags' }]);
    expect(state.pending).toEqual([]);
    expect(state.problem).toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      'Lookup "facetValues.tags" failed',
      expect.any(Object)
    );
    consoleError.mockRestore();
  });

  test('a result for a frame that was cut is dropped, and no one is told', async () => {
    const { lookups, resolveAll } = makeSlowTags();
    const engine = makeCommandBuilder({ commands: [SEARCH, ADD], lookups, now });
    const listener = vi.fn();
    engine.subscribe(listener);

    engine.read('search owl with tags rea');
    engine.read('search owl');
    resolveAll();
    await new Promise((settle) => setTimeout(settle, 0));
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('the caret', () => {
  test('next steps are for the word at the caret, keeping the rest of the line', () => {
    const text = 'search owl wit tags react';
    const state = makeEngine().read(text, 'search owl wit'.length);
    expect(state.nextSteps).toContainEqual(
      expect.objectContaining({ label: 'with', insertText: 'search owl with tags react' })
    );
  });
});

describe('annotations', () => {
  test("each word's role in the top reading", () => {
    const roles = makeEngine()
      .read('search owl with tags react')
      .annotations.map(({ text, role }) => `${text}:${role}`);
    expect(roles).toEqual(['search:verb', 'owl:text', 'with:hint', 'tags:param', 'react:value']);
  });

  // While a line waits after a hint or a param word, nothing can run yet, but the words read so far keep their
  // roles.
  test.each([
    ['search owl with', ['search:verb', 'owl:text', 'with:hint']],
    ['tags ', ['tags:param']],
    ['search owl with tags ', ['search:verb', 'owl:text', 'with:hint', 'tags:param']]
  ])('an unfinished line keeps its roles: "%s"', (line, expected) => {
    const state = makeEngine().read(line);
    expect(state.readings).toEqual([]);
    expect(state.annotations.map(({ text, role }) => `${text}:${role}`)).toEqual(expected);
  });

  test('a broken word, with the reason', () => {
    const broken = makeEngine()
      .read('search owl with tags zzz')
      .annotations.find(({ role }) => role === 'broken');
    expect(broken).toEqual(
      expect.objectContaining({ text: 'zzz', reason: 'No Tags value matches "zzz"' })
    );
  });
});

// A command's name is typed only if it is a plain lowercase word ("next"); a name like "clearFilters" is the
// catalog's identifier, typed by its aliases ("clear filters"). The engine follows what CATALOG.md and the skill's
// review page already say.
describe('command names', () => {
  const COMMANDS = [
    { name: 'next', label: 'Next', aliases: [], run: 'app.next', params: {} },
    {
      name: 'clearFilters',
      label: 'Clear filters',
      aliases: ['clear filters'],
      run: 'app.clearFilters',
      params: {}
    }
  ];
  const engine = () => makeCommandBuilder({ commands: COMMANDS, lookups: {}, now });
  const commandOf = (state) => state.readings[0]?.call.command;

  test('a name that is a plain word is typed and suggested', () => {
    expect(commandOf(engine().read('next'))).toBe('next');
    expect(
      engine()
        .read('ne')
        .nextSteps.map(({ label }) => label)
    ).toEqual(['next']);
  });

  test('a name that is not a plain word is neither suggested nor read; its alias is', () => {
    expect(
      engine()
        .read('cl')
        .nextSteps.map(({ label }) => label)
    ).toEqual(['clear filters']);
    expect(commandOf(engine().read('clearFilters'))).toBeUndefined();
    expect(commandOf(engine().read('clearfilters'))).toBeUndefined();
    expect(commandOf(engine().read('clear filters '))).toBe('clearFilters');
    expect(commandOf(engine().read('clear filters'))).toBe('clearFilters');
  });
});

describe('command labels', () => {
  const COMMANDS = [
    { name: 'next', label: 'Next', aliases: [], run: 'app.next', params: {} },
    { name: 'closePreview', label: 'Close preview', aliases: [], run: 'app.close', params: {} },
    { name: 'exportCsv', label: 'Export (CSV)', aliases: [], run: 'app.export', params: {} }
  ];
  const engine = () => makeCommandBuilder({ commands: COMMANDS, lookups: {}, now });
  const commandOf = (state) => state.readings[0]?.call.command;
  const stepsOf = (text) =>
    engine()
      .read(text)
      .nextSteps.map(({ label }) => label);

  test('a label is read and suggested, though the command has no alias', () => {
    expect(commandOf(engine().read('close preview'))).toBe('closePreview');
    expect(commandOf(engine().read('Close Preview'))).toBe('closePreview');
    expect(stepsOf('cl')).toEqual(['close preview']);
  });

  test('a label that is the name is suggested once', () => {
    expect(stepsOf('ne')).toEqual(['next']);
  });

  test('a label with characters a typed word cannot hold is not offered', () => {
    expect(stepsOf('ex')).toEqual([]);
    expect(commandOf(engine().read('export (csv)'))).toBeUndefined();
  });

  test.each([
    ['declared before', ['closeAll', 'shut']],
    ['declared after', ['shut', 'closeAll']]
  ])("another command's alias keeps its phrase from a label %s it", (_order, names) => {
    const byName = {
      closeAll: { name: 'closeAll', label: 'Close', aliases: [], run: 'app.closeAll', params: {} },
      shut: { name: 'shut', label: 'Shut', aliases: ['close'], run: 'app.shut', params: {} }
    };
    const commands = names.map((name) => byName[name]);
    const read = makeCommandBuilder({ commands, lookups: {}, now }).read('close');

    expect(read.readings.map(({ call }) => call.command)).toEqual(['shut']);
  });

  test("another command's typed name keeps its phrase from a label", () => {
    const commands = [
      { name: 'closeAll', label: 'Close', aliases: [], run: 'app.closeAll', params: {} },
      { name: 'close', label: 'Close one', aliases: [], run: 'app.close', params: {} }
    ];
    const read = makeCommandBuilder({ commands, lookups: {}, now }).read('close');

    expect(read.readings.map(({ call }) => call.command)).toEqual(['close']);
  });

  test('typing and editing a label reads as a fresh read does', () => {
    const kept = engine();
    const texts = [
      'c',
      'close',
      'close ',
      'close p',
      'close preview',
      'close',
      'clos preview',
      'close preview'
    ];
    const mismatched = texts.filter(
      (text) =>
        JSON.stringify(kept.read(text).readings.map(({ call }) => call)) !==
        JSON.stringify(
          engine()
            .read(text)
            .readings.map(({ call }) => call)
        )
    );
    expect(mismatched).toEqual([]);
  });
});

describe('invalidate', () => {
  test('a changed lookup shows only after invalidate()', () => {
    const tags = ['react'];
    const engine = makeEngine({ tags });
    const labels = () => engine.read('search with tags ').nextSteps.map(({ label }) => label);
    expect(labels()).toEqual(['react']);
    tags.push('zeta');
    expect(labels()).toEqual(['react']);
    engine.invalidate();
    expect(labels()).toEqual(['react', 'zeta']);
  });
});

// The same key the engine caches on: the lookup, the command, and the plain values filled so far.
function keyOf(name, { command, filled }) {
  const plain = (value) => (Array.isArray(value) ? value.map(plain) : (value?.value ?? value));
  const values = Object.fromEntries(
    Object.entries(filled).map(([param, value]) => [param, plain(value)])
  );
  return JSON.stringify({ name, command, values });
}
