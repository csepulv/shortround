import { useChat } from '@ai-sdk/react';
import { drawnLineState, makeChatLine } from '@shortround/core';
import { lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { makeWiredChat, runtimeOfChat } from './make-intention-chat.js';

/**
 * A chat over a catalog runtime: the AI SDK conversation, and a line that runs the app's intentions as typed or sends
 * the line to the model. Give it a `chat` from `makeIntentionChat`, which the host holds; or a `runtime` and a
 * `transport` (with `body` and `sendAutomaticallyWhen`), and it makes and holds its own, stopping it on unmount or when a
 * `chat` takes its place. Given neither, it throws, naming what to pass. Every request, including the one that
 * continues after a tool runs, carries every intention as a tool (the ones not available at that moment marked so),
 * plus the host's `body`. The model's tool calls run in the app through `runtime.runTool`; one whose app run fails
 * goes back to the model as an error. A new `runtime`, `transport` or `body` is followed by the next request; a new
 * `runtime` or `showHintForMissing` starts a new, empty line. A new `chat` is drawn at once, and the line's runs
 * join it.
 */
export function useIntentionChat(options) {
  const { chat, runtime } = useChatAndRuntime(options);
  const chatState = useChat({ chat });
  const chatRef = useRef(null);
  chatRef.current = { ...chatState, generateId: chat.generateId };

  const line = useChatLine({
    runtime,
    showHintForMissing: options.showHintForMissing ?? true,
    chatRef
  });
  const lineState = useLineState(line);

  return {
    messages: chatState.messages,
    status: chatState.status,
    error: chatState.error,
    line,
    lineState,
    rows: line?.rows() ?? [],
    runtime,
    sendText: (text) => chatState.sendMessage({ text }),
    stop: chatState.stop
  };
}

const OWN_CHAT_OPTIONS = ['runtime', 'transport', 'body', 'sendAutomaticallyWhen'];

function useChatAndRuntime(options) {
  const ownChat = useOwnChat(options);
  if (options.chat) {
    return { chat: options.chat, runtime: runtimeOfHostChat(options) };
  }
  if (!ownChat) {
    throw new Error(
      'useIntentionChat: pass chat (from makeIntentionChat), or runtime and transport'
    );
  }
  return { chat: ownChat, runtime: options.runtime };
}

function runtimeOfHostChat(options) {
  const extra = OWN_CHAT_OPTIONS.filter((name) => options[name] !== undefined);
  if (extra.length) {
    throw new Error(
      `useIntentionChat: pass chat alone; it already has its runtime, transport and body. Drop: ${extra.join(', ')}`
    );
  }
  const runtime = runtimeOfChat(options.chat);
  if (!runtime) {
    throw new Error(
      "useIntentionChat: this chat wasn't made by makeIntentionChat, so it has no runtime or tools"
    );
  }
  return runtime;
}

function useOwnChat({
  chat: hostChat,
  runtime,
  transport,
  body,
  sendAutomaticallyWhen = lastAssistantMessageIsCompleteWithToolCalls
}) {
  const latest = useRef(null);
  latest.current = { runtime, transport, body, sendAutomaticallyWhen };
  const ownChat = useRef(null);
  const isOwnChatWanted = !hostChat && Boolean(runtime && transport);
  if (isOwnChatWanted && !ownChat.current) {
    ownChat.current = makeWiredChat({
      current: () => latest.current,
      sendAutomaticallyWhen: (state) => latest.current.sendAutomaticallyWhen(state)
    });
  }
  useEffect(() => {
    if (hostChat) {
      void ownChat.current?.stop();
    }
  }, [hostChat]);
  useEffect(() => () => void ownChat.current?.stop(), []);
  return isOwnChatWanted ? ownChat.current : null;
}

// The line lives in an effect so it is disposed (it stops following the app) when the chat unmounts.
function useChatLine({ runtime, showHintForMissing, chatRef }) {
  const [line, setLine] = useState(null);
  useEffect(() => {
    const made = makeChatLine({
      runtime,
      showHintForMissing,
      onIntentionRun: (run) =>
        chatRef.current.setMessages((messages) => [
          ...messages,
          intentionRunMessage(run, chatRef.current.generateId())
        ]),
      onSendAsChat: (text) => chatRef.current.sendMessage({ text })
    });
    setLine(made);
    return () => made.dispose();
  }, [runtime, showHintForMissing, chatRef]);
  return line;
}

const NO_LINE = { subscribe: () => () => {}, getState: () => null };

function useLineState(line) {
  const source = line ?? NO_LINE;
  const state = useSyncExternalStore(source.subscribe, source.getState);
  return useMemo(() => state && drawnLineState(state), [state]);
}

const intentionRunMessage = (run, id) => ({
  id,
  role: 'user',
  parts: [{ type: 'data-intention', data: run }]
});
