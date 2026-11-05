// Lookups, cached on the frame that asked for them. A frame looks in its own cache and then in the
// frames below it, so a lookup is called once per context for as long as those frames stand. Cutting
// the stack drops their caches. A lookup that returns a promise is pending until it resolves; the
// result is applied only if the frame that asked is still on the stack (same id), otherwise dropped.

export const PENDING = Symbol('pending');
// A lookup whose promise rejected: no values, and the state says so (rather than "no value matches").
export const FAILED = Symbol('failed');
export const isUnavailable = (rows) => rows === PENDING || rows === FAILED;

export function makeLookupAccess({ lookups, stack, work, onResolve }) {
  const at = (position) => (name, context) => {
    const key = `${name}:${JSON.stringify(keyOf(context))}`;
    const cached = stack.findCached(position, key);
    if (cached) {
      if (cached.isPending) {
        return PENDING;
      }
      return cached.isFailed ? FAILED : cached.rows;
    }
    work.lookups += 1;
    const cache = stack.cacheAt(position);
    let result;
    try {
      result = lookups[name](context);
    } catch (error) {
      // A lookup that throws is a failed lookup, as a rejected one is: every reader (a palette's rows, a store's line,
      // an editor's line) says "Couldn't load" instead of throwing out of a keystroke.
      console.error(`Lookup "${name}" failed`, { context: keyOf(context), error });
      cache.set(key, { rows: [], isFailed: true });
      return FAILED;
    }
    if (typeof result?.then !== 'function') {
      cache.set(key, { rows: result });
      return result;
    }
    const frameId = stack.idAt(position);
    cache.set(key, { isPending: true });
    result.then(
      (rows) => settle(position, frameId, key, { rows }),
      (error) => {
        console.error(`Lookup "${name}" failed`, { context: keyOf(context), error });
        settle(position, frameId, key, { rows: [], isFailed: true });
      }
    );
    return PENDING;
  };

  function settle(position, frameId, key, entry) {
    if (stack.idAt(position) !== frameId) {
      return;
    }
    stack.cacheAt(position).set(key, entry);
    onResolve(position);
  }

  return { at };
}

// The cache key: the command and the plain values filled so far (not the word being typed, so a
// lookup isn't called again on every keystroke).
const keyOf = ({ command, filled }) => ({
  command,
  filled: Object.fromEntries(
    Object.entries(filled).map(([param, value]) => [param, plainValue(value)])
  )
});

const plainValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(plainValue);
  }
  return typeof value === 'object' && value !== null ? value.value : value;
};
