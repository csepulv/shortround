import { createSidekickStore } from '../sidekick-store.js';

const PANEL = () => 'panel';
const CHAT = () => 'chat';

const sidecarOf = (store) => {
  const { internalSidecarRenderer, isSidecarOpen, totalWidth } = store.get();
  return { renderer: internalSidecarRenderer, isSidecarOpen, totalWidth };
};

describe('the sidekick store', () => {
  test('starts closed, centred, medium, with no side panel', () => {
    expect(createSidekickStore().get()).toEqual({
      internalSidecarRenderer: null,
      isOpen: false,
      isSidecarOpen: false,
      anchorOrigin: 'center',
      maxTotalWidth: '90vw',
      commandWidth: '40vw',
      totalWidth: '40vw',
      size: 'medium'
    });
  });

  test('what it is created with replaces those defaults, key by key', () => {
    const state = createSidekickStore({ anchorOrigin: 'top-left', isOpen: true }).get();

    expect(state).toEqual(
      expect.objectContaining({ anchorOrigin: 'top-left', isOpen: true, size: 'medium' })
    );
  });

  test('set merges an object, or what a function of the state returns, and tells each listener', () => {
    const store = createSidekickStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.set({ isOpen: true });
    store.set((state) => ({ size: state.isOpen ? 'full' : 'compact' }));

    expect(store.get()).toEqual(
      expect.objectContaining({ isOpen: true, size: 'full', anchorOrigin: 'center' })
    );
    expect(listener).toHaveBeenCalledTimes(2);
  });

  test('a listener that unsubscribed is not told', () => {
    const store = createSidekickStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.set({ isOpen: true });

    expect(listener).not.toHaveBeenCalled();
  });

  test('two stores keep their own state', () => {
    const first = createSidekickStore();
    const second = createSidekickStore();

    first.set({ isOpen: true });

    expect(second.get().isOpen).toBe(false);
  });
});

describe("the store's sidecar", () => {
  test('openSidecar shows a renderer and widens; closeSidecar clears and narrows', () => {
    const store = createSidekickStore({ maxTotalWidth: '90vw', commandWidth: '40vw' });

    store.openSidecar(PANEL);
    expect(sidecarOf(store)).toEqual({ renderer: PANEL, isSidecarOpen: true, totalWidth: '90vw' });

    store.closeSidecar();
    expect(sidecarOf(store)).toEqual({ renderer: null, isSidecarOpen: false, totalWidth: '40vw' });
  });

  test('the app’s calls go through the reducer with the reason app', () => {
    const store = createSidekickStore();
    const reducer = vi.fn((current, proposed) => proposed);
    store.setSidecarReducer(reducer);

    store.openSidecar(PANEL);
    store.closeSidecar();

    expect(reducer.mock.calls).toEqual([
      [{ renderer: null }, { renderer: PANEL }, { reason: 'app' }],
      [{ renderer: PANEL }, { renderer: null }, { reason: 'app' }]
    ]);
  });

  test("the reducer's answer is what the store holds", () => {
    const store = createSidekickStore();
    store.setSidecarReducer(() => ({ renderer: CHAT }));

    store.openSidecar(PANEL);

    expect(sidecarOf(store).renderer).toBe(CHAT);
  });

  test('answering with the current renderer changes nothing, so nothing is told', () => {
    const store = createSidekickStore();
    store.openSidecar(CHAT);
    store.setSidecarReducer((current) => current);
    const listener = vi.fn();
    store.subscribe(listener);

    store.changeSidecar({ renderer: null }, 'start');

    expect(listener).not.toHaveBeenCalled();
    expect(sidecarOf(store).renderer).toBe(CHAT);
  });

  test('a reducer that returns no renderer key throws, naming the contract', () => {
    const store = createSidekickStore();
    store.setSidecarReducer(() => undefined);

    expect(() => store.openSidecar(PANEL)).toThrow(
      'sidecarReducer must return { renderer } or { renderer: null }'
    );
  });

  test("clearing (core's close) skips the reducer", () => {
    const store = createSidekickStore();
    store.openSidecar(CHAT);
    const reducer = vi.fn((current) => current);
    store.setSidecarReducer(reducer);

    store.clearSidecar();

    expect(reducer).not.toHaveBeenCalled();
    expect(sidecarOf(store).renderer).toBeNull();
  });

  test('without a reducer of its own, the store applies what is proposed', () => {
    const store = createSidekickStore();
    store.setSidecarReducer(undefined);

    store.changeSidecar({ renderer: PANEL }, 'result');

    expect(sidecarOf(store).renderer).toBe(PANEL);
  });
});
