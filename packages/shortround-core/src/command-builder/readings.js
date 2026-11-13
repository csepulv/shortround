// One step of reading: given a reading (a candidate command, its args so far) and the next word,
// the readings that follow. Each step records the role of the words it consumed, for annotations.
//
// Ideas borrowed, with credit: params introduced by keyword hints (Mozilla Ubiquity Parser 2's semantic
// roles); named value sources and list params (Fig's generators, isVariadic).

import { isUnavailable } from './lookups.js';
import { beginsNullWord, isNumberParam, takesAnotherWord } from './typed-values.js';
import { displayOf, hasSource, textOf, unavailableFlag } from './values.js';

const SEPARATORS = [',', 'and'];

export const START = {
  command: undefined,
  filled: {},
  open: undefined,
  pendingHint: undefined,
  rank: 0,
  textWords: 0,
  fuzzyCount: 0,
  roles: []
};

// ctx: { die(reason, fix), lookup(name, context), countStep() } for the frame being stepped.
export function makeStepper({ commands, matcher, values }) {
  function step(reading, tokens, index, ctx) {
    ctx.countStep();
    const token = tokens[index];
    if (!reading.command) {
      return startCommand(tokens, index, ctx);
    }
    if (!token.isQuoted && SEPARATORS.includes(token.word) && isListOpen(reading)) {
      return values.closeOpen(reading, ctx).map((closed) => ({
        reading: withRoles(
          { ...closed, open: { param: reading.open.param, tokens: [] } },
          index,
          1,
          'separator'
        ),
        index: index + 1
      }));
    }
    if (reading.pendingHint) {
      return afterHint(reading, tokens, index, ctx);
    }
    // "sort recently created": "created" completes a sort value, so it doesn't introduce a param here.
    if (continuesValue(reading, token, ctx)) {
      return addValueWord(reading, token, index, ctx);
    }
    const introduced = token.isQuoted
      ? []
      : matcher.matchPhrase(tokens, index, introducersHere(reading));
    const viaIntroducer = introduced.flatMap((match) =>
      applyIntroducer(reading, match, index, ctx)
    );
    // A fuzzy introducer is a guess: keep the reading where the word is just value text too.
    if (introduced.length && introduced[0].via !== 'fuzzy') {
      return viaIntroducer;
    }
    return [...viaIntroducer, ...addValueWord(reading, token, index, ctx)];
  }

  // By name ("search", "find", "serach"), or implied: the first word introduces a param or is a value
  // alias ("with", "tagged", "starred"). Names and introducers go to the matcher together, so an exact
  // "kind" beats a fuzzy "find". Bare words never imply a command.
  function startCommand(tokens, index, ctx) {
    const implied = commands.flatMap((command) =>
      introducerItems({ command }).map((item) => ({ ...item, command, isImplied: true }))
    );
    const starts = matcher
      .matchPhrase(tokens, index, [...commandItems(), ...implied])
      .flatMap((match) => {
        const { item, wordCount, via } = match;
        if (item.isImplied) {
          const fresh = { ...START, command: item.command, verbEnd: 0 };
          return applyIntroducer(fresh, match, index, { ...ctx, die: () => [] });
        }
        const started = {
          ...START,
          command: item.command,
          verbEnd: tokens[index + wordCount - 1].end,
          fuzzyCount: Number(via === 'fuzzy')
        };
        return [
          { reading: withRoles(started, index, wordCount, 'verb'), index: index + wordCount }
        ];
      });
    return starts.length ? starts : ctx.die(`"${tokens[index].word}" doesn't start a command`);
  }

  function applyIntroducer(reading, { item, wordCount, via }, index, ctx) {
    const next = index + wordCount;
    const counted = { ...reading, fuzzyCount: reading.fuzzyCount + Number(via === 'fuzzy') };
    return values.closeOpen(counted, ctx).flatMap((closed) => {
      if (item.kind === 'hint') {
        const params = item.params.filter((param) => canTake(closed, param));
        if (!params.length) {
          return refill(closed, item.params[0], ctx);
        }
        const hinted = { ...closed, pendingHint: { word: item.phrase, params } };
        return [{ reading: withRoles(hinted, index, wordCount, 'hint'), index: next }];
      }
      if (!canTake(closed, item.param)) {
        return refill(closed, item.param, ctx);
      }
      if (item.kind === 'valueAlias') {
        const spec = closed.command.params[item.param];
        const value = values.valueOfEntry(spec, item.entry);
        return value
          ? [
              {
                reading: withRoles(
                  values.fill(closed, item.param, value),
                  index,
                  wordCount,
                  'value'
                ),
                index: next
              }
            ]
          : [];
      }
      const opened = { ...closed, open: { param: item.param, tokens: [] } };
      return [{ reading: withRoles(opened, index, wordCount, 'param'), index: next }];
    });
  }

  // After a hint ("with", "of", "about"): an alias of one of its params, or a value for one of them.
  // The hint stays with the value: for a range, "newer than" and "since" change its meaning.
  function afterHint(reading, tokens, index, ctx) {
    const { word, params } = reading.pendingHint;
    const cleared = { ...reading, pendingHint: undefined };
    const aliases = params.flatMap((param) => paramAliasItems(reading.command, param));
    const named = tokens[index].isQuoted ? [] : matcher.matchPhrase(tokens, index, aliases);
    if (named.length) {
      return named.map(({ item, wordCount, via }) => ({
        reading: withRoles(
          {
            ...cleared,
            open: { param: item.param, tokens: [] },
            fuzzyCount: cleared.fuzzyCount + Number(via === 'fuzzy')
          },
          index,
          wordCount,
          'param'
        ),
        index: index + wordCount
      }));
    }
    const quiet = { ...ctx, die: () => [] };
    const asValues = params.flatMap((param) =>
      addValueWord(
        { ...cleared, open: { param, tokens: [], hint: word } },
        tokens[index],
        index,
        quiet
      )
    );
    return asValues.length
      ? asValues
      : ctx.die(`"${tokens[index].word}" doesn't follow "${word}" in ${reading.command.label}`);
  }

  function addValueWord(reading, token, index, ctx) {
    const { command } = reading;
    const open = reading.open ?? openDefault(reading);
    if (!open || (open.tokens.length && !canAddWord(command.params[open.param], open, token))) {
      return ctx.die(`"${token.word}" isn't part of ${command.label}`);
    }
    const extended = { ...open, tokens: [...open.tokens, token] };
    const spec = command.params[extended.param];
    const role = hasSource(spec) || isNumberParam(spec) ? 'value' : 'text';
    if (!spec.argSource.freeform) {
      const matches = values.matchEntries(reading, extended, ctx);
      if (isUnavailable(matches)) {
        const waiting = { ...reading, open: extended, ...unavailableFlag(matches) };
        return [{ reading: withRoles(waiting, index, 1, role), index: index + 1 }];
      }
      if (!matches.length) {
        return ctx.die(`No ${spec.label} value matches "${textOf(extended)}"`);
      }
    }
    return [
      { reading: withRoles({ ...reading, open: extended }, index, 1, role), index: index + 1 }
    ];
  }

  const canAddWord = (spec, open, token) =>
    !token.isQuoted &&
    !open.tokens[0].isQuoted &&
    (token.index === open.tokens.at(-1).end || takesAnotherWord(spec, textOf(open)));

  const openDefault = ({ command, filled }) => {
    const [param] = Object.entries(command.params).find(([, spec]) => spec.default) ?? [];
    return param && filled[param] === undefined ? { param, tokens: [] } : undefined;
  };

  function continuesValue(reading, token, ctx) {
    const { open, command } = reading;
    if (!open?.tokens.length || token.isQuoted) {
      return false;
    }
    const spec = command.params[open.param];
    const extended = { ...open, tokens: [...open.tokens, token] };
    if (beginsNullWord(spec, textOf(extended))) {
      return true;
    }
    if (!hasSource(spec)) {
      return false;
    }
    const matches = values.matchEntries(reading, extended, ctx);
    return !isUnavailable(matches) && Boolean(matches[0]) && matches[0].rank <= 1;
  }

  // A freeform text arg, once it has words, runs until a reserved word, so only hints can end it
  // ("search notes machine illy" is one term). Right after the command name, param words start a param
  // ("search sort created") but value aliases don't: they start the term ("search latest news").
  function introducersHere(reading) {
    const items = introducerItems(reading);
    if (isRunningText(reading)) {
      return items.filter((item) => item.kind === 'hint');
    }
    return isRightAfterVerb(reading) ? items.filter((item) => item.kind !== 'valueAlias') : items;
  }

  // A quoted phrase is a whole term: its closing quote ended it, so whatever may follow a matched value may follow it
  // ("search "react grid" kind library").
  function isRunningText({ command, open }) {
    if (!open?.tokens.length || open.tokens[0].isQuoted) {
      return false;
    }
    const spec = command.params[open.param];
    return isFreeformText(spec) && !hasSource(spec);
  }

  const isRightAfterVerb = ({ open, filled, verbEnd }) =>
    verbEnd > 0 && !open && Object.keys(filled).length === 0;

  // What may introduce something: hints and aliases of every param, and value aliases of params other
  // than the open one (a value implies its param). Filled params stay in, so introducing one again fails
  // with a reason rather than reading the word as text.
  function introducerItems({ command, open }) {
    const params = Object.keys(command.params);
    const hints = new Map();
    for (const param of params) {
      for (const hint of command.params[param].hints ?? []) {
        hints.set(hint, [...(hints.get(hint) ?? []), param]);
      }
    }
    const valueAliases = params
      .filter((param) => param !== open?.param && command.params[param].argSource.list)
      .flatMap((param) =>
        command.params[param].argSource.list.flatMap((entry) =>
          (entry.aliases ?? []).map((phrase) => ({
            phrase,
            isAlias: true,
            kind: 'valueAlias',
            param,
            entry
          }))
        )
      );
    return [
      ...[...hints].map(([phrase, hintParams]) => ({
        phrase,
        isAlias: false,
        kind: 'hint',
        params: hintParams
      })),
      ...params.flatMap((param) => paramAliasItems(command, param)),
      ...valueAliases
    ];
  }

  const paramAliasItems = (command, param) =>
    paramNames(command.params[param]).map((phrase) => ({
      phrase,
      isAlias: false,
      kind: 'paramAlias',
      param
    }));

  // A command's name is typed only if it is a plain lowercase word ("next"); a name like "clearFilters" is the catalog's
  // identifier, typed by its label when that is plain words ("close preview") and by its aliases (CATALOG.md).
  const commandItems = () =>
    commands.flatMap((command) => commandPhrases(command).map((item) => ({ ...item, command })));

  function canTake({ command, filled, open }, param) {
    const isFilled = filled[param] !== undefined || open?.param === param;
    return command.params[param].list || !isFilled;
  }

  // The fix (quote the term) is built later, from the line as it is then.
  function refill(reading, param, ctx) {
    const spec = reading.command.params[param];
    const fix =
      reading.termStart !== undefined && !hasSource(spec)
        ? { verbEnd: reading.verbEnd, termStart: reading.termStart }
        : undefined;
    return ctx.die(`${spec.label} is already "${displayOf(spec, reading.filled[param])}"`, fix);
  }

  const isListOpen = ({ open, command }) => Boolean(open && command.params[open.param].list);

  // The longest phrase any command uses: how far back an edit can reach into readings.
  const maxPhraseWords = Math.max(
    1,
    ...commands
      .flatMap((command) => [
        ...commandItems().map(({ phrase }) => phrase),
        ...introducerItems({ command }).map(({ phrase }) => phrase)
      ])
      .map((phrase) => phrase.split(/\s+/).length)
  );

  return { step, introducersHere, commandItems, canTake, maxPhraseWords, openDefault };
}

// Whether a command's name is typed as it is (catalog checks ask too: findUntypedCommands).
export const isTypedName = (name) => /^[a-z]+$/.test(name);

export function typedLabelOf(label) {
  const phrase = String(label ?? '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .join(' ');
  return /^[a-z0-9]+( [a-z0-9]+)*$/.test(phrase) ? phrase : undefined;
}

function commandPhrases(command) {
  const label = typedLabelOf(command.label);
  return [
    ...(isTypedName(command.name) ? [{ phrase: command.name, isAlias: false }] : []),
    ...(command.aliases ?? []).map((phrase) => ({ phrase, isAlias: true })),
    ...(label ? [{ phrase: label, isAlias: true, isLabel: true }] : [])
  ];
}

const isFreeformText = (spec) =>
  Boolean(spec.argSource.freeform) && (spec.argSource.type ?? 'text') === 'text';

// The words that name a param: its label and its aliases.
const paramNames = (spec) => [...new Set([spec.label.toLowerCase(), ...(spec.aliases ?? [])])];

const withRoles = (reading, from, count, role) => ({
  ...reading,
  roles: [
    ...reading.roles,
    ...Array.from({ length: count }, (_, offset) => ({ token: from + offset, role }))
  ]
});
