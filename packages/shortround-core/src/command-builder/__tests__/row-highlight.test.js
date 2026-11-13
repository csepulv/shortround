import { expect, test } from 'vitest';

import { firstEnabledIndex, moveHighlight } from '../row-highlight.js';

const ROWS = [
  { id: 'problem', disabled: true },
  { id: 'a' },
  { id: 'status', disabled: true },
  { id: 'b' }
];

test('the first row that can be chosen starts highlighted', () => {
  expect(firstEnabledIndex(ROWS)).toBe(1);
});

test('no row is highlighted when none can be chosen', () => {
  expect(firstEnabledIndex([{ id: 'problem', disabled: true }])).toBe(-1);
});

test('the arrows skip rows that cannot be chosen', () => {
  expect(moveHighlight(ROWS, 1, 1)).toBe(3);
  expect(moveHighlight(ROWS, 3, -1)).toBe(1);
});

test('the highlight stops at the ends', () => {
  expect(moveHighlight(ROWS, 3, 1)).toBe(3);
  expect(moveHighlight(ROWS, 1, -1)).toBe(1);
});
