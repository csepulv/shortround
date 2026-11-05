import { createPaletteStore } from '@shortround/core';
import { useEffect, useRef, useSyncExternalStore } from 'react';

// The palette's state for React: core's palette store, one per palette, read with useSyncExternalStore. Rows are
// worked out on each render, because a resolver reads live app data that can change while the input doesn't. New
// defaults reset the list and the input, as before; the resolver is watched while the palette is mounted, and so is a
// `palette` (what buildPalette returns), whose notify() makes the store re-read the app's state. Internal: the palette
// uses `store.select` and the Back and Cancel rows; apps use `useShortRound`.
export function usePalette({
  palette,
  defaultIntentions,
  resolveDefaultInput,
  resolveDefaultFallbackInput
}) {
  const storeRef = useRef(null);
  if (!storeRef.current) {
    storeRef.current = createPaletteStore({
      palette,
      defaultIntentions,
      resolveDefaultInput,
      resolveDefaultFallbackInput
    });
  }
  const store = storeRef.current;
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);

  useEffect(() => {
    store.setDefaults({
      palette,
      defaultIntentions,
      resolveDefaultInput,
      resolveDefaultFallbackInput
    });
  }, [store, palette, defaultIntentions, resolveDefaultInput, resolveDefaultFallbackInput]);

  useEffect(() => store.watchResolver(), [store]);
  useEffect(() => store.watchPalette(), [store, palette]);

  return { store, state, intentions: store.rows() };
}
