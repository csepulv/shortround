// @shortround/chat's types: the chat over a catalog runtime, and the Chat slot group a theme provides.
import type {
  CatalogIntention,
  CatalogRuntime,
  ChatLine,
  ChatLineRow,
  CommandLineState
} from '@shortround/core';
import type { Chat } from '@ai-sdk/react';
import type { ChatInit, ChatStatus, ChatTransport, UIMessage } from 'ai';
import type { ComponentType, JSX, ReactNode } from 'react';

/** What the host passes with every request besides the messages and the tools: an object, or a function per request. */
export type IntentionChatBody = Record<string, unknown> | (() => Record<string, unknown>);

/** When the chat sends again by itself after tool calls; the default is once every call has its answer. */
export type SendAutomaticallyWhen = NonNullable<ChatInit<UIMessage>['sendAutomaticallyWhen']>;

/** What the chat is made with: the app's runtime, the host's transport, and what each request carries. */
export interface IntentionChatWiring {
  /** The app's catalog at run time (`buildCatalogRuntime` from `@shortround/core`). */
  runtime: CatalogRuntime;
  /** The host's AI SDK transport, such as `new DefaultChatTransport({ api: '/api/chat' })`. */
  transport: ChatTransport<UIMessage>;
  /** Sent with every request, such as the model the user chose; the intentions, as tools, are added to it. */
  body?: IntentionChatBody;
  /**
   * When to send again after tool calls (default `lastAssistantMessageIsCompleteWithToolCalls` from `ai`), such as one
   * that also stops after so many calls in a turn.
   */
  sendAutomaticallyWhen?: SendAutomaticallyWhen;
}

/**
 * An AI SDK `Chat` over a catalog runtime, for a host that holds the conversation itself (in a store, outside React).
 * The model's tool calls run in the app through `runtime.runTool` (one whose app run fails goes back to the model as an
 * error); every request carries every intention as a tool (the ones not available at that moment marked so), plus
 * `body`; the chat continues after tool calls while `sendAutomaticallyWhen` says so. It throws without `runtime` or
 * `transport`. Every other `Chat` option (`id`, `messages`, `onFinish`, `generateId`, `messageMetadataSchema`, …)
 * passes through, and a typed intention's message takes its id from `generateId` too; `onToolCall` is the package's,
 * and passing one throws. The host sends, reads and empties the chat with the AI SDK's own API
 * (`chat.sendMessage({ text, metadata })`, `chat.status`, `chat.messages = []`). Draw it with
 * `useIntentionChat({ chat })` or `<IntentionChat chat={chat} />`.
 */
export function makeIntentionChat(
  options: IntentionChatWiring & Omit<ChatInit<UIMessage>, 'transport' | 'sendAutomaticallyWhen' | 'onToolCall'>
): Chat<UIMessage>;

export type IntentionChatOptions = (
  | (IntentionChatWiring & { chat?: undefined })
  | {
      /**
       * A chat from `makeIntentionChat`, which the host holds; it brings its runtime, transport and body, so passing
       * those too throws, as does a chat `makeIntentionChat` didn't make.
       */
      chat: Chat<UIMessage>;
      runtime?: undefined;
      transport?: undefined;
      body?: undefined;
      sendAutomaticallyWhen?: undefined;
    }
) & {
  /** Whether rows say what a command is missing (default `true`); off, those rows are hidden. */
  showHintForMissing?: boolean;
};

/**
 * The chat's state: the AI SDK conversation, and a line that runs the app's intentions as typed or sends the line to
 * the model. Given a `chat` from `makeIntentionChat`, it draws that one, which the host holds; given a `runtime` and a
 * `transport`, it makes its own and stops it on unmount or when a `chat` takes its place. Given neither (such as
 * `chat={undefined}` while the host loads), it throws, naming what to pass. Every request, including the one that
 * continues after a tool runs, carries every intention as a tool, the ones not available at that moment marked so.
 * The model's tool calls run in the app through `runtime.runTool`; one whose app run fails goes back to the model as
 * an error. A typed run joins the conversation as
 * a `data-intention` part (`{ line, message }`, with `output` when the run returned one other than `null`), which
 * `@shortround/chat/server` tells the model. A new `runtime`, `transport` or `body` is followed by the next request; a
 * new `runtime` or `showHintForMissing` starts a new, empty line. A new `chat` is drawn at once, and the line's runs
 * join it.
 */
export function useIntentionChat(options: IntentionChatOptions): {
  messages: UIMessage[];
  status: ChatStatus;
  error: Error | undefined;
  /** The runtime the chat runs intentions in: the one given, or the one `makeIntentionChat` made the chat with. */
  runtime: CatalogRuntime;
  /** The chat line; `null` on the first render, before it is made. */
  line: ChatLine | null;
  /** The line as the input draws it (`drawnLineState`); `null` while there is no line. */
  lineState: CommandLineState | null;
  rows: ChatLineRow[];
  /** Sends text to the model, as "Send as chat" does, but leaves the line as it is. */
  sendText: (text: string) => Promise<void>;
  stop: () => Promise<void>;
};

/**
 * The chat drawn through the nearest `ShortRoundProvider`'s `components.Chat`. It throws, naming what is missing, when
 * the theme has no Chat group or the group lacks a slot. It draws inside the box its host gives it; whether it fills
 * that box is the theme's `Frame` slot's (`@shortround/mui`'s does).
 */
export function IntentionChat(
  props: IntentionChatOptions & {
    /**
     * What the empty input says. Default: "Type a command (↓ or help lists them), or Cmd/Ctrl+Enter to chat".
     */
    placeholder?: string;
  }
): JSX.Element;

/** The names of the slots a theme's `components.Chat` provides. */
export const CHAT_SLOT_NAMES: ReadonlyArray<keyof ChatComponents>;

/** A tool run's state as a theme sees it: still running, answered, or refused by the app. */
export type ToolRunState = 'running' | 'done' | 'refused';

/**
 * The slots a theme provides as `components.Chat`. They only draw; the chat owns the keys, the highlight, scrolling and
 * Markdown.
 */
export interface ChatComponents {
  /** The chat's box: the transcript, then the composer. */
  Frame: ComponentType<{ children: ReactNode }>;
  /** The messages, then an end marker the chat scrolls into view as messages arrive. */
  Transcript: ComponentType<{ children: ReactNode }>;
  /** One message and its parts; `message` is the whole message, for its `id` and `metadata`. */
  Message: ComponentType<{ role: UIMessage['role']; message: UIMessage; children: ReactNode }>;
  /** Text: the user's as typed; the assistant's already rendered as Markdown (with GitHub's extensions). */
  Text: ComponentType<{ role: UIMessage['role']; children: ReactNode }>;
  /** An intention the user ran by typing it, with the app's message or "Ran <label>". */
  IntentionRun: ComponentType<{ line: string; message: string }>;
  /**
   * An intention the model ran: its command's `label` (the name, for a tool the catalog doesn't have), its `name`, input,
   * state, and the app's answer (a message, or the run's `output`, which may be any JSON) or why it was refused.
   */
  ToolRun: ComponentType<{
    name: string;
    label: string;
    input: unknown;
    state: ToolRunState;
    output?: unknown;
    errorText?: string;
  }>;
  /** A request that failed. */
  Error: ComponentType<{ message: string }>;
  /** Places the rows (or `null` when there are none) and the input. */
  Composer: ComponentType<{ rows: ReactNode | null; input: ReactNode }>;
  /**
   * One row: shows `row.title` and `row.subtitle`; calls `onChoose` on a click; `isHighlighted` marks the row Enter
   * acts on, drawn and as `aria-selected`. A row with `missing` says what a command is missing: draw it as a hint
   * (italics). A `disabled` row can't be chosen.
   */
  Row: ComponentType<{
    row: ChatLineRow & Partial<Pick<CatalogIntention, 'missing' | 'disabled'>>;
    isHighlighted: boolean;
    onChoose: () => void;
  }>;
  /**
   * Places `input`: the chat's textarea (`data-testid="shortround-chat-input"`) inside `LineInput`, already wired to the
   * keys. Colour the line's words through `[data-role]`.
   */
  Input: ComponentType<{ input: ReactNode }>;
}
