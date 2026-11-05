// Date ranges for `range` args. chrono-node (MIT) parses single expressions ("July", "last week", "a year ago"); this
// wrapper adds comparisons ("newer than a year"), spans (a month means the whole month; "last week" runs to now) and
// month ranges ("Jun-Sep 2025"). The hint that opened the arg carries meaning: `since` keeps only the start.

import * as chrono from 'chrono-node';

const COMPARISONS = { 'newer than': 'start', 'older than': 'end' };
const RANGE_SEPARATOR = /\s*(?:-|–|\bto\b|\bthrough\b)\s*/i;

// → { start?, end? } as YYYY-MM-DD, or undefined when the text isn't a date.
export function parseRange(text, { now, hint } = {}) {
  const phrase = text.trim();
  if (COMPARISONS[hint]) {
    return comparison(phrase, now, COMPARISONS[hint]);
  }
  const span = spanOf(phrase, now);
  if (!span) {
    return undefined;
  }
  return hint === 'since' ? { start: span.start } : span;
}

function comparison(phrase, now, side) {
  const point = parseWhole(`${phrase} ago`, now);
  return point ? { [side]: day(point.start.date()) } : undefined;
}

function spanOf(phrase, now) {
  const [left, right] = phrase.split(RANGE_SEPARATOR);
  if (right !== undefined) {
    return between(left, right, now);
  }
  const result = parseWhole(phrase, now);
  if (!result) {
    return undefined;
  }
  if (/^(last|past)\b/i.test(phrase)) {
    return { start: day(result.start.date()), end: day(now) };
  }
  return { start: day(startOf(result.start)), end: day(endOf(result.start)) };
}

// "Jun-Sep 2025": the left side takes its year from the right when it names none. chrono-node doesn't
// parse a bare "Jun" (it does "June" and "Jun 2025"), so the year is added before giving up.
function between(left, right, now) {
  const last = parseWhole(right, now);
  if (!last) {
    return undefined;
  }
  const first = parseWhole(left, now);
  const firstWithYear = first?.start.isCertain('year')
    ? first
    : parseWhole(`${left} ${last.start.get('year')}`, now);
  return firstWithYear
    ? { start: day(startOf(firstWithYear.start)), end: day(endOf(last.start)) }
    : undefined;
}

// The whole phrase must be one date expression: "claude" or "fire alarm" isn't a date.
function parseWhole(phrase, now) {
  const [result] = chrono.parse(phrase, now);
  return result && result.index === 0 && result.text.length === phrase.length ? result : undefined;
}

// A named day ("nov 6") or a weekday ("friday", which chrono-node certifies as a weekday and resolves to a date) is
// one day; a month alone is the month; otherwise the year.
const isOneDay = (components) => components.isCertain('day') || components.isCertain('weekday');

function startOf(components) {
  const year = components.get('year');
  if (isOneDay(components)) {
    return components.date();
  }
  return components.isCertain('month')
    ? new Date(year, components.get('month') - 1, 1)
    : new Date(year, 0, 1);
}

function endOf(components) {
  const year = components.get('year');
  if (isOneDay(components)) {
    return components.date();
  }
  return components.isCertain('month')
    ? new Date(year, components.get('month'), 0)
    : new Date(year, 11, 31);
}

const day = (date) =>
  [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => String(part).padStart(index ? 2 : 4, '0'))
    .join('-');
