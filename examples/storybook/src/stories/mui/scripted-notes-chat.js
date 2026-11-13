import {
  INTENTION_CHAT_SYSTEM_PROMPT,
  intentionErrorText,
  intentionModelMessages,
  intentionToolSet,
  parseIntentionChatRequest
} from '@shortround/chat/server';
import { DefaultChatTransport, streamText } from 'ai';
import { convertArrayToReadableStream, MockLanguageModelV4 } from 'ai/test';

const USAGE = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined }
};

const HELP =
  'This story’s model is **scripted**. Try:\n\n' +
  '- “preview the CSS grid guide”\n' +
  '- “show me the next one” (while browsing, it isn’t available yet)\n' +
  '- “close the preview”\n\n' +
  'Or type an intention, such as `search grid with sort newest`.';

const textAnswer = (text) => [
  { type: 'text-start', id: 't1' },
  { type: 'text-delta', id: 't1', delta: text },
  { type: 'text-end', id: 't1' },
  { type: 'finish', finishReason: { unified: 'stop', raw: 'end_turn' }, usage: USAGE }
];

const toolCall = (toolName, input) => [
  { type: 'tool-call', toolCallId: `call-${Date.now()}`, toolName, input: JSON.stringify(input) },
  { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_use' }, usage: USAGE }
];

const USER_ASKS = [
  [/close/, () => toolCall('closePreview', {})],
  [/next/, () => toolCall('next', {})],
  [/guide|\b2\b/, () => toolCall('preview', { note: '2. CSS grid guide' })],
  [/preview|notes|\b1\b/, () => toolCall('preview', { note: '1. Grid layout notes' })]
];

function answerTo(prompt) {
  const last = prompt.at(-1);
  if (last.role === 'tool') {
    const { output } = last.content[0];
    return textAnswer(
      output.type === 'error-text'
        ? `That didn’t run: ${output.value}`
        : `**Done.** ${output.value}`
    );
  }
  const said = last.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join(' ')
    .toLowerCase();
  const asked = USER_ASKS.find(([pattern]) => pattern.test(said));
  return asked ? asked[1]() : textAnswer(HELP);
}

const model = new MockLanguageModelV4({
  doStream: async ({ prompt }) => ({ stream: convertArrayToReadableStream(answerTo(prompt)) })
});

async function route(body) {
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

export const makeScriptedTransport = () =>
  new DefaultChatTransport({
    api: '/story/chat',
    fetch: async (url, init) => route(JSON.parse(init.body))
  });
