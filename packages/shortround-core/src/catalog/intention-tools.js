import {
  describeForModel,
  isNumberParam,
  isTypedParam,
  readGivenValue
} from '../command-builder/typed-values.js';
import { fillFromApp } from './app-held-values.js';

/** How long building the tools waits for a lookup's values before describing its param without them. */
export const LOOKUP_WAIT_MS = 500;

const MAX_LISTED_VALUES = 20;

/**
 * The commands given, as tool definitions a model can call: a name, a description and a JSON Schema for the args. The
 * description is the label, then the command's `toolDescription` when it has one. A fixed list becomes an enum; a
 * lookup becomes a string checked when the call runs, since its values are the app's and change. A number type becomes
 * an integer or a number with its `minimum` and `maximum`, text keeps its `maxLength`, and a `nullable` param also
 * takes `null`; the description says the rule in words. For the commands
 * `isAvailable` accepts (all, by default), a lookup's description lists the values the app has now, so the model
 * needn't guess; for the others the lookup isn't asked, and the label is marked "(not available now)".
 */
export const toolsOf = (commands, { isAvailable = () => true } = {}) =>
  Promise.all(commands.map((command) => toolOf(command, isAvailable(command))));

const NOT_AVAILABLE = ' (not available now)';

function descriptionOf(command, isAvailableNow) {
  const label = isAvailableNow ? command.label : `${command.label}${NOT_AVAILABLE}`;
  return command.toolDescription ? `${label}. ${command.toolDescription}` : label;
}

async function toolOf(command, isAvailableNow) {
  const properties = await Promise.all(
    Object.entries(command.params).map(async ([paramKey, param]) => [
      paramKey,
      await propertyOf(command, paramKey, param, isAvailableNow)
    ])
  );
  const required = requiredFromModel(command);
  return {
    name: command.name,
    description: descriptionOf(command, isAvailableNow),
    inputSchema: {
      type: 'object',
      properties: Object.fromEntries(properties),
      ...(required.length ? { required } : {}),
      additionalProperties: false
    }
  };
}

const requiredFromModel = (command) =>
  Object.entries(command.params)
    .filter(([, param]) => param.required && (!param.currentOf || param.currentOf() == null))
    .map(([paramKey]) => paramKey);

/**
 * Runs a model's tool call through `runtime`: refuses an intention that isn't available now, an unknown param, a
 * value outside its choices (the answer names them, so the model can try again), a value that isn't text (an object,
 * a nested list), a list with fewer items than its `minItems`, and a typed value that breaks its param's rule (the
 * answer says the rule); takes `null` as left out, unless the param is `nullable`, when `run` receives `null`; takes a
 * number or boolean given as free text as its text, and a number type's number (or number written as text) as a
 * number; fills what the app holds, and refuses, naming each, a required param still missing, empty or blank;
 * otherwise runs it and answers with its `output` (what the run returns for the model), else its message, else the
 * placeholder "Ran <label>".
 */
export async function runToolCall(runtime, { toolName, input }) {
  const command = runtime.catalog.commands[toolName];
  if (!command || !runtime.isAvailable(toolName)) {
    return { errorText: `"${toolName}" is not available now` };
  }
  const checked = await checkArgs(command, input ?? {});
  if (checked.errorText) {
    return checked;
  }
  const filled = fillFromApp(command, checked.args);
  const needs = neededLabels(command, filled.args ?? checked.args, filled.needs ?? []);
  if (needs.length) {
    return { errorText: `"${toolName}" needs ${needs.join(', ')}` };
  }
  const outcome = await runtime.run(toolName, filled.args);
  return { output: outcome.output ?? outcome.message ?? `Ran ${command.label}` };
}

const neededLabels = (command, args, appNeeds) =>
  Object.entries(command.params)
    .filter(
      ([paramKey, param]) =>
        appNeeds.includes(param.label) || (param.required && isMissing(args[paramKey]))
    )
    .map(([, param]) => param.label);

const isBlankText = (value) => typeof value === 'string' && !value.trim();

const isMissing = (value) =>
  value === undefined || isBlankText(value) || (Array.isArray(value) && value.every(isBlankText));

async function propertyOf(command, paramKey, param, isListingValues) {
  const property = await propertyShapeOf(command, paramKey, param, isListingValues);
  const minItems = param.minItems ?? (param.list && param.required ? 1 : undefined);
  return minItems ? { ...property, minItems } : property;
}

async function propertyShapeOf(command, paramKey, param, isListingValues) {
  const { list: fixedValues, lookup } = param.argSource;
  if (fixedValues) {
    return asListIf(
      param.list,
      { type: 'string', enum: fixedValues.map((row) => String(row.value)) },
      param.label
    );
  }
  if (lookup) {
    const checkedLater = param.list
      ? 'the app’s values, checked when it runs'
      : 'one of the app’s values, checked when it runs';
    const values = isListingValues ? await valuesNow(command, paramKey, param) : '';
    return asListIf(param.list, { type: 'string' }, `${param.label}: ${checkedLater}${values}`);
  }
  if (isTypedParam(param)) {
    return asListIf(param.list, typedShapeOf(param), describeForModel(param));
  }
  return asListIf(param.list, { type: 'string' }, `${param.label}: free text`);
}

function typedShapeOf(param) {
  const { type, minimum, maximum, maxLength } = param.argSource;
  const jsonType = isNumberParam(param) ? type : 'string';
  return {
    type: param.nullable ? [jsonType, 'null'] : jsonType,
    ...(minimum === undefined ? {} : { minimum }),
    ...(maximum === undefined ? {} : { maximum }),
    ...(maxLength === undefined ? {} : { maxLength })
  };
}

// The lookup's values as the model may give them: each title, with its aliases. A lookup that fails or is slow lists
// nothing, and the call is still checked when it runs.
async function valuesNow(command, paramKey, param) {
  let rows;
  try {
    rows = await withinWait(choicesOf(command, paramKey, param));
  } catch (error) {
    console.error(`Lookup for the tool "${command.name}" failed`, { param: paramKey, error });
    return '';
  }
  if (!rows?.length) {
    return '';
  }
  const listed = rows.slice(0, MAX_LISTED_VALUES).map(nameForModel).join(', ');
  const more = rows.length - MAX_LISTED_VALUES;
  return `. Now: ${listed}${more > 0 ? `, and ${more} more` : ''}`;
}

const nameForModel = (row) => {
  const title = JSON.stringify(String(row.title ?? row.value));
  const aliases = (row.aliases ?? []).map((alias) => JSON.stringify(String(alias)));
  return aliases.length ? `${title} (or ${aliases.join(', ')})` : title;
};

function withinWait(result) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(undefined), LOOKUP_WAIT_MS);
  });
  return Promise.race([Promise.resolve(result), timeout]).finally(() => clearTimeout(timer));
}

const asListIf = (isList, item, description) =>
  isList ? { type: 'array', items: item, description } : { ...item, description };

async function checkArgs(command, input) {
  const args = {};
  for (const [paramKey, given] of Object.entries(input)) {
    if (!Object.hasOwn(command.params, paramKey)) {
      return { errorText: `"${command.name}" has no "${paramKey}"` };
    }
    const param = command.params[paramKey];
    if (given == null) {
      if (param.nullable) {
        args[paramKey] = null;
      }
      continue;
    }
    if (!param.list && Array.isArray(given)) {
      return { errorText: `"${command.name}" takes one ${param.label}` };
    }
    if (param.list && [given].flat().length < (param.minItems ?? 0)) {
      return { errorText: `"${command.name}" needs at least ${param.minItems} of ${param.label}` };
    }
    const items = [given].flat();
    if (!items.every((item) => TEXT_LIKE.has(typeof item))) {
      return { errorText: `"${command.name}" takes ${param.label} as text` };
    }
    const choices = await choicesOf(command, paramKey, param);
    if (!choices) {
      const free = freeValuesOf(param, items);
      if (free.rule) {
        return { errorText: `"${command.name}": ${free.rule}` };
      }
      args[paramKey] = param.list ? free.values : free.values[0];
      continue;
    }
    const resolved = [given].flat().map((value) => [value, valueAmong(choices, value)]);
    const unknown = resolved.find(([, value]) => value === undefined);
    if (unknown) {
      const names = choices.map((row) => row.title ?? row.value).join(', ');
      return { errorText: `No ${param.label} "${unknown[0]}". Choose from: ${names}` };
    }
    const values = resolved.map(([, value]) => value);
    args[paramKey] = param.list ? values : values[0];
  }
  return { args };
}

const TEXT_LIKE = new Set(['string', 'number', 'boolean']);

function freeValuesOf(param, items) {
  if (!isTypedParam(param)) {
    return { values: items.map(String) };
  }
  const reads = items.map((item) =>
    readGivenValue(param, isNumberParam(param) ? item : String(item))
  );
  const broken = reads.find((read) => read.rule);
  return broken ? { rule: broken.rule } : { values: reads.map((read) => read.value) };
}

function choicesOf(command, paramKey, param) {
  if (param.argSource.list) {
    return param.argSource.list;
  }
  if (param.source) {
    return param.source({ command: command.name, filled: {}, key: param.argSource.key });
  }
  return undefined;
}

function valueAmong(choices, given) {
  const wanted = String(given).toLowerCase();
  const names = (row) =>
    [row.value, row.title, ...(row.aliases ?? [])].map((name) => String(name).toLowerCase());
  return choices.find((row) => names(row).includes(wanted))?.value;
}
