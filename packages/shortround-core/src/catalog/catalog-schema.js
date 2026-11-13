import { z } from 'zod';

// Catalog format version 3: commands are declared once, with params, and drive both picking rows and typed whole
// commands. States hold while their `when` holds; there is no `then`. The catalog holds what is built and what is
// planned: the engine runs the built part, and `summary`, `planned`, `tier`, `review`, `steps` and `workflows` are
// design notes it checks but doesn't act on. Strict throughout: an unknown field (a misspelling, a version 2 field) is
// an error, not ignored.

const tierSchema = z.enum(['common', 'full']);

// A guided flow for a planned state, one step at a time: ask for something, or run and move on.
const askSchema = z.union([
  z.strictObject({ text: z.string(), required: z.string().optional() }),
  z.strictObject({ choose: z.string() })
]);
const stepSchema = z.union([
  z.strictObject({ ask: askSchema }),
  z.strictObject({ run: z.string().optional(), then: z.string().optional() })
]);

const workflowStepSchema = z.strictObject({
  question: z.string(),
  state: z.string().optional(),
  do: z.string(),
  then: z.union([z.string(), z.array(z.string())]).optional()
});

const workflowSchema = z
  .strictObject({
    title: z.string().optional(),
    steps: z.array(workflowStepSchema).optional(),
    options: z.array(workflowStepSchema).optional()
  })
  .refine((workflow) => Boolean(workflow.steps) !== Boolean(workflow.options), {
    message: 'a workflow has steps (in order) or options (places to start), not both'
  });

const stringList = z.array(z.string());

const groupSchema = z.strictObject({ label: z.string(), icon: z.string().optional() });

// Overrides for the picking rows only; each has a default (a prompt from the label, ids from the catalog's names).
const pathSchema = z.strictObject({
  id: z.string().optional(),
  title: z.string().optional(),
  aliases: stringList.optional(),
  prompt: z.string().optional(),
  required: z.string().optional(),
  empty: z.string().optional(),
  group: z.string().optional(),
  icon: z.string().optional(),
  rows: z.literal('each value').optional()
});

const listEntrySchema = z.strictObject({
  value: z.union([z.string(), z.number(), z.boolean()]),
  title: z.string(),
  subtitle: z.string().optional(),
  aliases: stringList.optional(),
  path: z.strictObject({ id: z.string().optional() }).optional()
});

const NUMBER_TYPES = ['integer', 'number'];
const isNumberType = (source) => NUMBER_TYPES.includes(source.type);

const argSourceSchema = z
  .strictObject({
    freeform: z.boolean().optional(),
    type: z.enum(['text', 'range', 'url', ...NUMBER_TYPES]).optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    maxLength: z.number().int().min(1).optional(),
    list: z.array(listEntrySchema).optional(),
    lookup: z.string().optional(),
    key: z.string().optional(),
    current: z.string().optional()
  })
  .refine((source) => source.freeform || source.list || source.lookup || source.current, {
    message: 'an argSource needs freeform, list, lookup or current'
  })
  .refine(
    (source) => !isNumberType(source) || (source.freeform && !source.list && !source.lookup),
    {
      message: 'a number type is freeform only, with no list or lookup',
      path: ['type']
    }
  )
  .refine(
    (source) =>
      isNumberType(source) || (source.minimum === undefined && source.maximum === undefined),
    { message: 'minimum and maximum are for a number type (integer or number)', path: ['minimum'] }
  )
  .refine(
    (source) =>
      source.minimum === undefined ||
      source.maximum === undefined ||
      source.minimum <= source.maximum,
    { message: 'minimum is above maximum', path: ['minimum'] }
  )
  .refine(
    (source) =>
      source.type !== 'integer' ||
      [source.minimum, source.maximum].every(
        (bound) => bound === undefined || Number.isInteger(bound)
      ),
    { message: "an integer type's minimum and maximum are whole numbers", path: ['minimum'] }
  )
  .refine(
    (source) =>
      source.maxLength === undefined || (source.freeform && (source.type ?? 'text') === 'text'),
    { message: 'maxLength is for text (freeform, type text)', path: ['maxLength'] }
  )
  // `current` may hold nothing (no result previewed); the param must then have a way to ask.
  .refine((source) => !source.current || source.freeform || source.list || source.lookup, {
    message: 'current needs a way to ask too: freeform, list or lookup'
  });

const paramSchema = z
  .strictObject({
    label: z.string(),
    summary: z.string().optional(),
    required: z.boolean().optional(),
    list: z.boolean().optional(),
    minItems: z.number().int().min(1).optional(),
    nullable: z.union([z.literal(true), stringList.min(1)]).optional(),
    default: z.boolean().optional(),
    priority: z.number().optional(),
    hints: stringList.optional(),
    aliases: stringList.optional(),
    argSource: argSourceSchema,
    path: pathSchema.optional()
  })
  .refine((param) => param.minItems === undefined || param.list, {
    message: 'minItems is for a list param (list: true)',
    path: ['minItems']
  })
  .refine((param) => param.nullable === undefined || !param.list, {
    message: 'nullable is for a param that takes one value',
    path: ['nullable']
  })
  .refine(
    (param) => param.nullable === undefined || (!param.argSource.list && !param.argSource.lookup),
    { message: 'nullable is for a param with no list or lookup', path: ['nullable'] }
  );

const wordsOfParam = (param) => [
  param.label,
  ...(param.aliases ?? []),
  ...(param.hints ?? []),
  ...(param.argSource.list ?? []).flatMap((entry) => entry.aliases ?? [])
];

function refuseNullWordsTheCommandUses(command, context) {
  const params = Object.entries(command.params);
  const commandWords = new Set(
    params.flatMap(([, param]) => wordsOfParam(param)).map((word) => word.toLowerCase())
  );
  for (const [key, param] of params) {
    const nullWords = Array.isArray(param.nullable) ? param.nullable : [];
    for (const word of nullWords.filter((each) => commandWords.has(each.toLowerCase()))) {
      context.addIssue({
        code: 'custom',
        message: `"${word}" is already a word of this command, so it can't also mean no value`,
        path: ['params', key, 'nullable']
      });
    }
  }
}

const commandSchema = z
  .strictObject({
    label: z.string(),
    summary: z.string().optional(),
    toolDescription: z.string().optional(),
    aliases: stringList.optional(),
    group: z.string().optional(),
    icon: z.string().optional(),
    run: z.string().optional(),
    when: z.string().optional(),
    params: z.record(z.string(), paramSchema).default({}),
    planned: z.boolean().optional(),
    tier: tierSchema.optional(),
    review: z.string().optional()
  })
  .refine((command) => command.planned || command.run, {
    message: 'a built command needs run (a planned one may leave it out)',
    path: ['run']
  })
  .superRefine(refuseNullWordsTheCommandUses);

const stateSchema = z
  .strictObject({
    summary: z.string().optional(),
    start: z.boolean().optional(),
    when: z.string().optional(),
    panel: z.string().optional(),
    commands: stringList.default([]),
    steps: z.array(stepSchema).optional(),
    planned: z.boolean().optional(),
    tier: tierSchema.optional(),
    review: z.string().optional()
  })
  .superRefine((state, context) => {
    if (state.steps && !state.planned) {
      context.addIssue({
        code: 'custom',
        message: 'steps (a guided flow) belong to a planned state; the engine cannot run them yet',
        path: ['steps']
      });
    }
    if (!state.steps && state.commands.length === 0) {
      context.addIssue({ code: 'custom', message: 'a state needs commands', path: ['commands'] });
    }
  });

export const catalogSchema = z.strictObject({
  version: z.literal(3),
  app: z.string(),
  groups: z.record(z.string(), groupSchema).default({}),
  states: z.record(z.string(), stateSchema),
  commands: z.record(z.string(), commandSchema),
  workflows: z.record(z.string(), workflowSchema).optional()
});
