// What every chat route needs. The route itself, the model, the provider and its options are the adopter's.
import { convertToModelMessages, jsonSchema, tool } from 'ai';
import { z } from 'zod';

/** A system prompt that tells the model what its tools are; a route may use it, extend it or write its own. */
export const INTENTION_CHAT_SYSTEM_PROMPT = [
  'You are the assistant inside an app. The user can run the app’s intentions by typing them, and can also ask you.',
  'The tools you are given are the app’s intentions. One marked "(not available now)" can’t run in the app’s current',
  'state: don’t call it; tell the user what has to happen first, or use a tool that is available.',
  'When the user asks for something a tool does, run the tool rather than describing how to do it.',
  'A tool’s result is what the app answered: the short message it showed the user, or data for you.',
  'Keep your answers short.'
].join(' ');

/**
 * The tools a chat request carries, as zod checks them (`[]` when none were sent), for a route that takes the request
 * in its own shape, such as one new message rather than the whole conversation.
 */
export const intentionToolsSchema = z
  .array(
    z.object({
      name: z.string(),
      description: z.string(),
      inputSchema: z.record(z.string(), z.unknown())
    })
  )
  .default([]);

const requestSchema = z.looseObject({
  messages: z
    .array(z.looseObject({ role: z.string(), parts: z.array(z.looseObject({ type: z.string() })) }))
    .min(1),
  tools: intentionToolsSchema
});

/**
 * Checks a chat request from the browser: its messages and the tools available there. Fields the route sends itself
 * (the model the user chose) pass through. Returns zod's `{ success, data }` or `{ success, error }`.
 */
export const parseIntentionChatRequest = (body) => requestSchema.safeParse(body);

/**
 * The conversation for the model, with each intention the user ran without it told as text: the line, then the run's
 * `output` when it returned one (text as it is, anything else as JSON), else its message.
 */
export const intentionModelMessages = (messages) =>
  convertToModelMessages(messages, { convertDataPart: intentionRunAsText });

/** The browser's tools for the model. They have no `execute`, so each call goes back to the browser, which runs it. */
export const intentionToolSet = (tools) =>
  Object.fromEntries(
    tools.map(({ name, description, inputSchema }) => [
      name,
      tool({ description, inputSchema: jsonSchema(inputSchema) })
    ])
  );

/**
 * For `toUIMessageStreamResponse({ onError })`: a call to a tool the model wasn't offered is told by name, so the model
 * and the user see why; any other error keeps the AI SDK's masked text, so nothing private reaches the browser.
 */
export function intentionErrorText(error) {
  if (error?.name === 'AI_NoSuchToolError') {
    return `"${error.toolName}" is not one of the app’s intentions`;
  }
  return 'An error occurred.';
}

function intentionRunAsText(part) {
  if (part.type !== 'data-intention') {
    return undefined;
  }
  const { line, message, output } = part.data;
  return {
    type: 'text',
    text: `The user ran "${line}": ${output == null ? message : asText(output)}`
  };
}

const asText = (value) => (typeof value === 'string' ? value : JSON.stringify(value));
