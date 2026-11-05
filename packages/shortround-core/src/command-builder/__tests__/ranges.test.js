import { expect, test } from 'vitest';

import { parseRange } from '../ranges.js';

const now = new Date('2026-11-01T12:00:00');

test.each([
  ['a year', 'newer than', { start: '2025-11-01' }],
  ['1 year', 'older than', { end: '2025-11-01' }],
  ['last week', 'from', { start: '2026-10-25', end: '2026-11-01' }],
  ['July', 'from', { start: '2026-07-01', end: '2026-07-31' }],
  ['Jun-Sep 2025', 'from', { start: '2025-06-01', end: '2025-09-30' }],
  ['July', 'since', { start: '2026-07-01' }],
  ['last 30 days', undefined, { start: '2026-10-02', end: '2026-11-01' }],
  // A weekday is the one day chrono-node resolves it to (from Sunday 1 November, "friday" is the 30th), not the
  // whole year.
  ['friday', undefined, { start: '2026-10-30', end: '2026-10-30' }],
  ['next friday', undefined, { start: '2026-11-06', end: '2026-11-06' }],
  ['monday', undefined, { start: '2026-11-02', end: '2026-11-02' }]
])('%s (%s)', (text, hint, expected) => {
  expect(parseRange(text, { now, hint })).toEqual(expected);
});

test('words that are not a date', () => {
  expect(parseRange('claude', { now, hint: 'from' })).toBeUndefined();
  expect(parseRange('fire alarm', { now })).toBeUndefined();
});
