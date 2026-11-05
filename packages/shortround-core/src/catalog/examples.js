import { parse } from 'yaml';
import { z } from 'zod';

// An examples file is the catalog's grammar tests, checked against the start list: each typed line (`say`) must run,
// first, the call `means`: one command and the args it runs with ({ search: { term: grid } }).
const callSchema = z
  .record(z.string(), z.record(z.string(), z.unknown()))
  .refine((call) => Object.keys(call).length === 1, {
    message: 'means names one command, with its args'
  });

const examplesSchema = z.strictObject({
  examples: z.array(z.strictObject({ say: z.string(), means: callSchema }))
});

export function loadExamples(text) {
  const result = examplesSchema.safeParse(parse(text));
  if (!result.success) {
    throw new Error(`Examples are malformed:\n${z.prettifyError(result.error)}`);
  }
  return result.data.examples;
}

// The examples whose line doesn't run what they mean, with what it ran instead (undefined: nothing).
export function findExampleFailures(palette, examples) {
  return examples
    .map(({ say, means }) => ({ say, means, got: firstCall(palette.resolveInput(say)) }))
    .filter(({ means, got }) => !sameCall(means, got));
}

// What the line runs: the first enabled command row's call, as an example writes it ({ <command>: <args> }). A
// disabled command row runs nothing; Enter completes a next step instead.
function firstCall(rows) {
  const call = rows.find((row) => row.call && !row.disabled)?.call;
  return call && { [call.command]: call.args };
}

// The same command with the same args, whatever order the example writes them in.
const sameCall = (wanted, got) => got !== undefined && canonical(wanted) === canonical(got);

function canonical(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}
