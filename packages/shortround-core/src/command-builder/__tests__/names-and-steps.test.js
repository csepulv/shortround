// Found when an app moved to the command builder: a param's label is a word people type ("a param's key, label or
// alias starts that param"), and a next step shows a value by its title.
import { describe, expect, test } from 'vitest';

import { makeCommandBuilder } from '../engine.js';

const KINDS = [
  { value: 'library', title: 'library' },
  { value: 'tool', title: 'tool', isApplied: true }
];
const SORTS = [
  { value: 'created-newest', title: 'Created (newest)' },
  { value: 'created-oldest', title: 'Created (oldest)' }
];
const FILTERS = [
  { key: 'tags::react', value: { facet: 'tags', value: 'react' }, title: 'Tag: react' }
];

const SEARCH = {
  name: 'search',
  label: 'Search',
  aliases: [],
  run: 'app.apply',
  params: {
    term: { label: 'Search', default: true, argSource: { freeform: true, type: 'text' } },
    kinds: { label: 'Kind', list: true, hints: ['with'], argSource: { lookup: 'kinds' } },
    sort: { label: 'Sort', aliases: ['sort'], argSource: { lookup: 'sorts' } }
  }
};
const DROP = {
  name: 'drop',
  label: 'Drop filter',
  aliases: [],
  run: 'app.drop',
  params: { filter: { label: 'Filter', default: true, argSource: { lookup: 'filters' } } }
};

const makeEngine = () =>
  makeCommandBuilder({
    commands: [SEARCH, DROP],
    lookups: { kinds: () => KINDS, sorts: () => SORTS, filters: () => FILTERS }
  });

const callOf = (state) => state.readings[0]?.call;

describe("a param's label", () => {
  test('starts the param at the start of a line, though it is not an alias', () => {
    expect(callOf(makeEngine().read('kind library'))).toEqual(
      expect.objectContaining({ command: 'search', args: { kinds: ['library'] } })
    );
  });

  test('starts the param after a hint', () => {
    expect(callOf(makeEngine().read('search grid with kind library'))).toEqual(
      expect.objectContaining({ args: { term: 'grid', kinds: ['library'] } })
    );
  });
});

// One-param commands read back by their own label, as version 2's rows did.
describe("a reading's title", () => {
  test("names a one-param command by the command's label, not the param's", () => {
    expect(makeEngine().read('drop tag react').readings[0].title).toBe('Drop filter: Tag: react');
  });

  test("names a several-param command's args by their params' labels", () => {
    expect(makeEngine().read('search grid with kind library').readings[0].title).toBe(
      'Search: grid · Kind: library'
    );
  });
});

// A value already applied (a tag in the filter, the current sort) isn't offered again.
describe('a value already applied', () => {
  test('is not offered as a next step', () => {
    const labels = makeEngine()
      .read('kind ')
      .nextSteps.map(({ label }) => label);
    expect(labels).toContain('library');
    expect(labels).not.toContain('tool');
  });

  test('still runs when typed in full', () => {
    expect(callOf(makeEngine().read('kind tool'))).toEqual(
      expect.objectContaining({ args: { kinds: ['tool'] } })
    );
  });
});

describe('a next step for a value', () => {
  test('shows the value by its title', () => {
    const labels = makeEngine()
      .read('sort created')
      .nextSteps.map(({ label }) => label);
    expect(labels).toEqual(['Created (newest)', 'Created (oldest)']);
  });

  test("inserts a value that isn't text by its title, so the line reads it back", () => {
    const engine = makeEngine();
    const [step] = engine.read('drop tag ').nextSteps;
    expect(step).toEqual(
      expect.objectContaining({ label: 'Tag: react', insertText: 'drop Tag: react ' })
    );
    expect(callOf(engine.read(step.insertText))).toEqual(
      expect.objectContaining({ args: { filter: { facet: 'tags', value: 'react' } } })
    );
  });
});
