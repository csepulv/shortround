// Values: where a param's args come from, and what closing a typed value gives (a list or lookup
// entry, freeform text, a date range).

import { FAILED, isUnavailable } from './lookups.js';
import { parseRange } from './ranges.js';

export function makeValues({ matcher, now }) {
  function entriesFor({ command, filled }, param, ctx) {
    const { argSource } = command.params[param];
    if (argSource.list) {
      return argSource.list;
    }
    return argSource.lookup ? ctx.lookup(argSource.lookup, { command: command.name, filled }) : [];
  }

  function matchEntries(reading, open, ctx) {
    const entries = entriesFor(reading, open.param, ctx);
    return isUnavailable(entries) ? entries : matcher.matchValue(textOf(open), entries);
  }

  // Closing a value may give several readings ("sort fav": two Favorites sorts). A value whose
  // lookup is still pending, or failed, stays as typed and is marked so (the state reports it).
  function closeOpen(reading, ctx) {
    const { open, command } = reading;
    if (!open) {
      return [reading];
    }
    const spec = command.params[open.param];
    const cleared = { ...reading, open: undefined };
    if (!open.tokens.length) {
      return reading.filled[open.param] === undefined
        ? ctx.die(`Choose a ${spec.label} value`)
        : [cleared];
    }
    const text = textOf(open);
    const matches = hasSource(spec) ? matchEntries(reading, open, ctx) : [];
    if (isUnavailable(matches)) {
      const asTyped = fill(cleared, open.param, { value: text, title: text });
      return [{ ...asTyped, ...unavailableFlag(matches) }];
    }
    const isSourceMatch = matches.length && (!spec.argSource.freeform || matches[0].rank <= 1);
    if (isSourceMatch) {
      return matches.flatMap(({ entry, via, rank }) => {
        const value = valueOfEntry(spec, entry, open.hint);
        return value
          ? [
              {
                ...fill(cleared, open.param, value),
                rank: Math.max(reading.rank, rank),
                fuzzyCount: reading.fuzzyCount + Number(via === 'fuzzy')
              }
            ]
          : [];
      });
    }
    if (!spec.argSource.freeform) {
      return ctx.die(`No ${spec.label} value matches "${text}"`);
    }
    if (isRange(spec)) {
      const range = toRange(text, text, open.hint);
      return range
        ? [
            {
              ...fill(cleared, open.param, range),
              textWords: reading.textWords + open.tokens.length
            }
          ]
        : ctx.die(`No date matches "${text}"`);
    }
    const value = spec.list || hasSource(spec) ? { value: text, title: text, isNew: true } : text;
    return [
      {
        ...fill(cleared, open.param, value),
        textWords: reading.textWords + open.tokens.length,
        termStart: open.tokens[0].index
      }
    ];
  }

  // A list entry for a range param ("recent") stands for a range ("last 30 days").
  const valueOfEntry = (spec, entry, hint) =>
    isRange(spec) ? toRange(entry.value, entry.title, hint) : entry;

  // A range value keeps how it was typed (its title) and the dates it means. The hint that opened it
  // can change its meaning ("newer than", "since").
  function toRange(phrase, title, hint) {
    const range = parseRange(phrase, { now: now(), hint });
    const shownHint = hint && hint !== 'from' ? `${hint} ` : '';
    return range && { value: range, title: `${shownHint}${title}` };
  }

  function fill(reading, param, value) {
    const spec = reading.command.params[param];
    const previous = reading.filled[param] ?? [];
    return {
      ...reading,
      filled: { ...reading.filled, [param]: spec.list ? [...previous, value] : value }
    };
  }

  return { entriesFor, matchEntries, closeOpen, valueOfEntry, fill };
}

export const hasSource = (spec) => Boolean(spec.argSource.list || spec.argSource.lookup);

// A reading waiting on its param's args carries why: still loading, or the lookup failed.
export const unavailableFlag = (rows) =>
  rows === FAILED ? { isFailed: true } : { isPending: true };
export const isRange = (spec) => spec.argSource.type === 'range';
export const textOf = (open) => open.tokens.map((token) => token.text).join(' ');

export function displayOf(spec, value) {
  const titleOf = (item) => (typeof item === 'string' ? item : item.title);
  return spec.list ? value.map(titleOf).join(', ') : titleOf(value);
}

// What `run` receives: each filled param's arg, as plain values.
export const argsOf = (command, filled) =>
  Object.fromEntries(
    Object.entries(filled).map(([param, value]) => {
      const valueOf = (item) => (typeof item === 'string' ? item : item.value);
      return [param, command.params[param].list ? value.map(valueOf) : valueOf(value)];
    })
  );
