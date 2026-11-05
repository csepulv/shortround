import invariant from 'tiny-invariant';
import { createStore } from 'zustand/vanilla';

import { AnchorPositions, Sizes } from './utils.js';

const initialStore = {
  internalSidecarRenderer: null,
  isOpen: false,
  isSidecarOpen: false,
  anchorOrigin: AnchorPositions.CENTER,
  maxTotalWidth: '90vw',
  commandWidth: '40vw',
  totalWidth: '40vw',
  size: Sizes.MEDIUM
};

const applyProposed = (current, proposed) => proposed;

// The sidekick's state on Zustand's vanilla store, behind the shape apps already use: `get`, `set` (an object, or a
// function of the state, merged in), `subscribe`, and the side panel's changes.
export function createSidekickStore(init = {}) {
  const store = createStore(() => ({ ...initialStore, ...init }));
  let sidecarReducer = applyProposed;

  // Nothing is set when nothing changes, so the side panel's content doesn't remount.
  const applySidecar = (renderer) => {
    const state = store.getState();
    if (renderer === state.internalSidecarRenderer && state.isSidecarOpen === Boolean(renderer)) {
      return;
    }
    store.setState(
      renderer
        ? {
            internalSidecarRenderer: renderer,
            isSidecarOpen: true,
            totalWidth: state.maxTotalWidth
          }
        : { internalSidecarRenderer: null, isSidecarOpen: false, totalWidth: state.commandWidth }
    );
  };

  // Every sidecar change but a close goes through here: core proposes, the app's reducer decides.
  const changeSidecar = (proposed, reason) => {
    const answer = sidecarReducer(
      { renderer: store.getState().internalSidecarRenderer },
      proposed,
      { reason }
    );
    invariant(
      answer && 'renderer' in answer,
      'sidecarReducer must return { renderer } or { renderer: null }'
    );
    applySidecar(answer.renderer);
  };

  return {
    get: store.getState,
    subscribe: store.subscribe,
    set: store.setState,
    changeSidecar,
    openSidecar: (renderer) => changeSidecar({ renderer }, 'app'),
    closeSidecar: () => changeSidecar({ renderer: null }, 'app'),
    // A close always clears, whatever the reducer would keep: the side panel never outlives the palette.
    clearSidecar: () => applySidecar(null),
    setSidecarReducer: (reducer) => {
      sidecarReducer = reducer ?? applyProposed;
    }
  };
}
