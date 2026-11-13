// The smallest theme that meets the contract: plain elements that only draw, with the contract's test hooks.
// No cmdk: core renders cmdk's input and rows.
// A test fixture that exports a theme object, not a module for fast refresh.
/* eslint-disable react-refresh/only-export-components */
import { TEST_IDS } from '../../test-ids.js';

// Visible text differs from core's names, so the names can only come from `labels`.
const SIZE_TEXT = { compact: 'S', medium: 'M', full: 'L' };

const PassThrough = ({ children }) => <div>{children}</div>;

function Input({ input, inputMessage }) {
  return (
    <div>
      {input}
      {inputMessage && <p>{inputMessage.text}</p>}
    </div>
  );
}

function Item({ intention, icon }) {
  return (
    <div>
      {icon}
      <span>{intention.title}</span>
      {intention.subtitle && <span>{intention.subtitle}</span>}
    </div>
  );
}

function ControlBar({ title, labels, onClose, setSize, cycleAnchorOrigin }) {
  return (
    <div>
      <span>{title}</span>
      <button
        aria-label={labels.close}
        data-testid={TEST_IDS.close}
        onClick={onClose}
        type="button"
      >
        x
      </button>
      <div aria-label={labels.size} role="group">
        {Object.keys(SIZE_TEXT).map((size) => (
          <button
            aria-label={labels.sizes[size]}
            data-testid={TEST_IDS.size(size)}
            key={size}
            onClick={() => setSize(size)}
            type="button"
          >
            {SIZE_TEXT[size]}
          </button>
        ))}
      </div>
      <button
        aria-label={labels.anchor}
        data-testid={TEST_IDS.anchor}
        onClick={cycleAnchorOrigin}
        type="button"
      >
        +
      </button>
    </div>
  );
}

const answerOf = ({ state, output, errorText }) =>
  state === 'refused' ? errorText : typeof output === 'string' ? output : '';

export const REFERENCE_CHAT = {
  Frame: PassThrough,
  Transcript: ({ children }) => <ol>{children}</ol>,
  Message: ({ children }) => <li>{children}</li>,
  Text: ({ children }) => <div>{children}</div>,
  IntentionRun: ({ line, message }) => (
    <p>
      <code>{line}</code> {message}
    </p>
  ),
  ToolRun: (props) => (
    <p>
      <code>{props.label}</code> {answerOf(props)}
    </p>
  ),
  Error: ({ message }) => <p>{message}</p>,
  Composer: ({ rows, input }) => (
    <div>
      {rows && <ul>{rows}</ul>}
      {input}
    </div>
  ),
  Row: ({ row, isHighlighted, onChoose }) => (
    <li aria-selected={isHighlighted} role="option">
      <button onClick={onChoose} type="button">
        {row.title}
        {row.subtitle && <span> {row.subtitle}</span>}
      </button>
    </li>
  ),
  Input: ({ input }) => <div>{input}</div>
};

export const referenceTheme = {
  components: {
    Chat: REFERENCE_CHAT,
    IntentionPalette: {
      Frame: PassThrough,
      Input,
      Item,
      Group: ({ name }) => <p>{name}</p>,
      NoMatches: ({ inputValue }) => (
        <p data-testid={TEST_IDS.noMatches}>Nothing matches {inputValue}</p>
      )
    },
    Sidekick: {
      Popover: PassThrough,
      Frame: PassThrough,
      ControlBar
    },
    SidecarContent: ({ isOpen, renderSidecar }) => <div>{isOpen ? renderSidecar() : null}</div>
  },
  Toast: ({ isOpen, message }) => (isOpen ? <p data-testid={TEST_IDS.toast}>{message}</p> : null)
};
