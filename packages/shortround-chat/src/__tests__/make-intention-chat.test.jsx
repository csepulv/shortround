import { buildCatalogRuntime, loadCatalog } from '@shortround/core';
import { act, renderHook, waitFor } from '@testing-library/react';
import { lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { StrictMode } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { makeIntentionChat } from '../make-intention-chat.js';
import { useIntentionChat } from '../use-intention-chat.js';
import { makeRouteTransport, makeStoringRouteTransport, toolNamesOf } from './helpers/route.js';
import { makeScriptedModel, userSays } from './helpers/scripted-model.js';
import { makeSearchRuntime } from './helpers/search-runtime.js';

const SEND = { key: 'Enter', metaKey: true };
const partsOf = (messages) => messages.flatMap((message) => message.parts);
const toolPartsOf = (messages) => partsOf(messages).filter((part) => part.type.startsWith('tool-'));

const SAVED = [
  userSays('what can I do here?', 'saved-1'),
  { id: 'saved-2', role: 'assistant', parts: [{ type: 'text', text: 'Search or preview.' }] }
];

function makeHeldChat(turns, options = {}, app = makeSearchRuntime()) {
  const { transport, requests } = makeRouteTransport(makeScriptedModel(turns));
  const chat = makeIntentionChat({ runtime: app.runtime, transport, ...options });
  return { chat, requests, ...app };
}

function renderHeld(chat, options = {}) {
  const hook = renderHook((props) => useIntentionChat(props), {
    initialProps: { chat, ...options }
  });
  return { hook, state: () => hook.result.current };
}

async function type(state, text, key = { key: 'Enter' }) {
  await waitFor(() => expect(state().line).not.toBeNull());
  await act(async () => {
    state().line.change(text, text.length);
  });
  await act(async () => {
    await state().line.pressKey(key);
  });
}

describe('a chat the host makes and holds', () => {
  test('starts from saved messages, and a typed line runs an intention into it', async () => {
    const { chat, log, requests } = makeHeldChat(['unused'], {
      messages: SAVED,
      id: 'workspace-1'
    });
    const { state } = renderHeld(chat);

    await type(state, 'search grid');

    expect(chat.id).toBe('workspace-1');
    expect(
      state()
        .messages.map((message) => message.id)
        .slice(0, 2)
    ).toEqual(['saved-1', 'saved-2']);
    expect(state().messages.at(-1)).toMatchObject({
      role: 'user',
      parts: [
        { type: 'data-intention', data: { line: 'search grid', message: 'Searched for grid' } }
      ]
    });
    expect(log).toEqual(['search.apply({"term":"grid"})']);
    expect(requests).toEqual([]);
  });

  test("runs the model's tool calls in the app and continues with the new state's tools", async () => {
    const { chat, requests, log } = makeHeldChat([
      { toolCalls: [{ toolName: 'preview', input: { result: '1' } }] },
      'Previewing it'
    ]);
    const { state } = renderHeld(chat);

    await type(state, 'preview the first one', SEND);
    await waitFor(() => expect(requests).toHaveLength(2));
    await waitFor(() => expect(state().status).toBe('ready'));

    expect(log).toEqual(['results.preview({"result":"w1"})']);
    expect(requests.map(toolNamesOf)).toEqual([
      ['search', 'preview'],
      ['next', 'closePreview']
    ]);
    expect(partsOf(state().messages).at(-1)).toMatchObject({ type: 'text', text: 'Previewing it' });
  });

  test("a message the host sends with metadata carries the tools and the host's body", async () => {
    const { chat, requests } = makeHeldChat(['Noted'], { body: () => ({ model: 'small' }) });
    const { state } = renderHeld(chat);

    await act(async () => {
      await chat.sendMessage({ text: 'The run ended', metadata: { source: 'app' } });
    });
    await waitFor(() => expect(state().status).toBe('ready'));

    expect(requests[0].model).toBe('small');
    expect(toolNamesOf(requests[0])).toEqual(['search', 'preview']);
    expect(state().messages[0]).toMatchObject({ role: 'user', metadata: { source: 'app' } });
  });

  test('emptied by the host, the drawn conversation empties too', async () => {
    const { chat } = makeHeldChat(['unused'], { messages: SAVED });
    const { state } = renderHeld(chat);

    act(() => {
      chat.messages = [];
    });

    expect(state().messages).toEqual([]);
  });

  test('swapped for another, the hook draws that one, and the first keeps its messages', async () => {
    const first = makeHeldChat(['unused'], { messages: SAVED });
    const second = makeHeldChat(['unused'], { messages: [userSays('workspace 2', 's-1')] });
    const { hook, state } = renderHeld(first.chat);

    hook.rerender({ chat: second.chat });
    await type(state, 'search grid');

    expect(state().messages.map((message) => message.id)[0]).toBe('s-1');
    expect(second.log).toEqual(['search.apply({"term":"grid"})']);
    expect(first.chat.messages).toHaveLength(2);
  });

  test("a typed run's message takes its id from the host's generateId", async () => {
    let count = 0;
    const { chat } = makeHeldChat(['unused'], { generateId: () => `host-${(count += 1)}` });
    const { state } = renderHeld(chat);

    await type(state, 'search grid');

    expect(state().messages.at(-1).id).toMatch(/^host-\d+$/);
  });

  test('a typed run that returns output keeps it in its part, beside the message', async () => {
    const app = makeSearchRuntime({ searchOutput: { total: 2 } });
    const { chat } = makeHeldChat(['unused'], {}, app);
    const { state } = renderHeld(chat);

    await type(state, 'search grid');

    expect(state().messages.at(-1).parts[0].data).toEqual({
      line: 'search grid',
      message: 'Searched for grid',
      output: { total: 2 }
    });
  });
});

describe('what the factory and the hook refuse', () => {
  test('a chat the factory did not make', async () => {
    const { Chat } = await import('@ai-sdk/react');
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHeld(new Chat({}))).toThrow(
      "useIntentionChat: this chat wasn't made by makeIntentionChat, so it has no runtime or tools"
    );
  });

  test('a chat with a runtime, transport or body beside it', () => {
    const { chat, runtime } = makeHeldChat(['unused']);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHeld(chat, { runtime, body: {} })).toThrow(
      'useIntentionChat: pass chat alone; it already has its runtime, transport and body. Drop: runtime, body'
    );
  });

  test('an onToolCall of its own, since the package runs the tools', () => {
    const { runtime } = makeSearchRuntime();
    const { transport } = makeRouteTransport(makeScriptedModel(['unused']));

    expect(() => makeIntentionChat({ runtime, transport, onToolCall: () => {} })).toThrow(
      "makeIntentionChat: onToolCall is the package's (it runs the app's intentions); leave it out"
    );
  });

  test('a chat prop that holds nothing yet, as while the host loads, rather than falling back to props', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useIntentionChat({ chat: undefined }))).toThrow(
      'useIntentionChat: pass chat (from makeIntentionChat), or runtime and transport'
    );
  });

  test('a held chat replaced by nothing', () => {
    const { chat } = makeHeldChat(['unused']);
    const { hook } = renderHeld(chat);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => hook.rerender({ chat: undefined })).toThrow(
      'useIntentionChat: pass chat (from makeIntentionChat), or runtime and transport'
    );
  });

  test.each([
    ['runtime', { transport: {} }],
    ['transport', { runtime: makeSearchRuntime().runtime }],
    ['runtime, transport', {}]
  ])('a factory call missing %s', (missing, options) => {
    expect(() => makeIntentionChat(options)).toThrow(
      `makeIntentionChat: needs runtime (from buildCatalogRuntime) and transport; missing: ${missing}`
    );
  });

  afterEach(() => vi.restoreAllMocks());
});

describe('a route that keeps the conversation and receives only what it lacks', () => {
  test("gets each typed run before the user's next message, so the model hears its output", async () => {
    const model = makeScriptedModel(['Two of them']);
    const { transport, requests, stored } = makeStoringRouteTransport(model);
    const app = makeSearchRuntime({ searchOutput: { total: 2 } });
    const chat = makeIntentionChat({ runtime: app.runtime, transport });
    const { state } = renderHeld(chat);

    await type(state, 'search grid');
    await type(state, 'how many were there?', SEND);
    await waitFor(() => expect(state().status).toBe('ready'));

    expect(requests[0].messages.map((message) => message.parts[0].type)).toEqual([
      'data-intention',
      'text'
    ]);
    expect(JSON.stringify(model.doStreamCalls[0].prompt)).toContain(
      'The user ran \\"search grid\\": {\\"total\\":2}'
    );
    expect(stored().map((message) => message.role)).toEqual(['user', 'user', 'assistant']);
  });

  test("runs the model's tool call and continues, sending the answered call back", async () => {
    const model = makeScriptedModel([
      { toolCalls: [{ toolName: 'preview', input: { result: '1' } }] },
      'Previewing it'
    ]);
    const { transport, requests, stored } = makeStoringRouteTransport(model);
    const app = makeSearchRuntime();
    const chat = makeIntentionChat({ runtime: app.runtime, transport });
    const { state } = renderHeld(chat);

    await type(state, 'open the first one', SEND);
    await waitFor(() => expect(requests).toHaveLength(2));
    await waitFor(() => expect(state().status).toBe('ready'));

    expect(app.log).toEqual(['results.preview({"result":"w1"})']);
    expect(requests[1].messages).toHaveLength(1);
    expect(toolPartsOf(requests[1].messages)[0]).toMatchObject({
      state: 'output-available',
      output: 'Previewing 1. Grid layout notes'
    });
    expect(partsOf(stored()).at(-1)).toMatchObject({ type: 'text', text: 'Previewing it' });
  });

  test('refuses a request whose tools are malformed', async () => {
    const { transport } = makeStoringRouteTransport(makeScriptedModel(['never']));
    const response = await transport
      .sendMessages({
        chatId: 'c',
        messages: [userSays('hi')],
        abortSignal: undefined,
        body: { tools: [{ name: 'search' }] },
        trigger: 'submit-message'
      })
      .catch((error) => error);

    expect(response).toBeInstanceOf(Error);
    expect(response.message).toContain('description');
  });
});

describe('a catalog with a name that cannot be a tool name', () => {
  afterEach(() => vi.restoreAllMocks());

  test('the chat still makes its request, without that tool, and the command still runs typed', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = [];
    const runtime = buildCatalogRuntime(
      loadCatalog(
        `
version: 3
app: app
states:
  s: { start: true, commands: [search, notes.archive] }
commands:
  search: { label: Search, run: app.search, params: {} }
  notes.archive: { label: Archive note, run: app.archive, params: {} }
`,
        { app: { search: () => ({}), archive: () => log.push('archive') } }
      )
    );
    const { transport, requests } = makeRouteTransport(makeScriptedModel(['Hello']));
    const { state } = renderHeld(makeIntentionChat({ runtime, transport }));

    await type(state, 'archive note');
    await type(state, 'hello', SEND);
    await waitFor(() => expect(state().status).toBe('ready'));

    expect(requests[0].tools.map((tool) => tool.name)).toEqual(['search']);
    expect(partsOf(state().messages).at(-1)).toMatchObject({ type: 'text', text: 'Hello' });
    expect(log).toEqual(['archive']);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});

const capAt =
  (count) =>
  ({ messages }) =>
    lastAssistantMessageIsCompleteWithToolCalls({ messages }) &&
    toolPartsOf(messages.slice(messages.findLastIndex((message) => message.role === 'user') + 1))
      .length < count;

describe('continuing after tool calls', () => {
  const callsSearch = { toolCalls: [{ toolName: 'search', input: { term: 'grid' } }] };

  test("a host's sendAutomaticallyWhen caps a turn", async () => {
    const { chat, requests } = makeHeldChat([callsSearch, callsSearch, callsSearch, 'Done'], {
      sendAutomaticallyWhen: capAt(2)
    });
    const { state } = renderHeld(chat);

    await type(state, 'keep searching', SEND);
    await waitFor(() => expect(requests).toHaveLength(2));
    await waitFor(() => expect(state().status).toBe('ready'));
    await waitFor(() => expect(toolPartsOf(state().messages)).toHaveLength(2));

    expect(requests).toHaveLength(2);
  });

  test("the hook's own chat takes the option too", async () => {
    const { runtime } = makeSearchRuntime();
    const { transport, requests } = makeRouteTransport(
      makeScriptedModel([callsSearch, callsSearch, 'Done'])
    );
    const hook = renderHook(() =>
      useIntentionChat({ runtime, transport, sendAutomaticallyWhen: capAt(1) })
    );
    const state = () => hook.result.current;

    await type(state, 'keep searching', SEND);
    await waitFor(() => expect(state().status).toBe('ready'));
    await waitFor(() => expect(toolPartsOf(state().messages)).toHaveLength(1));

    expect(requests).toHaveLength(1);
  });

  test('without one, the chat continues after each completed tool call', async () => {
    const { chat, requests } = makeHeldChat([callsSearch, 'Done']);
    const { state } = renderHeld(chat);

    await type(state, 'search once', SEND);
    await waitFor(() => expect(requests).toHaveLength(2));
    await waitFor(() => expect(state().status).toBe('ready'));

    expect(partsOf(state().messages).at(-1)).toMatchObject({ type: 'text', text: 'Done' });
  });
});

describe('under StrictMode, which runs the unmount cleanup once after mounting', () => {
  test.each([
    ['its own chat', () => ({})],
    ['a host chat', (runtime, transport) => ({ chat: makeIntentionChat({ runtime, transport }) })]
  ])('%s still sends and is answered', async (_, optionsFor) => {
    const { runtime } = makeSearchRuntime();
    const { transport, requests } = makeRouteTransport(makeScriptedModel(['Hello back']));
    const options = optionsFor(runtime, transport);
    const props = options.chat ? options : { runtime, transport };
    const hook = renderHook(() => useIntentionChat(props), { wrapper: StrictMode });
    const state = () => hook.result.current;

    await type(state, 'hello', SEND);
    await waitFor(() => expect(state().status).toBe('ready'));

    expect(requests).toHaveLength(1);
    expect(partsOf(state().messages).at(-1)).toMatchObject({ type: 'text', text: 'Hello back' });
  });
});

describe("the hook's own chat", () => {
  test('stops its stream when the chat unmounts', async () => {
    const signals = [];
    const transport = {
      sendMessages: async ({ abortSignal }) => {
        signals.push(abortSignal);
        return new ReadableStream({ start: () => {} });
      },
      reconnectToStream: async () => null
    };
    const { runtime } = makeSearchRuntime();
    const hook = renderHook(() => useIntentionChat({ runtime, transport }));
    const state = () => hook.result.current;

    await type(state, 'hello', SEND);
    await waitFor(() => expect(signals).toHaveLength(1));
    hook.unmount();

    expect(signals[0].aborted).toBe(true);
  });

  test('stops its stream when a host chat takes its place', async () => {
    const signals = [];
    const transport = {
      sendMessages: async ({ abortSignal }) => {
        signals.push(abortSignal);
        return new ReadableStream({ start: () => {} });
      },
      reconnectToStream: async () => null
    };
    const { runtime } = makeSearchRuntime();
    const hook = renderHook((props) => useIntentionChat(props), {
      initialProps: { runtime, transport }
    });
    const state = () => hook.result.current;

    await type(state, 'hello', SEND);
    await waitFor(() => expect(signals).toHaveLength(1));
    const { chat } = makeHeldChat(['unused']);
    hook.rerender({ chat });

    await waitFor(() => expect(signals[0].aborted).toBe(true));
  });

  test("a host's chat is not stopped when the hook unmounts: the host holds it", async () => {
    const signals = [];
    const transport = {
      sendMessages: async ({ abortSignal }) => {
        signals.push(abortSignal);
        return new ReadableStream({ start: () => {} });
      },
      reconnectToStream: async () => null
    };
    const { runtime } = makeSearchRuntime();
    const chat = makeIntentionChat({ runtime, transport });
    const { hook, state } = renderHeld(chat);

    await type(state, 'hello', SEND);
    await waitFor(() => expect(signals).toHaveLength(1));
    hook.unmount();

    expect(signals[0].aborted).toBe(false);
    await chat.stop();
  });
});
