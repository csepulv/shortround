// Whether a call matches one of a corpus entry's accepted calls, and which slots were wrong.

const LIST_SLOTS = ['tags', 'format', 'kind'];
const SLOTS = ['term', ...LIST_SLOTS, 'sort'];

function normalize(call) {
  return Object.fromEntries(
    SLOTS.filter((slot) => call[slot] !== undefined && call[slot].length !== 0).map((slot) => {
      const value = call[slot];
      if (LIST_SLOTS.includes(slot)) {
        return [slot, [...value].map((item) => item.toLowerCase()).sort()];
      }
      return [slot, value.toLowerCase().trim()];
    })
  );
}

const sameSlot = (first, second) => JSON.stringify(first) === JSON.stringify(second);

export const matchesAny = (call, accepted) =>
  accepted.some((expected) => sameSlot(normalize(call), normalize(expected)));

// Slots wrong against the closest accepted call (the one with fewest wrong slots).
export function wrongSlots(call, accepted) {
  const actual = normalize(call);
  const misses = accepted.map((expected) => {
    const wanted = normalize(expected);
    return SLOTS.filter((slot) => !sameSlot(actual[slot], wanted[slot]));
  });
  return misses.reduce((fewest, slots) => (slots.length < fewest.length ? slots : fewest));
}
