import { describe, expect, test } from 'vitest';

import { makeEngine } from './fixtures/engines.js';

// A freeform text arg runs until a reserved word (a hint). Right after the command name, a param word starts a
// param. Value aliases are ordinary words inside a term, and a hint narrows what may follow it.
const engine = makeEngine();
const argsOf = (text) => engine.read(text).readings[0]?.call.args;

describe('a freeform term runs until a reserved word', () => {
  test('param words inside a started term are part of it', () => {
    expect(argsOf('search notes kind tool')).toEqual({ term: 'notes kind tool' });
  });

  test('a hint ends the term', () => {
    expect(argsOf('search notes with kind tool')).toEqual({ term: 'notes', kind: ['tool'] });
  });

  test('a list arg ends once matched, so the next param word starts a param', () => {
    expect(argsOf('search notes with kind tool tagged react')).toEqual({
      term: 'notes',
      kind: ['tool'],
      tags: ['react']
    });
  });
});

describe('right after the command name', () => {
  test('a param word starts a param', () => {
    expect(argsOf('search sort oldest')).toEqual({ sort: 'bookmarked-oldest' });
  });

  test('once the term has started, the same words are text', () => {
    expect(argsOf('search foo sort oldest')).toEqual({ term: 'foo sort oldest' });
  });

  test('a value alias starts the term instead', () => {
    expect(argsOf('search latest news')).toEqual({ term: 'latest news' });
  });

  test('a param word with nothing after it yet is a Search being typed, not a problem', () => {
    const state = engine.read('search kind ');
    expect(state.problem).toBeUndefined();
    expect(state.nextSteps.map(({ label }) => label)).toEqual(
      expect.arrayContaining(['library', 'tool', 'article'])
    );
  });
});

describe('hints and value aliases', () => {
  test('a hint narrows what may follow it: "for" introduces only the term', () => {
    expect(argsOf('search for latest news')).toEqual({ term: 'latest news' });
  });

  test('a value alias on its own still implies its param', () => {
    expect(argsOf('latest')).toEqual({ sort: 'bookmarked-newest' });
  });

  test('the next steps inside a term offer hints, not param words', () => {
    const labels = engine.read('search notes s').nextSteps.map(({ label }) => label);
    expect(labels).toEqual(expect.arrayContaining(['sort by', 'sorted by', 'since']));
    expect(labels).not.toContain('sort');
    expect(labels).not.toContain('service');
  });
});
