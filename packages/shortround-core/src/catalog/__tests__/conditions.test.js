import { describe, expect, test } from 'vitest';

import { compileWhen } from '../conditions.js';

const CONDITIONS = {
  previewed: () => true,
  readOnly: () => false,
  hasResults: () => true,
  chosenTag: ({ args }) => Boolean(args?.tags?.length)
};
const resolve = (path) => {
  const name = path.replace(/^app\.conditions\./, '');
  if (!CONDITIONS[name]) {
    throw new Error(`the app does not provide "${path}"`);
  }
  return CONDITIONS[name];
};
const when = (clause, reading = {}) => compileWhen(clause, { resolve, owner: 'test' })(reading);

describe('a when clause', () => {
  test.each([
    ['app.conditions.previewed', true],
    ['!app.conditions.previewed', false],
    ['app.conditions.previewed && !app.conditions.readOnly', true],
    ['app.conditions.readOnly || app.conditions.hasResults', true],
    ['!(app.conditions.previewed && app.conditions.hasResults)', false],
    ['app.conditions.readOnly || (app.conditions.previewed && app.conditions.hasResults)', true]
  ])('%s → %s', (clause, expected) => {
    expect(when(clause)).toBe(expected);
  });

  test('a condition can read the reading (the command and the args so far)', () => {
    expect(when('app.conditions.chosenTag', { args: { tags: ['react'] } })).toBe(true);
    expect(when('app.conditions.chosenTag', { args: {} })).toBe(false);
  });
});

describe('what a clause may not say', () => {
  test.each([
    'app.conditions.count > 0',
    "app.conditions.sort == 'relevance'",
    'app.conditions.previewed()',
    'app.conditions["previewed"]',
    'true'
  ])('%s fails when the catalog loads', (clause) => {
    expect(() => compileWhen(clause, { resolve, owner: 'Command "next"' })).toThrow(
      /^Command "next": when /
    );
  });

  test('an unknown condition fails when the catalog loads, naming it', () => {
    expect(() => compileWhen('app.conditions.missing', { resolve, owner: 'x' })).toThrow(
      'the app does not provide "app.conditions.missing"'
    );
  });

  test('a condition that returns something other than a boolean fails when evaluated', () => {
    const lax = compileWhen('app.conditions.lax', { resolve: () => () => 1, owner: 'x' });
    expect(() => lax({})).toThrow('Condition "app.conditions.lax" returned number');
  });
});
