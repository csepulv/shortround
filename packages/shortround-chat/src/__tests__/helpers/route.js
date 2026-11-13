// An adopter's route, as small as the server helpers make it, and a transport whose fetch calls it in-process.
import { DefaultChatTransport, streamText } from 'ai';

import {
  INTENTION_CHAT_SYSTEM_PROMPT,
  intentionErrorText,
  intentionModelMessages,
  intentionToolSet,
  intentionToolsSchema,
  parseIntentionChatRequest
} from '../../server.js';

export async function route(body, model) {
  const parsed = parseIntentionChatRequest(body);
  if (!parsed.success) {
    return new Response(parsed.error.message, { status: 400 });
  }
  const result = streamText({
    model,
    system: INTENTION_CHAT_SYSTEM_PROMPT,
    messages: await intentionModelMessages(parsed.data.messages),
    tools: intentionToolSet(parsed.data.tools)
  });
  return result.toUIMessageStreamResponse({ onError: intentionErrorText });
}

/** A transport to the route above; `requests` holds each request's body as sent. */
export function makeRouteTransport(model) {
  const requests = [];
  const transport = new DefaultChatTransport({
    api: '/api/chat',
    fetch: async (url, init) => {
      const body = JSON.parse(init.body);
      requests.push(body);
      return route(body, model);
    }
  });
  return { transport, requests };
}

export function makeStoringRouteTransport(model) {
  const requests = [];
  let stored = [];
  const storeAll = (incoming) => {
    const byId = new Map(stored.map((message) => [message.id, message]));
    incoming.forEach((message) => byId.set(message.id, message));
    stored = [...byId.values()];
  };
  async function storingRoute(body) {
    const tools = intentionToolsSchema.safeParse(body.tools);
    if (!tools.success) {
      return new Response(tools.error.message, { status: 400 });
    }
    storeAll(body.messages);
    const result = streamText({
      model,
      system: INTENTION_CHAT_SYSTEM_PROMPT,
      messages: await intentionModelMessages(stored),
      tools: intentionToolSet(tools.data)
    });
    return result.toUIMessageStreamResponse({
      originalMessages: stored,
      onFinish: ({ messages }) => {
        stored = messages;
      },
      onError: intentionErrorText
    });
  }
  const transport = new DefaultChatTransport({
    api: '/api/chat',
    prepareSendMessagesRequest: ({ messages, body }) => ({
      body: { messages: messagesTheServerLacks(messages), tools: body.tools }
    }),
    fetch: async (url, init) => {
      const body = JSON.parse(init.body);
      requests.push(body);
      return storingRoute(body);
    }
  });
  return { transport, requests, stored: () => stored };
}

const messagesTheServerLacks = (messages) =>
  messages.slice(
    Math.max(
      0,
      messages.findLastIndex((message) => message.role === 'assistant')
    )
  );

/** The tools a request offers as available now (every intention is offered; the rest say "(not available now)"). */
export const toolNamesOf = (body) =>
  body.tools
    .filter((tool) => !tool.description.endsWith('(not available now)'))
    .map((tool) => tool.name);
