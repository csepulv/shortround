// @vitest-environment node
// The server helpers an adopter's chat route uses; the route picks the model and the provider.
import { expect, test } from 'vitest';

import {
  INTENTION_CHAT_SYSTEM_PROMPT,
  intentionErrorText,
  intentionToolSet,
  intentionToolsSchema,
  parseIntentionChatRequest
} from '../server.js';
import { route } from './helpers/route.js';
import { makeScriptedModel, userSays } from './helpers/scripted-model.js';

const SEARCH_TOOL = {
  name: 'search',
  description: 'Search',
  inputSchema: { type: 'object', properties: { term: { type: 'string' } } }
};

async function chatWith(body) {
  const model = makeScriptedModel(['Hello there']);
  const response = await route(body, model);
  const streamed = await response.text();
  return { response, streamed, call: model.doStreamCalls[0] };
}

test("streams the model's answer back", async () => {
  const { response, streamed } = await chatWith({ messages: [userSays('hi')], tools: [] });

  expect(response.status).toBe(200);
  expect(streamed).toContain('Hello there');
});

test("offers the browser's tools to the model with their schemas, and no execute", async () => {
  const { call } = await chatWith({ messages: [userSays('find grid')], tools: [SEARCH_TOOL] });
  const toolSet = intentionToolSet([SEARCH_TOOL]);

  expect(call.tools).toEqual([
    expect.objectContaining({
      type: 'function',
      name: 'search',
      description: 'Search',
      inputSchema: expect.objectContaining({ properties: { term: { type: 'string' } } })
    })
  ]);
  expect(toolSet.search.execute).toBeUndefined();
});

test('tells the model about an intention the user ran without it', async () => {
  const typedRun = {
    id: 'r1',
    role: 'user',
    parts: [{ type: 'data-intention', data: { line: 'search grid', message: 'Searched for grid' } }]
  };

  const { call } = await chatWith({
    messages: [typedRun, userSays('what did I just do?', 'u2')],
    tools: []
  });

  expect(JSON.stringify(call.prompt)).toContain(
    'The user ran \\"search grid\\": Searched for grid'
  );
});

test("tells the model a typed run's output in place of its message: text as it is, anything else as JSON", async () => {
  const typedRun = (id, output) => ({
    id,
    role: 'user',
    parts: [{ type: 'data-intention', data: { line: 'find notes', message: 'Found 2', output } }]
  });

  const { call } = await chatWith({
    messages: [typedRun('r1', { total: 2 }), typedRun('r2', 'w1, w2'), userSays('so?', 'u3')],
    tools: []
  });
  const prompt = JSON.stringify(call.prompt);

  expect(prompt).toContain('The user ran \\"find notes\\": {\\"total\\":2}');
  expect(prompt).toContain('The user ran \\"find notes\\": w1, w2');
  expect(prompt).not.toContain('Found 2');
});

test('a typed run whose output is null is told by its message', async () => {
  const typedRun = {
    id: 'r1',
    role: 'user',
    parts: [
      {
        type: 'data-intention',
        data: { line: 'find notes', message: 'Nothing found', output: null }
      }
    ]
  };

  const { call } = await chatWith({ messages: [typedRun, userSays('so?', 'u2')], tools: [] });

  expect(JSON.stringify(call.prompt)).toContain('The user ran \\"find notes\\": Nothing found');
});

test('the suggested system prompt says a result is what the app answered, a message or data', () => {
  expect(INTENTION_CHAT_SYSTEM_PROMPT).toContain(
    'A tool’s result is what the app answered: the short message it showed the user, or data for you.'
  );
  expect(INTENTION_CHAT_SYSTEM_PROMPT).not.toContain('the short message the app showed the user.');
});

test("a route that receives one message still checks the browser's tools", () => {
  const checked = intentionToolsSchema.safeParse([SEARCH_TOOL]);
  const malformed = intentionToolsSchema.safeParse([{ name: 'search' }]);
  const absent = intentionToolsSchema.safeParse(undefined);

  expect(checked).toMatchObject({ success: true, data: [SEARCH_TOOL] });
  expect(malformed.success).toBe(false);
  expect(absent).toMatchObject({ success: true, data: [] });
});

test('passes the route its own fields, such as the model the user chose', () => {
  const parsed = parseIntentionChatRequest({ model: 'big', messages: [userSays('hi')] });

  expect(parsed.success).toBe(true);
  expect(parsed.data).toMatchObject({ model: 'big', tools: [] });
});

test('refuses a request with no messages, or a malformed tool, before any model call', async () => {
  const model = makeScriptedModel(['never']);

  const noMessages = await route({ tools: [] }, model);
  const emptyMessages = await route({ messages: [], tools: [] }, model);
  const badTool = await route({ messages: [userSays('hi')], tools: [{ name: 'search' }] }, model);

  expect([noMessages.status, emptyMessages.status, badTool.status]).toEqual([400, 400, 400]);
  expect(model.doStreamCalls).toEqual([]);
});

test('the suggested system prompt tells the model what a marked tool means', () => {
  expect(INTENTION_CHAT_SYSTEM_PROMPT).toContain(
    'One marked "(not available now)" can’t run in the app’s current state: don’t call it;'
  );
});

test('a call to a tool the model was not offered is told by name; other errors stay masked', () => {
  const noSuchTool = Object.assign(new Error('Model tried to call unavailable tool'), {
    name: 'AI_NoSuchToolError',
    toolName: 'launch'
  });

  expect(intentionErrorText(noSuchTool)).toBe('"launch" is not one of the app’s intentions');
  expect(intentionErrorText(new Error('database password is hunter2'))).toBe('An error occurred.');
});
