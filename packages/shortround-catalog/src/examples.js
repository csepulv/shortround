import { parse } from 'yaml';
import { z } from 'zod';

// An examples file is the catalog's grammar tests: each typed line (`say`) must resolve, first, to
// the row whose id is `means`, or for a line of several commands, to the row made of the ids `means`
// lists, in order. Checked against the start state.
const examplesSchema = z.strictObject({
  examples: z.array(
    z.strictObject({ say: z.string(), means: z.union([z.string(), z.array(z.string()).min(2)]) })
  )
});

// A line row's id joins its commands' row ids (see resolve-input.js).
const toRowId = (means) => [means].flat().join(' + ');

export function loadExamples(text) {
  const result = examplesSchema.safeParse(parse(text));
  if (!result.success) {
    throw new Error(`Examples are malformed:\n${z.prettifyError(result.error)}`);
  }
  return result.data.examples;
}

// The examples whose first resolved row is not `means`, with what they got instead.
export function findExampleFailures(palette, examples) {
  return examples
    .map(({ say, means }) => ({ say, means, got: palette.resolveInput(say)[0]?.id }))
    .filter(({ means, got }) => got !== toRowId(means));
}
