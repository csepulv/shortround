// One reader for rows and input: a store watching a catalog palette reads typed lines through one command line, its
// `commandLine()`. Its typed-line rows are that line's rows (`rows()`), so a lookup is called once per text, and the
// rows, the ghost and Tab agree, mid-line too.
import { vi } from 'vitest';

import { buildPalette } from '../catalog/build-palette.js';
import { loadCatalog } from '../catalog/load-catalog.js';
import { LOADING_DELAY_MS } from '../command-builder/loading-delay.js';
import { createPaletteStore } from '../palette-store.js';

// A command with a default lookup param (`item`, counted) and another introduced by "with".
const CATALOG = `
version: 3
app: app
states:
  working: { commands: [paint] }
commands:
  paint:
    label: Paint
    run: app.paint
    params:
      item: { label: Item, default: true, argSource: { lookup: app.items } }
      color:
        label: Color
        hints: [with]
        argSource: { list: [{ value: red, title: red }] }
`;

function setup({ items = () => [{ value: 'fence', title: 'fence' }] } = {}) {
  const lookup = vi.fn(items);
  const paint = vi.fn();
  const palette = buildPalette(loadCatalog(CATALOG, { app: { paint, items: lookup } }), {
    backIntentionId: 'back'
  });
  const store = createPaletteStore({ palette });
  return { lookup, paint, palette, store };
}

const completionsOf = (rows) =>
  rows.filter(({ completion }) => completion !== undefined).map(({ completion }) => completion);

describe('a store watching a catalog palette reads typed lines through one command line', () => {
  test('the lookup is called once for the text, and the rows and the line agree', () => {
    const { lookup, store } = setup();
    store.watchPalette();

    store.changeInput('paint ');
    const rows = store.rows();
    const lineSteps = store.commandLine().getState().nextSteps;

    expect(lookup).toHaveBeenCalledTimes(1);
    expect(completionsOf(rows)).toEqual(lineSteps.map(({ insertText }) => insertText));
    expect(completionsOf(rows)).toContain('paint fence ');
  });

  test('with the caret mid-line, the completion rows are the next steps at the caret', () => {
    const { store } = setup();
    store.watchPalette();

    store.changeInput('paint f with red', 'paint f'.length);

    expect(completionsOf(store.rows())).toEqual(['paint fence with red']);
    expect(store.commandLine().getState().caret).toBe('paint f'.length);
  });

  // The caret lands after the inserted word and its space, before the words that followed (the line's rule).
  test('Tab completes at the caret, and the caret goes after the inserted word', () => {
    const { store } = setup();
    store.watchPalette();
    store.changeInput('paint f with red', 'paint f'.length);

    expect(store.completeFirst()).toBe(true);

    expect(store.getState().inputValue).toBe('paint fence with red');
    expect(store.commandLine().getState().caret).toBe('paint fence '.length);
  });

  // The store's own change to its line doesn't come back to it as a second update.
  test('typing tells the listeners once', () => {
    const { store } = setup();
    store.watchPalette();
    const listener = vi.fn();
    store.subscribe(listener);

    store.changeInput('paint ');

    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("a command row runs the line's call once", async () => {
    const { paint, store } = setup();
    store.watchPalette();
    store.changeInput('paint fence ');
    const command = store.rows().find(({ group }) => group === 'Commands');

    await store.select(command.id);

    expect(paint).toHaveBeenCalledTimes(1);
    expect(paint).toHaveBeenCalledWith({ item: 'fence' });
  });

  test('a lookup with nothing to offer says so in a Status row', () => {
    const { store } = setup({ items: () => [] });
    store.watchPalette();

    store.changeInput('paint ');

    expect(store.rows().map(({ group, title }) => `${group}: ${title}`)).toContain(
      'Status: No item to choose from'
    );
  });

  test('the line is made when watching starts and disposed when it stops: nothing reads after', async () => {
    let land;
    const { store } = setup({
      items: () =>
        new Promise((resolve) => {
          land = () => resolve([{ value: 'fence', title: 'fence' }]);
        })
    });
    expect(store.commandLine()).toBeNull();

    const stop = store.watchPalette();
    store.changeInput('paint ');
    const listener = vi.fn();
    store.subscribe(listener);
    stop();
    land();
    await Promise.resolve();
    await Promise.resolve();

    expect(store.commandLine()).toBeNull();
    expect(listener).not.toHaveBeenCalled();
  });

  test('when its lookup lands, the store re-reads and tells its listeners', async () => {
    let land;
    const { store } = setup({
      items: () =>
        new Promise((resolve) => {
          land = () => resolve([{ value: 'fence', title: 'fence' }]);
        })
    });
    store.watchPalette();
    store.changeInput('paint ');
    const listener = vi.fn();
    store.subscribe(listener);

    land();
    await vi.waitFor(() => expect(completionsOf(store.rows())).toContain('paint fence '));
    expect(listener).toHaveBeenCalled();
  });

  // A PaletteSource of the app's own may give a line without rows(): the hints still have a line, the rows the list.
  test("a source's line without rows() still gives typed rows, from the list's resolver", () => {
    const { palette } = setup();
    const source = {
      ...palette,
      commandLine: () => {
        // eslint-disable-next-line no-unused-vars
        const { rows, ...line } = palette.commandLine();
        return line;
      }
    };
    const store = createPaletteStore({ palette: source });
    store.watchPalette();

    store.changeInput('paint ');

    expect(store.commandLine()).not.toBeNull();
    expect(completionsOf(store.rows())).toContain('paint fence ');
  });

  // A lookup that throws is a failed lookup, as a rejected one is; the typed text stays.
  test("a lookup that throws keeps the typed text, and the rows say it couldn't load", () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { store } = setup({
      items: () => {
        throw new Error('boom');
      }
    });
    store.watchPalette();

    expect(() => store.changeInput('paint ')).not.toThrow();

    expect(store.getState().inputValue).toBe('paint ');
    expect(store.rows().map(({ group, title }) => `${group}: ${title}`)).toContain(
      "Status: Couldn't load item"
    );
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  // Watches share the one line; it goes when the last one stops.
  test('two watches share one line, and it is disposed when the last one stops', () => {
    const { lookup, palette, store } = setup();
    const stopFirst = store.watchPalette();
    const stopSecond = store.watchPalette();
    store.changeInput('paint ');

    stopFirst();
    expect(store.commandLine()).not.toBeNull();

    stopSecond();
    lookup.mockClear();
    palette.notify();
    expect(store.commandLine()).toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });

  // New defaults while watched read through the new source, or the list's resolver.
  test('new defaults while watched: plain rows read with their resolver, a new palette through its own line', () => {
    const first = setup();
    first.store.watchPalette();
    const resolveDefaultInput = vi.fn(() => [{ id: 'plain', title: 'Plain row' }]);

    first.store.setDefaults({ defaultIntentions: [], resolveDefaultInput });
    first.store.changeInput('paint ');
    expect(first.store.rows().map(({ id }) => id)).toEqual(['plain']);
    expect(first.store.commandLine()).toBeNull();

    const second = setup();
    first.lookup.mockClear();
    first.store.setDefaults({ palette: second.palette });
    first.store.changeInput('paint ');
    expect(completionsOf(first.store.rows())).toContain('paint fence ');
    expect(second.lookup).toHaveBeenCalledTimes(1);
    expect(first.lookup).not.toHaveBeenCalled();
  });

  // The older obligations, through a watched catalog store (the path that ships).
  test('when a slow lookup lands, the highlight moves to the command that can now run, and it runs once', async () => {
    let land;
    const { paint, store } = setup({
      items: () =>
        new Promise((resolve) => {
          land = () => resolve([{ value: 'fence', title: 'fence' }]);
        })
    });
    store.watchPalette();
    store.changeInput('paint fence ');
    const before = store.getState().highlightedId;

    land();
    await vi.waitFor(() => expect(store.getState().highlightedId).not.toBe(before));

    const highlighted = store.rows().find(({ id }) => id === store.getState().highlightedId);
    expect(highlighted.group).toBe('Commands');
    await store.select(highlighted.id);
    expect(paint).toHaveBeenCalledTimes(1);
    expect(paint).toHaveBeenCalledWith({ item: 'fence' });
  });

  test('"Loading" shows only once the lookup has been pending for the delay', () => {
    vi.useFakeTimers();
    try {
      const { store } = setup({ items: () => new Promise(() => {}) });
      store.watchPalette();
      const statusRows = () =>
        store
          .rows()
          .filter(({ group }) => group === 'Status')
          .map(({ title }) => title);

      store.changeInput('paint ');
      expect(statusRows()).toEqual([]);

      vi.advanceTimersByTime(LOADING_DELAY_MS);
      expect(statusRows()).toEqual(['Loading item…']);
    } finally {
      vi.useRealTimers();
    }
  });

  test('a command row on screen still runs after the app data moved on', async () => {
    const data = { items: [{ value: 'fence', title: 'fence' }] };
    const { paint, palette, store } = setup({ items: () => data.items });
    store.watchPalette();
    store.changeInput('paint fence ');
    const command = store.rows().find(({ group }) => group === 'Commands');

    data.items = [];
    palette.notify();
    await store.select(command.id);

    expect(paint).toHaveBeenCalledWith({ item: 'fence' });
  });

  // Mid-line, the command row is the whole line's reading.
  test('with the caret mid-line, the command row reads the whole line', () => {
    const { store } = setup();
    store.watchPalette();

    store.changeInput('paint fence with red', 'paint f'.length);

    const commands = store.rows().filter(({ group }) => group === 'Commands');
    expect(commands.map(({ call }) => call.args)).toEqual([{ item: 'fence', color: 'red' }]);
  });

  // Pins: these read as before.
  test('an unwatched store reads typed lines with the list resolver, and has no line', () => {
    const { store } = setup();

    store.changeInput('paint ');

    expect(store.commandLine()).toBeNull();
    expect(completionsOf(store.rows())).toContain('paint fence ');
  });

  test("in a picker the input filters the picker's rows and the line isn't read", async () => {
    const { store } = setup();
    store.watchPalette();
    const line = store.commandLine();
    await store.dispatch('app.paint.item');
    expect(store.getState().currentIntentions.map(({ title }) => title)).toEqual(['fence']);

    store.changeInput('fen');

    expect(store.rows().map(({ title }) => title)).toEqual(['fence']);
    expect(line.getState().text).toBe('');
    // While the input isn't a command line, the store hands out none.
    expect(store.commandLine()).toBeNull();
  });
});
