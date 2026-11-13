// The candidate matcher: given words and what may come next, which expected items do they name?
// Exact and alias phrases compete on length together, so a longer phrase is not hidden by a shorter exact one ("open
// in service" over the command name "open"); Damerau-Levenshtein only.
//
// Phrases: exact and alias first (the longest phrase wins; an exact one wins a tie, and an alias beats a label), then
// fuzzy. Values: exact,
// alias, prefix, then fuzzy; a later layer runs only when earlier ones found nothing. Every match records the
// layer that found it (`via`).

import damerau from 'damerau-levenshtein';

export const LAYERS = ['exact', 'alias', 'prefix', 'fuzzy'];

const distance = (first, second) => damerau(first, second).steps;

// Short words get no fuzzy match as introducers ("ai" would be one edit from "as"); values from 3
// letters ("wbe" → web).
const MIN_FUZZY_INTRODUCER = 4;
const MIN_FUZZY_VALUE = 3;
const allowedDistance = (word) => (word.length <= 5 ? 1 : 2);

export function makeMatcher({ layers = LAYERS } = {}) {
  const uses = (layer) => layers.includes(layer);

  // Items are { phrase, isAlias, isLabel?, ...payload }. Returns [{ item, wordCount, via }]: the longest exact or
  // alias phrases ("sort by" over "sort", "open in service" over "open"); on a tie, exact ones, then aliases, then
  // labels (a label read as a phrase never takes one from another command's alias); else fuzzy.
  function matchPhrase(tokens, index, items) {
    const whole = items
      .map((item) => ({
        item,
        wordCount: countPhraseWords(item.phrase, tokens, index),
        via: item.isAlias ? 'alias' : 'exact'
      }))
      .filter(({ wordCount, via }) => wordCount > 0 && uses(via));
    const found = longest(whole);
    if (found.length) {
      return firstNonEmpty([
        found.filter(({ via }) => via === 'exact'),
        found.filter(({ item }) => !item.isLabel),
        found
      ]);
    }
    return uses('fuzzy') ? fuzzyPhrase(tokens[index], items) : [];
  }

  // One-word phrases only; the nearest phrase must be unique (a tie is ambiguous: left for a model).
  function fuzzyPhrase(token, items) {
    if (!token || token.isQuoted || token.word.length < MIN_FUZZY_INTRODUCER) {
      return [];
    }
    const singles = items.filter((item) => !item.phrase.includes(' '));
    const nearest = nearestBy(singles, (item) => [item.phrase], token.word);
    return nearest.map((item) => ({ item, wordCount: 1, via: 'fuzzy' }));
  }

  // Entries are { value, title, aliases? }. Returns [{ entry, via, rank }] from the first layer that
  // finds anything.
  function matchValue(text, entries) {
    const typed = text.toLowerCase().trim();
    if (!typed) {
      return entries.map((entry) => ({ entry, via: 'prefix', rank: 0 }));
    }
    const names = (entry) => [entry.value, entry.title].map((name) => String(name).toLowerCase());
    const aliases = (entry) => (entry.aliases ?? []).map((alias) => alias.toLowerCase());
    // A plural names its value too: "chats" → chat, "libraries" → library.
    const forms = [typed, singular(typed)];
    const tiers = [
      ['exact', (entry) => forms.some((form) => names(entry).includes(form))],
      ['alias', (entry) => forms.some((form) => aliases(entry).includes(form))],
      ['prefix', (entry) => matchesWords(entry, typed)]
    ];
    for (const [via, isMatch] of tiers) {
      const found = uses(via) ? entries.filter(isMatch) : [];
      if (found.length) {
        return found.map((entry) => ({ entry, via, rank: LAYERS.indexOf(via) }));
      }
    }
    if (!uses('fuzzy') || typed.length < MIN_FUZZY_VALUE) {
      return [];
    }
    return nearestBy(entries, (entry) => [...names(entry), ...aliases(entry)], typed).map(
      (entry) => ({ entry, via: 'fuzzy', rank: LAYERS.indexOf('fuzzy') })
    );
  }

  function nearestBy(candidates, namesOf, word) {
    const scored = candidates.map((candidate) => ({
      candidate,
      steps: Math.min(...namesOf(candidate).map((name) => distance(word, name)))
    }));
    const best = Math.min(Infinity, ...scored.map(({ steps }) => steps));
    if (best > allowedDistance(word)) {
      return [];
    }
    const nearest = scored.filter(({ steps }) => steps === best).map(({ candidate }) => candidate);
    const distinctNames = new Set(nearest.map((candidate) => namesOf(candidate)[0]));
    return distinctNames.size === 1 ? nearest : [];
  }

  return { matchPhrase, matchValue };
}

function singular(word) {
  if (word.endsWith('ies') && word.length > 4) {
    return `${word.slice(0, -3)}y`;
  }
  return word.endsWith('s') && word.length > 3 ? word.slice(0, -1) : word;
}

function countPhraseWords(phrase, tokens, index) {
  const words = phrase.split(/\s+/);
  const isMatch = words.every((word, offset) => {
    const token = tokens[index + offset];
    return token && !token.isQuoted && token.word === word;
  });
  return isMatch ? words.length : 0;
}

const firstNonEmpty = (lists) => lists.find((list) => list.length) ?? [];

const longest = (matches) => {
  const most = Math.max(0, ...matches.map(({ wordCount }) => wordCount));
  return matches.filter(({ wordCount }) => wordCount === most);
};

// Every typed word is a whole word, or the start of a word, of the entry's names.
function matchesWords(entry, typed) {
  const entryWords = [entry.value, entry.title, ...(entry.aliases ?? [])].flatMap(splitWords);
  return splitWords(typed).every((word) =>
    entryWords.some((entryWord) => entryWord.startsWith(word))
  );
}

export const splitWords = (text) =>
  String(text)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
