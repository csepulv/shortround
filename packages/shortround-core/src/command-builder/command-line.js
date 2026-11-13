// A command line: it owns a line's text and caret, reads them with the command builder, and says what a host should
// show (each word's role, the ghost, the next steps, loading) and what Tab and Enter do. No DOM and no React: a palette
// input and an editor's slash command are two hosts; anything that produces a line (voice, an agent, a replayed
// workflow) could be another.
//
//   makeCommandLine({ builder, run, now?, schedule? })
//     → { getState, change, acceptCompletion, submit, cancel, subscribe, dispose }
//   getState() → { text, caret, roles, nextSteps, ghost, top, readings, canRun, incomplete, awaiting, problem, loading,
//                  failed }

import { makeLoadingDelay } from './loading-delay.js';

export function makeCommandLine({
  builder,
  run,
  now = () => Date.now(),
  schedule = (callback, ms) => setTimeout(callback, ms)
}) {
  let text = '';
  let caret = 0;
  let current = builder.read(text, caret);
  const listeners = new Set();
  // The state is worked out when something changes, not on every read: a UI reads it with useSyncExternalStore,
  // which needs the same object until then.
  let snapshot;
  const notify = () => {
    snapshot = computeState();
    listeners.forEach((listener) => listener());
  };
  const loadingDelay = makeLoadingDelay({ now, schedule, notify });

  function readAgain() {
    current = builder.read(text, caret);
    loadingDelay.track(current.pending);
  }

  // A lookup landed: the same text reads differently now.
  const stopHearingBuilder = builder.subscribe(() => {
    readAgain();
    notify();
  });

  function computeState() {
    const top = current.readings[0];
    return {
      text,
      caret,
      roles: current.annotations,
      nextSteps: current.nextSteps,
      ghost: ghostOf(text, caret, current.nextSteps[0]),
      top,
      // Every candidate, best first (`top` is the first): a palette's rows show several.
      readings: current.readings,
      canRun: Boolean(top) && top.needs.length === 0,
      incomplete: current.incomplete,
      brokenRules: current.brokenRules,
      awaiting: current.awaiting,
      problem: current.problem,
      loading: loadingDelay.shown(current.pending),
      failed: current.failed
    };
  }
  snapshot = computeState();

  function change(nextText, nextCaret = nextText.length) {
    text = nextText;
    caret = nextCaret;
    readAgain();
    notify();
  }

  // Tab: the chosen next step (the first by default) replaces the line, and the caret goes just after the inserted
  // word, before any words that followed it.
  function acceptCompletion(step = current.nextSteps[0]) {
    if (!step) {
      return false;
    }
    const following = text.slice(caret).replace(/^\S*/, '').trimStart();
    change(step.insertText, step.insertText.length - following.length);
    return true;
  }

  // Enter: a line that can run runs once and the line clears; one that can't yet completes like Tab (the palette's
  // rule). A second Enter while it runs gets the same run, not another. Text typed while it runs is the user's next
  // line, so only the submitted text is cleared.
  let running = null;
  function submit() {
    running ??= submitOnce().finally(() => {
      running = null;
    });
    return running;
  }

  async function submitOnce() {
    const { canRun, top, text: submitted } = snapshot;
    if (!canRun) {
      return acceptCompletion();
    }
    const outcome = await run(top.call);
    if (text === submitted) {
      change('');
    }
    return outcome ?? true;
  }

  const cancel = () => change('');

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  // The host is done with the line: it stops hearing the builder, and tells no one anything more.
  function dispose() {
    stopHearingBuilder();
    listeners.clear();
  }

  return { getState: () => snapshot, change, acceptCompletion, submit, cancel, subscribe, dispose };
}

// The rest of the first next step, shown after the caret, when the caret is at the end and the step continues what
// is typed ("sea" → "rch "). An empty line has none: an input shows its placeholder there.
function ghostOf(text, caret, step) {
  if (!step || !text || caret !== text.length) {
    return undefined;
  }
  const { insertText } = step;
  return insertText.startsWith(text) && insertText.length > text.length
    ? insertText.slice(text.length)
    : undefined;
}
