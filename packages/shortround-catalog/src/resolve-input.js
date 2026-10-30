// Turns one typed line into rows for the current state. The command words (a command's title or one
// of its aliases, as whole words, in any case) pick the command; the words after them pick its value.
//
//   "tag rea"          → "Tag: react"            (each value word starts a word of the row)
//   "sort "            → every sort option        (command words and a space)
//   "search react grid" → "Search: react grid"    (a text command takes the rest as its text)
//
// A line may hold several commands: each starts where another command's words begin, and quotes end a
// value anywhere. The line resolves to one row that reads every command back and runs them in order:
//
//   search "react grid" kind library sort created   → "Search: react grid · Kind: library · Sort: Created (newest)"
//
// Rows that match are ranked: the exact title or alias first, then whole-word matches, then prefixes,
// keeping the source's order within each. The first row is the one Enter runs.
export function makeInputResolver({ catalog, stateName, listEntries, runEntry, runLine }) {
  // The first way of splitting the line that reads is the one used. A piece that can't read ends
  // every split that would follow it, so a long line that never reads stays cheap.
  function resolveInput(text) {
    const tokens = findTokens(text);
    const isAwaitingValue = /\s$/.test(text) || isOpeningQuote(tokens.at(-1));
    const readOnce = makePieceReader(text, isAwaitingValue);
    const canClose = (piece) => readOnce(piece, false).length > 0;
    for (const pieces of splitIntoPieces(listEntries(), tokens, canClose)) {
      const rows =
        pieces.length === 1
          ? rowsForCommand(pieces[0], text, isAwaitingValue)
          : rowsForLine(pieces, readOnce);
      if (rows.length) {
        return rows;
      }
    }
    return [];
  }

  // Each piece is read once per keystroke, however many splits share it.
  function makePieceReader(text, isAwaitingValue) {
    const readings = new Map();
    return (piece, isLast) => {
      const key = `${piece.start}:${piece.valueTokens.length}:${isLast}`;
      if (!readings.has(key)) {
        const valueText = valueOf(piece, text);
        readings.set(
          key,
          readPiece(piece, valueText, {
            isAwaitingValue: isLast && isAwaitingValue,
            includesApplied: !isLast || Boolean(valueText)
          })
        );
      }
      return readings.get(key);
    };
  }

  // One command: every candidate's rows, as in M2. A command without a step is already a row of
  // the list, so it adds nothing here.
  const rowsForCommand = (piece, text, isAwaitingValue) =>
    piece.candidates
      .filter((entry) => entry.command.ask)
      .flatMap((entry) =>
        partsFor(entry, valueOf(piece, text), { isAwaitingValue, includesApplied: false })
      )
      .map(toResolvedRow);

  // Several commands: each must read; earlier ones take their best match, the last lists its own.
  // A typed value may name one already applied: the line says so instead of failing. The last
  // command, still without a value, lists only values not yet applied.
  function rowsForLine(pieces, readOnce) {
    const readings = pieces.map((piece, index) => readOnce(piece, index === pieces.length - 1));
    if (readings.some((parts) => !parts.length)) {
      return [];
    }
    const earlier = readings.slice(0, -1).map(([best]) => best);
    return readings.at(-1).map((last) => toLineRow([...earlier, last]));
  }

  // Only commands that stay in this state can share a line; a value decides between commands that
  // share their words ("type library": Kind has a library, Type doesn't).
  function readPiece(piece, valueText, options) {
    return piece.candidates
      .filter(staysInState)
      .flatMap((entry) => partsFor(entry, valueText, options))
      .sort((first, second) => first.rank - second.rank);
  }

  const staysInState = (entry) => (entry.command.then ?? stateName) === stateName;

  function partsFor(entry, valueText, { isAwaitingValue, includesApplied }) {
    const { ask } = entry.command;
    if (ask?.choose) {
      return valueText || isAwaitingValue ? pickerParts(entry, valueText, includesApplied) : [];
    }
    if (ask?.text) {
      return valueText ? [toPart(entry, { id: 'text', title: valueText, value: valueText })] : [];
    }
    return valueText ? [] : [{ entry, id: entry.id, title: entry.title, rank: EXACT }];
  }

  function pickerParts(entry, valueText, includesApplied) {
    const rows = catalog.pickers[entry.command.ask.choose].from({
      key: entry.key,
      facets: catalog.facets
    });
    if (typeof rows?.then === 'function') {
      // Async sources resolve nothing while typing (async semantics are on hold); the two-step
      // picker still uses them. The dropped promise must not become an unhandled rejection.
      Promise.resolve(rows).catch(() => {});
      return [];
    }
    const valueWords = splitWords(valueText);
    return rows
      .filter((row) => includesApplied || !row.isApplied)
      .map((row) => ({ row, rank: rankMatch(row, valueText, valueWords) }))
      .filter(({ rank }) => rank !== undefined)
      .sort((first, second) => first.rank - second.rank)
      .map(({ row, rank }) =>
        toPart(entry, {
          id: row.key ?? row.value,
          title: row.title,
          subtitle: row.subtitle,
          value: row.value,
          rank,
          isApplied: Boolean(row.isApplied)
        })
      );
  }

  const toPart = (entry, { id, title, subtitle, value, rank = EXACT, isApplied = false }) => ({
    entry,
    id: `${entry.id}::${id}`,
    title: `${entry.title}: ${title}`,
    subtitle,
    value,
    rank,
    isApplied
  });

  const toResolvedRow = ({ entry, id, title, subtitle, value }) => ({
    id,
    title,
    subtitle,
    group: entry.command.group,
    icon: entry.command.icon,
    action: () => runEntry(entry, value)
  });

  // Applied parts are read back and marked. They still run: an earlier part may undo what is
  // applied ("clear filters kind library"), and a command changes nothing for a value in effect.
  const toLineRow = (parts) => ({
    id: parts.map(({ id }) => id).join(' + '),
    title: parts
      .map(({ title, isApplied }) => (isApplied ? `${title} (already set)` : title))
      .join(' · '),
    group: parts[0].entry.command.group,
    icon: parts[0].entry.command.icon,
    action: () => runLine(parts.map(({ entry, value }) => ({ entry, value })))
  });

  return resolveInput;
}

const EXACT = 0;
const WHOLE_WORDS = 1;
const PREFIXES = 2;

// How well the typed value matches a row; undefined when it doesn't. An empty value matches every row.
function rankMatch(row, valueText, valueWords) {
  const names = [row.title, ...(row.aliases ?? [])].map((name) => String(name).toLowerCase());
  const rowWords = names.flatMap(splitWords);
  if (names.includes(valueText.toLowerCase())) {
    return EXACT;
  }
  if (valueWords.every((word) => rowWords.includes(word))) {
    return WHOLE_WORDS;
  }
  if (valueWords.every((word) => rowWords.some((rowWord) => rowWord.startsWith(word)))) {
    return PREFIXES;
  }
  return undefined;
}

// The line's words, with where each starts and ends. A quoted run is one word (its quotes removed,
// an unclosed quote running to the end), so the words inside it never start a command.
const findTokens = (text) =>
  [...text.matchAll(/"([^"]*)"?|\S+/g)].map((match) => ({
    word: match[1] ?? match[0],
    index: match.index,
    end: match.index + match[0].length,
    isQuoted: match[1] !== undefined,
    isUnclosed: match[1] !== undefined && (match[0].length === 1 || !match[0].endsWith('"'))
  }));

// A quote just opened, nothing typed after it yet: like a trailing space, the values are listed.
const isOpeningQuote = (token) => Boolean(token?.isUnclosed && !token.word);

// Every way to split the line into pieces, each { candidates, valueTokens }, most pieces first: where
// a command's words begin, a new piece starts; failing that, the words stay in the value before them
// ("drop tag react": Drop filter's value is "tag react"). A text command's unquoted value takes the
// rest of the line. Nothing when the line doesn't start with a command. A piece is closed (another
// starts after it) only if `canClose` says it reads.
function* splitIntoPieces(entries, tokens, canClose, index = 0, pieces = []) {
  if (index >= tokens.length) {
    if (pieces.length) {
      yield pieces;
    }
    return;
  }
  const current = pieces.at(-1);
  const starting = findCommands(entries, unquotedWordsFrom(tokens, index));
  if (starting.length && (!current || canClose(current))) {
    const piece = { start: index, candidates: starting.map(({ entry }) => entry), valueTokens: [] };
    yield* splitIntoPieces(entries, tokens, canClose, index + starting[0].wordCount, [
      ...pieces,
      piece
    ]);
  }
  if (!current) {
    return;
  }
  const earlier = pieces.slice(0, -1);
  if (!canTakeValueWord(current, tokens[index])) {
    return;
  }
  if (takesRestOfLine(current, tokens[index])) {
    yield [...earlier, withValue(current, tokens.slice(index))];
    return;
  }
  yield* splitIntoPieces(entries, tokens, canClose, index + 1, [
    ...earlier,
    withValue(current, [tokens[index]])
  ]);
}

const withValue = (piece, tokens) => ({ ...piece, valueTokens: [...piece.valueTokens, ...tokens] });

// A quoted value is the whole value: nothing joins it, before or after.
const canTakeValueWord = (piece, token) =>
  !piece.valueTokens.some(({ isQuoted }) => isQuoted) &&
  !(token.isQuoted && piece.valueTokens.length);

const takesRestOfLine = (piece, token) =>
  !piece.valueTokens.length &&
  !token.isQuoted &&
  piece.candidates.every((entry) => entry.command.ask?.text);

// The lower-case words from `index` up to the next quoted word: where command words may be.
function unquotedWordsFrom(tokens, index) {
  const nextQuoted = tokens.findIndex((token, at) => at >= index && token.isQuoted);
  return tokens
    .slice(index, nextQuoted === -1 ? undefined : nextQuoted)
    .map(({ word }) => word.toLowerCase());
}

// A piece's value as typed: a quoted word without its quotes; otherwise the text from its first word
// to its last, spacing kept.
function valueOf(piece, text) {
  const [first] = piece.valueTokens;
  if (!first) {
    return '';
  }
  if (first.isQuoted) {
    return first.word.trim();
  }
  return text.slice(first.index, piece.valueTokens.at(-1).end).trim();
}

// The commands whose title or an alias starts these words; when several do, the longest wins
// ("open in service" over "open").
function findCommands(entries, words) {
  const matches = entries
    .map((entry) => ({ entry, wordCount: countCommandWords(entry, words) }))
    .filter(({ wordCount }) => wordCount > 0);
  const longest = Math.max(0, ...matches.map(({ wordCount }) => wordCount));
  return matches.filter(({ wordCount }) => wordCount === longest);
}

function countCommandWords(entry, words) {
  const phrases = [entry.title, ...entry.aliases].map((phrase) =>
    phrase.toLowerCase().split(/\s+/).filter(Boolean)
  );
  const matching = phrases.filter(
    (phrase) =>
      phrase.length <= words.length && phrase.every((word, index) => words[index] === word)
  );
  return Math.max(0, ...matching.map((phrase) => phrase.length));
}

// "Created (newest)" → created, newest; "react-native" → react, native. Typed values and row titles
// are split the same way, so "react-native" typed matches "react-native" listed.
const splitWords = (text) =>
  String(text)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
