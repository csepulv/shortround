// The parse stack: one frame per finished word. Frame p holds the readings that have read exactly the
// first p words ("landing" there), the lookups asked while stepping from it, and an id that changes
// whenever the frame is rebuilt. As in an Earley chart (nearley keeps one column per token and cuts the
// table back with restore()), a phrase of several words makes a reading land frames ahead.
//
// sync() keeps the frames whose words are unchanged and reads forward from there: typing at the end of
// the line costs one word.

let nextFrameId = 0;

export function makeStack({ step, maxPhraseWords, start }) {
  let words = [];
  // Each entry remembers the frame whose step produced it (`origin`), so a rebuild can redo that step.
  let landing = [[{ reading: start, origin: -1 }]];
  let caches = [new Map()];
  let ids = [(nextFrameId += 1)];
  let deathsAt = [];

  function sync(finished, makeCtx, isSameToken) {
    const limit = Math.min(words.length, finished.length);
    let keep = 0;
    while (keep < limit && isSameToken(words[keep], finished[keep])) {
      keep += 1;
    }
    if (keep === words.length && keep === finished.length) {
      return;
    }
    rebuild(finished, keep, makeCtx);
  }

  // Frames after `keep` are cut and read again. A step looks ahead for phrases of up to
  // `maxPhraseWords` words, and what it finds there changes everything it produces: an exact "sorted
  // by" suppresses the readings "sorted" alone would give. So every step whose look-ahead reaches the
  // first changed word (from `keep − maxPhraseWords + 1` on) is redone in full: its earlier results are
  // removed, wherever they landed.
  function rebuild(finished, keep, makeCtx) {
    words = finished;
    const from = Math.max(0, keep - maxPhraseWords + 1);
    landing = landing
      .slice(0, keep + 1)
      .map((entries, position) =>
        position > from ? entries.filter(({ origin }) => origin < from) : entries
      );
    caches = caches.slice(0, keep + 1);
    ids = ids.slice(0, keep + 1);
    for (let position = keep + 1; position <= finished.length; position += 1) {
      landing[position] = [];
      caches[position] = new Map();
      ids[position] = nextFrameId += 1;
    }
    deathsAt = deathsAt.slice(0, from);
    for (let position = from; position < finished.length; position += 1) {
      deathsAt[position] = [];
      const ctx = makeCtx(position, deathsAt[position]);
      for (const { reading } of landing[position]) {
        for (const next of step(reading, finished, position, ctx)) {
          landing[next.index].push({ reading: next.reading, origin: position });
        }
      }
    }
  }

  // After a lookup resolves for frame `position`: everything read from it onward is read again.
  const rebuildFrom = (position, makeCtx) => rebuild(words, position, makeCtx);

  function invalidate(makeCtx) {
    caches = caches.map(() => new Map());
    ids = ids.map(() => (nextFrameId += 1));
    rebuild(words, 0, makeCtx);
  }

  function findCached(position, key) {
    for (let frame = Math.min(position, caches.length - 1); frame >= 0; frame -= 1) {
      const cached = caches[frame].get(key);
      if (cached) {
        return cached;
      }
    }
    return undefined;
  }

  return {
    sync,
    rebuildFrom,
    invalidate,
    findCached,
    readingsAt: (position) => (landing[position] ?? []).map(({ reading }) => reading),
    cacheAt: (position) => caches[position],
    idAt: (position) => ids[position],
    deaths: () => deathsAt.flat()
  };
}
