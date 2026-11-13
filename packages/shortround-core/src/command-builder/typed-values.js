const NUMBER_TYPES = new Set(['integer', 'number']);
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

export const isNumberParam = (spec) => NUMBER_TYPES.has(spec.argSource.type);

const nullWordsOf = (spec) => (Array.isArray(spec.nullable) ? spec.nullable : []);

/** Whether a param's value is read and checked here: a number type, text with `maxLength`, or a nullable param. */
export const isTypedParam = (spec) =>
  isNumberParam(spec) || spec.argSource.maxLength !== undefined || Boolean(spec.nullable);

/** Whether typed text is one of the words the param's `nullable` names ("all"), in any case. */
export const isNullWord = (spec, text) =>
  nullWordsOf(spec).some((word) => word.toLowerCase() === text.trim().toLowerCase());

/** Whether typed text is one of the param's null words, or its first words ("no" of "no limit"). */
export function beginsNullWord(spec, text) {
  const typed = text.trim().toLowerCase();
  return nullWordsOf(spec).some((word) => {
    const nullWord = word.toLowerCase();
    return nullWord === typed || nullWord.startsWith(`${typed} `);
  });
}

/**
 * Whether a typed value can take another word after a space: a number is one word, unless the words so far begin one
 * of its null words. Text can always.
 */
export const takesAnotherWord = (spec, text) =>
  !isNumberParam(spec) || (beginsNullWord(spec, text) && !isNullWord(spec, text));

/** Typed text (the line, the palette's step) as the param's value, or the rule it breaks. */
export function readTypedText(spec, text) {
  const trimmed = text.trim();
  if (isNullWord(spec, trimmed)) {
    return { value: null };
  }
  if (isNumberParam(spec)) {
    return PLAIN_NUMBER.test(trimmed) ? checkNumber(spec, Number(trimmed)) : { rule: ruleOf(spec) };
  }
  return checkText(spec, text);
}

/** A model's value (not `null`) as the param's value, or the rule it breaks: a number, or a number written as text. */
export function readGivenValue(spec, given) {
  if (isNumberParam(spec)) {
    if (typeof given === 'number') {
      return checkNumber(spec, given);
    }
    return typeof given === 'string' && PLAIN_NUMBER.test(given.trim())
      ? checkNumber(spec, Number(given.trim()))
      : { rule: ruleOf(spec) };
  }
  return checkText(spec, given);
}

function checkNumber(spec, number) {
  const { minimum, maximum } = spec.argSource;
  const isWrongKind = spec.argSource.type === 'integer' && !Number.isInteger(number);
  const isOutside =
    (minimum !== undefined && number < minimum) || (maximum !== undefined && number > maximum);
  return isWrongKind || isOutside || !Number.isFinite(number)
    ? { rule: ruleOf(spec) }
    : { value: number };
}

function checkText(spec, text) {
  const { maxLength } = spec.argSource;
  return maxLength !== undefined && text.length > maxLength
    ? { rule: `${spec.label} has at most ${maxLength} characters` }
    : { value: text };
}

/** The rule a param's value follows, as the user and the model are told it: "Limit is a whole number from 1, or all". */
export function ruleOf(spec) {
  const words = nullWordsOf(spec);
  const orWord = words.length ? `, or ${words[0]}` : '';
  return `${spec.label} is ${kindOf(spec)}${orWord}`;
}

/** The param's description for a model: "Limit: a whole number from 1, or null for all". */
export function describeForModel(spec) {
  const words = nullWordsOf(spec);
  const orNull = spec.nullable ? `, or null${words.length ? ` for ${words[0]}` : ''}` : '';
  const each = spec.list ? 'each ' : '';
  if (isNumberParam(spec)) {
    return `${spec.label}: ${each}${kindOf(spec)}${orNull}`;
  }
  const { maxLength } = spec.argSource;
  const length = maxLength === undefined ? '' : `, at most ${maxLength} characters`;
  return `${spec.label}: ${each}free text${length}${orNull}`;
}

function kindOf(spec) {
  const { minimum, maximum } = spec.argSource;
  const kind = spec.argSource.type === 'integer' ? 'a whole number' : 'a number';
  if (minimum !== undefined && maximum !== undefined) {
    return `${kind} from ${minimum} to ${maximum}`;
  }
  if (minimum !== undefined) {
    return `${kind} from ${minimum}`;
  }
  return maximum !== undefined ? `${kind} up to ${maximum}` : kind;
}
