// The palette a loaded version 3 catalog gives (`buildPalette`): picking rows, and typed whole commands read by the
// command-builder engine over the same commands, as rows through the palette adapter. How it differs from version 2's palette, on purpose:
//   - states hold while their `when` holds (conditions the app provides); no `then`. After every run, the list is
//     whatever the app's state now says.
//   - a compound command shows one row per param; a run calls the command's own `run({ [paramKey]: arg })`.

import { makeCommandLine } from '../command-builder/command-line.js';
import { makeCommandBuilder } from '../command-builder/engine.js';
import { makePaletteAdapter, rowsFor } from '../command-builder/palette-adapter.js';

export function buildPalette(catalog, { panels = {}, backIntentionId, fallback } = {}) {
  checkAppSupplies(catalog, { panels, backIntentionId });
  const engines = new Map();

  const activeStates = () => Object.values(catalog.states).filter((state) => state.holds({}));
  const panelOf = (states) => states.find((state) => state.panel)?.panel;

  // The states' commands whose own `when` holds now: what the list shows and what a typed line can read.
  const availableCommands = (states) =>
    [...new Set(states.flatMap((state) => state.commands))]
      .map((name) => catalog.commands[name])
      .filter((command) => command.isAvailable({ command: command.name }));

  const listFor = (states) => inGroupOrder(availableCommands(states).flatMap(rowsOfCommand));

  // Rows follow the catalog's group order, then catalog order within a group. Rows carry the group's label, as palette
  // rows always have.
  const groupLabels = Object.values(catalog.groups).map(({ label }) => label);
  const groupRank = ({ group }) => {
    const rank = groupLabels.indexOf(group);
    return rank === -1 ? groupLabels.length : rank;
  };
  const inGroupOrder = (rows) =>
    [...rows].sort((first, second) => groupRank(first) - groupRank(second));

  function rowsOfCommand(command) {
    const params = Object.entries(command.params);
    const commandRow = commandRowOf(command);
    if (!params.length) {
      return [{ ...commandRow, action: () => runCommand(command.name, {}) }];
    }
    if (params.length === 1) {
      const [[paramKey, param]] = params;
      return [{ ...commandRow, action: () => runOrAsk(command, paramKey, param, commandRow) }];
    }
    return params.flatMap(([paramKey, param]) => rowsOfParam(command, paramKey, param));
  }

  const commandRowOf = (command) => {
    const group = catalog.groups[command.group];
    return {
      id: `${catalog.app}.${command.name}`,
      title: command.label,
      aliases: command.aliases,
      group: group?.label,
      icon: command.icon ?? group?.icon
    };
  };

  // A row: the arg the app holds now (`current`, such as the previewed result) runs the command at once; otherwise
  // the row asks for it, as intention-path always has.
  function runOrAsk(command, paramKey, param, meta) {
    const current = param.currentOf?.();
    // `null` or `undefined`: the app holds none.
    return current == null
      ? stepFor(command, paramKey, param, meta)
      : runCommand(command.name, { [paramKey]: argFor(param, current) });
  }

  // A typed line: each param left empty that has a `current` takes the app's arg. One with none asks for it ("open"
  // while nothing is previewed offers the results); other empty params stay empty, as typed.
  function runTyped(command, args) {
    const fromApp = Object.entries(command.params).filter(
      ([paramKey, param]) => args[paramKey] === undefined && param.currentOf
    );
    const filled = { ...args };
    for (const [paramKey, param] of fromApp) {
      const current = param.currentOf();
      if (current == null) {
        return stepFor(command, paramKey, param, commandRowOf(command));
      }
      filled[paramKey] = argFor(param, current);
    }
    return runCommand(command.name, filled);
  }

  // A compound command's param: one row that asks for an arg, or (`rows: 'each value'`) one row per list value.
  function rowsOfParam(command, paramKey, param) {
    const path = param.path ?? {};
    const group = catalog.groups[path.group ?? command.group];
    const meta = {
      id: path.id ?? `${catalog.app}.${command.name}.${paramKey}`,
      title: path.title ?? param.label,
      aliases: path.aliases ?? param.aliases,
      group: group?.label,
      icon: path.icon ?? group?.icon ?? command.icon
    };
    // A row per value takes the entry's own aliases ("every" for all), and its own id: the entry's `path.id`, or the
    // param's id with the value (links.search.match.all).
    if (path.rows === 'each value') {
      return param.argSource.list.map((entry) => ({
        ...meta,
        id: entry.path?.id ?? `${meta.id}.${entry.value}`,
        aliases: entry.aliases ?? meta.aliases,
        title: fillTemplate(meta.title, { title: entry.title }),
        action: () => runCommand(command.name, { [paramKey]: argFor(param, entry.value) })
      }));
    }
    return [{ ...meta, action: () => stepFor(command, paramKey, param, meta) }];
  }

  const stepFor = (command, paramKey, param, meta) =>
    param.argSource.freeform && !param.source && !param.argSource.list
      ? askForText(command, paramKey, param, meta)
      : offerPicker(command, paramKey, param, meta);

  async function offerPicker(command, paramKey, param, meta) {
    const source = param.source
      ? param.source({ command: command.name, filled: {}, key: param.argSource.key })
      : param.argSource.list;
    const rows = (await source).filter((row) => !row.isApplied);
    if (!rows.length) {
      const states = activeStates();
      return stateResult(states, states, { message: emptyTextOf(param) });
    }
    return {
      intentions: rows.map((row) => ({
        id: `${meta.id}::${row.key ?? row.value}`,
        title: row.title,
        subtitle: row.subtitle,
        aliases: row.aliases,
        group: meta.group,
        icon: meta.icon,
        action: () => runCommand(command.name, { [paramKey]: argFor(param, row.value) })
      })),
      includeRevertIntentions: [backIntentionId],
      listKind: 'picker',
      command: commandOf(command)
    };
  }

  // A step says which command it belongs to, so a palette store can tell when the app's state has left it behind.
  const commandOf = (command) => ({ name: command.name, label: command.label });

  // `required` asks again with its message on a blank entry.
  function askForText(command, paramKey, param, meta, message) {
    const path = param.path ?? {};
    const step = {
      id: `${meta.id}::text`,
      title: path.prompt ?? fillTemplate(DEFAULT_PROMPT, { label: param.label.toLowerCase() }),
      group: meta.group,
      icon: meta.icon,
      action: (typed) => {
        const trimmed = typed.trim();
        if (!trimmed && path.required) {
          return askForText(command, paramKey, param, meta, path.required);
        }
        return runCommand(command.name, { [paramKey]: trimmed });
      }
    };
    return {
      intentions: [step],
      disableInputMatching: true,
      includeRevertIntentions: [backIntentionId],
      message,
      listKind: 'text',
      command: commandOf(command)
    };
  }

  async function runCommand(name, args) {
    const before = activeStates();
    const outcome = (await catalog.commands[name].call(args)) ?? {};
    return stateResult(before, activeStates(), outcome);
  }

  // The list is whatever the app's state says now. A run's own side effects win; otherwise the panel follows the
  // states: open while a panel state holds, closed when one stops holding.
  const stateResult = (before, after, outcome = {}) => ({
    intentions: listFor(after),
    resolveInput: resolverFor(after),
    resolveFallbackInput: fallbackFor(after),
    listKind: 'state',
    message: outcome.message,
    sideEffects: outcome.sideEffects ?? panelEffects(before, after)
  });

  function panelEffects(before, after) {
    const panel = panelOf(after);
    if (panel) {
      return { sidecarRenderer: panels[panel] };
    }
    return panelOf(before) ? { closeSidecar: true } : undefined;
  }

  const fallbackFor = (states) =>
    fallback && ((text, context) => fallback(text, { ...context, stateName: states[0]?.name }));

  // The command-builder engine over the commands available now (a command the list hides doesn't read either), with
  // its typed-line resolver; one per set of commands, so a `when` that changes gives the line another engine.
  const keyOf = (commands) => commands.map((command) => command.name).join('+');
  function engineFor(states) {
    const commands = availableCommands(states);
    const key = keyOf(commands);
    if (!engines.has(key)) {
      const engine = makeEngine(commands);
      const { resolveInput } = makePaletteAdapter({ engine, run: runCall });
      engines.set(key, { engine, resolveInput });
    }
    return engines.get(key);
  }
  const resolverFor = (states) => engineFor(states).resolveInput;
  const runCall = (call) => runTyped(catalog.commands[call.command], call.args);

  // The adapter maps the engine's state to rows, holds "Loading" back for a short delay, and tells subscribers when a
  // lookup lands or the delay passes.
  function makeEngine(commands) {
    const lookups = {};
    return makeCommandBuilder({
      commands: commands.map((command) => toEngineCommand(command, lookups)),
      lookups
    });
  }

  // A command line for the commands available now: a custom UI's typed line, or an editor's slash command. It follows
  // the app (its notify(), and its own runs) and runs as a typed-line row does. It reads with engines of its own: an
  // engine holds one line's reading, and a reader with other text on a shared engine would cut it and drop a pending
  // lookup's result. dispose() stops it following.
  function commandLine() {
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
      read: (text, caret) => lineEngineFor(activeStates()).read(text, caret),
      subscribe(listener) {
        lineListeners.add(listener);
        return () => lineListeners.delete(listener);
      }
    };
    const line = makeCommandLine({ builder, run: runCall });
    const followApp = () => {
      lineEngines.forEach((engine) => engine.invalidate());
      const { text, caret } = line.getState();
      line.change(text, caret);
    };
    const stopFollowing = subscribe(followApp);
    const dispose = () => {
      stopFollowing();
      line.dispose();
    };
    // The typed-line rows for the line as it reads now, at its caret, as `resolveInput` would give them: a palette store
    // reads its rows here, so the rows and the line are one reading. The line's `loading` is already the delayed
    // pending.
    const rows = () => {
      const state = line.getState();
      return rowsFor({ ...state, pending: state.loading }, runCall);
    };
    return { ...line, rows, dispose };
  }

  // The app tells ShortRound when something it knows changed (the preview closed, results arrived).
  // ShortRound drops what it cached and tells its subscribers, who re-read through listNow().
  const listeners = new Set();
  function notify() {
    engines.forEach(({ engine }) => engine.invalidate());
    listeners.forEach((listener) => listener());
  }
  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  // The palette for the states that hold now: what a palette store shows when it opens or re-reads.
  function current() {
    const states = activeStates();
    return {
      intentions: listFor(states),
      resolveInput: resolverFor(states),
      resolveFallbackInput: fallbackFor(states),
      sidecarRenderer: panels[panelOf(states)]
    };
  }

  // Whether a command is offered now: one of its states holds, and its own `when` does.
  const isAvailable = (name) =>
    activeStates().some((state) => state.commands.includes(name)) &&
    catalog.commands[name].isAvailable({ command: name });

  return {
    ...current(),
    current,
    commandLine,
    isAvailable,
    // The list as the app's state says now: what a palette would show if it re-read after an outside change.
    listNow: () => listFor(activeStates()),
    notify,
    subscribe
  };
}

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

function checkAppSupplies(catalog, { panels, backIntentionId }) {
  if (!backIntentionId) {
    throw new Error('buildPalette needs backIntentionId');
  }
  for (const state of Object.values(catalog.states)) {
    if (state.panel && !panels[state.panel]) {
      throw new Error(
        `Catalog state "${state.name}" shows panel "${state.panel}", but the app supplies no renderer for it`
      );
    }
  }
}

// What `path` defaults to, so a catalog writes it only to change the wording.
const DEFAULT_PROMPT = 'Type the {label}';
const DEFAULT_EMPTY = 'No {label} to choose from';

const argFor = (param, value) => (param.list ? [value] : value);
// `{label}` in a message names the param ("No {label} values"); `{title}` in a row title names a list value
// ("Match {title}").
const fillTemplate = (template, fields) =>
  template?.replace(/\{(\w+)\}/g, (placeholder, name) => fields[name] ?? placeholder);
const emptyTextOf = (param) =>
  fillTemplate(param.path?.empty ?? DEFAULT_EMPTY, { label: param.label.toLowerCase() });
