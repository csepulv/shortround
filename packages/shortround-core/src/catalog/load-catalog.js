import { parse } from 'yaml';
import { z } from 'zod';

import { catalogSchema } from './catalog-schema.js';
import { compileWhen } from './conditions.js';

const VERSION_2 =
  'This is a version 2 catalog; ShortRound 0.5.0 reads version 3. See "From a v2 catalog" in MIGRATING.md: ' +
  'https://github.com/csepulv/shortround/blob/main/MIGRATING.md#from-a-v2-catalog';

// Reads a catalog (format version 3) and replaces every code path with the app's function, so a mistake fails here
// rather than when a user picks the command. Planned items are checked for their references, then left out: their
// functions may not exist yet.
export function loadCatalog(text, bindings) {
  const built = withoutPlanned(checkCatalog(text));
  const resolve = (path, owner) => resolvePath(bindings, path, owner);
  return {
    ...built,
    commands: mapValues(built.commands, (command, name) => resolveCommand(command, name, resolve)),
    states: mapValues(built.states, (state, name) => ({
      ...state,
      name,
      holds: state.when ? compileWhen(state.when, { resolve, owner: stateOwner(name) }) : () => true
    }))
  };
}

// Every check loading makes except resolving code paths, so a catalog can be checked without the app (while it is
// written or reviewed). Planned items stay in; paths stay as written.
export function checkCatalog(text) {
  const raw = readYaml(text);
  if (raw?.version === 2) {
    throw new Error(VERSION_2);
  }
  const catalog = parseCatalog(withoutExtensionKeys(raw));
  checkReferences(catalog);
  checkStartState(catalog.states);
  // A clause's shape needs no app, so it is checked here too, against conditions that always answer.
  const anyCondition = () => () => true;
  forEachWhen(catalog, (clause, owner) => compileWhen(clause, { resolve: anyCondition, owner }));
  return catalog;
}

// Merge keys (`<<: *shared`) let a catalog share a definition, such as one facet's fields.
const readYaml = (text) => parse(text, { merge: true });

// Top-level keys starting with `x-` hold shared definitions (anchors) and are not part of the catalog.
const withoutExtensionKeys = (raw) =>
  raw && typeof raw === 'object'
    ? Object.fromEntries(Object.entries(raw).filter(([key]) => !key.startsWith('x-')))
    : raw;

function parseCatalog(raw) {
  const result = catalogSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Catalog is malformed:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

// Every command, built or planned, names groups that exist; every state names commands that exist.
function checkReferences(catalog) {
  const checkGroup = (key, owner) => {
    if (key !== undefined && !catalog.groups[key]) {
      throw new Error(`${owner}: no group "${key}" in the catalog`);
    }
  };
  for (const [name, command] of Object.entries(catalog.commands)) {
    checkGroup(command.group, commandOwner(name));
    for (const [paramKey, param] of Object.entries(command.params)) {
      checkGroup(param.path?.group, paramOwner(name, paramKey));
    }
  }
  for (const [name, state] of Object.entries(catalog.states)) {
    const missing = state.commands.find((command) => !catalog.commands[command]);
    if (missing) {
      throw new Error(`${stateOwner(name)}: no command "${missing}" in the catalog`);
    }
  }
}

// `start` marks where the palette starts, for readers and the catalog-discovery skill: at most one state.
function checkStartState(states) {
  const startStates = Object.keys(states).filter((name) => states[name].start);
  if (startStates.length > 1) {
    throw new Error(`Catalog has more than one start state: ${startStates.join(', ')}`);
  }
}

function forEachWhen(catalog, visit) {
  for (const [name, state] of Object.entries(catalog.states)) {
    if (state.when) {
      visit(state.when, stateOwner(name));
    }
  }
  for (const [name, command] of Object.entries(catalog.commands)) {
    if (command.when) {
      visit(command.when, commandOwner(name));
    }
  }
}

function withoutPlanned(catalog) {
  const isBuilt = (item) => !item.planned;
  const commands = filterValues(catalog.commands, isBuilt);
  return {
    ...catalog,
    commands,
    states: mapValues(filterValues(catalog.states, isBuilt), (state) => ({
      ...state,
      commands: state.commands.filter((name) => commands[name])
    }))
  };
}

function resolveCommand(command, name, resolve) {
  const owner = commandOwner(name);
  return {
    ...command,
    name,
    call: resolve(command.run, owner),
    isAvailable: command.when ? compileWhen(command.when, { resolve, owner }) : () => true,
    params: mapValues(command.params, (param, paramKey) => {
      const { lookup, current } = param.argSource;
      return {
        ...param,
        source: lookup ? resolve(lookup, paramOwner(name, paramKey)) : undefined,
        // The arg the app holds now (the previewed result), if any.
        currentOf: current ? resolve(current, paramOwner(name, paramKey)) : undefined
      };
    })
  };
}

const commandOwner = (name) => `Catalog command "${name}"`;
const paramOwner = (name, paramKey) => `${commandOwner(name)} param "${paramKey}"`;
const stateOwner = (name) => `Catalog state "${name}"`;

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
