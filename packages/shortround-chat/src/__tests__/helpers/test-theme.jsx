// A theme for tests: stand-ins for the palette's slot groups the provider requires, and plain Chat slots with test ids.
const Pass = ({ children }) => <div>{children}</div>;

export const CHAT_SLOTS = {
  Frame: ({ children }) => <section data-testid="chat">{children}</section>,
  Transcript: ({ children }) => <ol data-testid="transcript">{children}</ol>,
  Message: ({ role, message, children }) => (
    <li
      data-message-id={message?.id}
      data-source={message?.metadata?.source}
      data-testid={`message-${role}`}
    >
      {children}
    </li>
  ),
  Text: ({ children }) => <div data-testid="text">{children}</div>,
  IntentionRun: ({ line, message }) => (
    <p data-testid="intention-run">
      {line}: {message}
    </p>
  ),
  ToolRun: ({ name, label, state, output, errorText }) => (
    <p data-label={label} data-state={state} data-testid={`tool-${name}`}>
      {typeof output === 'string' || output === undefined
        ? (output ?? errorText)
        : JSON.stringify(output)}
    </p>
  ),
  Error: ({ message }) => <p data-testid="chat-error">{message}</p>,
  Composer: ({ rows, input }) => (
    <div>
      <div data-testid="rows">{rows}</div>
      {input}
    </div>
  ),
  Row: ({ row, isHighlighted, onChoose }) => (
    <button
      data-highlighted={isHighlighted}
      data-missing={Boolean(row.missing)}
      data-testid={`row-${row.id}`}
      onClick={onChoose}
      type="button"
    >
      {row.title}
    </button>
  ),
  Input: ({ input }) => <div data-testid="input-slot">{input}</div>
};

export const makeTestTheme = (chat = CHAT_SLOTS) => ({
  components: {
    IntentionPalette: {
      Frame: Pass,
      Input: () => null,
      Item: () => null,
      Group: () => null,
      NoMatches: () => null
    },
    Sidekick: { Frame: Pass, Popover: Pass, ControlBar: () => null },
    SidecarContent: () => null,
    ...(chat ? { Chat: chat } : {})
  },
  Toast: () => null
});
