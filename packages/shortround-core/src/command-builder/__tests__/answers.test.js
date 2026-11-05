import { describe, expect, test } from 'vitest';

import { CORPUS, makeEngine, OPERATOR_LINES } from './fixtures/engines.js';
import { matchesAny } from './fixtures/match-call.js';

// Known answers, through the command builder's own contract.
const engine = makeEngine();
const top = (text) => engine.read(text).readings[0];
const titles = (text) => engine.read(text).readings.map(({ title }) => title);
const labels = (text) => engine.read(text).nextSteps.map(({ label }) => label);

describe('the corpora', () => {
  test.each(CORPUS.map(({ text, accept }) => [text, accept]))('%s', (text, accept) => {
    const row = top(text);
    expect(row?.call.command).toBe('search');
    expect(matchesAny(row.call.args, accept)).toBe(true);
  });

  test.each(OPERATOR_LINES)('%s', (text, expected) => {
    expect(top(text).call.args).toEqual(expected);
  });
});

describe('behaviour', () => {
  test('read-back', () => {
    expect(top('search owl with tags react, ai sort relevance').title).toBe(
      'Search: owl · Tags: react, ai · Sort: Relevance'
    );
  });

  test('an open lookup param lists its values; a partial value narrows them', () => {
    expect(labels('search owl with tags ')).toEqual([
      'react',
      'react-native',
      'grid',
      'ai',
      'design'
    ]);
    expect(labels('search owl with tags re')).toEqual(['react', 'react-native']);
  });

  // was: search owl sort fav
  test('a partial value offers each complete reading', () => {
    expect(titles('search owl sort by fav')).toEqual([
      'Search: owl · Sort: Favorites + Relevance',
      'Search: owl · Sort: Favorites + Bookmarked'
    ]);
  });

  test('narrowing between commands', () => {
    expect(titles('with tags react')).toEqual([
      'Search · Tags: react',
      'Add bookmark · Tags: react (needs URL)'
    ]);
  });

  test('priority keeps the other readings as rows', () => {
    expect(titles('search grid from last week').slice(0, 2)).toEqual([
      'Search: grid · Bookmarked: last week',
      'Search: grid · Created: last week'
    ]);
  });

  test('a broken line says why and offers the quoted fix', () => {
    const state = engine.read('search tools for react');
    expect(state.readings).toEqual([]);
    expect(state.problem).toBe('Search is already "tools"');
    expect(state.nextSteps).toContainEqual(
      expect.objectContaining({ insertText: 'search "tools for react"' })
    );
  });
});
