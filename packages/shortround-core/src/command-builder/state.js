// What the engine returns: the candidate commands ranked, what may come next at the caret, each word's
// role, and why the line is broken.

import { FAILED, isUnavailable, PENDING } from './lookups.js';
import { isTypedParam, readTypedText } from './typed-values.js';
import { argsOf, displayOf, hasSource, textOf } from './values.js';

const MAX_ROWS = 5;

export function makeState({ stepper, values }) {
  // live: the readings after the finished words; readings: those also read with the word being typed.
  function build({ text, tokens, partial, live, readings, deaths, caretFrame, ctx }) {
    const nextSteps = dedupe(
      caretFrame.readings.flatMap((reading) => suggest(reading, caretFrame, text, ctx))
    );
    const problem = readings.length || nextSteps.length ? undefined : furthest(deaths);
    const ranked = rank(readings, ctx);
    return {
      readings: dedupe(ranked.map(toRow), 'title').slice(0, MAX_ROWS),
      nextSteps: problem?.fix ? [...nextSteps, fixStep(problem.fix, text)] : nextSteps,
      annotations: annotate(tokens, ranked[0]?.reading ?? bestUnfinished(readings), problem),
      problem: problem?.reason,
      // Nothing can run yet, but nothing is wrong either: say what's still being typed.
      incomplete:
        ranked.length || problem
          ? []
          : [...describeIncomplete(readings, ctx), ...emptyAtCaret(caretFrame, text, ctx)],
      brokenRules: ranked.length || problem ? [] : brokenRulesOf(readings, ctx),
      awaiting: ranked.length || problem ? [] : awaitedAfterHints(readings),
      ...lookupStatus([...live, ...readings], caretFrame, ctx),
      partial: partial?.text
    };
  }

  // Which params' args are still loading, and which failed to load: from readings waiting on them, and
  // from the values the next steps would list at the caret. Each is { param, label }, once per param.
  function lookupStatus(readings, caretFrame, ctx) {
    const statuses = [
      ...readings.flatMap((reading) => {
        if (!reading.open || !(reading.isPending || reading.isFailed)) {
          return [];
        }
        return [statusEntry(reading, reading.open.param, reading.isFailed ? FAILED : PENDING)];
      }),
      ...caretFrame.readings.flatMap((reading) =>
        paramsListedAtCaret(reading, caretFrame).map((param) =>
          statusEntry(reading, param, values.entriesFor(reading, param, ctx))
        )
      )
    ].filter(({ rows }) => isUnavailable(rows));
    const listed = (rows) =>
      dedupe(
        statuses
          .filter((status) => status.rows === rows)
          .map(({ param, label }) => ({ param, label })),
        'param'
      );
    return { pending: listed(PENDING), failed: listed(FAILED) };
  }

  const statusEntry = (reading, param, rows) => ({
    param,
    label: reading.command.params[param].label,
    rows
  });

  // The params whose values the next steps would list: the open one, or after a hint, the hinted ones once
  // a value is being typed.
  function paramsListedAtCaret(reading, { typed }) {
    if (!reading.command) {
      return [];
    }
    if (reading.pendingHint) {
      return typed ? reading.pendingHint.params : [];
    }
    // Right after the name, the default param the next steps offer counts as open here too.
    const { open } = withDefaultOffered(reading);
    return open && hasSource(reading.command.params[open.param]) ? [open.param] : [];
  }

  function rank(readings, ctx) {
    const quiet = { ...ctx, die: () => [] };
    const isWaiting = (reading) => reading.isPending || reading.isFailed;
    return readings
      .filter((reading) => reading.command && !reading.pendingHint && !isWaiting(reading))
      .flatMap((reading) => values.closeOpen(reading, quiet))
      .filter(
        (reading) =>
          !isWaiting(reading) &&
          (Object.keys(reading.filled).length > 0 || isCompleteByName(reading.command))
      )
      .map((reading) => ({ reading, needs: missingParams(reading) }))
      .sort(byPreference);
  }

  // Runnable first; then the reading that explains more words structurally (fewer words left as freeform text), then
  // fewer fuzzy guesses, then the higher param priority, then better value matches.
  const byPreference = (first, second) =>
    first.needs.length - second.needs.length ||
    first.reading.textWords - second.reading.textWords ||
    first.reading.fuzzyCount - second.reading.fuzzyCount ||
    priorityOf(second.reading) - priorityOf(first.reading) ||
    first.reading.rank - second.reading.rank;

  // While nothing can run yet (the line waits after a hint or a param word), the words read so far keep their roles:
  // the reading the ranking's own tie-breaks prefer.
  const bestUnfinished = (readings) =>
    readings
      .filter((reading) => reading.command)
      .map((reading) => ({ reading, needs: [] }))
      .sort(byPreference)[0]?.reading;

  const priorityOf = ({ command, filled }) =>
    Object.keys(filled).reduce((sum, param) => sum + (command.params[param].priority ?? 0), 0);

  const missingParams = ({ command, filled }) =>
    Object.entries(command.params)
      .filter(([param, spec]) => spec.required && filled[param] === undefined)
      .map(([, spec]) => spec.label);

  function toRow({ reading: { command, filled }, needs }) {
    // A one-param command reads back by its own label ("Preview: 3. CSS grid guide"), so commands that share a
    // param's label stay apart; a command with several params names each arg by its param.
    const isOneParam = Object.keys(command.params).length === 1;
    const parts = Object.entries(command.params)
      .filter(([param]) => filled[param] !== undefined)
      .map(
        ([param, spec]) =>
          `${isOneParam ? command.label : spec.label}: ${displayOf(spec, filled[param])}`
      );
    const defaultParam = Object.keys(command.params).find((param) => command.params[param].default);
    const lead = filled[defaultParam] === undefined ? [command.label] : [];
    const needsText = needs.length ? ` (needs ${needs.join(', ')})` : '';
    return {
      title: [...lead, ...parts].join(' · ') + needsText,
      needs,
      call: { command: command.name, run: command.run, args: argsOf(command, filled) }
    };
  }

  // caretFrame: the readings before the caret's word, the part of that word before the caret, and the
  // text on either side of it.
  function suggest(reading, caretFrame, text, ctx) {
    const { typed, before, after } = caretFrame;
    const step = (label, kind) => ({ label, insertText: joinParts(before, label, after), kind });
    if (!reading.command) {
      return stepper
        .commandItems()
        .filter(({ phrase }) => phrase.startsWith(typed))
        .map(({ phrase }) => step(phrase, 'command'));
    }
    if (reading.pendingHint) {
      return hintSteps(reading, caretFrame, text, ctx, step);
    }
    // While the open value can't be closed yet ("from last"), only values can come next.
    const quiet = { ...ctx, die: () => [] };
    const isIncomplete =
      reading.open?.tokens.length > 0 && values.closeOpen(reading, quiet).length === 0;
    const offered = withDefaultOffered(reading);
    const offeredParam = offered === reading ? undefined : offered.open.param;
    return [
      ...valueSteps(offered, caretFrame, text, ctx),
      ...(isIncomplete ? [] : introducerSteps(reading, typed, step, offeredParam))
    ];
  }

  // Right after a command's name ("preview "), a default param with values is what comes next: its values are offered
  // as if it were open, ahead of the hints and other params' words, and its own label isn't. A freeform default (a
  // search term) has no values, so it keeps offering what it did. While the app holds the default's current value
  // (`open`, on the previewed result), it isn't opened: Tab would swap that value for the first in the list. Once any
  // param has words, it stays open until the next word, so this only applies right after the name.
  function withDefaultOffered(reading) {
    if (reading.open) {
      return reading;
    }
    const open = stepper.openDefault(reading);
    const spec = open && reading.command.params[open.param];
    return spec && hasSource(spec) && !holdsCurrent(spec) ? { ...reading, open } : reading;
  }

  // After a hint ("from"): the names of the params it introduces and, once a value is being typed, their
  // values ("from l" → last week, last month; "from cl" → claude).
  function hintSteps(reading, caretFrame, text, ctx, step) {
    const { word, params } = reading.pendingHint;
    const names = params
      .map((param) =>
        reading.command.params[param].aliases?.find((alias) => alias.startsWith(caretFrame.typed))
      )
      .filter(Boolean)
      .map((alias) => step(alias, 'param'));
    if (!caretFrame.typed) {
      return names;
    }
    const hinted = { ...reading, pendingHint: undefined };
    const valuesOf = params.flatMap((param) =>
      valueSteps({ ...hinted, open: { param, tokens: [], hint: word } }, caretFrame, text, ctx)
    );
    return [...names, ...valuesOf];
  }

  // The params a hint word waits for ("with" → Sort), each with the `incomplete` message that says so.
  function awaitedAfterHints(readings) {
    const awaited = readings
      .filter((reading) => reading.pendingHint)
      .map(({ command, pendingHint }) => {
        const labels = pendingHint.params.map((param) => command.params[param].label);
        return { message: hintMessage(pendingHint, labels), labels };
      });
    return dedupe(awaited, 'message');
  }

  const ruleBrokenBy = ({ command, open }) => {
    const spec = command.params[open.param];
    return isTypedParam(spec) ? readTypedText(spec, textOf(open)).rule : undefined;
  };

  function brokenRulesOf(readings, ctx) {
    const quiet = { ...ctx, die: () => [] };
    const rules = readings
      .filter(
        (reading) =>
          reading.open?.tokens.length &&
          isTypedParam(reading.command.params[reading.open.param]) &&
          !values.closeOpen(reading, quiet).length
      )
      .map(ruleBrokenBy)
      .filter(Boolean);
    return [...new Set(rules)];
  }

  // What each live reading is waiting for: a param after a hint, or the rest of a value.
  function describeIncomplete(readings, ctx) {
    const quiet = { ...ctx, die: () => [] };
    const waiting = readings.flatMap((reading) => {
      const { command, pendingHint, open } = reading;
      if (pendingHint) {
        const labels = pendingHint.params.map((param) => command.params[param].label);
        return [hintMessage(pendingHint, labels)];
      }
      if (open?.tokens.length && !values.closeOpen(reading, quiet).length) {
        const spec = command.params[open.param];
        const rule = ruleBrokenBy(reading);
        if (rule) {
          return [rule];
        }
        const kind = spec.argSource.type === 'range' ? 'a date' : 'a value';
        return [{ kind, label: spec.label }];
      }
      return [];
    });
    const hints = waiting.filter((item) => typeof item === 'string');
    const unfinished = waiting.filter((item) => typeof item !== 'string');
    const byKind = [...new Set(unfinished.map(({ kind }) => kind))].map((kind) => {
      const labels = [
        ...new Set(unfinished.filter((item) => item.kind === kind).map(({ label }) => label))
      ];
      const examples = kind === 'a date' ? ', such as last week, July or Jun-Sep 2025' : '';
      return `Keep typing ${kind} for ${joinOr(labels)}${examples}`;
    });
    return [...new Set([...hints, ...byKind])];
  }

  // Nothing to choose from: the values offered at the caret come from a source with none to offer (none loaded, or each
  // one already applied), and nothing is typed for the param. Says the param's `emptyText`, as its picker does. A
  // lookup still loading or failed says so in `pending` and `failed` instead.
  function emptyAtCaret(caretFrame, text, ctx) {
    if (caretFrame.typed) {
      return [];
    }
    const texts = caretFrame.readings.flatMap((reading) => {
      if (!reading.command || reading.pendingHint) {
        return [];
      }
      const offered = withDefaultOffered(reading);
      const spec = offered.open && reading.command.params[offered.open.param];
      if (!spec?.emptyText || !hasSource(spec) || offered.open.tokens.length) {
        return [];
      }
      const entries = values.entriesFor(offered, offered.open.param, ctx);
      const isEmpty = !isUnavailable(entries) && !valueSteps(offered, caretFrame, text, ctx).length;
      return isEmpty ? [spec.emptyText] : [];
    });
    return [...new Set(texts)];
  }

  function valueSteps(reading, { typedToken, after }, text, ctx) {
    const { open } = reading;
    const spec = open && reading.command.params[open.param];
    if (!spec || !hasSource(spec)) {
      return [];
    }
    const typedOpen = { ...open, tokens: typedToken ? [...open.tokens, typedToken] : open.tokens };
    const start = typedOpen.tokens[0]?.index ?? text.length - after.length;
    const matches = values.matchEntries(reading, typedOpen, ctx);
    if (isUnavailable(matches)) {
      return [];
    }
    const chosen = new Set((reading.filled[open.param] ?? []).map(({ value }) => value));
    // A value the app marks applied (a tag already in the filter) isn't offered again; typed in full, it still runs.
    return matches
      .filter(({ entry }) => !chosen.has(entry.value) && !entry.isApplied)
      .map(({ entry }) => ({
        label: entry.title ?? String(entry.value),
        // A text value is inserted as it is; one that isn't text (an object) by its title, which the matcher reads.
        insertText: joinParts(
          text.slice(0, start),
          typeof entry.value === 'string' ? entry.value : entry.title,
          after
        ),
        kind: 'value'
      }));
  }

  // `offeredParam`: a default param whose values are already offered, so its own label isn't.
  function introducerSteps(reading, typed, step, offeredParam) {
    if (reading.open && !reading.open.tokens.length && !typed) {
      return [];
    }
    const items = stepper
      .introducersHere(reading)
      .filter(
        (item) =>
          item.kind !== 'valueAlias' &&
          (item.kind === 'hint' ||
            (item.param !== offeredParam && stepper.canTake(reading, item.param)))
      );
    const firstPerParam = new Set();
    return items
      .filter((item) => item.phrase.startsWith(typed))
      .filter((item) => {
        const key = item.kind === 'hint' ? item.phrase : item.param;
        return !firstPerParam.has(key) && firstPerParam.add(key);
      })
      .map((item) => step(item.phrase, item.kind));
  }

  return { build };
}

// The app holds an arg for this param now (`current`, as "open" takes the previewed result): asked on each read, so
// while nothing is previewed "open" has none. `null` is none too.
const holdsCurrent = (param) => param.currentOf?.() != null;

// A command is complete by its name alone when nothing needs typing: it has no params ("next", "clear filters"), or
// the app holds an arg for each param now (the caller fills it when the command runs). "search" alone is not: it
// would run an empty search.
const isCompleteByName = (command) => Object.values(command.params).every(holdsCurrent);

// Each word's role in the top reading; with no reading, the word where the line broke, and why.
function annotate(tokens, topReading, problem) {
  const roles = new Map((topReading?.roles ?? []).map(({ token, role }) => [token, role]));
  return tokens.map((token, position) => {
    const isBroken = !topReading && problem?.index === position;
    return {
      text: token.text,
      start: token.index,
      end: token.end,
      role: isBroken ? 'broken' : (roles.get(position) ?? 'unread'),
      ...(isBroken ? { reason: problem.reason } : {})
    };
  });
}

// "search tools for react" → search "tools for react": the fix is built from the line as it is now.
const fixStep = ({ verbEnd, termStart }, text) => {
  const fix = `${text.slice(0, verbEnd)} "${text.slice(termStart).trim()}"`.trim();
  return { label: fix, insertText: fix, kind: 'fix' };
};

export const joinOr = (items) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} or ${items.at(-1)}` : (items[0] ?? '');

const hintMessage = (pendingHint, labels) => `After "${pendingHint.word}": ${joinOr(labels)}`;

const joinParts = (before, inserted, after) =>
  after ? `${before}${inserted} ${after.trimStart()}` : `${before}${inserted} `;

const furthest = (deaths) =>
  deaths.reduce((best, death) => (death.index > (best?.index ?? -1) ? death : best), undefined);

const dedupe = (items, key = 'insertText') => {
  const seen = new Set();
  return items.filter((item) => !seen.has(item[key]) && seen.add(item[key]));
};
