import { buildCatalogRuntime, loadCatalog } from '@shortround/core';
import { ShortRoundProvider } from '@shortround/react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';

import {
  click,
  defineCheck,
  expectThat,
  findByHook,
  installJsdomShims,
  pressKey,
  typeInto
} from './check-tools.js';
import { TEST_IDS } from './test-ids.js';

const CHAT_CATALOG = `
version: 3
app: app
states:
  browsing: { start: true, commands: [search, preview, share] }
commands:
  search:
    label: Search
    run: app.search
    params: { term: { label: Search, default: true, argSource: { freeform: true, type: text } } }
  preview:
    label: Show result
    run: app.preview
    params: { result: { label: Result, default: true, argSource: { lookup: app.results } } }
  share:
    label: Share
    run: app.share
    params:
      note: { label: Note, default: true, argSource: { freeform: true, type: text } }
      result: { label: Result, aliases: [result], argSource: { lookup: app.results, current: app.previewed } }
`;

const RESULTS = [
  { value: 'r1', title: '1. Grid layout notes', aliases: ['1'] },
  { value: 'r2', title: '2. CSS grid guide', aliases: ['2'] }
];

const ROUTE_DOWN = 'Contract route is down';

const CHAT_IMPORTERS = {
  chat: () => import('@shortround/chat'),
  server: () => import('@shortround/chat/server'),
  ai: () => import('ai'),
  aiTest: () => import('ai/test')
};

/** The packages the Chat checks render with; a missing one fails with a message that names what to install. */
export async function loadChatModules(importers = CHAT_IMPORTERS) {
  try {
    const [chat, server, ai, aiTest] = await Promise.all([
      importers.chat(),
      importers.server(),
      importers.ai(),
      importers.aiTest()
    ]);
    return { chat, server, ai, aiTest };
  } catch (error) {
    throw new Error(
      `The theme has components.Chat: its checks need @shortround/chat, ai and @ai-sdk/react installed (${error.message})`
    );
  }
}

function makeChatRuntime() {
  const titleOf = (value) => RESULTS.find((result) => result.value === value)?.title ?? value;
  const bindings = {
    app: {
      search: ({ term }) => ({ message: `Searched for ${term}` }),
      preview: ({ result }) => ({ message: `Previewing ${titleOf(result)}` }),
      share: ({ result }) => ({ message: `Shared ${titleOf(result)}` }),
      results: () => RESULTS,
      previewed: () => null
    }
  };
  return buildCatalogRuntime(loadCatalog(CHAT_CATALOG, bindings));
}

const USAGE = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined }
};

function streamPartsOf(turn) {
  if (typeof turn === 'string') {
    return [
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: turn },
      { type: 'text-end', id: 't1' },
      { type: 'finish', finishReason: { unified: 'stop', raw: 'end_turn' }, usage: USAGE }
    ];
  }
  return [
    ...turn.toolCalls.map(({ toolName, input }, index) => ({
      type: 'tool-call',
      toolCallId: `contract-call-${index}`,
      toolName,
      input: JSON.stringify(input)
    })),
    { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_use' }, usage: USAGE }
  ];
}

function makeTransport({ server, ai, aiTest }, turns) {
  const requests = [];
  let turn = 0;
  const model = new aiTest.MockLanguageModelV4({
    doStream: async () => {
      const answer = turns[Math.min(turn, turns.length - 1)];
      turn += 1;
      return { stream: aiTest.convertArrayToReadableStream(streamPartsOf(answer)) };
    }
  });
  const route = async (body) => {
    const parsed = server.parseIntentionChatRequest(body);
    const result = ai.streamText({
      model,
      messages: await server.intentionModelMessages(parsed.data.messages),
      tools: server.intentionToolSet(parsed.data.tools)
    });
    return result.toUIMessageStreamResponse({ onError: server.intentionErrorText });
  };
  const transport = new ai.DefaultChatTransport({
    api: '/contract/chat',
    fetch: async (url, init) => {
      requests.push(init.body);
      return turns.length
        ? route(JSON.parse(init.body))
        : new Response(ROUTE_DOWN, { status: 500 });
    }
  });
  return { transport, requests };
}

async function withChat(theme, exercise, { turns = ['Contract reply'] } = {}) {
  installJsdomShims();
  const modules = await loadChatModules();
  const runtime = makeChatRuntime();
  const { transport, requests } = makeTransport(modules, turns);
  render(
    createElement(
      ShortRoundProvider,
      { theme },
      createElement(modules.chat.IntentionChat, { runtime, transport })
    )
  );
  try {
    await exercise({ runtime, requests });
  } finally {
    cleanup();
  }
}

const chatInput = (slot) => findByHook(TEST_IDS.chatInput, `${slot}: (precondition) Chat.Input`);

async function send(slot, text) {
  await typeInto(chatInput(slot), text);
  await pressKey(chatInput(slot), 'Enter', { metaKey: true });
}

const isShown = (text) => document.body.textContent.includes(text);

async function expectShown(texts, message) {
  await waitFor(() => expectThat(texts.every(isShown), message));
}

const selectedTexts = () =>
  [...document.querySelectorAll('[aria-selected="true"]')].map((element) => element.textContent);

export const CHAT_CHECKS = [
  defineCheck({
    group: 'chat',
    id: 'chat-input',
    slots: ['Chat.Frame', 'Chat.Composer', 'Chat.Input'],
    obligation: "place the chat's input",
    verify: (theme) =>
      withChat(theme, () => {
        findByHook(TEST_IDS.chatInput, 'Chat.Frame, Chat.Composer or Chat.Input');
      })
  }),
  defineCheck({
    group: 'chat',
    id: 'chat-intention-run',
    slots: ['Chat.Transcript', 'Chat.Message', 'Chat.IntentionRun'],
    obligation: "show an intention the user typed: the line and the app's message",
    verify: (theme) =>
      withChat(theme, async () => {
        await typeInto(chatInput('Chat.IntentionRun'), 'search grid');
        await pressKey(chatInput('Chat.IntentionRun'), 'Enter');
        await expectShown(
          ['search grid', 'Searched for grid'],
          'Chat.IntentionRun: the typed line "search grid" and the message "Searched for grid" are not both shown'
        );
      })
  }),
  defineCheck({
    group: 'chat',
    id: 'chat-text',
    slots: ['Chat.Text'],
    obligation: "shows the user's text, and the assistant's text as rendered",
    verify: (theme) =>
      withChat(
        theme,
        async () => {
          await send('Chat.Text', 'contract hello');
          await waitFor(() =>
            expectThat(
              isShown('contract hello') &&
                [...document.querySelectorAll('strong')].some((node) => node.textContent === 'Hi'),
              'Chat.Text: the user\'s "contract hello" and the assistant\'s rendered "**Hi** there" (a <strong>Hi</strong>) are not both shown'
            )
          );
        },
        { turns: ['**Hi** there'] }
      )
  }),
  defineCheck({
    group: 'chat',
    id: 'chat-tool-done',
    slots: ['Chat.ToolRun'],
    obligation: "shows the app's answer to an intention the model ran",
    verify: (theme) =>
      withChat(
        theme,
        async () => {
          await send('Chat.ToolRun', 'open the first one');
          await expectShown(
            ['Previewing 1. Grid layout notes'],
            'Chat.ToolRun: the answer "Previewing 1. Grid layout notes" is not shown'
          );
        },
        { turns: [{ toolCalls: [{ toolName: 'preview', input: { result: '1' } }] }, 'Opened'] }
      )
  }),
  defineCheck({
    group: 'chat',
    id: 'chat-tool-label',
    slots: ['Chat.ToolRun'],
    obligation: 'shows an intention the model ran by its label, as the user knows it',
    verify: (theme) =>
      withChat(
        theme,
        async () => {
          await send('Chat.ToolRun', 'open the first one');
          await expectShown(
            ['Show result'],
            'Chat.ToolRun: the tool "preview" is not shown by its label "Show result"'
          );
        },
        { turns: [{ toolCalls: [{ toolName: 'preview', input: { result: '1' } }] }, 'Opened'] }
      )
  }),
  defineCheck({
    group: 'chat',
    id: 'chat-tool-refused',
    slots: ['Chat.ToolRun'],
    obligation: 'shows why the app refused an intention the model asked for',
    verify: async (theme) => {
      const call = { toolName: 'preview', input: { result: '9' } };
      const { errorText } = await makeChatRuntime().runTool(call);
      await withChat(
        theme,
        async () => {
          await send('Chat.ToolRun', 'open the ninth one');
          await expectShown([errorText], `Chat.ToolRun: the refusal "${errorText}" is not shown`);
        },
        { turns: [{ toolCalls: [call] }, 'Sorry'] }
      );
    }
  }),
  defineCheck({
    group: 'chat',
    id: 'chat-error',
    slots: ['Chat.Error'],
    obligation: "shows a failed request's message",
    verify: (theme) =>
      withChat(
        theme,
        async () => {
          await send('Chat.Error', 'contract hello');
          await expectShown([ROUTE_DOWN], `Chat.Error: the failure "${ROUTE_DOWN}" is not shown`);
        },
        { turns: [] }
      )
  }),
  defineCheck({
    group: 'chat',
    id: 'chat-row-shows',
    slots: ['Chat.Row'],
    obligation: "shows each row's title and subtitle",
    verify: (theme) =>
      withChat(theme, async () => {
        await typeInto(chatInput('Chat.Row'), 'share hello');
        await expectShown(
          ['Missing result', 'Send as chat'],
          'Chat.Row: the subtitle "Missing result" and the title "Send as chat" are not both shown'
        );
      })
  }),
  defineCheck({
    group: 'chat',
    id: 'chat-row-chooses',
    slots: ['Chat.Row'],
    obligation: 'a click on a row chooses it',
    verify: (theme) =>
      withChat(theme, async ({ requests }) => {
        await typeInto(chatInput('Chat.Row'), 'contract hello');
        await click(screen.getByText('Send as chat'));
        await waitFor(() =>
          expectThat(
            requests.length === 1,
            'Chat.Row: a click on the "Send as chat" row did not send the line'
          )
        );
      })
  }),
  defineCheck({
    group: 'chat',
    id: 'chat-row-highlight',
    slots: ['Chat.Row'],
    obligation: 'marks the row Enter acts on as aria-selected, and follows the arrows',
    verify: (theme) =>
      withChat(theme, async () => {
        await typeInto(chatInput('Chat.Row'), 'se');
        const first = selectedTexts();
        await pressKey(chatInput('Chat.Row'), 'ArrowDown');
        const second = selectedTexts();
        expectThat(
          first.length === 1 &&
            first[0].includes('search') &&
            second.length === 1 &&
            second[0].includes('Send as chat'),
          'Chat.Row: the highlighted row is not the one element with aria-selected="true" (first "search", then "Send as chat" after ArrowDown)'
        );
      })
  })
];
