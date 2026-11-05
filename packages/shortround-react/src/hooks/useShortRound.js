import { usePalette } from './usePalette.js';

// The palette's state and actions for an app's own UI: core's palette store, in the shape this hook has always
// returned. `resolveDefaultInput` (optional) turns typed text into extra rows for the default list, and
// `resolveDefaultFallbackInput` (optional) adds rows after the list's matches. A result that brings a new list brings
// its own of each, or none. `dispatch` chooses a row as ShortRoundSidekick does (the store's `select`), so it keeps the
// Back and Cancel a result asks for, in `revertIntentions`, and a completion row sets the input.
export function useShortRound({
  defaultIntentions,
  resolveDefaultInput,
  resolveDefaultFallbackInput
}) {
  const { store, state, intentions } = usePalette({
    defaultIntentions,
    resolveDefaultInput,
    resolveDefaultFallbackInput
  });
  return {
    inputValue: state.inputValue,
    inputMessage: state.inputMessage,
    onInputChange: store.changeInput,
    intentions,
    revertIntentions: state.revertIntentions,
    dispatch: (intentionId) => store.select(intentionId),
    reset: store.reset,
    back: store.back,
    dispatchedStack: state.dispatchedStack
  };
}
