import { parse } from 'yaml';
import { z } from 'zod';

import { findMalformedReferences, findReferencedInputs } from './call-args.js';
import { catalogSchema } from './catalog-schema.js';

// Reads a catalog and replaces every code path (run, when, from) with the app's function, so a
// mistake fails here rather than when a user picks the command. Planned states, commands and pickers
// are checked for their references, then left out: their functions may not exist yet.
export function loadCatalog(text, bindings) {
  const built = withoutPlanned(checkCatalog(text));
  return {
    ...built,
    pickers: resolvePickers(built.pickers, bindings),
    states: resolveStates(built, bindings)
  };
}

// Every check loading makes except resolving code paths, so a catalog can be checked without the app
// (while it is written or reviewed). Planned items stay in; paths stay as written.
export function checkCatalog(text) {
  const catalog = parseCatalog(text);
  const startState = findStartState(catalog.states);
  checkReferences(catalog);
  return { ...catalog, startState };
}

function parseCatalog(text) {
  const result = catalogSchema.safeParse(parse(text));
  if (!result.success) {
    throw new Error(`Catalog is malformed:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

function findStartState(states) {
  const startStates = Object.keys(states).filter((name) => states[name].start);
  if (startStates.length === 0) {
    throw new Error('Catalog has no start state');
  }
  if (startStates.length > 1) {
    throw new Error(`Catalog has more than one start state: ${startStates.join(', ')}`);
  }
  if (states[startStates[0]].planned) {
    throw new Error(`Catalog start state "${startStates[0]}" is planned, not built`);
  }
  return startStates[0];
}

// Every command, built or planned, must name states and pickers that exist; a built command must
// not lead into a planned state or choose from a planned picker, or the palette breaks when used.
function checkReferences(catalog) {
  for (const [stateName, state] of Object.entries(catalog.states)) {
    for (const [commandName, command] of Object.entries(state.commands)) {
      const owner = `Catalog command "${stateName}.${commandName}"`;
      const isBuilt = !state.planned && !command.planned;
      checkPicker(catalog, command.ask?.choose, { owner, isBuilt });
      checkNextState(catalog, command.then, { owner, isBuilt });
      checkArgs(command, owner);
    }
  }
}

// `args` may refer only to inputs the command has: $key needs forEach, $value needs ask.
function checkArgs(command, owner) {
  const [malformed] = findMalformedReferences(command.args ?? []);
  if (malformed) {
    throw new Error(
      `${owner}: "${malformed}" looks like a reference but isn't one ($key, $value or $value.<field>)`
    );
  }
  const inputs = findReferencedInputs(command.args ?? []);
  if (inputs.has('value') && !command.ask) {
    throw new Error(`${owner}: args use $value, but the command asks for nothing`);
  }
  if (inputs.has('key') && !command.forEach) {
    throw new Error(`${owner}: args use $key, but the command is not forEach`);
  }
}

function checkPicker(catalog, pickerName, { owner, isBuilt }) {
  if (!pickerName) {
    return;
  }
  const picker = catalog.pickers[pickerName];
  if (!picker) {
    throw new Error(`${owner}: no picker named "${pickerName}"`);
  }
  if (isBuilt && picker.planned) {
    throw new Error(`${owner}: picker "${pickerName}" is planned, not built`);
  }
}

function checkNextState(catalog, stateName, { owner, isBuilt }) {
  if (!stateName) {
    return;
  }
  const state = catalog.states[stateName];
  if (!state) {
    throw new Error(`${owner}: no state named "${stateName}"`);
  }
  if (isBuilt && state.planned) {
    throw new Error(`${owner}: state "${stateName}" is planned, not built`);
  }
}

function withoutPlanned(catalog) {
  const isBuilt = (item) => !item.planned;
  const builtStates = filterValues(catalog.states, isBuilt);
  return {
    ...catalog,
    pickers: filterValues(catalog.pickers, isBuilt),
    states: mapValues(builtStates, (state) => ({
      ...state,
      commands: filterValues(state.commands, isBuilt)
    }))
  };
}

function resolvePickers(pickers, bindings) {
  return mapValues(pickers, (picker, name) => ({
    ...picker,
    from: resolvePath(bindings, picker.from, `Catalog picker "${name}"`)
  }));
}

function resolveStates(catalog, bindings) {
  return mapValues(catalog.states, (state, stateName) => ({
    ...state,
    commands: mapValues(state.commands, (command, commandName) =>
      resolveCommand(command, `Catalog command "${stateName}.${commandName}"`, bindings)
    )
  }));
}

function resolveCommand(command, owner, bindings) {
  return {
    ...command,
    run: resolvePath(bindings, command.run, owner),
    when: command.when && resolvePath(bindings, command.when, owner)
  };
}

function resolvePath(bindings, path, owner) {
  // Own properties only: `app.search.toString` must not resolve to an inherited function.
  const target = path
    .split('.')
    .reduce(
      (node, segment) => (node && Object.hasOwn(node, segment) ? node[segment] : undefined),
      bindings
    );
  if (typeof target !== 'function') {
    throw new Error(`${owner}: the app does not provide "${path}"`);
  }
  return target;
}

const mapValues = (object, transform) =>
  Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));

const filterValues = (object, keep) =>
  Object.fromEntries(Object.entries(object).filter(([, value]) => keep(value)));
