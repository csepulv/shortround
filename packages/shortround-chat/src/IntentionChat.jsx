import { useLayoutEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useChatSlots } from './chat-slots.js';
import { ChatComposer } from './ChatComposer.jsx';
import { useIntentionChat } from './use-intention-chat.js';

/**
 * A chat over a catalog runtime, drawn through the theme's `Chat` slots: the conversation, and a line that runs the
 * app's intentions as typed or sends the line to the model. Give it a `chat` from `makeIntentionChat`, or a `runtime`
 * and a `transport`, as `useIntentionChat` takes them. It draws inside the box its host gives it; whether it fills
 * that box is the theme's `Frame` slot's.
 */
export function IntentionChat({ placeholder = DEFAULT_PLACEHOLDER, ...options }) {
  const Chat = useChatSlots();
  const { messages, error, line, lineState, rows, runtime } = useIntentionChat(options);

  return (
    <Chat.Frame>
      <Transcript Chat={Chat} error={error} labelOf={labelIn(runtime)} messages={messages} />
      {line && (
        <ChatComposer
          Chat={Chat}
          line={line}
          lineState={lineState}
          placeholder={placeholder}
          rows={rows}
        />
      )}
    </Chat.Frame>
  );
}

function Transcript({ Chat, messages, error, labelOf }) {
  const endRef = useRef(null);
  useLayoutEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages]);
  return (
    <Chat.Transcript>
      {messages.map((message) => (
        <Chat.Message key={message.id} message={message} role={message.role}>
          {message.parts.map((part, index) => (
            <MessagePart
              Chat={Chat}
              key={index}
              labelOf={labelOf}
              part={part}
              role={message.role}
            />
          ))}
        </Chat.Message>
      ))}
      {error && <Chat.Error message={error.message} />}
      <span aria-hidden ref={endRef} />
    </Chat.Transcript>
  );
}

function MessagePart({ Chat, part, role, labelOf }) {
  if (part.type === 'text') {
    return (
      <Chat.Text role={role}>
        {role === 'assistant' ? <AssistantText text={part.text} /> : part.text}
      </Chat.Text>
    );
  }
  if (part.type === 'data-intention') {
    return <Chat.IntentionRun line={part.data.line} message={part.data.message} />;
  }
  if (part.type.startsWith('tool-') || part.type === 'dynamic-tool') {
    const name = part.type === 'dynamic-tool' ? part.toolName : part.type.slice('tool-'.length);
    return (
      <Chat.ToolRun
        errorText={part.errorText}
        input={part.input}
        label={labelOf(name)}
        name={name}
        output={part.output}
        state={TOOL_STATES[part.state] ?? 'running'}
      />
    );
  }
  return null;
}

const DEFAULT_PLACEHOLDER = 'Type a command (↓ or help lists them), or Cmd/Ctrl+Enter to chat';

const AssistantText = ({ text }) => <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>;

const TOOL_STATES = { 'output-available': 'done', 'output-error': 'refused' };

const labelIn = (runtime) => (name) =>
  Object.hasOwn(runtime.catalog.commands, name) ? runtime.catalog.commands[name].label : name;
