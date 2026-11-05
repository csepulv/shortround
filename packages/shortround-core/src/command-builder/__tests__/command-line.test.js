// The command line: a line read against the commands, that says what a host should show (each word's role, the ghost,
// the next steps, loading) and what Tab and Enter do. Tested on the engine's own fixture.
import { describe, expect, test, vi } from 'vitest';

import { makeCommandLine } from '../command-line.js';
import { makeCommandBuilder } from '../engine.js';
import { LOADING_DELAY_MS } from '../loading-delay.js';
import { ADD, makeLookups, SEARCH } from './fixtures/commands.js';
import { now as engineNow } from './fixtures/engines.js';

// Time the test moves by hand: `schedule` callbacks run when `advance` passes their time.
function makeManualClock() {
  let time = 0;
  let timers = [];
  return {
    now: () => time,
    schedule: (callback, ms) => {
      timers.push({ at: time + ms, callback });
    },
    advance: (ms) => {
      time += ms;
      const due = timers.filter(({ at }) => at <= time);
      timers = timers.filter(({ at }) => at > time);
      due.forEach(({ callback }) => callback());
    }
  };
}

// `tags` replaces the Tags lookup (a slow one, for loading).
function setup({ tags } = {}) {
  const lookups = { ...makeLookups(), ...(tags ? { 'facetValues.tags': tags } : {}) };
  const builder = makeCommandBuilder({ commands: [SEARCH, ADD], lookups, now: engineNow });
  const run = vi.fn();
  const clock = makeManualClock();
  const line = makeCommandLine({ builder, run, now: clock.now, schedule: clock.schedule });
  return { line, run, clock };
}

const rolesOf = (state) => state.roles.map(({ text, role }) => `${text}:${role}`);

describe('the command line', () => {
  test('a command being typed shows the rest of its name as ghost text, and Tab completes it', () => {
    const { line } = setup();

    line.change('sea');
    expect(line.getState().ghost).toBe('rch ');

    expect(line.acceptCompletion()).toBe(true);
    expect(line.getState()).toMatchObject({ text: 'search ', caret: 7 });
  });

  test('each word has its role, and Tab completes the value being typed', () => {
    const { line } = setup();

    line.change('search owl with sort cre');
    const state = line.getState();
    expect(rolesOf(state)).toEqual([
      'search:verb',
      'owl:text',
      'with:hint',
      'sort:param',
      'cre:value'
    ]);
    expect(state.ghost).toBe('ated-newest ');

    line.acceptCompletion();
    expect(line.getState()).toMatchObject({
      text: 'search owl with sort created-newest ',
      caret: 36
    });
  });

  test('Enter runs a complete line once, with every arg, and clears the line', async () => {
    const { line, run } = setup();

    line.change('search owl with tags react');
    expect(line.getState()).toMatchObject({
      canRun: true,
      top: { title: 'Search: owl · Tags: react' }
    });

    await line.submit();
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'search', args: { term: 'owl', tags: ['react'] } })
    );
    expect(line.getState()).toMatchObject({ text: '', caret: 0 });
  });

  test("Enter on a line that can't run yet completes the first next step and runs nothing", async () => {
    const { line, run } = setup();

    line.change('search owl with');
    expect(line.getState().canRun).toBe(false);

    await line.submit();
    expect(run).not.toHaveBeenCalled();
    expect(line.getState()).toMatchObject({ text: 'search owl with ', caret: 16 });
  });

  test('a slow lookup says it is loading only after the delay, and its values come once it lands', async () => {
    let land;
    const { line, clock } = setup({
      tags: () =>
        new Promise((resolve) => {
          land = () => resolve([{ value: 'react', title: 'react' }]);
        })
    });
    line.change('search owl with tags ');
    expect(line.getState().loading).toEqual([]);
    const listener = vi.fn();
    line.subscribe(listener);

    clock.advance(LOADING_DELAY_MS);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(line.getState().loading).toEqual([{ param: 'tags', label: 'Tags' }]);

    land();
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(2));
    const state = line.getState();
    expect(state.loading).toEqual([]);
    expect(state.nextSteps.map(({ label }) => label)).toContain('react');
  });

  test('a broken line marks the word where it broke, and Enter does nothing', async () => {
    const { line, run } = setup();

    line.change('search owl with tags zzz');
    const state = line.getState();
    expect(state.roles.at(-1)).toMatchObject({
      text: 'zzz',
      role: 'broken',
      reason: 'No Tags value matches "zzz"'
    });
    expect(state.problem).toBe('No Tags value matches "zzz"');

    expect(await line.submit()).toBe(false);
    expect(run).not.toHaveBeenCalled();
    expect(line.getState().text).toBe('search owl with tags zzz');
  });

  test('Tab with words after the caret completes the word and leaves the caret before them', () => {
    const { line } = setup();

    line.change('sea owl', 3);
    line.acceptCompletion();
    expect(line.getState()).toMatchObject({ text: 'search owl', caret: 7 });
  });

  // An empty line's ghost would draw over the input's placeholder.
  test('an empty line has no ghost text', () => {
    const { line } = setup();

    line.change('');
    const state = line.getState();
    expect(state.nextSteps[0]).toMatchObject({ insertText: 'search ' });
    expect(state.ghost).toBeUndefined();
  });

  // A UI reads the command line with useSyncExternalStore, which needs the same object until something changes.
  test('the state is the same object until something changes', () => {
    const { line } = setup();

    line.change('sea');
    const first = line.getState();
    expect(line.getState()).toBe(first);

    line.change('sear');
    expect(line.getState()).not.toBe(first);
  });

  // A host that drops a line must be able to release it, or the builder keeps telling it about every lookup that lands.
  test('after dispose(), a lookup that lands tells the line nothing', async () => {
    let land;
    const { line } = setup({
      tags: () =>
        new Promise((resolve) => {
          land = () => resolve([{ value: 'react', title: 'react' }]);
        })
    });
    line.change('search owl with tags ');
    const listener = vi.fn();
    line.subscribe(listener);

    line.dispose();
    land();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(listener).not.toHaveBeenCalled();
  });

  // A second Enter before a slow run settles.
  test('Enter while the line is running runs nothing more', async () => {
    const { line, run } = setup();
    let finish;
    const running = new Promise((resolve) => (finish = resolve));
    run.mockImplementation(() => running);
    line.change('search owl with tags react');

    const first = line.submit();
    const second = line.submit();
    finish();
    await Promise.all([first, second]);

    expect(run).toHaveBeenCalledTimes(1);
  });

  test('text typed while the line runs is still there after the run', async () => {
    const { line, run } = setup();
    let finish;
    run.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    line.change('search owl with tags react');

    const submitted = line.submit();
    line.change('search other');
    finish();
    await submitted;

    expect(line.getState().text).toBe('search other');
  });

  // At the end of "sea" the ghost is "rch "; with the caret after "s", the same next step ("search ") would still
  // continue the text, so only the caret decides.
  test('with the caret inside a word, there is no ghost text', () => {
    const { line } = setup();

    line.change('sea', 1);
    const state = line.getState();
    expect(state.nextSteps[0]).toMatchObject({ insertText: 'search ' });
    expect(state.ghost).toBeUndefined();
  });
});
