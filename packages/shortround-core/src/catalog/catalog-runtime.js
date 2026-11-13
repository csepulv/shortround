// A loaded catalog at run time: which states hold, what is available, the app's one signal (`notify`), running a
// command, and a command line over the commands available now. It knows nothing of rows, panels or Back: the palette
// (`buildPalette`) and the chat are views over it, so an app with both calls `notify()` once.

import { makeCommandLine } from '../command-builder/command-line.js';
import { makeCommandBuilder } from '../command-builder/engine.js';
import { rowsFor } from '../command-builder/palette-adapter.js';
import { fillFromApp } from './app-held-values.js';
import { runToolCall, toolsOf } from './intention-tools.js';
import { findInvalidToolNames } from './invalid-tool-names.js';

export function buildCatalogRuntime(catalog) {
  const listeners = new Set();

  const activeStates = () => Object.values(catalog.states).filter((state) => state.holds({}));

  // The states' commands whose own `when` holds now: what a list shows and what a typed line can read.
  const availableCommands = (states = activeStates()) =>
    [...new Set(states.flatMap((state) => state.commands))]
      .map((name) => catalog.commands[name])
      .filter((command) => command.isAvailable({ command: command.name }));

  const isAvailable = (name) =>
    activeStates().some((state) => state.commands.includes(name)) &&
    catalog.commands[name].isAvailable({ command: name });

  // The app tells ShortRound when something it knows changed (the preview closed, results arrived).
  const notify = () => listeners.forEach((listener) => listener());
  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  async function run(name, args = {}) {
    return (await catalog.commands[name].call(args)) ?? {};
  }

  // A typed line: each empty param the app holds a value for takes it. One the app holds none for leaves the command
  // incomplete: it doesn't run, and the outcome names what it needs.
  function runTyped(call) {
    const command = catalog.commands[call.command];
    const filled = fillFromApp(command, call.args);
    return filled.needs ? { needs: filled.needs } : run(command.name, filled.args);
  }

  // A reading the app holds a missing value for needs it, as one missing a typed word does: it can't run, its row is
  // disabled and says so, and Enter keeps the line.
  function withAppNeeds(state) {
    const readings = state.readings
      .map((reading) => {
        const { needs } = fillFromApp(catalog.commands[reading.call.command], reading.call.args);
        return needs
          ? { ...reading, needs: [...new Set([...reading.needs, ...needs])], appNeeds: needs }
          : reading;
      })
      .sort((first, second) => first.needs.length - second.needs.length);
    return { ...state, readings };
  }

  // A command line for the commands available now. It reads with engines of its own: an engine holds one line's
  // reading, and a reader with other text on a shared engine would cut it and drop a pending lookup's result. It
  // follows the app (`followWith`, the runtime's notify by default) and its own runs. `runCall` replaces how a typed
  // line runs (the palette opens a step); without it, a command the app holds a missing value for needs it.
  function commandLine({ runCall, followWith = subscribe } = {}) {
    const runLine = runCall ?? runTyped;
    const readAs = runCall ? (state) => state : withAppNeeds;
    const lineEngines = new Map();
    const lineListeners = new Set();
    const tellLine = () => lineListeners.forEach((listener) => listener());
    const lineEngineFor = (states) => {
      const commands = availableCommands(states);
      const key = keyOf(commands);
      if (!lineEngines.has(key)) {
        const engine = makeEngine(commands);
        engine.subscribe(tellLine);
        lineEngines.set(key, engine);
      }
      return lineEngines.get(key);
    };
    const builder = {
      read: (text, caret) => readAs(lineEngineFor(activeStates()).read(text, caret)),
      subscribe(listener) {
        lineListeners.add(listener);
        return () => lineListeners.delete(listener);
      }
    };
    const line = makeCommandLine({ builder, run: runLine });
    const followApp = () => {
      lineEngines.forEach((engine) => engine.invalidate());
      const { text, caret } = line.getState();
      line.change(text, caret);
    };
    const stopFollowing = followWith(followApp);
    const dispose = () => {
      stopFollowing();
      line.dispose();
    };
    // The typed-line rows for the line as it reads now, at its caret, as a palette's `resolveInput` would give them.
    // The line's `loading` is already the delayed pending.
    const rows = () => {
      const state = line.getState();
      return rowsFor({ ...state, pending: state.loading }, runLine);
    };
    return { ...line, rows, dispose };
  }

  // Every intention, every time: a list that changes between a call and the reply makes some models doubt the app's
  // answer. One that isn't available now says so, lists no lookup values (it can't be called), and runTool refuses it.
  const invalidToolNames = findInvalidToolNames(catalog);
  const offerableCommands = Object.values(catalog.commands).filter(
    (command) => !invalidToolNames.some((invalid) => invalid.command === command.name)
  );
  let hasWarnedOfInvalidNames = false;

  function offeredTools() {
    warnOfInvalidNamesOnce();
    const isAvailableNow = new Set(availableCommands().map((command) => command.name));
    return toolsOf(offerableCommands, {
      isAvailable: (command) => isAvailableNow.has(command.name)
    });
  }

  function warnOfInvalidNamesOnce() {
    if (hasWarnedOfInvalidNames || !invalidToolNames.length) {
      return;
    }
    hasWarnedOfInvalidNames = true;
    const named = invalidToolNames.map(({ command, reason }) => `${command} (${reason})`);
    console.warn(
      `These commands can't be a model's tools, so the model isn't offered them: ${named.join(', ')}`
    );
  }

  const runtime = {
    catalog,
    activeStates,
    availableCommands,
    isAvailable,
    notify,
    subscribe,
    run,
    commandLine,
    tools: offeredTools,
    runTool: (toolCall) => runToolCall(runtime, toolCall)
  };
  return runtime;
}

/** Whether a value is a runtime (rather than a loaded catalog). */
export const isCatalogRuntime = (value) =>
  typeof value?.commandLine === 'function' && Boolean(value.catalog);

// The command-builder engine over some commands; one per set of commands, so a `when` that changes gives another.
export function makeEngine(commands) {
  const lookups = {};
  return makeCommandBuilder({
    commands: commands.map((command) => toEngineCommand(command, lookups)),
    lookups
  });
}

export const keyOf = (commands) => commands.map((command) => command.name).join('+');

// The engine names its lookups; each param's source is wrapped so it also receives the param's `key`. Each param
// carries the empty picker's text, so a typed line with nothing to choose says the same.
function toEngineCommand(command, lookups) {
  const params = Object.fromEntries(
    Object.entries(command.params).map(([paramKey, param]) => {
      const withEmpty = { ...param, emptyText: emptyTextOf(param) };
      if (!param.source) {
        return [paramKey, withEmpty];
      }
      const name = `${command.name}.${paramKey}`;
      lookups[name] = (context) => param.source({ ...context, key: param.argSource.key });
      return [paramKey, { ...withEmpty, argSource: { ...param.argSource, lookup: name } }];
    })
  );
  return {
    name: command.name,
    label: command.label,
    aliases: command.aliases ?? [],
    run: command.run,
    params
  };
}

// What `path` defaults to, so a catalog writes it only to change the wording.
const DEFAULT_EMPTY = 'No {label} to choose from';

// `{label}` in a message names the param ("No {label} values"); `{title}` in a row title names a list value
// ("Match {title}").
export const fillTemplate = (template, fields) =>
  template?.replace(/\{(\w+)\}/g, (placeholder, name) => fields[name] ?? placeholder);
export const emptyTextOf = (param) =>
  fillTemplate(param.path?.empty ?? DEFAULT_EMPTY, { label: param.label.toLowerCase() });
