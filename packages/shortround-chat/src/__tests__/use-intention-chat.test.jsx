// The chat's state over a catalog runtime: typed runs, messages to the model, and the model's tool calls run in the app,
// against a route built from the server helpers and a scripted model.
import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { useIntentionChat } from '../use-intention-chat.js';
import { makeRouteTransport, toolNamesOf } from './helpers/route.js';
import { makeScriptedModel } from './helpers/scripted-model.js';
import { makeSearchRuntime } from './helpers/search-runtime.js';

function renderChat(turns, options = {}, app = makeSearchRuntime()) {
  const model = makeScriptedModel(turns);
  const { transport, requests } = makeRouteTransport(model);
  const { runtime, log } = app;
  const hook = renderHook((props) => useIntentionChat(props), {
    initialProps: { runtime, transport, ...options }
  });
  return { hook, requests, log, runtime, transport, chat: () => hook.result.current };
}

async function type(chat, text, key = { key: 'Enter' }) {
  await waitFor(() => expect(chat().line).not.toBeNull());
  await act(async () => {
    chat().line.change(text, text.length);
  });
  await act(async () => {
    await chat().line.pressKey(key);
  });
}

const SEND = { key: 'Enter', metaKey: true };
const partsOf = (messages) => messages.flatMap((message) => message.parts);
const toolPartsOf = (messages) => partsOf(messages).filter((part) => part.type.startsWith('tool-'));

test('a typed run is added to the conversation, with no request to the model', async () => {
  const { chat, requests, log } = renderChat(['unused']);

  await type(chat, 'search grid');

  expect(log).toEqual(['search.apply({"term":"grid"})']);
  expect(chat().messages.at(-1)).toMatchObject({
    role: 'user',
    parts: [{ type: 'data-intention', data: { line: 'search grid', message: 'Searched for grid' } }]
  });
  expect(requests).toEqual([]);
});

test("a message carries the intentions as tools, and the host's body", async () => {
  const { chat, requests } = renderChat(['Hi there'], { body: () => ({ model: 'big' }) });

  await type(chat, 'hello', SEND);
  await waitFor(() => expect(chat().status).toBe('ready'));

  expect(requests).toHaveLength(1);
  expect(requests[0].model).toBe('big');
  expect(toolNamesOf(requests[0])).toEqual(['search', 'preview']);
  expect(partsOf(chat().messages).at(-1)).toMatchObject({ type: 'text', text: 'Hi there' });
});

test("a tool the model calls runs in the app, and the continuation carries the new state's tools", async () => {
  const { chat, requests, log } = renderChat([
    { toolCalls: [{ toolName: 'preview', input: { result: '1' } }] },
    'Previewing it'
  ]);

  await type(chat, 'preview the first one', SEND);
  await waitFor(() => expect(requests).toHaveLength(2));
  await waitFor(() => expect(chat().status).toBe('ready'));

  expect(log).toEqual(['results.preview({"result":"w1"})']);
  expect(toolPartsOf(chat().messages)[0]).toMatchObject({
    type: 'tool-preview',
    state: 'output-available',
    output: 'Previewing 1. Grid layout notes'
  });
  expect(requests.map(toolNamesOf)).toEqual([
    ['search', 'preview'],
    ['next', 'closePreview']
  ]);
});

test('a call the app refuses goes back to the model as an error, and the conversation continues', async () => {
  const { chat, requests, log } = renderChat([
    { toolCalls: [{ toolName: 'preview', input: { result: 'vue' } }] },
    'Sorry'
  ]);

  await type(chat, 'preview vue', SEND);
  await waitFor(() => expect(requests).toHaveLength(2));
  await waitFor(() => expect(chat().status).toBe('ready'));

  expect(log).toEqual([]);
  expect(toolPartsOf(chat().messages)[0]).toMatchObject({
    state: 'output-error',
    errorText: 'No Result "vue". Choose from: 1. Grid layout notes, 2. CSS grid guide'
  });
});

test('the line says what a command is missing, unless the host turns the hint off', async () => {
  const on = renderChat(['unused']);
  const off = renderChat(['unused'], { showHintForMissing: false });

  for (const { chat } of [on, off]) {
    await waitFor(() => expect(chat().line).not.toBeNull());
    await act(async () => chat().line.change('search grid with', 16));
  }

  expect(on.chat().rows.some((row) => row.missing)).toBe(true);
  expect(off.chat().rows.some((row) => row.disabled)).toBe(false);
});

test('the line stops following the app when the chat unmounts', async () => {
  const { chat, hook, runtime } = renderChat(['unused']);
  await waitFor(() => expect(chat().line).not.toBeNull());
  const { line } = chat();
  await act(async () => line.change('next', 4));
  const before = line.getState();

  hook.unmount();
  await runtime.runTool({ toolName: 'preview', input: { result: '1' } });

  expect(line.getState()).toBe(before);
});

test('a tool call whose app run fails goes back to the model as an error, and the chat goes on', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const { chat, requests } = renderChat(
    [{ toolCalls: [{ toolName: 'search', input: { term: 'grid' } }] }, 'That failed', 'Still here'],
    {},
    makeSearchRuntime({ failSearch: true })
  );

  await type(chat, 'search for grid', SEND);
  await waitFor(() => expect(requests).toHaveLength(2));
  await waitFor(() => expect(chat().status).toBe('ready'));
  await type(chat, 'are you there', SEND);
  await waitFor(() => expect(requests).toHaveLength(3));
  await waitFor(() => expect(chat().status).toBe('ready'));

  expect(toolPartsOf(chat().messages)[0]).toMatchObject({
    state: 'output-error',
    errorText: '"search" failed: app exploded'
  });
  expect(partsOf(chat().messages).at(-1)).toMatchObject({ type: 'text', text: 'Still here' });
  expect(console.error).toHaveBeenCalledWith('Intention "search" failed', expect.anything());
  vi.restoreAllMocks();
});

test('a new body is followed by the next request', async () => {
  const { chat, hook, requests, runtime, transport } = renderChat(['One', 'Two'], {
    body: { model: 'small' }
  });

  await type(chat, 'hello', SEND);
  await waitFor(() => expect(chat().status).toBe('ready'));
  hook.rerender({ runtime, transport, body: { model: 'big' } });
  await type(chat, 'again', SEND);
  await waitFor(() => expect(requests).toHaveLength(2));

  expect(requests.map((request) => request.model)).toEqual(['small', 'big']);
});

test('a new runtime or transport is followed by the next request', async () => {
  const { chat, hook, requests, transport } = renderChat(['One', 'Two']);
  const previewing = makeSearchRuntime();
  await previewing.runtime.runTool({ toolName: 'preview', input: { result: '1' } });
  const other = makeRouteTransport(makeScriptedModel(['Three']));

  hook.rerender({ runtime: previewing.runtime, transport });
  await type(chat, 'hello', SEND);
  await waitFor(() => expect(chat().status).toBe('ready'));
  hook.rerender({ runtime: previewing.runtime, transport: other.transport });
  await type(chat, 'again', SEND);
  await waitFor(() => expect(other.requests).toHaveLength(1));

  expect(toolNamesOf(requests[0])).toEqual(['next', 'closePreview']);
  expect(requests).toHaveLength(1);
});
