import invariant from 'tiny-invariant';
import { createStore } from 'zustand/vanilla';

import { matchIntentions } from './match-intentions.js';
import { bringsList, makeRevertIntentionsFor, RevertIntentionIds } from './utils.js';

const UNAVAILABLE_MESSAGE = 'Not available right now';

const indexIntentions = (intentions) =>
  Object.fromEntries(intentions.map((item) => [item.id, item]));

const isSystemIntention = (intentionId) =>
  intentionId === RevertIntentionIds.RESET || intentionId === RevertIntentionIds.BACK;

// A resolver error must not take the palette down: log it with the input, and show no resolved rows. (The store's
// line's `rows()` goes through here too, under the same message, which tests and apps pin; a lookup that throws is the
// engine's failed lookup.)
function resolveTypedInput(resolveInput, inputValue) {
  try {
    return resolveInput(inputValue) ?? [];
  } catch (error) {
    console.error(`ShortRound resolveInput failed for "${inputValue}"`, error);
    return [];
  }
}

// A fallback error must not take the palette down either: log it with the input, and add no rows.
function resolveFallbackRows(resolveFallbackInput, inputValue, matches) {
  try {
    return resolveFallbackInput(inputValue, { matches }) ?? [];
  } catch (error) {
    console.error(`ShortRound resolveFallbackInput failed for "${inputValue}"`, error);
    return [];
  }
}

// The rows in the order a palette draws them: by group, in the order each group first appears (`group: null` is no
// group, as a missing one is).
const groupOf = (intention) => intention.group ?? undefined;
function inDrawnOrder(intentions) {
  const groups = [...new Set(intentions.map(groupOf))];
  return groups.flatMap((group) => intentions.filter((intention) => groupOf(intention) === group));
}
const firstEnabledId = (intentions) =>
  inDrawnOrder(intentions).find((intention) => !intention.disabled)?.id;

// A resolved row replaces a listed row with the same id.
const withoutIds = (intentions, replacements) => {
  const ids = new Set(replacements.map(({ id }) => id));
  return intentions.filter(({ id }) => !ids.has(id));
};

// Validates against the input at dispatch time: the last input change may not have run for this list.
function findRejection(intention, inputValue) {
  const validation = intention.validate?.(inputValue);
  if (validation) {
    return validation.valid ? undefined : (validation.message ?? UNAVAILABLE_MESSAGE);
  }
  return intention.disabled ? UNAVAILABLE_MESSAGE : undefined;
}

// Why the sidecar may change, decided before dispatch: Back from the first step lands on the start list.
function sidecarReasonFor(intentionId, stepsTaken) {
  if (intentionId === RevertIntentionIds.RESET) {
    return 'reset';
  }
  if (intentionId === RevertIntentionIds.BACK) {
    return stepsTaken <= 1 ? 'start' : 'back';
  }
  return 'result';
}

// What core proposes: the start list's panel when returning to it; otherwise what the result asks for, or nothing.
function proposedSidecar(reason, result, defaultSidecarRenderer) {
  if (reason === 'start' || reason === 'reset') {
    return { renderer: defaultSidecarRenderer ?? null };
  }
  if (result?.sideEffects?.sidecarRenderer) {
    return { renderer: result.sideEffects.sidecarRenderer };
  }
  if (result?.sideEffects?.closeSidecar) {
    return { renderer: null };
  }
  return undefined;
}

// The palette's state and what it does, with no UI. Moved from @shortround/react's useShortRound (state and dispatch)
// and ShortRoundPalette's onSelect (side panel, Back and Cancel rows), unchanged in behaviour. Rows are worked out when
// read (`rows()`): a resolver reads live app data that can change while the input doesn't. `resolveDefaultInput` turns
// typed text into extra rows for the default list; `resolveDefaultFallbackInput` adds rows after its matches; a result
// that brings a new list brings its own of each, or none.
//
// Given a `palette` (what buildPalette returns) instead, the start list is whatever the app's state says now
// (`palette.current()`), when the store is made, on Back to the start, and when it re-reads.
export function createPaletteStore({
  defaultIntentions = [],
  resolveDefaultInput,
  resolveDefaultFallbackInput,
  palette
} = {}) {
  let source = palette;
  let defaults = { defaultIntentions, resolveDefaultInput, resolveDefaultFallbackInput };
  const startDefaults = () => (source ? defaultsOf(source.current()) : defaults);
  // What the last read showed, and which of those rows came from the resolver or the fallback: a row on screen stays
  // choosable by its id even if the app's data has moved on since.
  let lastShown = { shown: [], extra: [] };
  // One reader for rows and input: while the store watches a palette that has commandLine(), it owns that one line. At
  // a list from the app's state its typed rows are the line's rows, read at the caret; the line follows the store's
  // input. Made in watchPalette(), disposed by its stop, so a store a UI drops (React StrictMode's copy) leaves nothing
  // reading.
  let line = null;
  let watching = null;
  let watchCount = 0;
  let typedCaret = { text: '', caret: 0 };
  let isChangingLine = false;

  const store = createStore(() => ({
    inputValue: '',
    inputMessage: undefined,
    dispatchedStack: [],
    ...startState(startDefaults()),
    disableInputMatching: false,
    revertIntentions: [],
    resolverVersion: 0,
    highlightedId: undefined
  }));
  const { getState, setState } = store;

  // The highlight rule (from React's palette): whenever the rows change (typing, a new list, the app's state, or a
  // resolver's notice that a lookup landed), the highlight goes to the first enabled row as drawn, so Enter does what
  // it would have had the lookup been instant. Back and Cancel are drawn apart and
  // aren't candidates. A UI moves it between changes with highlight(id). One update, so listeners hear it once.
  const setAndHighlight = (update) =>
    setState((state) => {
      const next = typeof update === 'function' ? update(state) : update;
      const merged = { ...state, ...next };
      keepLineInStep(merged);
      return { ...next, highlightedId: firstEnabledId(rowsOf(merged).shown) };
    });
  const highlight = (intentionId) => setState({ highlightedId: intentionId });

  const readsLine = (state) => Boolean(line) && isAtAppList(state);

  // The line reads what the store's input says, at the caret the UI gave (the end otherwise). The store's own changes
  // to the line don't come back to it as notices. This runs inside setState's updater, a side effect on purpose:
  // zustand calls the updater once and synchronously, and the line must read the new text before the rows are worked
  // out.
  function keepLineInStep(state) {
    if (!readsLine(state)) {
      return;
    }
    const text = state.inputValue;
    const caret = typedCaret.text === text ? typedCaret.caret : text.length;
    const current = line.getState();
    if (current.text !== text || current.caret !== caret) {
      changeLineQuietly(() => line.change(text, caret));
    }
  }

  function changeLineQuietly(change) {
    isChangingLine = true;
    try {
      return change();
    } finally {
      isChangingLine = false;
    }
  }

  function rowsOf(state) {
    const { inputValue, currentIntentions, disableInputMatching, resolveInput, resolveFallback } =
      state;
    const isMatchingTypedText = !disableInputMatching && Boolean(inputValue.trim());
    // A source's line without rows() (a PaletteSource of the app's own) still gives hints; its rows come from the list.
    const typedRows = readsLine(state) && line.rows ? () => line.rows() : resolveInput;
    const resolved =
      isMatchingTypedText && typedRows ? resolveTypedInput(typedRows, inputValue) : [];
    const matches = [
      ...resolved,
      ...withoutIds(matchIntentions(inputValue, currentIntentions), resolved)
    ];
    // After the matches, and never in place of a listed row.
    const fallback =
      isMatchingTypedText && resolveFallback
        ? withoutIds(resolveFallbackRows(resolveFallback, inputValue, matches), matches)
        : [];
    return {
      shown: disableInputMatching ? currentIntentions : [...matches, ...fallback],
      extra: [...resolved, ...fallback]
    };
  }

  // The one read that records what it shows; the store's own lookups read without recording.
  function rows() {
    lastShown = rowsOf(getState());
    return lastShown.shown;
  }

  // What was last shown first, then what would show now (for a UI that chooses without reading).
  const shownThenCurrent = () => [...lastShown.shown, ...rowsOf(getState()).shown];

  function makeStartResult() {
    const start = startDefaults();
    return {
      intentions: [...start.defaultIntentions],
      resolveInput: start.resolveDefaultInput,
      resolveFallbackInput: start.resolveDefaultFallbackInput,
      sideEffects: { closeSidecar: true }
    };
  }

  function handleSystemIntention(intentionId) {
    const { dispatchedStack } = getState();
    if (intentionId === RevertIntentionIds.RESET) {
      setState({ dispatchedStack: [] });
      return makeStartResult();
    }
    // Back leaves the current list: it drops the step that brought it, and any after it, and shows the list of the
    // last earlier step that brought one.
    const currentListStep = dispatchedStack.findLastIndex(bringsList);
    const remaining = currentListStep >= 0 ? dispatchedStack.slice(0, currentListStep) : [];
    setState({ dispatchedStack: remaining });
    const earlierList = remaining.findLast(bringsList);
    return earlierList ? earlierList.result : makeStartResult();
  }

  async function runIntention(intentionId) {
    const state = getState();
    const intention = indexIntentions([
      ...state.currentIntentions,
      ...lastShown.extra,
      ...rowsOf(state).extra
    ])[intentionId];
    invariant(intention, `Unknown intention id: ${intentionId}`);
    const rejection = findRejection(intention, state.inputValue);
    if (rejection) {
      setState({ inputMessage: { type: 'error', text: rejection } });
      return { isRejected: true };
    }
    const result = (await intention.action(state.inputValue)) ?? {};
    setState({ dispatchedStack: [...state.dispatchedStack, { intention, result }] });
    return result;
  }

  // While a choice runs, following the app waits: an app may notify() from inside the run (an app's effect on its preview),
  // and the step being left would be judged against the state the run just made. Only the latest choice counts: a run
  // that never settles stops counting once the user makes another choice (Cancel, Back, a row), and when that one
  // settles the store follows.
  let runningChoice = null;
  let isFollowPending = false;

  async function dispatch(intentionId) {
    const choice = {};
    runningChoice = choice;
    try {
      return await dispatchNow(intentionId);
    } finally {
      if (runningChoice === choice) {
        runningChoice = null;
        if (isFollowPending) {
          isFollowPending = false;
          followApp();
        }
      }
    }
  }

  async function dispatchNow(intentionId) {
    const result = isSystemIntention(intentionId)
      ? handleSystemIntention(intentionId)
      : await runIntention(intentionId);
    if (result.isRejected) {
      return result;
    }
    // Turning matching off describes a list, so only a result that brings one changes it, as with Back and Cancel in
    // select().
    setAndHighlight({
      ...(result.intentions
        ? {
            currentIntentions: result.intentions,
            resolveInput: result.resolveInput,
            resolveFallback: result.resolveFallbackInput,
            disableInputMatching: result.disableInputMatching
          }
        : {}),
      inputValue: '',
      inputMessage: undefined
    });
    if (result.shouldReset) {
      dispatch(RevertIntentionIds.RESET);
    }
    return result;
  }

  // `caret`: where the UI's caret is (the end when left out); the store's line reads its next steps there.
  function changeInput(typedText, caret = typedText.length) {
    typedCaret = { text: typedText, caret };
    const validations = new Map();
    const messages = new Set();
    getState().currentIntentions.forEach((intention) => {
      const result = intention.validate?.(typedText);
      if (result) {
        validations.set(intention.id, !result.valid);
        if (result.message) {
          messages.add(result.message);
        }
      }
    });
    const text = Array.from(messages).join(', ');
    setAndHighlight((state) => ({
      inputValue: typedText,
      currentIntentions: validations.size
        ? state.currentIntentions.map((intention) =>
            validations.has(intention.id)
              ? { ...intention, disabled: validations.get(intention.id) }
              : intention
          )
        : state.currentIntentions,
      inputMessage: text ? { type: 'error', text } : undefined
    }));
  }

  // New defaults (or a new palette) show at once and clear the input (useShortRound did this when its props changed).
  function setDefaults({ palette: nextPalette, ...next }) {
    source = nextPalette;
    defaults = { ...next, defaultIntentions: next.defaultIntentions ?? [] };
    // The input clears first, so a new line doesn't read the old text.
    setAndHighlight({ ...startState(startDefaults()), inputValue: '' });
    rebindWatching();
  }

  // Re-reading the app's state (a palette only). On the start list, or a list a run brought, the list follows the
  // states that hold now; the input stays. A step whose command is no longer available returns to that list and says
  // so; any other step stays.
  function followApp() {
    if (!source) {
      return;
    }
    if (runningChoice) {
      isFollowPending = true;
      return;
    }
    const step = getState().dispatchedStack.findLast(bringsList);
    // The start list, and a list a run brought (`listKind: 'state'`), are the app's state: they follow it. Such a list
    // has no Back or Cancel rows, and the steps that led to it describe a state the app has left, so they go.
    if (!step || step.result.listKind === 'state') {
      setAndHighlight({ ...startState(startDefaults()), dispatchedStack: [] });
      return;
    }
    const { command } = step.result;
    if (!command || source.isAvailable(command.name)) {
      return;
    }
    setAndHighlight({
      ...startState(startDefaults()),
      dispatchedStack: [],
      disableInputMatching: false,
      revertIntentions: [],
      inputValue: '',
      inputMessage: { type: 'error', text: `${command.label} isn't available now` }
    });
  }

  // While watched, the app's notify() makes the store re-read, and a palette with commandLine() gives the store its one
  // line, whose notices (a lookup landed, the loading delay passed) re-read the rows. Returns a function that stops and
  // disposes the line.
  // Watches are counted: the first starts following the source and makes the line, the last stop disposes it, so two
  // watches share one line and none leaks. New defaults while watched rebind.
  function watchPalette() {
    if (!source) {
      return () => {};
    }
    watchCount += 1;
    if (!watching) {
      startWatching();
    }
    let isStopped = false;
    return () => {
      if (isStopped) {
        return;
      }
      isStopped = true;
      watchCount -= 1;
      if (watchCount === 0 && watching) {
        stopWatching();
      }
    };
  }

  function startWatching() {
    const stopFollowing = source.subscribe(followApp);
    line = source.commandLine?.() ?? null;
    const stopHearingLine = line?.subscribe(() => {
      if (!isChangingLine) {
        setAndHighlight((state) => ({ resolverVersion: state.resolverVersion + 1 }));
      }
    });
    watching = { source, line, stopFollowing, stopHearingLine };
    if (line) {
      setAndHighlight({});
    }
  }

  function stopWatching() {
    watching.stopFollowing();
    watching.stopHearingLine?.();
    watching.line?.dispose();
    watching = null;
    line = null;
  }

  // New defaults while watched: the store follows the new source (and reads through its line), or none.
  function rebindWatching() {
    if (watching && watching.source !== source) {
      stopWatching();
    }
    if (watchCount > 0 && !watching && source) {
      startWatching();
    }
  }

  // Choosing a row: a completion row rewrites the input and runs nothing; otherwise dispatch, then propose the side
  // panel's change to the sidekick store (when given) and keep the Back and Cancel rows the result asks for. The
  // result is returned for the UI's own concerns (a toast for its message, closing on shouldReset).
  async function select(intentionId, { sidekickStore, defaultSidecarRenderer } = {}) {
    const completion = shownThenCurrent().find(
      (intention) => intention.id === intentionId
    )?.completion;
    if (completion !== undefined) {
      changeInput(completion);
      return { isCompletion: true };
    }
    const reason = sidecarReasonFor(
      intentionId,
      getState().dispatchedStack.filter(bringsList).length
    );
    const result = await dispatch(intentionId);
    if (result.isRejected) {
      return result;
    }
    // With a palette, the start list's panel is the one for the states that hold now.
    const startRenderer = source ? source.current().sidecarRenderer : defaultSidecarRenderer;
    const proposed = proposedSidecar(reason, result, startRenderer);
    if (proposed && sidekickStore) {
      sidekickStore.changeSidecar(proposed, reason);
    }
    // Back and Cancel belong to the list: a result that brings neither a list nor its own leaves them as they are.
    if (result.intentions || result.includeRevertIntentions) {
      setState({ revertIntentions: makeRevertIntentionsFor(result.includeRevertIntentions) });
    }
    return result;
  }

  // Tab: the first enabled completion row rewrites the input. Says whether there was one. With the store's line, its
  // first next step at the caret, and the caret goes just after the inserted word (the line's rule).
  function completeFirst() {
    if (readsLine(getState()) && line.getState().nextSteps.length) {
      changeLineQuietly(() => line.acceptCompletion());
      const { text, caret } = line.getState();
      changeInput(text, caret);
      return true;
    }
    const first = shownThenCurrent().find(
      (intention) => intention.completion !== undefined && !intention.disabled
    );
    if (first) {
      changeInput(first.completion);
    }
    return Boolean(first);
  }

  // A resolver whose rows can change without new input (an async lookup landed) carries `subscribe`: while watched,
  // its notice tells the store's listeners, and a new list's resolver replaces it. Returns a function that stops.
  function watchResolver() {
    let watched;
    let unsubscribe;
    const follow = () => {
      const { resolveInput } = getState();
      if (resolveInput === watched) {
        return;
      }
      unsubscribe?.();
      watched = resolveInput;
      unsubscribe = resolveInput?.subscribe?.(() =>
        setAndHighlight((state) => ({ resolverVersion: state.resolverVersion + 1 }))
      );
    };
    follow();
    const stopFollowing = store.subscribe(follow);
    return () => {
      stopFollowing();
      unsubscribe?.();
      watched = undefined;
      unsubscribe = undefined;
    };
  }

  setAndHighlight({});

  return {
    getState,
    subscribe: store.subscribe,
    rows,
    changeInput,
    highlight,
    dispatch,
    back: () => dispatch(RevertIntentionIds.BACK),
    reset: () => dispatch(RevertIntentionIds.RESET),
    setDefaults,
    select,
    completeFirst,
    watchResolver,
    watchPalette,
    // The store's line while it reads typed lines through it (watching a palette with one, at a list from the app's
    // state), otherwise null (in a picker or a typed-text step the input isn't a command line): a UI reads the line's
    // words, ghost and caret here.
    commandLine: () => (readsLine(getState()) ? line : null),
    refresh: followApp
  };
}

// The store is at a list from the app's state: the start list, or a list a run brought. In a picker or a typed-text
// step, the input filters that step's rows, so it isn't a command line (moved from React's useLineHints).
const isAtAppList = ({ dispatchedStack }) => {
  const step = dispatchedStack.findLast(bringsList);
  return !step || step.result.listKind === 'state';
};

// A palette's current() as the store's defaults.
const defaultsOf = ({ intentions, resolveInput, resolveFallbackInput }) => ({
  defaultIntentions: intentions ?? [],
  resolveDefaultInput: resolveInput,
  resolveDefaultFallbackInput: resolveFallbackInput
});

// The state the start list sets.
const startState = ({ defaultIntentions, resolveDefaultInput, resolveDefaultFallbackInput }) => ({
  currentIntentions: defaultIntentions,
  resolveInput: resolveDefaultInput,
  resolveFallback: resolveDefaultFallbackInput
});
