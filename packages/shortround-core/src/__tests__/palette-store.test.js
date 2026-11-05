import { matchIntentions } from '../match-intentions.js';
import { createPaletteStore } from '../palette-store.js';
import { createSidekickStore } from '../sidekick-store.js';
import { RevertIntentionIds } from '../utils.js';

// The palette's state without React. The behaviours are useShortRound's, as its tests in @shortround/react pin them
// (useShortRound.test.js, fallback-input.test.js), and ShortRoundPalette's onSelect.

const { BACK, RESET } = RevertIntentionIds;

const ids = (store) => store.rows().map(({ id }) => id);

function makeStart() {
  const first = { id: 'abc', title: 'Search', group: 'Actions', aliases: ['fetch items', 'find'] };
  const second = { id: 'def', title: 'Read', group: 'Other', aliases: ['scan', 'find'] };
  const third = { id: 'ghi', title: 'Write', group: 'Actions', aliases: ['scribe', 'pen'] };
  const list = [
    { id: '123', title: 'One', group: 'One', action: () => {} },
    { id: '456', title: 'Two', group: 'Two', action: () => {} }
  ];
  return { first, second, third, list, defaults: [first, second, third] };
}

describe('typing', () => {
  test('matches fuzzily over title, group and aliases, keeping list order', () => {
    const { first, second, third, defaults } = makeStart();
    const store = createPaletteStore({ defaultIntentions: defaults });

    store.changeInput('ea');
    expect(store.rows()).toEqual([first, second]);
    store.changeInput('act');
    expect(store.rows()).toEqual([first, third]);
    store.changeInput('scri');
    expect(store.rows()).toEqual([third]);
  });

  // A host can ask core's matching what the palette would show, instead of copying it.
  test('matchIntentions returns exactly what the palette shows for typed text', () => {
    const { defaults } = makeStart();
    const store = createPaletteStore({ defaultIntentions: defaults });

    for (const text of ['ea', 'act', 'find', 'zzz', '']) {
      store.changeInput(text);
      expect(store.rows()).toEqual(matchIntentions(text, defaults));
    }
  });

  test('does not match on id', () => {
    const store = createPaletteStore({ defaultIntentions: makeStart().defaults });
    store.changeInput('abc');
    expect(store.rows()).toEqual([]);
  });

  test('a result that turns matching off shows its list whatever is typed', async () => {
    const { second, list, defaults } = makeStart();
    second.action = () => ({ intentions: list, disableInputMatching: true });
    const store = createPaletteStore({ defaultIntentions: defaults });

    await store.dispatch(second.id);
    store.changeInput('does not change the list');

    expect(store.rows()).toEqual(list);
  });

  // Turning matching off belongs to the list, as Back and Cancel do. A result that brings no list leaves it as it is.
  describe('matching off belongs to the list', () => {
    function typedTextStep() {
      const { second, defaults } = makeStart();
      const help = { id: 'help', title: 'Help', action: () => ({ message: 'Type a name' }) };
      const name = { id: 'name', title: 'Name it', action: () => {} };
      second.action = () => ({
        intentions: [name, help],
        disableInputMatching: true,
        includeRevertIntentions: [BACK]
      });
      return { second, help, name, store: createPaletteStore({ defaultIntentions: defaults }) };
    }

    test('a row whose result brings no list leaves matching off', async () => {
      const { second, help, name, store } = typedTextStep();
      await store.dispatch(second.id);

      await store.dispatch(help.id);
      store.changeInput('zzz');

      expect(store.getState().disableInputMatching).toBe(true);
      expect(store.rows()).toEqual([name, help]);
    });

    // Pins: these read the same as before.
    test('a result that brings a list without it turns matching back on', async () => {
      const { second, name, store } = typedTextStep();
      const { list } = makeStart();
      name.action = () => ({ intentions: list });
      await store.dispatch(second.id);

      await store.dispatch(name.id);
      store.changeInput('One');

      expect(store.getState().disableInputMatching).toBeFalsy();
      expect(store.rows()).toEqual([list[0]]);
    });

    test('Back to the start list turns matching back on', async () => {
      const { second, store } = typedTextStep();
      await store.dispatch(second.id);

      await store.dispatch(BACK);
      store.changeInput('scri');

      expect(store.rows().map(({ id }) => id)).toEqual(['ghi']);
    });
  });

  test('new defaults show and clear the input', () => {
    const { first, defaults } = makeStart();
    const store = createPaletteStore({ defaultIntentions: defaults });
    store.changeInput('some value');

    store.setDefaults({ defaultIntentions: [first] });

    expect(store.rows()).toEqual([first]);
    expect(store.getState().inputValue).toBe('');
  });

  test('each change tells the listeners', () => {
    const store = createPaletteStore({ defaultIntentions: makeStart().defaults });
    const listener = vi.fn();
    store.subscribe(listener);

    store.changeInput('a');

    expect(listener).toHaveBeenCalled();
  });
});

describe('dispatch', () => {
  test('an unknown id throws', async () => {
    const store = createPaletteStore({ defaultIntentions: makeStart().defaults });
    await expect(store.dispatch('bad-id')).rejects.toThrow(
      'Invariant failed: Unknown intention id: bad-id'
    );
  });

  test('runs the action with the input, shows its list and clears the input', async () => {
    const { second, list, defaults } = makeStart();
    second.action = vi.fn(() => ({ intentions: list }));
    const store = createPaletteStore({ defaultIntentions: defaults });
    store.changeInput('foo');

    await store.dispatch(second.id);

    expect(second.action).toHaveBeenCalledWith('foo');
    expect(store.rows()).toEqual(list);
    expect(store.getState().inputValue).toBe('');
  });

  test('an action that returns nothing leaves the list', async () => {
    const { second, defaults } = makeStart();
    second.action = () => undefined;
    const store = createPaletteStore({ defaultIntentions: defaults });

    await store.dispatch(second.id);

    expect(store.rows()).toEqual(defaults);
  });
});

describe('validation and disabled intentions', () => {
  test('validate runs on each input change, setting disabled and the message', () => {
    const { first, third, defaults } = makeStart();
    first.disabled = true;
    first.validate = vi.fn(() => ({ valid: true }));
    third.validate = vi.fn(() => ({ valid: false, message: 'Not Valid' }));
    const store = createPaletteStore({ defaultIntentions: defaults });

    store.changeInput('');

    expect(store.rows()[0].disabled).toBe(false);
    expect(store.rows()[2].disabled).toBe(true);
    expect(store.getState().inputMessage).toEqual({ type: 'error', text: 'Not Valid' });
  });

  test('the message clears once the input is valid, and on dispatch', async () => {
    const { second, third, list, defaults } = makeStart();
    third.validate = (value) =>
      value === 'ok' ? { valid: true } : { valid: false, message: 'Not Valid' };
    second.action = () => ({ intentions: list });
    const store = createPaletteStore({ defaultIntentions: defaults });

    store.changeInput('bad');
    store.changeInput('ok');
    expect(store.getState().inputMessage).toBeUndefined();

    store.changeInput('bad');
    await store.dispatch(second.id);
    expect(store.getState().inputMessage).toBeUndefined();
  });

  test('a disabled intention is rejected: nothing runs, the input stays, the message says why', async () => {
    const { second, defaults } = makeStart();
    second.disabled = true;
    second.action = vi.fn();
    const store = createPaletteStore({ defaultIntentions: defaults });
    store.changeInput('typed');

    const result = await store.dispatch(second.id);

    expect(result).toEqual({ isRejected: true });
    expect(second.action).not.toHaveBeenCalled();
    expect(store.getState().inputValue).toBe('typed');
    expect(store.getState().inputMessage).toEqual({
      type: 'error',
      text: 'Not available right now'
    });
  });

  test('validates against the current input at dispatch, even without an input change', async () => {
    const { second, defaults } = makeStart();
    const needsText = {
      id: 'needs-text',
      title: 'Name it',
      action: vi.fn(),
      validate: (value) => (value ? { valid: true } : { valid: false, message: 'Type a name' })
    };
    second.action = () => ({ intentions: [needsText], disableInputMatching: true });
    const store = createPaletteStore({ defaultIntentions: defaults });
    await store.dispatch(second.id);

    const result = await store.dispatch(needsText.id);

    expect(result).toEqual({ isRejected: true });
    expect(needsText.action).not.toHaveBeenCalled();
    expect(store.getState().inputMessage).toEqual({ type: 'error', text: 'Type a name' });
  });
});

describe('Back and Cancel', () => {
  async function twoListsDeep(listForThird) {
    const { first, second, third, list, defaults } = makeStart();
    const secondList = [list[0], third];
    const secondResult = { intentions: secondList, includeRevertIntentions: [BACK, RESET] };
    second.action = vi.fn(() => secondResult);
    third.action = vi.fn(() => ({
      intentions: listForThird ?? defaults,
      includeRevertIntentions: [BACK, RESET]
    }));
    first.action = () => ({ shouldReset: true });
    const store = createPaletteStore({ defaultIntentions: defaults });
    await store.dispatch(second.id);
    await store.dispatch(third.id);
    return { store, second, third, secondList, secondResult, defaults };
  }

  test('Back returns to the earlier list, and drops the step that brought this one', async () => {
    const { store, second, third, secondList, secondResult } = await twoListsDeep();

    await store.dispatch(BACK);

    expect(second.action).toHaveBeenCalledTimes(1);
    expect(third.action).toHaveBeenCalledTimes(1);
    expect(store.rows()).toEqual(secondList);
    expect(store.getState().dispatchedStack).toEqual([{ intention: second, result: secondResult }]);
  });

  test('back() does the same, and leaves the earlier stack array as it was', async () => {
    const { store, secondList } = await twoListsDeep();
    const before = store.getState().dispatchedStack;

    await store.back();

    expect(before).toHaveLength(2);
    expect(store.getState().dispatchedStack).toHaveLength(1);
    expect(store.rows()).toEqual(secondList);
  });

  test('Cancel, or reset(), returns to the start list with an empty stack', async () => {
    const { store, defaults } = await twoListsDeep();
    await store.dispatch(RESET);
    expect(store.rows()).toEqual(defaults);
    expect(store.getState().dispatchedStack).toEqual([]);

    const again = await twoListsDeep();
    await again.store.reset();
    expect(again.store.rows()).toEqual(again.defaults);
    expect(again.store.getState().dispatchedStack).toEqual([]);
  });

  test('a result that asks to reset returns to the start list', async () => {
    const done = {
      id: 'be-done',
      title: 'Done',
      group: 'G',
      action: () => ({ shouldReset: true })
    };
    const { store, defaults } = await twoListsDeep([done]);

    await store.dispatch(done.id);
    await vi.waitFor(() => expect(store.rows()).toEqual(defaults));
  });
});

describe('Back after steps that bring no list', () => {
  const messageOnly = (id) => ({ id, title: id, group: 'G', action: () => ({ message: 'done' }) });
  const opensList = (id, rows) => ({
    id,
    title: id,
    group: 'G',
    action: () => ({ intentions: rows, includeRevertIntentions: [BACK, RESET] })
  });
  const subRow = { id: 'sub-row', title: 'Sub row', group: 'Sub', action: () => ({}) };
  const run = async (store, ...steps) => {
    for (const id of steps) {
      await store.dispatch(id);
    }
  };

  test('a step with no list before a list does not count: Back goes to the start list', async () => {
    const store = createPaletteStore({
      defaultIntentions: [messageOnly('msg'), opensList('ask', [subRow])]
    });
    await run(store, 'msg', 'ask', BACK);
    expect(ids(store)).toEqual(['msg', 'ask']);
  });

  test('a step with no list inside a list: one Back leaves that list', async () => {
    const store = createPaletteStore({
      defaultIntentions: [opensList('ask', [messageOnly('note')])]
    });
    await run(store, 'ask', 'note', BACK);
    expect(ids(store)).toEqual(['ask']);
    expect(store.getState().dispatchedStack).toEqual([]);
  });
});

describe('the input resolver', () => {
  const kindRow = {
    id: 'kind::library',
    title: 'Kind: library',
    group: 'Refine',
    action: vi.fn(() => ({}))
  };
  const resolveKind = (text) => (text.startsWith('kind') ? [kindRow] : []);

  test('resolved rows come first, then the matches; none while the input is blank', () => {
    const { second, defaults } = makeStart();
    const store = createPaletteStore({
      defaultIntentions: defaults,
      resolveDefaultInput: (text) => (text === 'read' ? [kindRow] : [])
    });
    expect(store.rows()).toEqual(defaults);

    store.changeInput('read');
    expect(store.rows()).toEqual([kindRow, second]);
  });

  test('a resolved row can be dispatched with the typed text', async () => {
    const store = createPaletteStore({
      defaultIntentions: makeStart().defaults,
      resolveDefaultInput: resolveKind
    });
    store.changeInput('kind lib');
    store.rows();

    await store.dispatch(kindRow.id);

    expect(kindRow.action).toHaveBeenCalledWith('kind lib');
  });

  test('a new list brings its own resolver; Back restores the earlier one, Cancel the default', async () => {
    const { second, list, defaults, first } = makeStart();
    const nextRow = { id: 'next', title: 'Next', action: vi.fn() };
    const deeper = {
      id: 'deeper',
      title: 'Deeper',
      group: 'D',
      action: () => ({ intentions: [first] })
    };
    second.action = () => ({ intentions: [...list, deeper], resolveInput: () => [nextRow] });
    const store = createPaletteStore({
      defaultIntentions: defaults,
      resolveDefaultInput: resolveKind
    });

    await store.dispatch(second.id);
    store.changeInput('kind');
    expect(store.rows()[0]).toBe(nextRow);

    await store.dispatch(deeper.id);
    await store.dispatch(BACK);
    store.changeInput('kind');
    expect(store.rows()[0]).toBe(nextRow);

    await store.dispatch(RESET);
    store.changeInput('kind');
    expect(store.rows()[0]).toBe(kindRow);
  });

  test('rows follow the app data when it changes, without retyping', () => {
    const data = { rows: [] };
    const store = createPaletteStore({
      defaultIntentions: makeStart().defaults,
      resolveDefaultInput: () => data.rows
    });
    store.changeInput('kind ');

    data.rows = [kindRow];

    expect(store.rows()[0]).toBe(kindRow);
  });

  test('a resolver that throws adds no rows and logs why', () => {
    const { second, defaults } = makeStart();
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createPaletteStore({
      defaultIntentions: defaults,
      resolveDefaultInput: () => {
        throw new Error('no aggregations yet');
      }
    });

    store.changeInput('read');

    expect(store.rows()).toEqual([second]);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('resolveInput'),
      expect.objectContaining({ message: 'no aggregations yet' })
    );
    logError.mockRestore();
  });

  test('a resolved row with a listed id appears once, as the resolved row', () => {
    const { second, defaults } = makeStart();
    const resolvedSecond = { ...second, title: 'Read: now' };
    const store = createPaletteStore({
      defaultIntentions: defaults,
      resolveDefaultInput: () => [resolvedSecond]
    });

    store.changeInput('read');

    expect(store.rows()).toEqual([resolvedSecond]);
  });

  test('a typed-text step adds no resolved rows', async () => {
    const { second, list, defaults } = makeStart();
    second.action = () => ({
      intentions: list,
      disableInputMatching: true,
      resolveInput: () => [kindRow]
    });
    const store = createPaletteStore({
      defaultIntentions: defaults,
      resolveDefaultInput: () => [kindRow]
    });

    await store.dispatch(second.id);
    store.changeInput('kind');

    expect(store.rows()).toEqual(list);
  });

  test('watchResolver tells listeners when the resolver says its rows changed, and stops when asked', async () => {
    let notify;
    const resolveInput = Object.assign(() => [], {
      subscribe: vi.fn((listener) => {
        notify = listener;
        return vi.fn();
      })
    });
    const store = createPaletteStore({
      defaultIntentions: makeStart().defaults,
      resolveDefaultInput: resolveInput
    });
    const listener = vi.fn();
    store.subscribe(listener);

    const stop = store.watchResolver();
    notify();
    expect(listener).toHaveBeenCalledTimes(1);

    const unsubscribe = resolveInput.subscribe.mock.results[0].value;
    stop();
    expect(unsubscribe).toHaveBeenCalled();
  });

  test('watchResolver moves to a new list’s resolver, leaving the old one', async () => {
    const oldUnsubscribe = vi.fn();
    const oldResolver = Object.assign(() => [], { subscribe: () => oldUnsubscribe });
    const newResolver = Object.assign(() => [], { subscribe: vi.fn(() => vi.fn()) });
    const { second, list, defaults } = makeStart();
    second.action = () => ({ intentions: list, resolveInput: newResolver });
    const store = createPaletteStore({
      defaultIntentions: defaults,
      resolveDefaultInput: oldResolver
    });
    store.watchResolver();

    await store.dispatch(second.id);

    expect(oldUnsubscribe).toHaveBeenCalled();
    expect(newResolver.subscribe).toHaveBeenCalled();
  });
});

describe('the fallback', () => {
  const chatRow = (text) => ({
    id: 'send-as-chat',
    title: `Send as chat: ${text}`,
    group: 'Chat',
    action: vi.fn()
  });
  const batches = [
    { id: 'close', title: 'Close batch', group: 'Batches', action: () => ({}) },
    { id: 'open', title: 'Open batch', group: 'Batches', action: () => ({}) }
  ];

  test('text that matches nothing gets its row, after the matches when there are some', () => {
    const fallback = vi.fn((text) => [chatRow(text)]);
    const store = createPaletteStore({
      defaultIntentions: batches,
      resolveDefaultFallbackInput: fallback
    });

    store.changeInput('why was this escalated');
    expect(ids(store)).toEqual(['send-as-chat']);

    store.changeInput('close');
    expect(ids(store)).toEqual(['close', 'send-as-chat']);
    expect(fallback).toHaveBeenLastCalledWith('close', {
      matches: [expect.objectContaining({ id: 'close' })]
    });
  });

  test('a blank input calls nothing; a row with a listed id is left out', () => {
    const fallback = vi.fn(() => [{ id: 'close', title: 'Another close', action: () => ({}) }]);
    const store = createPaletteStore({
      defaultIntentions: batches,
      resolveDefaultFallbackInput: fallback
    });

    store.changeInput('   ');
    store.rows();
    expect(fallback).not.toHaveBeenCalled();

    store.changeInput('close');
    expect(store.rows().map(({ title }) => title)).toEqual(['Close batch']);
  });

  test('a fallback that throws is logged, and the matches still show', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createPaletteStore({
      defaultIntentions: batches,
      resolveDefaultFallbackInput: () => {
        throw new Error('broken');
      }
    });

    store.changeInput('close');

    expect(ids(store)).toEqual(['close']);
    expect(consoleError).toHaveBeenCalledWith(
      'ShortRound resolveFallbackInput failed for "close"',
      expect.any(Error)
    );
    consoleError.mockRestore();
  });

  test('a list brings its own fallback or none; Back and Cancel restore the start list’s', async () => {
    const startFallback = vi.fn((text) => [chatRow(text)]);
    const listFallback = vi.fn((text) => [{ ...chatRow(text), id: 'list-fallback' }]);
    const intentions = [
      { id: 'pick', title: 'Pick', group: 'B', action: () => ({ intentions: [batches[0]] }) },
      {
        id: 'review',
        title: 'Review',
        group: 'B',
        action: () => ({ intentions: [batches[1]], resolveFallbackInput: listFallback })
      }
    ];
    const store = createPaletteStore({
      defaultIntentions: intentions,
      resolveDefaultFallbackInput: startFallback
    });

    await store.dispatch('pick');
    store.changeInput('zzz');
    expect(ids(store)).toEqual([]);

    await store.dispatch(BACK);
    await store.dispatch('review');
    store.changeInput('zzz');
    expect(ids(store)).toEqual(['list-fallback']);

    await store.dispatch(RESET);
    store.changeInput('zzz');
    expect(ids(store)).toEqual(['send-as-chat']);
  });
});

describe('select: what choosing a row does', () => {
  const PANEL = () => 'panel';
  const START_PANEL = () => 'start';

  test('a completion row rewrites the input and runs nothing', async () => {
    const action = vi.fn();
    const store = createPaletteStore({
      defaultIntentions: [{ id: 'next:search ', title: 'search', completion: 'search ', action }]
    });

    const outcome = await store.select('next:search ');

    expect(outcome).toEqual({ isCompletion: true });
    expect(store.getState().inputValue).toBe('search ');
    expect(action).not.toHaveBeenCalled();
    expect(store.getState().dispatchedStack).toEqual([]);
  });

  test('completeFirst applies the first enabled completion row, if any', () => {
    const store = createPaletteStore({
      defaultIntentions: [
        { id: 'a', title: 'A', completion: 'a ', disabled: true, action: () => ({}) },
        { id: 'b', title: 'B', completion: 'b ', action: () => ({}) }
      ]
    });

    expect(store.completeFirst()).toBe(true);
    expect(store.getState().inputValue).toBe('b ');

    const none = createPaletteStore({
      defaultIntentions: [{ id: 'x', title: 'X', action: () => ({}) }]
    });
    expect(none.completeFirst()).toBe(false);
  });

  test("a result's panel is proposed to the sidekick with the reason result", async () => {
    const sidekickStore = createSidekickStore();
    const reducer = vi.fn((current, proposed) => proposed);
    sidekickStore.setSidecarReducer(reducer);
    const store = createPaletteStore({
      defaultIntentions: [
        { id: 'show', title: 'Show', action: () => ({ sideEffects: { sidecarRenderer: PANEL } }) }
      ]
    });

    await store.select('show', { sidekickStore });

    expect(reducer).toHaveBeenCalledWith(
      { renderer: null },
      { renderer: PANEL },
      { reason: 'result' }
    );
    expect(sidekickStore.get().internalSidecarRenderer).toBe(PANEL);
  });

  test('Back to the start list, and Cancel, propose the start panel', async () => {
    const sidekickStore = createSidekickStore();
    const reasons = [];
    sidekickStore.setSidecarReducer((current, proposed, { reason }) => {
      reasons.push(reason);
      return proposed;
    });
    const store = createPaletteStore({
      defaultIntentions: [
        {
          id: 'open',
          title: 'Open',
          action: () => ({
            intentions: [{ id: 'leaf', title: 'Leaf', action: () => ({}) }],
            includeRevertIntentions: [BACK, RESET]
          })
        }
      ]
    });
    const options = { sidekickStore, defaultSidecarRenderer: START_PANEL };

    await store.select('open', options);
    await store.select(BACK, options);
    await store.select('open', options);
    await store.select(RESET, options);

    expect(reasons).toEqual(['start', 'reset']);
    expect(sidekickStore.get().internalSidecarRenderer).toBe(START_PANEL);
  });

  test('the Back and Cancel rows follow what a result asks for, and stay when a result brings no list', async () => {
    const store = createPaletteStore({
      defaultIntentions: [
        {
          id: 'open',
          title: 'Open',
          action: () => ({
            intentions: [{ id: 'note', title: 'Note', action: () => ({ message: 'saved' }) }],
            includeRevertIntentions: [BACK]
          })
        }
      ]
    });

    await store.select('open');
    expect(store.getState().revertIntentions.map(({ id }) => id)).toEqual([BACK]);

    await store.select('note');
    expect(store.getState().revertIntentions.map(({ id }) => id)).toEqual([BACK]);
  });

  // The app's data can move on with no notice (a resolver without `subscribe`): what was shown stays choosable.
  test('a resolved row still on screen runs when chosen, after the app data moved on', async () => {
    const shown = { id: 'kind::library', title: 'Kind: library', action: vi.fn(() => ({})) };
    const data = { rows: [shown] };
    const store = createPaletteStore({
      defaultIntentions: makeStart().defaults,
      resolveDefaultInput: () => data.rows
    });
    store.changeInput('kind lib');
    store.rows();

    data.rows = [];
    await store.select(shown.id);

    expect(shown.action).toHaveBeenCalledWith('kind lib');
  });

  test('a completion row still on screen completes when chosen, after the app data moved on', async () => {
    const shown = { id: 'next:search ', title: 'search', completion: 'search ', action: vi.fn() };
    const data = { rows: [shown] };
    const store = createPaletteStore({ resolveDefaultInput: () => data.rows });
    store.changeInput('se');
    store.rows();

    data.rows = [];
    const outcome = await store.select(shown.id);

    expect(outcome).toEqual({ isCompletion: true });
    expect(store.getState().inputValue).toBe('search ');
    expect(shown.action).not.toHaveBeenCalled();
  });

  test('a rejected row changes nothing in the side panel', async () => {
    const sidekickStore = createSidekickStore();
    const reducer = vi.fn((current, proposed) => proposed);
    sidekickStore.setSidecarReducer(reducer);
    const store = createPaletteStore({
      defaultIntentions: [
        {
          id: 'off',
          title: 'Off',
          disabled: true,
          action: () => ({ sideEffects: { sidecarRenderer: PANEL } })
        }
      ]
    });

    const outcome = await store.select('off', { sidekickStore });

    expect(outcome).toEqual({ isRejected: true });
    expect(reducer).not.toHaveBeenCalled();
  });
});

// The highlight rule, moved from React's palette into the store, so a UI on core alone gets it. The highlight is the
// first enabled row in the order rows are drawn (by group, in order of first appearance); it moves there when the rows
// change without typing, and on typing or a new list.
describe('the highlight', () => {
  // A typed line that can't run until its lookup lands, then can (React's palette-highlight test, at the store).
  function waitingLine() {
    const listeners = new Set();
    const lookup = { hasLanded: false };
    const ran = vi.fn(() => ({}));
    const next = {
      id: 'next:sort by',
      title: 'sort by',
      group: 'Next',
      completion: 'tag x sort by '
    };
    const command = { id: 'command:Search', title: 'Search', group: 'Commands', action: ran };
    const resolveInput = () => (lookup.hasLanded ? [command, next] : [next]);
    resolveInput.subscribe = (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    const land = () => {
      lookup.hasLanded = true;
      listeners.forEach((listener) => listener());
    };
    const store = createPaletteStore({ resolveDefaultInput: resolveInput });
    return { store, next, command, ran, land };
  }

  test('when a lookup lands, the highlight moves to the command that can now run, and choosing it runs it once', async () => {
    const { store, next, command, ran, land } = waitingLine();
    store.watchResolver();
    store.changeInput('tag x');
    expect(store.getState().highlightedId).toBe(next.id);

    land();
    expect(store.getState().highlightedId).toBe(command.id);

    await store.select(store.getState().highlightedId);
    expect(ran).toHaveBeenCalledTimes(1);
  });

  test('typing moves the highlight to the first row the new text shows', () => {
    const { first, second, defaults } = makeStart();
    const store = createPaletteStore({ defaultIntentions: defaults });
    store.highlight(second.id);

    store.changeInput('scri');
    expect(store.getState().highlightedId).toBe('ghi');

    store.changeInput('');
    expect(store.getState().highlightedId).toBe(first.id);
  });

  test('a new list highlights its first row, skipping a disabled one', async () => {
    const { second, list, defaults } = makeStart();
    second.action = () => ({ intentions: [{ ...list[0], disabled: true }, list[1]] });
    const store = createPaletteStore({ defaultIntentions: defaults });

    await store.dispatch(second.id);

    expect(store.getState().highlightedId).toBe(list[1].id);
  });

  test('the first row is the first drawn: by group, in order of first appearance', () => {
    const rows = [
      { id: 'a1', title: 'A one', group: 'A', disabled: true },
      { id: 'b1', title: 'B one', group: 'B' },
      { id: 'a2', title: 'A two', group: 'A' }
    ];
    const store = createPaletteStore({ defaultIntentions: rows });

    expect(store.getState().highlightedId).toBe('a2');
  });

  test('highlight(id) sets it, as a UI moves it with the arrow keys', () => {
    const { third, defaults } = makeStart();
    const store = createPaletteStore({ defaultIntentions: defaults });

    store.highlight(third.id);

    expect(store.getState().highlightedId).toBe(third.id);
  });
});
