// The command-builder engine. It keeps a parse stack of candidate commands, reads only what changed, and returns its
// own state:
//
//   read(text, caret) → { readings, nextSteps, annotations, problem, incomplete, pending, failed, partial, work }
//     pending, failed: [{ param, label }] for params whose args are still loading, or failed to load
//   subscribe(listener) → unsubscribe     (told when a pending lookup lands on a live frame)
//   invalidate()                          (drops cached lookups: the escape hatch for changed app data)

import { makeLookupAccess } from './lookups.js';
import { makeMatcher } from './matcher.js';
import { makeStepper, START } from './readings.js';
import { makeStack } from './stack.js';
import { makeState } from './state.js';
import { isSameToken, locateCaret, splitFinished, tokenize } from './tokens.js';
import { makeValues } from './values.js';

export function makeCommandBuilder({
  commands,
  lookups,
  matcher = makeMatcher(),
  now = () => new Date()
}) {
  const values = makeValues({ matcher, now });
  const stepper = makeStepper({ commands, matcher, values });
  const stack = makeStack({
    step: stepper.step,
    maxPhraseWords: stepper.maxPhraseWords,
    start: START
  });
  const state = makeState({ stepper, values });
  const listeners = new Set();
  const work = { steps: 0, lookups: 0 };

  const access = makeLookupAccess({
    lookups,
    stack,
    work,
    onResolve: (position) => {
      stack.rebuildFrom(position, makeCtx);
      listeners.forEach((listener) => listener());
    }
  });

  const makeCtx = (position, deaths) => ({
    die: (reason, fix) => {
      deaths.push({ index: position, reason, fix });
      return [];
    },
    lookup: access.at(position),
    countStep: () => {
      work.steps += 1;
    }
  });

  function read(text, caret = text.length) {
    work.steps = 0;
    work.lookups = 0;
    const tokens = tokenize(text);
    const { finished, partial } = splitFinished(text, tokens);
    stack.sync(finished, makeCtx, isSameToken);

    const top = finished.length;
    const live = stack.readingsAt(top);
    const partialDeaths = [];
    const readings = partial ? readTypedWord(tokens, top, partialDeaths) : live;
    const caretFrame = frameAtCaret({ text, caret, tokens, partial, live });

    return {
      ...state.build({
        text,
        tokens,
        partial,
        live,
        readings,
        deaths: [...stack.deaths(), ...partialDeaths],
        caretFrame,
        ctx: makeCtx(top, [])
      }),
      work: { ...work }
    };
  }

  // The word being typed is read each time, never pushed: from the top frame, and from the earlier frames a phrase
  // ending in it could start at ("clear filters" with no space yet). Those earlier steps only look ahead, so what they
  // reject isn't reported; the frames themselves already said it.
  function readTypedWord(tokens, top, deaths) {
    const fromTop = readWord(stack.readingsAt(top), tokens, top, makeCtx(top, deaths));
    const fromEarlier = phraseStarts(top).flatMap((position) =>
      stack
        .readingsAt(position)
        .flatMap((reading) => stepper.step(reading, tokens, position, makeCtx(position, [])))
        .filter((next) => next.index === tokens.length)
        .map((next) => next.reading)
    );
    return [...fromTop, ...fromEarlier];
  }

  const readWord = (readings, tokens, position, ctx) =>
    readings.flatMap((reading) =>
      stepper.step(reading, tokens, position, ctx).map((next) => next.reading)
    );

  // The frames before the top that a phrase of up to maxPhraseWords words, ending in the typed word, starts at.
  const phraseStarts = (top) =>
    Array.from(
      { length: Math.min(top, stepper.maxPhraseWords - 1) },
      (_, offset) => top - 1 - offset
    );

  // Next steps follow the caret: the readings before the caret's word, and the part of it typed so far.
  function frameAtCaret({ text, caret, tokens, partial, live }) {
    if (caret >= text.length) {
      return {
        readings: live,
        typed: partial?.word ?? '',
        typedToken: partial,
        before: text.slice(0, partial ? partial.index : text.length),
        after: ''
      };
    }
    const { position, token } = locateCaret(tokens, caret);
    const typedText = token ? text.slice(token.index, caret) : '';
    return {
      readings: stack.readingsAt(position),
      typed: typedText.toLowerCase(),
      typedToken: token && { ...token, text: typedText, word: typedText.toLowerCase(), end: caret },
      before: text.slice(0, token ? token.index : caret),
      after: text.slice(token ? token.end : caret)
    };
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  const invalidate = () => stack.invalidate(makeCtx);

  return { read, subscribe, invalidate };
}
