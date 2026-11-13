// <IntentionChat>: the chat drawn through the theme's Chat slots, driven from the keyboard, against a route built from
// the server helpers and a scripted model.
import { ShortRoundProvider, ShortRoundSidekick } from '@shortround/react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DefaultChatTransport } from 'ai';
import { expect, test, vi } from 'vitest';

import { IntentionChat } from '../IntentionChat.jsx';
import { makeIntentionChat } from '../make-intention-chat.js';
import { makeRouteTransport, toolNamesOf } from './helpers/route.js';
import { makeScriptedModel } from './helpers/scripted-model.js';
import { makeAppHeldRuntime, makeSearchRuntime } from './helpers/search-runtime.js';
import { CHAT_SLOTS, makeTestTheme } from './helpers/test-theme.jsx';

function renderChat(
  turns,
  theme = makeTestTheme(),
  routeTransport = makeRouteTransport(makeScriptedModel(turns))
) {
  const { transport, requests } = routeTransport;
  const { runtime, log } = makeSearchRuntime();
  render(
    <ShortRoundProvider theme={theme}>
      <IntentionChat runtime={runtime} transport={transport} />
    </ShortRoundProvider>
  );
  return { requests, log };
}

const input = () => screen.getByTestId('shortround-chat-input');
const highlightedTitles = () =>
  within(screen.getByTestId('rows'))
    .getAllByRole('button')
    .filter((row) => row.dataset.highlighted === 'true')
    .map((row) => row.textContent);

async function type(text) {
  await waitFor(() => input());
  await act(async () => {
    fireEvent.change(input(), { target: { value: text, selectionStart: text.length } });
  });
}

async function press(key, modifiers = {}) {
  let isDefault;
  await act(async () => {
    isDefault = fireEvent.keyDown(input(), { key, ...modifiers });
  });
  return isDefault;
}

test('CP-9: a typed run, then a message whose tool call runs in the app, through the slots', async () => {
  const { requests, log } = renderChat([
    { toolCalls: [{ toolName: 'preview', input: { result: '1' } }] },
    'Now **previewing** it'
  ]);

  await type('search grid');
  await press('Enter');
  await waitFor(() => screen.getByTestId('intention-run'));
  await type('preview the first one');
  await press('Enter', { metaKey: true });
  await waitFor(() =>
    expect(screen.getByTestId('tool-preview')).toHaveAttribute('data-state', 'done')
  );
  await waitFor(() =>
    expect(screen.getByText('previewing', { selector: 'strong' })).toBeInTheDocument()
  );

  expect(screen.getByTestId('intention-run')).toHaveTextContent('search grid: Searched for grid');
  expect(screen.getByTestId('tool-preview')).toHaveTextContent('Previewing 1. Grid layout notes');
  expect(log).toEqual(['search.apply({"term":"grid"})', 'results.preview({"result":"w1"})']);
  expect(requests.map(toolNamesOf)).toEqual([
    ['search', 'preview'],
    ['next', 'closePreview']
  ]);
});

test('a refused tool call is drawn as refused', async () => {
  renderChat([{ toolCalls: [{ toolName: 'preview', input: { result: 'vue' } }] }, 'Sorry']);

  await type('preview vue');
  await press('Enter', { metaKey: true });

  await waitFor(() =>
    expect(screen.getByTestId('tool-preview')).toHaveAttribute('data-state', 'refused')
  );
  expect(screen.getByTestId('tool-preview')).toHaveTextContent('No Result "vue"');
});

test('the arrows move the highlight, and Enter chooses the highlighted row', async () => {
  const { requests } = renderChat(['Hello']);

  await type('se');
  const highlightedBefore = highlightedTitles();
  await press('ArrowDown');
  const highlightedAfter = highlightedTitles();
  await press('Enter');
  await waitFor(() => expect(requests).toHaveLength(1));

  expect([highlightedBefore, highlightedAfter]).toEqual([['search'], ['Send as chat']]);
});

test('an empty line shows no rows; ArrowDown lists the commands, and Enter puts the chosen one in the line', async () => {
  const { requests } = renderChat(['unused']);
  await waitFor(() => input());
  const rowCountWhenEmpty = screen.getByTestId('rows').children.length;

  await press('ArrowDown');
  const listed = highlightedTitles();
  await press('ArrowDown');
  await press('Enter');

  expect(rowCountWhenEmpty).toBe(0);
  expect(listed).toEqual(['Search']);
  expect(input().value).toBe('preview ');
  expect(requests).toEqual([]);
});

test('the empty input says how to start, in words the host can change', async () => {
  renderChat(['unused']);
  await waitFor(() => input());
  const byDefault = input().placeholder;
  cleanup();

  const { transport } = makeRouteTransport(makeScriptedModel(['unused']));
  render(
    <ShortRoundProvider theme={makeTestTheme()}>
      <IntentionChat
        placeholder="Ask about your todos"
        runtime={makeSearchRuntime().runtime}
        transport={transport}
      />
    </ShortRoundProvider>
  );
  await waitFor(() => input());

  expect(byDefault).toBe('Type a command (↓ or help lists them), or Cmd/Ctrl+Enter to chat');
  expect(input().placeholder).toBe('Ask about your todos');
});

test('Shift+Enter is left to the input, and a line with a break is drawn without line hints', async () => {
  renderChat(['unused']);

  await type('search grid');
  const hasHintsOnOneLine = Boolean(screen.queryByTestId('shortround-line-shadow'));
  const isDefault = await press('Enter', { shiftKey: true });
  await type('search grid\nand more');

  expect(hasHintsOnOneLine).toBe(true);
  expect(isDefault).toBe(true);
  expect(screen.queryByTestId('shortround-line-shadow')).toBeNull();
});

test('a row for what a command is missing reaches the Row slot marked as missing', async () => {
  renderChat(['unused']);

  await type('search grid with');

  expect(screen.getByText('Missing sort')).toHaveAttribute('data-missing', 'true');
});

test('CP-10: with no Chat slots, mounting the chat says so, and the sidekick still works', () => {
  const theme = makeTestTheme(null);
  vi.spyOn(console, 'error').mockImplementation(() => {});

  expect(() => renderChat(['unused'], theme)).toThrow(
    'IntentionChat: the theme has no components.Chat'
  );
  expect(() =>
    render(
      <ShortRoundProvider theme={theme}>
        <ShortRoundSidekick defaultIntentions={[]} />
      </ShortRoundProvider>
    )
  ).not.toThrow();
  vi.restoreAllMocks();
});

test('a Chat group missing a slot names it', () => {
  const withoutRow = { ...CHAT_SLOTS, Row: undefined };
  vi.spyOn(console, 'error').mockImplementation(() => {});

  expect(() => renderChat(['unused'], makeTestTheme(withoutRow))).toThrow(
    'IntentionChat: the theme has no components.Chat.Row'
  );
  vi.restoreAllMocks();
});

test('Enter on a line the chat handles is not left to the textarea', async () => {
  renderChat(['unused']);

  await type('search grid');
  const isDefault = await press('Enter');

  expect(isDefault).toBe(false);
});

test('the chat runs where the page has no scrollIntoView, as in jsdom', async () => {
  const shim = Element.prototype.scrollIntoView;
  delete Element.prototype.scrollIntoView;
  try {
    const { log } = renderChat(['unused']);

    await type('search grid');
    await press('Enter');

    await waitFor(() => expect(log).toEqual(['search.apply({"term":"grid"})']));
    expect(screen.getByTestId('intention-run')).toHaveTextContent('search grid: Searched for grid');
  } finally {
    Element.prototype.scrollIntoView = shim;
  }
});

test('a request that fails is drawn through the Error slot', async () => {
  const failing = {
    transport: new DefaultChatTransport({
      api: '/api/chat',
      fetch: async () => new Response('the route is down', { status: 500 })
    }),
    requests: []
  };
  renderChat([], makeTestTheme(), failing);

  await type('hello');
  await press('Enter', { metaKey: true });

  await waitFor(() =>
    expect(screen.getByTestId('chat-error')).toHaveTextContent('the route is down')
  );
});

test('a call to a tool the model was not offered is drawn as refused, and the model is told why', async () => {
  renderChat([{ toolCalls: [{ toolName: 'launch', input: {} }] }, 'Sorry']);

  await type('launch it');
  await press('Enter', { metaKey: true });

  await waitFor(() =>
    expect(screen.getByTestId('tool-launch')).toHaveAttribute('data-state', 'refused')
  );
  expect(screen.getByTestId('tool-launch')).toHaveTextContent(
    '"launch" is not one of the app’s intentions'
  );
});

test('a typed intention whose app call fails is logged, not left unhandled', async () => {
  const { transport, requests } = makeRouteTransport(makeScriptedModel(['unused']));
  const { runtime } = makeSearchRuntime({ failSearch: true });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  render(
    <ShortRoundProvider theme={makeTestTheme()}>
      <IntentionChat runtime={runtime} transport={transport} />
    </ShortRoundProvider>
  );

  await type('search grid');
  await press('Enter');

  await waitFor(() =>
    expect(console.error).toHaveBeenCalledWith(
      'IntentionChat: a typed intention failed',
      expect.anything()
    )
  );
  expect(requests).toEqual([]);
  vi.restoreAllMocks();
});

test('CP-30: a chat the host holds is drawn from its saved messages, and runs typed lines and tool calls', async () => {
  const { transport, requests } = makeRouteTransport(
    makeScriptedModel([{ toolCalls: [{ toolName: 'preview', input: { result: '1' } }] }, 'Done'])
  );
  const { runtime, log } = makeSearchRuntime();
  const chat = makeIntentionChat({
    runtime,
    transport,
    messages: [
      { id: 'saved-1', role: 'assistant', parts: [{ type: 'text', text: 'Welcome back' }] }
    ]
  });
  render(
    <ShortRoundProvider theme={makeTestTheme()}>
      <IntentionChat chat={chat} />
    </ShortRoundProvider>
  );

  await waitFor(() => expect(screen.getByText('Welcome back')).toBeInTheDocument());
  await type('search grid');
  await press('Enter');
  await type('preview the first one');
  await press('Enter', { metaKey: true });
  await waitFor(() => expect(requests).toHaveLength(2));
  await waitFor(() => expect(screen.getByText('Done')).toBeInTheDocument());

  expect(log).toEqual(['search.apply({"term":"grid"})', 'results.preview({"result":"w1"})']);
  expect(screen.getByTestId('intention-run')).toHaveTextContent('search grid: Searched for grid');
});

test('CP-32: the Message slot gets the message, and ToolRun gets the label and the name', async () => {
  const { transport } = makeRouteTransport(
    makeScriptedModel([
      {
        toolCalls: [
          { toolName: 'preview', input: { result: '1' } },
          { toolName: 'launch', input: {} }
        ]
      },
      'Done'
    ])
  );
  const { runtime } = makeSearchRuntime();
  const chat = makeIntentionChat({ runtime, transport });
  render(
    <ShortRoundProvider theme={makeTestTheme()}>
      <IntentionChat chat={chat} />
    </ShortRoundProvider>
  );

  await act(async () => {
    await chat.sendMessage({ text: 'The run ended', metadata: { source: 'app' } });
  });
  await waitFor(() => expect(screen.getByText('Done')).toBeInTheDocument());

  expect(screen.getAllByTestId('message-user')[0]).toHaveAttribute('data-source', 'app');
  expect(screen.getAllByTestId('message-user')[0]).toHaveAttribute(
    'data-message-id',
    chat.messages[0].id
  );
  expect(screen.getByTestId('tool-preview')).toHaveAttribute('data-label', 'Preview');
  expect(screen.getByTestId('tool-launch')).toHaveAttribute('data-label', 'launch');
});

test("CP-31: a read's output goes to the model, and its message to the user", async () => {
  const { transport, requests } = makeRouteTransport(
    makeScriptedModel([{ toolCalls: [{ toolName: 'search', input: { term: 'grid' } }] }, 'Two'])
  );
  const { runtime } = makeSearchRuntime({ searchOutput: { total: 2 } });
  render(
    <ShortRoundProvider theme={makeTestTheme()}>
      <IntentionChat runtime={runtime} transport={transport} />
    </ShortRoundProvider>
  );

  await type('search grid');
  await press('Enter');
  await type('how many were there?');
  await press('Enter', { metaKey: true });
  await waitFor(() => expect(requests).toHaveLength(2));
  await waitFor(() => expect(screen.getByText('Two')).toBeInTheDocument());

  expect(screen.getByTestId('intention-run')).toHaveTextContent('search grid: Searched for grid');
  expect(screen.getByTestId('tool-search')).toHaveTextContent('{"total":2}');
  const toolPart = requests[1].messages
    .flatMap((message) => message.parts)
    .find((part) => part.type === 'tool-search');
  expect(toolPart.output).toEqual({ total: 2 });
});

const SAVED = [
  { id: 'saved-1', role: 'user', parts: [{ type: 'text', text: 'Earlier question' }] },
  { id: 'saved-2', role: 'assistant', parts: [{ type: 'text', text: 'Earlier answer' }] }
];

function renderHeldChat(chat) {
  const view = render(
    <ShortRoundProvider theme={makeTestTheme()}>
      <IntentionChat chat={chat} />
    </ShortRoundProvider>
  );
  const rerenderWith = (next) =>
    view.rerender(
      <ShortRoundProvider theme={makeTestTheme()}>
        <IntentionChat chat={next} />
      </ShortRoundProvider>
    );
  return { rerenderWith };
}

test('a chat made at once and filled when the saved messages arrive keeps what was typed, without remounting', async () => {
  const { transport } = makeRouteTransport(makeScriptedModel(['unused']));
  const chat = makeIntentionChat({ runtime: makeSearchRuntime().runtime, transport });
  renderHeldChat(chat);

  await type('search grid');
  await press('Enter');
  await waitFor(() => screen.getByTestId('intention-run'));
  await type('prev');
  const inputBefore = input();
  await act(async () => {
    chat.messages = [...SAVED, ...chat.messages];
  });

  expect(screen.getByTestId('transcript')).toHaveTextContent(
    'Earlier questionEarlier answersearch grid: Searched for grid'
  );
  expect(input()).toBe(inputBefore);
  expect(input().value).toBe('prev');
});

test('emptied by the host, and swapped for a chat over another runtime, the component follows without remounting', async () => {
  const { transport } = makeRouteTransport(makeScriptedModel(['unused']));
  const first = makeIntentionChat({
    runtime: makeSearchRuntime().runtime,
    transport,
    messages: SAVED
  });
  const held = makeAppHeldRuntime();
  const second = makeIntentionChat({ runtime: held.runtime, transport });
  const { rerenderWith } = renderHeldChat(first);
  await waitFor(() => input());
  const inputBefore = input();

  await act(async () => {
    first.messages = [];
  });
  const emptied = screen.getByTestId('transcript').textContent;
  rerenderWith(second);
  held.app.previewedId = 'w1';
  await act(async () => held.runtime.notify());
  await type('share hello');
  await press('Enter');
  await waitFor(() => screen.getByTestId('intention-run'));

  expect(emptied).toBe('');
  expect(input()).toBe(inputBefore);
  expect(held.log).toEqual(['share({"note":"hello","result":"w1"})']);
  expect(second.messages).toHaveLength(1);
  expect(first.messages).toEqual([]);
});

test('the component refuses a chat the factory did not make, and a chat with a runtime beside it', async () => {
  const { Chat } = await import('@ai-sdk/react');
  const { transport } = makeRouteTransport(makeScriptedModel(['unused']));
  const { runtime } = makeSearchRuntime();
  const held = makeIntentionChat({ runtime, transport });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const renderWith = (props) =>
    render(
      <ShortRoundProvider theme={makeTestTheme()}>
        <IntentionChat {...props} />
      </ShortRoundProvider>
    );

  expect(() => renderWith({ chat: new Chat({}) })).toThrow(
    "useIntentionChat: this chat wasn't made by makeIntentionChat"
  );
  expect(() => renderWith({ chat: held, runtime })).toThrow(
    'useIntentionChat: pass chat alone; it already has its runtime, transport and body. Drop: runtime'
  );
  expect(() => renderWith({ chat: undefined })).toThrow(
    'useIntentionChat: pass chat (from makeIntentionChat), or runtime and transport'
  );
  vi.restoreAllMocks();
});

function renderAppHeldChat() {
  const { transport } = makeRouteTransport(makeScriptedModel(['unused']));
  const held = makeAppHeldRuntime();
  render(
    <ShortRoundProvider theme={makeTestTheme()}>
      <IntentionChat runtime={held.runtime} transport={transport} />
    </ShortRoundProvider>
  );
  return held;
}

test('no row is drawn highlighted while the top command misses a value the app holds', async () => {
  renderAppHeldChat();

  await type('share hello');

  expect(highlightedTitles()).toEqual([]);
});

test('a highlight the arrows moved leaves a row that has become disabled', async () => {
  const { app, runtime } = renderAppHeldChat();
  app.previewedId = 'w1';
  await act(async () => runtime.notify());

  await type('share hello');
  await press('ArrowDown');
  await press('ArrowUp');
  const movedTo = highlightedTitles();
  app.previewedId = null;
  await act(async () => runtime.notify());

  expect(movedTo).toEqual(['Note: hello']);
  expect(highlightedTitles()).toEqual([]);
});
