const canChoose = (row) => !row.disabled;

/** The row Enter acts on before the arrows move: the first that can be chosen, or -1. */
export const firstEnabledIndex = (rows) => rows.findIndex(canChoose);

/** The next row that can be chosen in the arrow's direction (step 1 or -1); the highlight stops at the ends. */
export function moveHighlight(rows, index, step) {
  for (let next = index + step; next >= 0 && next < rows.length; next += step) {
    if (canChoose(rows[next])) {
      return next;
    }
  }
  return index;
}
