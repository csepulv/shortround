// Words with their offsets. A quoted run is one word; a comma is a word of its own.
export const tokenize = (text) =>
  [...text.matchAll(/"([^"]*)"?|,|[^\s,"]+/g)].map((match) => ({
    word: (match[1] ?? match[0]).toLowerCase(),
    text: match[1] ?? match[0],
    index: match.index,
    end: match.index + match[0].length,
    isQuoted: match[1] !== undefined
  }));

// The words that are finished, and the one still being typed (unless a space, a comma or a closing
// quote ends the line).
export function splitFinished(text, tokens) {
  const last = tokens.at(-1);
  const isTyping =
    last &&
    !/\s$/.test(text) &&
    last.word !== ',' &&
    !(last.isQuoted && text.endsWith('"') && last.end - last.index > 1);
  return isTyping
    ? { finished: tokens.slice(0, -1), partial: last }
    : { finished: tokens, partial: undefined };
}

// A frame is kept only if its word is unchanged in every way, including where it sits: readings hold
// offsets (for completions and fixes), so a word that moved isn't the same word.
export const isSameToken = (first, second) =>
  first.word === second.word &&
  first.isQuoted === second.isQuoted &&
  first.index === second.index &&
  first.end === second.end;

// Where the caret is: inside a word (that word's position) or between words (the position after the
// words before it).
export function locateCaret(tokens, caret) {
  const inside = tokens.findIndex((token) => token.index < caret && caret <= token.end);
  if (inside !== -1) {
    return { position: inside, token: tokens[inside] };
  }
  return { position: tokens.filter((token) => token.end < caret).length, token: undefined };
}
