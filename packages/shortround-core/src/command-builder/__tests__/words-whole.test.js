// Version 2 tested these, and version 3 keeps them: a param label of several words is read whole, and a value with
// a hyphen or a dot is one value.
import { describe, expect, test } from 'vitest';

import { makeCommandBuilder } from '../engine.js';

const KINDS = [
  { value: 'react', title: 'react' },
  { value: 'react-native', title: 'react-native' },
  { value: 'next', title: 'next' },
  { value: 'next.js', title: 'next.js' }
];
const AGES = [
  { value: 'week', title: 'last week' },
  { value: 'month', title: 'last month' }
];

const SEARCH = {
  name: 'search',
  label: 'Search',
  aliases: [],
  run: 'app.apply',
  params: {
    term: { label: 'Search', default: true, argSource: { freeform: true, type: 'text' } },
    kinds: { label: 'Kind', list: true, hints: ['with'], argSource: { lookup: 'kinds' } },
    ages: { label: 'Bookmark age', hints: ['with'], argSource: { lookup: 'ages' } }
  }
};

const makeEngine = () =>
  makeCommandBuilder({
    commands: [SEARCH],
    lookups: { kinds: () => KINDS, ages: () => AGES }
  });

const argsOf = (line) => makeEngine().read(line).readings[0]?.call?.args;
// A value line must read one way only: the first of several readings could be right by list order alone.
const onlyArgsOf = (line) =>
  makeEngine()
    .read(line)
    .readings.map((reading) => reading.call?.args);

describe('a param label of several words', () => {
  test('starts the param at the start of a line', () => {
    expect(argsOf('bookmark age last week')).toEqual({ ages: 'week' });
  });

  test('starts the param after the typed text and a hint', () => {
    expect(argsOf('search notes with bookmark age last month')).toEqual({
      term: 'notes',
      ages: 'month'
    });
  });
});

describe('a value with a hyphen or a dot', () => {
  test('is one value, not its first part', () => {
    expect(onlyArgsOf('kind react-native')).toEqual([{ kinds: ['react-native'] }]);
  });

  test('a value with a dot is one value', () => {
    expect(onlyArgsOf('kind next.js')).toEqual([{ kinds: ['next.js'] }]);
  });

  test('its first part alone is the shorter value', () => {
    expect(onlyArgsOf('kind react')).toEqual([{ kinds: ['react'] }]);
  });
});
