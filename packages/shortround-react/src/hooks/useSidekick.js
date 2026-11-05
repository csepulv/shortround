import { createSidekickStore, cycleCorners } from '@shortround/core';
import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import invariant from 'tiny-invariant';

import { AnchorPositionDetails, SizeDetails } from '../utils.js';

// The global shortcut: Cmd/Ctrl+K from anywhere. Escape is not global: the sidekick's dialog handles it,
// so Escape in the page (an app's own dialog or field) stays the page's.
export const useShortRoundKeyboardShortcuts = ({ onOpen, installKeyboardShortcuts = true }) => {
  const callbacks = useRef({ onOpen });
  callbacks.current = { onOpen };

  useEffect(() => {
    if (!installKeyboardShortcuts) {
      return;
    }

    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        // event.preventDefault();
        callbacks.current.onOpen();
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [installKeyboardShortcuts]);
};

export const SidekickStoreContext = createContext(null);

export const useSidekickStore = () => useContext(SidekickStoreContext);

// Precedence: explicit store, then an ancestor provider's store, then one owned by this provider.
export function SidekickStoreProvider({ store: existingStore, initial, children }) {
  const ancestorStore = useSidekickStore();
  const ownStore = useRef(null);
  if (!existingStore && !ancestorStore && !ownStore.current) {
    ownStore.current = createSidekickStore(initial);
  }
  const store = existingStore ?? ancestorStore ?? ownStore.current;
  return <SidekickStoreContext.Provider value={store}>{children}</SidekickStoreContext.Provider>;
}

export function useSidekick(opts = {}) {
  const contextStore = useSidekickStore();
  let store = opts.store || contextStore;
  const localRef = useRef(null);
  if (!store) {
    if (!localRef.current) {
      localRef.current = createSidekickStore(opts.initial);
    }
    store = localRef.current;
  }

  const stateSnapshot = useSyncExternalStore(store.subscribe, store.get, store.get);

  const actions = useMemo(() => {
    const { maxTotalWidth, commandWidth, anchorOrigin, internalSidecarRenderer, size } =
      stateSnapshot;

    const { height } = SizeDetails[size];
    const sidecarWidth = `calc(${maxTotalWidth} - ${commandWidth})`;

    const setAnchorOrigin = (origin) => store.set({ anchorOrigin: origin });

    const cycleAnchorOrigin = () => {
      setAnchorOrigin(cycleCorners(anchorOrigin));
    };

    const renderSidecar = () => {
      if (internalSidecarRenderer) {
        return internalSidecarRenderer();
      }
    };

    return {
      // Worked out from the origin, so a store created with only `anchorOrigin` opens there; a position stored
      // beside it (a 0.3.0 workaround) is ignored.
      anchorPosition: AnchorPositionDetails[anchorOrigin],
      onOpen: () => store.set({ isOpen: true }),
      setIsOpen: (val) => {
        store.set({ isOpen: val });
      },
      onClose: () => {
        store.clearSidecar();
        store.set({ isOpen: false });
      },
      height,
      setSize: (val) => {
        invariant(SizeDetails[val], `Unknown size: ${val}`);
        store.set({ size: val });
      },
      setAnchorOrigin,
      cycleAnchorOrigin,
      // The app's own calls: through the reducer, with the reason `app`.
      setSidecarRenderer: store.openSidecar,
      commandWidth,
      sidecarWidth,
      closeSidecar: store.closeSidecar,
      renderSidecar
    };
  }, [store, stateSnapshot]);

  return { ...stateSnapshot, ...actions };
}
