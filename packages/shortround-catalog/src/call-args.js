// How a command's function is called. `args` lists the arguments; a string that is exactly `$key`,
// `$value` or `$value.<field>` refers to the call's input, and any other value is a literal, except a
// string that starts with `$key` or `$value` without being one of those: that is a mistake the loader
// reports. Without `args`, the call is the forEach key, then the asked value, each only if there is one.
const REFERENCE = /^\$(?:(key)|(value)((?:\.[A-Za-z_$][\w$]*)*))$/;
const LOOKS_LIKE_REFERENCE = /^\$(key|value)/;

function parseReference(item) {
  const match = typeof item === 'string' ? REFERENCE.exec(item) : null;
  return match && { name: match[1] ?? match[2], fields: (match[3] ?? '').split('.').slice(1) };
}

// Every string in `args`, at any depth in arrays and plain objects.
function collectStrings(item) {
  if (typeof item === 'string') {
    return [item];
  }
  if (item && typeof item === 'object') {
    return Object.values(item).flatMap(collectStrings);
  }
  return [];
}

// Strings that start like a reference but aren't one (`$values`, `$value.0`, `$key.length`).
export const findMalformedReferences = (args) =>
  collectStrings(args).filter((text) => LOOKS_LIKE_REFERENCE.test(text) && !REFERENCE.test(text));

// Replaces each reference, at any depth in arrays and plain objects, with what `visit` returns for it.
function mapReferences(item, visit) {
  const reference = parseReference(item);
  if (reference) {
    return visit(reference);
  }
  if (Array.isArray(item)) {
    return item.map((element) => mapReferences(element, visit));
  }
  if (item && typeof item === 'object') {
    return Object.fromEntries(
      Object.entries(item).map(([field, element]) => [field, mapReferences(element, visit)])
    );
  }
  return item;
}

// The inputs a command's `args` refer to: a set of 'key' and 'value'.
export function findReferencedInputs(args) {
  const names = new Set();
  mapReferences(args, ({ name }) => names.add(name));
  return names;
}

export function makeCallArgs(args, { key, value }) {
  if (!args) {
    return [key, value].filter((arg) => arg !== undefined);
  }
  const inputs = { key, value };
  // Own fields only, as with code paths: `$value.constructor` must not reach Object.
  const readField = (current, field) =>
    current !== null && typeof current === 'object' && Object.hasOwn(current, field)
      ? current[field]
      : undefined;
  return mapReferences(args, ({ name, fields }) => fields.reduce(readField, inputs[name]));
}
