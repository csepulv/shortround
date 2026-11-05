import { describe, expect, test } from 'vitest';

import { makeEngine } from './fixtures/engines.js';

// A line that works when finished looked broken while it was typed (was: search fire alarm type chat service
// claude, chatgpt from).
const LINE = 'search fire alarm with type chat service claude, chatgpt from';

const labels = (text) =>
  makeEngine()
    .read(text)
    .nextSteps.map(({ label }) => label);

describe('after a hint, the hinted params offer their values', () => {
  test('a date being typed', () => {
    expect(labels(`${LINE} l`)).toEqual(
      expect.arrayContaining(['last 7 days', 'last week', 'last month', 'last year'])
    );
  });

  test('a service being typed (claude is already chosen, so only claude-code)', () => {
    expect(labels(`${LINE} cl`)).toEqual(['claude-code']);
  });

  test('with nothing typed yet, only the params', () => {
    expect(labels(`${LINE} `)).toEqual(['service', 'bookmarked', 'created']);
  });
});

describe('an unfinished value is explained, not shown as nothing', () => {
  test('a date not yet complete', () => {
    const state = makeEngine().read(`${LINE} last`);
    expect(state.readings).toEqual([]);
    expect(state.problem).toBeUndefined();
    expect(state.incomplete).toEqual([
      'Keep typing a date for Bookmarked or Created, such as last week, July or Jun-Sep 2025'
    ]);
  });

  test('only values come next while the date is unfinished', () => {
    const steps = labels(`${LINE} last `);
    expect(steps).toEqual(expect.arrayContaining(['last week', 'last month']));
    expect(steps).not.toContain('with');
  });

  test('a hint with nothing after it yet', () => {
    expect(makeEngine().read('search owl with').incomplete).toEqual([
      'After "with": Tags, Format, Kind or Sort'
    ]);
  });

  test('once the line runs, nothing is explained', () => {
    const state = makeEngine().read(`${LINE} last week`);
    expect(state.readings[0].title).toContain('Bookmarked: last week');
    expect(state.incomplete).toEqual([]);
  });
});
