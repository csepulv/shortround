import { useSyncExternalStore } from 'react';

const NO_LINE = { subscribe: () => () => {}, getState: () => null };

// How the palette's input reads the line (the palette store's own line, so the rows and the input are one reading):
// the store keeps the line in step with its input and caret, and hands it out only while the input is a command line
// (not in a picker or a typed-text step). `canShowHints` is known on the first render (the line itself arrives once
// the store watches the palette, from an effect); `lineState` is null while the hints don't show.
export function useLineHints({ palette, disableLineHints, store }) {
  // `palette` may be any PaletteSource; only one with commandLine() (buildPalette's) can show hints.
  const canShowHints = typeof palette?.commandLine === 'function' && !disableLineHints;
  const line = canShowHints ? store.commandLine() : null;

  const source = line ?? NO_LINE;
  const lineState = useSyncExternalStore(source.subscribe, source.getState, source.getState);

  // Tab: the store's first completion, through its line, whether or not the hints are drawn (`disableLineHints` turns
  // off drawing only); says where the caret goes, or null when the store has no line or nothing to add.
  const complete = () => {
    if (!store.commandLine() || !store.completeFirst()) {
      return null;
    }
    return store.commandLine()?.getState().caret ?? null;
  };

  return { canShowHints, lineState: line ? lineState : null, complete };
}
