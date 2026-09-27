import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import invariant from 'tiny-invariant';
import {
  AnchorPositionDetails,
  AnchorPositions,
  cycleCorners,
  SizeDetails,
  Sizes
} from '../utils.js';

const initialStore = {
  internalSidecarRenderer: null,
  isOpen: false,
  isSidecarOpen: false,
  anchorOrigin: AnchorPositions.CENTER,
  anchorPosition: AnchorPositionDetails.center,
  maxTotalWidth: '90vw',
  commandWidth: '40vw',
  totalWidth: '40vw',
  size: Sizes.MEDIUM
};

export function createSidekickStore(init = {}) {
  let state = { ...initialStore, ...init };
  const listeners = new Set();

  return {
    get: () => state,
    subscribe: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    set: (updater) => {
      state =
        typeof updater === 'function' ? { ...state, ...updater(state) } : { ...state, ...updater };
      listeners.forEach((listener) => listener());
    }
  };
}

export const useShortRoundKeyboardShortcuts = ({
  onOpen,
  onClose,
  installKeyboardShortcuts = true
}) => {
  const callbacks = useRef({ onOpen, onClose });
  callbacks.current = { onOpen, onClose };

  useEffect(() => {
    if (!installKeyboardShortcuts) return;

    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        // event.preventDefault();
        callbacks.current.onOpen();
      }

      if (event.key === 'Escape') {
        callbacks.current.onClose();
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
    if (!localRef.current) localRef.current = createSidekickStore(opts.initial);
    store = localRef.current;
  }

  const stateSnapshot = useSyncExternalStore(store.subscribe, store.get, store.get);

  const actions = useMemo(() => {
    const { maxTotalWidth, commandWidth, anchorOrigin, internalSidecarRenderer, size } =
      stateSnapshot;

    const closeSidecar = () => {
      store.set({
        internalSidecarRenderer: null,
        isSidecarOpen: false,
        totalWidth: commandWidth
      });
    };

    const { height } = SizeDetails[size];
    const sidecarWidth = `calc(${maxTotalWidth} - ${commandWidth})`;

    const setAnchorOrigin = (origin) =>
      store.set({
        anchorOrigin: origin,
        anchorPosition: AnchorPositionDetails[origin]
      });

    const cycleAnchorOrigin = () => {
      setAnchorOrigin(cycleCorners(anchorOrigin));
    };

    const setSidecarRenderer = (renderer) => {
      store.set({
        internalSidecarRenderer: renderer,
        isSidecarOpen: true,
        totalWidth: maxTotalWidth
      });
    };

    const renderSidecar = () => {
      if (internalSidecarRenderer) return internalSidecarRenderer();
    };

    return {
      onOpen: () => store.set({ isOpen: true }),
      setIsOpen: (val) => {
        store.set({ isOpen: val });
      },
      onClose: () => {
        closeSidecar();
        store.set({ isOpen: false });
      },
      height,
      setSize: (val) => {
        invariant(SizeDetails[val], `Unknown size: ${val}`);
        store.set({ size: val });
      },
      setAnchorOrigin,
      cycleAnchorOrigin,
      setSidecarRenderer,
      commandWidth,
      sidecarWidth,
      closeSidecar,
      renderSidecar
    };
  }, [store, stateSnapshot]);

  return { ...stateSnapshot, ...actions };
}
