// The adapter: the command-builder engine's state, as today's palette rows. The engine owns the reading; this only
// maps it. Completion rows use core's `completion` field.

import { makeLoadingDelay } from './loading-delay.js';

const COMMANDS = 'Commands';
const NEXT = 'Next';
const PROBLEM = 'Problem';
const STATUS = 'Status';

export function makePaletteAdapter({
  engine,
  run,
  now = () => Date.now(),
  schedule = (callback, ms) => setTimeout(callback, ms)
}) {
  const listeners = new Set();
  const notify = () => listeners.forEach((listener) => listener());
  engine.subscribe(notify);
  const loadingDelay = makeLoadingDelay({ now, schedule, notify });

  // One function for the palette's lifetime: a new resolveInput resets core's list.
  const resolveInput = (text) => {
    const state = engine.read(text);
    const pending = state.pending ?? [];
    loadingDelay.track(pending);
    return rowsFor({ ...state, pending: loadingDelay.shown(pending) }, run);
  };
  // Core re-renders when told: when a lookup lands (the engine), or when a loading delay passes (here).
  resolveInput.subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  // Core doesn't resolve a blank input, so the empty line's next steps are the starting rows.
  const defaultIntentions = engine.read('').nextSteps.map(toCompletionRow);

  return { resolveInput, defaultIntentions };
}

// Enter runs the first row cmdk highlights, and cmdk never highlights a disabled row. So: when the top reading can
// run, commands come first (Enter sends it); when it can't yet, next steps come first (Enter completes, like Tab).
export function rowsFor(state, run) {
  const commands = state.readings.map((reading) => toCommandRow(reading, run));
  const next = state.nextSteps.map(toCompletionRow);
  const canRun = Boolean(state.readings[0]) && state.readings[0].needs.length === 0;
  const problem = state.problem ? [toProblemRow(state.problem)] : [];
  // An unfinished value, or a param with nothing to choose from, is explained at the top, so the list doesn't read as
  // an error. These rows are disabled, so Enter still lands on the first completion. They share the Status group with
  // the lookups' rows: "Keep typing" was wrong for "nothing to choose".
  const waiting = (state.incomplete ?? []).map(toWaitingRow);
  // Loading and failed lookups say so first, so an empty list isn't read as "nothing matches".
  const status = [
    ...(state.failed ?? []).map(({ param, label }) =>
      toStatusRow(param, `Couldn't load ${label.toLowerCase()}`)
    ),
    ...(state.pending ?? []).map(({ param, label }) =>
      toStatusRow(param, `Loading ${label.toLowerCase()}…`)
    )
  ];
  return [
    ...status,
    ...waiting,
    ...(canRun ? [...commands, ...next] : [...next, ...commands]),
    ...problem
  ];
}

const toStatusRow = (param, title) => ({
  id: `status:${param}:${title}`,
  title,
  group: STATUS,
  disabled: true,
  action: () => ({})
});

const toWaitingRow = (message) => ({
  id: `keep-typing:${message}`,
  title: message,
  group: STATUS,
  disabled: true,
  action: () => ({})
});

// A command row carries its call, so the catalog's examples can check what a typed line would run.
const toCommandRow = ({ title, needs, call }, run) => ({
  id: `command:${title}`,
  title,
  subtitle: needs.length ? `Needs ${needs.join(', ')}` : undefined,
  group: COMMANDS,
  icon: 'search',
  disabled: needs.length > 0,
  call,
  action: () => run(call)
});

const toCompletionRow = ({ label, insertText }) => ({
  id: `next:${insertText}`,
  title: label,
  subtitle: insertText,
  group: NEXT,
  completion: insertText,
  // Never called: core applies `completion` instead.
  action: () => ({})
});

const toProblemRow = (reason) => ({
  id: 'problem',
  title: reason,
  group: PROBLEM,
  disabled: true,
  action: () => ({})
});
