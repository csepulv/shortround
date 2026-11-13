import { Chat } from '@ai-sdk/react';
import { lastAssistantMessageIsCompleteWithToolCalls } from 'ai';

import { withRequestBody } from './with-request-body.js';

const runtimesByChat = new WeakMap();

/**
 * An AI SDK `Chat` over a catalog runtime, for a host that holds the conversation itself (in a store, outside React):
 * the model's tool calls run in the app through `runtime.runTool` (one whose app run fails goes back to the model as an
 * error), every request carries every intention as a tool (the ones not available at that moment marked so) plus
 * the host's `body` (an object, or a function called per request), and the chat continues after tool calls while
 * `sendAutomaticallyWhen` says so (by default, once every call has its answer). Every other `Chat` option (`id`,
 * `messages`, `onFinish`, …) passes through. Draw it with `useIntentionChat({ chat })` or
 * `<IntentionChat chat={chat} />`.
 */
export function makeIntentionChat({ runtime, transport, body, onToolCall, ...chatOptions }) {
  const missing = Object.entries({ runtime, transport })
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length) {
    throw new Error(
      `makeIntentionChat: needs runtime (from buildCatalogRuntime) and transport; missing: ${missing.join(', ')}`
    );
  }
  if (onToolCall) {
    throw new Error(
      "makeIntentionChat: onToolCall is the package's (it runs the app's intentions); leave it out"
    );
  }
  const chat = makeWiredChat({ current: () => ({ runtime, transport, body }), ...chatOptions });
  runtimesByChat.set(chat, runtime);
  return chat;
}

export const runtimeOfChat = (chat) => runtimesByChat.get(chat);

export function makeWiredChat({
  current,
  sendAutomaticallyWhen = lastAssistantMessageIsCompleteWithToolCalls,
  ...chatOptions
}) {
  const chat = new Chat({
    ...chatOptions,
    transport: transportWithTools(current),
    sendAutomaticallyWhen,
    onToolCall: async ({ toolCall }) => {
      const answer = await runToolReportingFailure(current().runtime, toolCall);
      chat.addToolOutput(toolOutputOf(toolCall, answer));
    }
  });
  return chat;
}

function transportWithTools(current) {
  return withRequestBody(
    {
      sendMessages: (options) => current().transport.sendMessages(options),
      reconnectToStream: (options) => current().transport.reconnectToStream(options)
    },
    async () => {
      const { body, runtime } = current();
      return { ...(typeof body === 'function' ? body() : body), tools: await runtime.tools() };
    }
  );
}

async function runToolReportingFailure(runtime, toolCall) {
  try {
    return await runtime.runTool(toolCall);
  } catch (error) {
    console.error(`Intention "${toolCall.toolName}" failed`, { toolCall, error });
    return { errorText: `"${toolCall.toolName}" failed: ${error.message ?? error}` };
  }
}

function toolOutputOf(toolCall, answer) {
  const target = { tool: toolCall.toolName, toolCallId: toolCall.toolCallId };
  return answer.errorText
    ? { ...target, state: 'output-error', errorText: answer.errorText }
    : { ...target, output: answer.output };
}
