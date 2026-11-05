import { describe, expect, test } from 'vitest';

import { makeCommandBuilder } from '../engine.js';
import { makeLookups, SEARCH } from './fixtures/commands.js';
import { now } from './fixtures/engines.js';

// A command with nothing to type ("next", "clear filters") is a runnable typed-line row.
const CLEAR = {
  name: 'clear',
  label: 'Clear filters',
  aliases: ['clear filters', 'reset filters'],
  run: 'links.search.clearFilters',
  params: {}
};
const engine = makeCommandBuilder({ commands: [SEARCH, CLEAR], lookups: makeLookups(), now });

describe('complete by name', () => {
  test('a command with no params is a runnable row by its name', () => {
    expect(engine.read('clear').readings).toEqual([
      {
        title: 'Clear filters',
        needs: [],
        call: { command: 'clear', run: 'links.search.clearFilters', args: {} }
      }
    ]);
  });

  test('by an alias too', () => {
    expect(engine.read('reset filters ').readings[0]?.call.command).toBe('clear');
  });

  // Before the matcher's change, the exact one-word name "clear" hid the longer alias, leaving "filters".
  test('by a longer alias that starts with its name', () => {
    expect(engine.read('clear filters ').readings[0]?.call.command).toBe('clear');
  });

  // A phrase that ends in the word being typed starts at an earlier word: the whole line is the alias, no space yet.
  test.each(['reset filters', 'clear filters'])('%s reads before its space', (text) => {
    const state = engine.read(text);

    expect(state.readings[0]?.call).toEqual({
      command: 'clear',
      run: 'links.search.clearFilters',
      args: {}
    });
    expect(state.problem).toBeUndefined();
    expect(state.annotations.map(({ role }) => role)).toEqual(['verb', 'verb']);
  });

  test('typing the phrase key by key reads as a fresh engine does', () => {
    const typing = makeCommandBuilder({ commands: [SEARCH, CLEAR], lookups: makeLookups(), now });
    const steps = [
      'c',
      'clear',
      'clear ',
      'clear fil',
      'clear filters',
      'clear filters ',
      'clear filters'
    ];

    for (const text of steps) {
      const fresh = makeCommandBuilder({ commands: [SEARCH, CLEAR], lookups: makeLookups(), now });
      const { work: _typed, ...typed } = typing.read(text);
      const { work: _fresh, ...expected } = fresh.read(text);
      expect(typed, text).toEqual(expected);
    }
  });

  test('the last word of a phrase is read only once it is typed in full', () => {
    expect(engine.read('reset filt').readings).toEqual([]);
  });

  test('a command with params is not runnable by its name alone', () => {
    expect(engine.read('search').readings).toEqual([]);
  });
});
