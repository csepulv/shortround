import { convertArrayToReadableStream, MockLanguageModelV4 } from 'ai/test';
import { expect, test, vi } from 'vitest';

import { MISSING_KEY, respondToChat } from '../chat-route.js';

const USAGE = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined }
};

const answering = (text) => {
  const doStream = vi.fn(async () => ({
    stream: convertArrayToReadableStream([
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: text },
      { type: 'text-end', id: 't1' },
      { type: 'finish', finishReason: { unified: 'stop', raw: 'end_turn' }, usage: USAGE }
    ])
  }));
  return { model: new MockLanguageModelV4({ doStream }), doStream };
};

const REQUEST = {
  messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'what is left?' }] }],
  tools: []
};

test("streams the model's answer back", async () => {
  const { model } = answering('Three todos are left.');

  const response = await respondToChat(REQUEST, { model });

  expect(response.status).toBe(200);
  expect(await response.text()).toContain('Three todos are left.');
});

test('without a key, answers an error that says where the key goes, and calls no model', async () => {
  const response = await respondToChat(REQUEST, { model: null });

  expect(response.status).toBe(503);
  expect(await response.text()).toBe(MISSING_KEY);
});

test('a call to a tool the model was not offered is told by name in the stream', async () => {
  const doStream = vi.fn(async () => ({
    stream: convertArrayToReadableStream([
      { type: 'tool-call', toolCallId: 'call-1', toolName: 'launch', input: '{}' },
      { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_use' }, usage: USAGE }
    ])
  }));

  const response = await respondToChat(REQUEST, { model: new MockLanguageModelV4({ doStream }) });

  expect(await response.text()).toContain('\\"launch\\" is not one of the app’s intentions');
});

test('a request the browser abandons tells the model to stop', async () => {
  const { model, doStream } = answering('unused');
  const abandoned = new AbortController();
  abandoned.abort();

  const response = await respondToChat(REQUEST, { model, abortSignal: abandoned.signal });
  await response.text();

  expect(doStream.mock.calls[0][0].abortSignal?.aborted).toBe(true);
});

test('refuses a malformed request before any model call', async () => {
  const { model, doStream } = answering('unused');

  const response = await respondToChat({ messages: [] }, { model });

  expect(response.status).toBe(400);
  expect(doStream).not.toHaveBeenCalled();
});
