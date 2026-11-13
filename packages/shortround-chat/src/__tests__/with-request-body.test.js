import { expect, test } from 'vitest';

import { withRequestBody } from '../with-request-body.js';

function makeRecordingTransport() {
  const sent = [];
  return {
    sent,
    sendMessages: async (options) => {
      sent.push(options);
      return 'stream';
    },
    reconnectToStream: async (options) => {
      sent.push(options);
      return null;
    }
  };
}

test('every request carries the body as it is when the request is made', async () => {
  const transport = makeRecordingTransport();
  let tools = ['search', 'preview'];
  const wrapped = withRequestBody(transport, async () => ({ tools }));

  await wrapped.sendMessages({ trigger: 'submit-message', body: { kept: true } });
  tools = ['next', 'closePreview'];
  await wrapped.sendMessages({ trigger: 'submit-message', body: { kept: true } });

  expect(transport.sent.map((options) => options.body)).toEqual([
    { kept: true, tools: ['search', 'preview'] },
    { kept: true, tools: ['next', 'closePreview'] }
  ]);
});

test("passes the transport's answer back, and reconnects unchanged", async () => {
  const transport = makeRecordingTransport();
  const wrapped = withRequestBody(transport, async () => ({ tools: [] }));

  expect(await wrapped.sendMessages({})).toBe('stream');
  expect(await wrapped.reconnectToStream({ chatId: 'c1' })).toBe(null);
  expect(transport.sent.at(-1)).toEqual({ chatId: 'c1' });
});
