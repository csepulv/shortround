import { describe, expect, test } from 'vitest';

import { CORPUS, makeEngine, OPERATOR_LINES, visible } from './fixtures/engines.js';

// The main test: a long-lived engine, reading only what changed, gives the same answers as a fresh one
// after every keystroke, every backspace and every edit.
const LINES = [...CORPUS.map(({ text }) => text), ...OPERATOR_LINES.map(([text]) => text)];

const prefixesOf = (line) => [...line].map((_, index) => line.slice(0, index + 1));

// Mid-line edits on each word: delete it, replace it, insert a word before it.
function editsOf(line) {
  const words = line.split(' ');
  return words.flatMap((_, index) => [
    [...words.slice(0, index), ...words.slice(index + 1)].join(' '),
    [...words.slice(0, index), 'xyz', ...words.slice(index + 1)].join(' '),
    [...words.slice(0, index), 'grid', ...words.slice(index)].join(' ')
  ]);
}

function mismatches(engine, texts) {
  return texts
    .map((text) => ({
      text,
      kept: visible(engine.read(text)),
      fresh: visible(makeEngine().read(text))
    }))
    .filter(({ kept, fresh }) => JSON.stringify(kept) !== JSON.stringify(fresh));
}

describe('incremental equals fresh', () => {
  test.each(LINES)('typing, then backspacing: %s', (line) => {
    const engine = makeEngine();
    const typing = prefixesOf(line);
    const backspacing = [...typing].reverse();
    expect(mismatches(engine, [...typing, ...backspacing]).map(({ text }) => text)).toEqual([]);
  });

  test.each(LINES)('mid-line edits: %s', (line) => {
    const engine = makeEngine();
    const texts = editsOf(line).flatMap((edited) => [line, edited]);
    expect(mismatches(engine, texts).map(({ text }) => text)).toEqual([]);
  });
});
