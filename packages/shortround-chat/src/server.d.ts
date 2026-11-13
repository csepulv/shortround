// @shortround/chat/server's types: what every chat route needs. The model, the provider and its options are the route's.
import type { IntentionTool } from '@shortround/core';
import type { ModelMessage, ToolSet, UIMessage } from 'ai';
import type { ZodType } from 'zod';

/** A system prompt that tells the model what its tools are; a route may use it, extend it or write its own. */
export const INTENTION_CHAT_SYSTEM_PROMPT: string;

/**
 * The tools a chat request carries, as zod checks them (`[]` when none were sent), for a route that takes the request
 * in its own shape, such as one new message rather than the whole conversation: `intentionToolsSchema.safeParse(tools)`.
 */
export const intentionToolsSchema: ZodType<IntentionTool[]>;

/** A checked chat request: the messages, the tools (`[]` when none were sent), and the route's own fields. */
export type IntentionChatRequest = {
  messages: UIMessage[];
  tools: IntentionTool[];
} & Record<string, unknown>;

/**
 * Checks a chat request from the browser: at least one message, and well-formed tools. Fields the route sends itself
 * (the model the user chose) pass through. Returns zod's result: `{ success: true, data }` or `{ success: false,
 * error }`, whose `error.message` says what was wrong.
 */
export function parseIntentionChatRequest(
  body: unknown
): { success: true; data: IntentionChatRequest } | { success: false; error: Error };

/**
 * The conversation for the model, with each intention the user ran without it told as text: the line, then the run's
 * `output` when it returned one (text as it is, anything else as JSON), else its message.
 */
export function intentionModelMessages(messages: UIMessage[]): Promise<ModelMessage[]>;

/**
 * For `result.toUIMessageStreamResponse({ onError: intentionErrorText })`: a call to a tool the model wasn't offered
 * becomes `"<name>" is not one of the app's intentions`, which the model and the user see; any other error keeps the AI
 * SDK's masked "An error occurred.".
 */
export function intentionErrorText(error: unknown): string;

/** The browser's tools for the model, without `execute`: each call goes back to the browser, which runs it. */
export function intentionToolSet(tools: IntentionTool[]): ToolSet;
