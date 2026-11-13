// Checks the hand-written declarations against how an app and a route use them, by the package's own name, so
// `exports` resolves them as it would for an adopter. `pnpm verify` runs it (`types:check`).
import { buildCatalogRuntime, type ChatLineRow, loadCatalog } from '@shortround/core';
import {
  CHAT_SLOT_NAMES,
  type ChatComponents,
  IntentionChat,
  type IntentionChatBody,
  type IntentionChatOptions,
  makeIntentionChat,
  type SendAutomaticallyWhen,
  type ToolRunState,
  useIntentionChat
} from '@shortround/chat';
import {
  INTENTION_CHAT_SYSTEM_PROMPT,
  type IntentionChatRequest,
  intentionErrorText,
  intentionModelMessages,
  intentionToolSet,
  intentionToolsSchema,
  parseIntentionChatRequest
} from '@shortround/chat/server';
import type { Chat } from '@ai-sdk/react';
import type { IntentionTool } from '@shortround/core';
import { DefaultChatTransport, streamText, type LanguageModel, type UIMessage } from 'ai';

declare const catalogText: string;
const runtime = buildCatalogRuntime(loadCatalog(catalogText, {}));
const transport = new DefaultChatTransport({ api: '/api/chat' });

// An app's chat, with the model the user chose sent on every request.
export const chat = () => <IntentionChat body={() => ({ model: 'big' })} runtime={runtime} transport={transport} />;
export const chatWithoutHints = () => (
  <IntentionChat
    placeholder="Ask about your todos"
    runtime={runtime}
    showHintForMissing={false}
    transport={transport}
  />
);

// A host drawing its own UI from the hook.
export function useOwnChat() {
  const body: IntentionChatBody = { model: 'big' };
  const options: IntentionChatOptions = { runtime, transport, body, showHintForMissing: true };
  const { messages, status, error, line, lineState, rows, sendText, stop } = useIntentionChat(options);
  const failure: string | undefined = error?.message;
  const highlighted: number | undefined = line?.defaultHighlightIndex(rows);
  const firstRow: ChatLineRow | undefined = rows[0];
  const caret: number | undefined = lineState?.caret;
  line?.change('search grid');
  void sendText('hello');
  void stop();
  return { count: messages.length, status, firstRow, caret, failure, highlighted };
}

const capTurn: SendAutomaticallyWhen = ({ messages }) => messages.length < 20;
const heldChat: Chat<UIMessage> = makeIntentionChat({
  runtime,
  transport,
  body: () => ({ model: 'big' }),
  id: 'workspace-1',
  messages: [],
  sendAutomaticallyWhen: capTurn,
  onFinish: () => {}
});
void heldChat.sendMessage({ text: 'The run ended', metadata: { source: 'app' } });
heldChat.messages = [];
export const heldStatus: string = heldChat.status;
export const drawnHeldChat = () => <IntentionChat chat={heldChat} />;
export function useMixedChat() {
  // @ts-expect-error a held chat brings its own runtime
  return useIntentionChat({ chat: heldChat, runtime });
}
export function useHeldChat() {
  const { messages, runtime: heldRuntime } = useIntentionChat({ chat: heldChat, showHintForMissing: false });
  return { count: messages.length, canShare: heldRuntime.isAvailable('share') };
}

// A theme's Chat slots.
const Pass = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
export const chatSlots: ChatComponents = {
  Frame: Pass,
  Transcript: Pass,
  Message: ({ role, message, children }) => (
    <div data-id={message.id} data-role={role}>
      {children}
    </div>
  ),
  Text: Pass,
  IntentionRun: ({ line, message }) => <p>{`${line}: ${message}`}</p>,
  ToolRun: ({ label, state, output, errorText }) => (
    <p data-state={state}>{errorText ?? `${label}: ${JSON.stringify(output)}`}</p>
  ),
  Error: ({ message }) => <p>{message}</p>,
  Composer: ({ rows, input }) => (
    <div>
      {rows}
      {input}
    </div>
  ),
  Row: ({ row, isHighlighted, onChoose }) => (
    <button aria-pressed={isHighlighted} onClick={onChoose} style={{ fontStyle: row.missing ? 'italic' : undefined }}>
      {row.title}
    </button>
  ),
  Input: ({ input }) => <div>{input}</div>
};
export const slotNames: ReadonlyArray<keyof ChatComponents> = CHAT_SLOT_NAMES;
export const refused: ToolRunState = 'refused';

// A route.
declare const model: LanguageModel;
export async function route(body: unknown): Promise<Response> {
  const parsed = parseIntentionChatRequest(body);
  if (!parsed.success) {
    return new Response(parsed.error.message, { status: 400 });
  }
  const request: IntentionChatRequest = parsed.data;
  const result = streamText({
    model,
    system: INTENTION_CHAT_SYSTEM_PROMPT,
    messages: await intentionModelMessages(request.messages),
    tools: intentionToolSet(request.tools)
  });
  return result.toUIMessageStreamResponse({ onError: intentionErrorText });
}

export function checkTools(body: { message: UIMessage; tools?: unknown }): IntentionTool[] | Response {
  const tools = intentionToolsSchema.safeParse(body.tools);
  return tools.success ? tools.data : new Response(tools.error.message, { status: 400 });
}
