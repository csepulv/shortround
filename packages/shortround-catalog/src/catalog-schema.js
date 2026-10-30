import { z } from 'zod';

// The catalog holds what is built and what is planned. The engine runs the built part; planned states, commands and
// pickers document intended paths until their functions exist (`run` and `from` are optional on them).
// `tier`, `review` and `workflows` are design notes the engine reads but doesn't act on.

const askSchema = z.union([
  z.strictObject({ text: z.string(), required: z.string().optional() }),
  z.strictObject({ choose: z.string() })
]);

const tierSchema = z.enum(['common', 'full']);

// Strict throughout: an unknown field (a misspelling, a leftover v1 field) is an error, not ignored.
const commandSchema = z
  .strictObject({
    title: z.string().optional(),
    summary: z.string().optional(),
    group: z.string().optional(),
    icon: z.string().optional(),
    aliases: z.array(z.string()).optional(),
    forEach: z.literal('facets').optional(),
    ask: askSchema.optional(),
    run: z.string().optional(),
    args: z.array(z.unknown()).optional(),
    when: z.string().optional(),
    then: z.string().optional(),
    planned: z.boolean().optional(),
    tier: tierSchema.optional(),
    review: z.string().optional()
  })
  .refine((command) => command.forEach || command.title, {
    message: 'a command needs a title (a forEach command takes its titles from the facets)',
    path: ['title']
  });

// A guided flow, one step at a time: ask for something, or run and move on.
const stepSchema = z.union([
  z.strictObject({ ask: askSchema }),
  z.strictObject({ run: z.string().optional(), then: z.string().optional() })
]);

const stateSchema = z
  .strictObject({
    summary: z.string().optional(),
    start: z.boolean().optional(),
    panel: z.literal('sidecar').optional(),
    commands: z.record(z.string(), commandSchema).default({}),
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
    if (!state.steps && Object.keys(state.commands).length === 0) {
      context.addIssue({ code: 'custom', message: 'a state needs commands', path: ['commands'] });
    }
    if (state.planned) {
      return;
    }
    for (const [name, command] of Object.entries(state.commands)) {
      if (!command.planned && !command.run) {
        context.addIssue({
          code: 'custom',
          message: 'a built command needs run (a planned one may leave it out)',
          path: ['commands', name, 'run']
        });
      }
    }
  });

const pickerSchema = z
  .strictObject({
    from: z.string().optional(),
    empty: z.string(),
    planned: z.boolean().optional()
  })
  .refine((picker) => picker.planned || picker.from, {
    message: 'a built picker needs from (a planned one may leave it out)',
    path: ['from']
  });

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

export const catalogSchema = z.strictObject({
  version: z.literal(2),
  app: z.string(),
  pickers: z.record(z.string(), pickerSchema).default({}),
  facets: z
    .record(
      z.string(),
      z.strictObject({ title: z.string(), aliases: z.array(z.string()).optional() })
    )
    .default({}),
  states: z.record(z.string(), stateSchema),
  workflows: z.record(z.string(), workflowSchema).optional()
});
