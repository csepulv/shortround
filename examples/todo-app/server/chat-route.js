import {
  INTENTION_CHAT_SYSTEM_PROMPT,
  intentionErrorText,
  intentionModelMessages,
  intentionToolSet,
  parseIntentionChatRequest
} from '@shortround/chat/server';
import { streamText } from 'ai';

export const MISSING_KEY =
  'The chat needs an Anthropic key: put ANTHROPIC_API_KEY=… in examples/todo-app/.env.local and restart the dev server. Typed intentions work without one.';

/**
 * Answers one chat request from the browser. `model` is the language model, or null when there is no key;
 * `abortSignal` stops the model when the browser goes away.
 */
export async function respondToChat(body, { model, abortSignal }) {
  if (!model) {
    return new Response(MISSING_KEY, { status: 503 });
  }
  const parsed = parseIntentionChatRequest(body);
  if (!parsed.success) {
    return new Response(parsed.error.message, { status: 400 });
  }
  const result = streamText({
    model,
    system: INTENTION_CHAT_SYSTEM_PROMPT,
    messages: await intentionModelMessages(parsed.data.messages),
    tools: intentionToolSet(parsed.data.tools),
    abortSignal,
    providerOptions: { anthropic: { thinking: { type: 'adaptive' }, effort: 'low' } }
  });
  return result.toUIMessageStreamResponse({ onError: intentionErrorText });
}
