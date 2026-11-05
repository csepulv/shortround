// The palette store follows the app: given a palette from buildPalette, it starts from the states that hold now,
// re-reads when the app calls notify() (while watched) or on refresh(), and a step whose command is no longer available
// returns to the list with a message.
import { vi } from 'vitest';

import { readFixture } from '../catalog/__tests__/fixtures/read-fixture.js';
import { buildPalette } from '../catalog/build-palette.js';
import { loadCatalog } from '../catalog/load-catalog.js';
import { createPaletteStore } from '../palette-store.js';
import { createSidekickStore } from '../sidekick-store.js';
import { RevertIntentionIds } from '../utils.js';

const BROWSING = ['Search', 'Match any', 'Sort', 'Tag', 'Bookmark age', 'Preview'];
const PREVIEWING = ['Next', 'Close preview'];

// The app holds real state: a previewed result makes the previewing state hold. `notifiesFromRun`: the preview run
// tells the palette itself, before it returns (as an app's effect on its preview can). `hangsRun`: the preview run never
// settles (a request with no time limit).
function setup({ isPreviewed = false, notifiesFromRun = false, hangsRun = false } = {}) {
  const app = { previewedId: isPreviewed ? 'w2' : null };
  const bindings = {
    app: {
      conditions: { previewed: () => app.previewedId !== null },
      sortOptions: { rows: () => [{ value: 'relevance', title: 'Relevance' }] },
      search: {
        apply: vi.fn(),
        facetValueRows: () => [
          { value: 'design', title: 'design' },
          { value: 'react', title: 'react' }
        ]
      },
      results: {
        rows: () => [{ value: 'w2', title: '3. CSS grid guide', aliases: ['3'] }],
        preview: vi.fn(({ result }) => {
          app.previewedId = result;
          if (notifiesFromRun) {
            palette.notify();
          }
          return hangsRun ? new Promise(() => {}) : undefined;
        }),
        next: vi.fn(),
        openInService: vi.fn(),
        closePreview: vi.fn(() => {
          app.previewedId = null;
        }),
        previewedHasServiceLink: () => false
      }
    }
  };
  const palette = buildPalette(loadCatalog(readFixture('search-palette-v3.yaml'), bindings), {
    panels: { sidecar: () => 'panel' },
    backIntentionId: RevertIntentionIds.BACK
  });
  return { app, palette, store: createPaletteStore({ palette }) };
}

const titles = (store) => store.rows().map(({ title }) => title);
const rowId = (store, title) => store.rows().find((row) => row.title === title).id;

describe('a palette store given a palette', () => {
  test('starts from the states that hold now', () => {
    expect(titles(setup().store)).toEqual(BROWSING);
    expect(titles(setup({ isPreviewed: true }).store)).toEqual(PREVIEWING);
  });

  test('follows a change outside the palette when the app calls notify(), while watched', () => {
    const { app, palette, store } = setup({ isPreviewed: true });
    const stop = store.watchPalette();

    app.previewedId = null;
    palette.notify();
    expect(titles(store)).toEqual(BROWSING);

    stop();
    app.previewedId = 'w2';
    palette.notify();
    expect(titles(store)).toEqual(BROWSING);
  });

  test('tells its own listeners when it re-reads', () => {
    const { app, palette, store } = setup({ isPreviewed: true });
    store.watchPalette();
    const listener = vi.fn();
    store.subscribe(listener);

    app.previewedId = null;
    palette.notify();
    expect(listener).toHaveBeenCalled();
  });

  test('refresh() re-reads without watching (a host that keeps one store across opens)', () => {
    const { app, store } = setup({ isPreviewed: true });

    app.previewedId = null;
    expect(titles(store)).toEqual(PREVIEWING);
    store.refresh();
    expect(titles(store)).toEqual(BROWSING);
  });

  test('keeps what the user typed when the start list is re-read', () => {
    const { app, palette, store } = setup({ isPreviewed: true });
    store.watchPalette();
    store.changeInput('pre');

    app.previewedId = null;
    palette.notify();
    expect(store.getState().inputValue).toBe('pre');
    expect(titles(store)).toContain('Preview');
  });
});

describe('after a run', () => {
  // A run's result is the list the app's state gives (derive's `listKind: 'state'`), so it follows the app too.
  test('the list it brought follows a later change outside the palette', async () => {
    const { app, palette, store } = setup();
    store.watchPalette();
    await store.select(rowId(store, 'Preview'));
    await store.select(rowId(store, '3. CSS grid guide'));
    expect(titles(store)).toEqual(PREVIEWING);

    app.previewedId = null;
    palette.notify();
    expect(titles(store)).toEqual(BROWSING);
  });

  // The steps that led to a state list describe a state the app has left, so following the app drops them; Back then
  // has nowhere stale to go.
  test('following the app drops the steps that led to the list, so Back stays on it', async () => {
    const { app, palette, store } = setup();
    store.watchPalette();
    await store.select(rowId(store, 'Preview'));
    await store.select(rowId(store, '3. CSS grid guide'));

    app.previewedId = null;
    palette.notify();
    expect(store.getState().dispatchedStack).toEqual([]);

    await store.back();
    expect(titles(store)).toEqual(BROWSING);
  });
});

// While a choice runs, the store holds off following the app, then follows once when it settles, so its listeners never
// see the picker step judged against the new state.
describe('a run that notifies the app itself', () => {
  test('listeners never see the step called unavailable, and the store follows after the choice', async () => {
    const { store } = setup({ notifiesFromRun: true });
    store.watchPalette();
    await store.select(rowId(store, 'Preview'));
    const seen = [];
    store.subscribe(() => {
      const { inputMessage, dispatchedStack } = store.getState();
      seen.push({ message: inputMessage?.text, steps: dispatchedStack.length });
    });

    await store.select(rowId(store, '3. CSS grid guide'));

    expect(seen.filter(({ message }) => message)).toEqual([]);
    const refilled = seen.findIndex(
      ({ steps }, index) => index > 0 && steps > 0 && seen[index - 1].steps === 0
    );
    expect(refilled).toBe(-1);
    expect(titles(store)).toEqual(PREVIEWING);
    expect(store.getState().inputMessage).toBeUndefined();
    // It followed once the choice was done: following to a state list drops the steps that led there.
    expect(store.getState().dispatchedStack).toEqual([]);
  });

  // A run that never settles is no longer the choice that counts once the user makes another one (Cancel here), so the
  // store follows the app again.
  test('after a run that never settles, a later choice lets the store follow the app again', async () => {
    const { app, palette, store } = setup({ hangsRun: true });
    store.watchPalette();
    await store.select(rowId(store, 'Preview'));
    store.select(rowId(store, '3. CSS grid guide'));

    await store.select(RevertIntentionIds.RESET);
    app.previewedId = null;
    palette.notify();

    expect(titles(store)).toEqual(BROWSING);
  });
});

describe('a step in progress when the app changes', () => {
  test('returns to the list, with a message, when its command is no longer available', async () => {
    const { app, palette, store } = setup();
    store.watchPalette();
    await store.select(rowId(store, 'Preview'));
    expect(titles(store)).toEqual(['3. CSS grid guide']);

    app.previewedId = 'w2';
    palette.notify();
    expect(titles(store)).toEqual(PREVIEWING);
    expect(store.getState().dispatchedStack).toEqual([]);
    expect(store.getState().inputMessage).toEqual({
      type: 'error',
      text: "Preview isn't available now"
    });
  });

  test('stays where it is when its command is still available', async () => {
    const { palette, store } = setup();
    store.watchPalette();
    await store.select(rowId(store, 'Tag'));
    expect(titles(store)).toEqual(['design', 'react']);

    palette.notify();
    expect(titles(store)).toEqual(['design', 'react']);
    expect(store.getState().inputMessage).toBeUndefined();
  });
});

describe('Back and Cancel', () => {
  test('land on the list as the app is now, not as it was when the store was made', async () => {
    const { app, store } = setup();
    await store.select(rowId(store, 'Tag'));

    app.previewedId = 'w2';
    await store.back();
    expect(titles(store)).toEqual(PREVIEWING);
  });

  test('propose the side panel of the state that holds now', async () => {
    const { app, store } = setup();
    const sidekickStore = createSidekickStore();
    await store.select(rowId(store, 'Tag'), { sidekickStore });

    app.previewedId = 'w2';
    await store.select(RevertIntentionIds.BACK, { sidekickStore });
    expect(sidekickStore.get().internalSidecarRenderer?.()).toBe('panel');
  });

  // Cancel shares Back's start result; this checks it on its own.
  test('Cancel lands on the list as the app is now, with its side panel', async () => {
    const { app, store } = setup();
    const sidekickStore = createSidekickStore();
    await store.select(rowId(store, 'Tag'), { sidekickStore });

    app.previewedId = 'w2';
    await store.select(RevertIntentionIds.RESET, { sidekickStore });
    expect(titles(store)).toEqual(PREVIEWING);
    expect(sidekickStore.get().internalSidecarRenderer?.()).toBe('panel');
  });
});
