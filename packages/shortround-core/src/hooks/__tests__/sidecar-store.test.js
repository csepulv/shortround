import { act, renderHook } from '@testing-library/react';

import { createSidekickStore, useSidekick } from '../useSidekick.js';

const PANEL = () => 'panel';
const CHAT = () => 'chat';

const sidecarOf = (store) => {
  const { internalSidecarRenderer, isSidecarOpen, totalWidth } = store.get();
  return { renderer: internalSidecarRenderer, isSidecarOpen, totalWidth };
};

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

  test("useSidekick's setSidecarRenderer and closeSidecar go through the reducer too", () => {
    const store = createSidekickStore();
    const reasons = [];
    store.setSidecarReducer((current, proposed, { reason }) => {
      reasons.push(reason);
      return proposed;
    });
    const { result } = renderHook(() => useSidekick({ store }));

    act(() => result.current.setSidecarRenderer(PANEL));
    act(() => result.current.closeSidecar());

    expect(reasons).toEqual(['app', 'app']);
  });

  test('without a reducer of its own, the store applies what is proposed', () => {
    const store = createSidekickStore();
    store.setSidecarReducer(undefined);

    store.changeSidecar({ renderer: PANEL }, 'result');

    expect(sidecarOf(store).renderer).toBe(PANEL);
  });
});
