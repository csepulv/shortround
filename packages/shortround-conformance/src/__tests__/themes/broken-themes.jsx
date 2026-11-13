// One theme per check, each breaking only that check's obligation: the proof that the check can fail.
// Each wraps the reference slot and changes one thing, so nothing else about the slot breaks.
import { referenceTheme } from './reference-theme.jsx';

const withComponents = (components) => ({
  ...referenceTheme,
  components: { ...referenceTheme.components, ...components }
});

const withPalette = (slots) =>
  withComponents({
    IntentionPalette: { ...referenceTheme.components.IntentionPalette, ...slots }
  });

const withSidekick = (slots) =>
  withComponents({ Sidekick: { ...referenceTheme.components.Sidekick, ...slots } });

const withChat = (slots) =>
  withComponents({ Chat: { ...referenceTheme.components.Chat, ...slots } });

const { Input, Item, NoMatches } = referenceTheme.components.IntentionPalette;
const { Text, ToolRun, Row } = referenceTheme.components.Chat;
const { ControlBar } = referenceTheme.components.Sidekick;
const { Toast } = referenceTheme;

// Names a theme might choose itself instead of applying core's.
const OWN_LABELS = {
  close: 'Dismiss',
  anchor: 'Reposition',
  size: 'Size',
  sizes: { compact: 'Small', medium: 'Normal', full: 'Large' }
};

export const BROKEN_THEMES = {
  // The popover drops its children, so nothing of the palette appears.
  'children-pass-through': withSidekick({ Popover: () => <div /> }),

  // The Input view never places core's input, so nothing can be typed.
  'input-narrows': withPalette({
    Input: ({ inputMessage }) => <Input input={null} inputMessage={inputMessage} />
  }),

  // The message is never shown.
  'input-message': withPalette({
    Input: (props) => <Input {...props} inputMessage={undefined} />
  }),

  // The subtitle is left out.
  'item-shows': withPalette({
    Item: ({ intention, ...props }) => (
      <Item {...props} intention={{ ...intention, subtitle: undefined }} />
    )
  }),

  // The icon it is given is left out.
  // eslint-disable-next-line no-unused-vars -- `icon` is taken out of the props on purpose
  'item-icon': withPalette({ Item: ({ icon, ...props }) => <Item {...props} /> }),

  // Group headings are left out.
  'group-name': withPalette({ Group: () => null }),

  // "No matches" without the typed text.
  'no-matches': withPalette({
    NoMatches: () => <NoMatches inputValue="" />
  }),

  // The title is left out.
  'control-title': withSidekick({
    ControlBar: (props) => <ControlBar {...props} title={undefined} />
  }),

  // The close control does nothing.
  'control-close': withSidekick({
    ControlBar: (props) => <ControlBar {...props} onClose={() => {}} />
  }),

  // The medium control does nothing (compact and full still work).
  'control-size': withSidekick({
    ControlBar: ({ setSize, ...props }) => (
      <ControlBar {...props} setSize={(size) => size !== 'medium' && setSize(size)} />
    )
  }),

  // The position control does nothing.
  'control-anchor': withSidekick({
    ControlBar: (props) => <ControlBar {...props} cycleAnchorOrigin={() => {}} />
  }),

  // The controls carry the theme's own names, not core's.
  'control-names': withSidekick({
    ControlBar: (props) => <ControlBar {...props} labels={OWN_LABELS} />
  }),

  // The side panel never renders its content.
  sidecar: withComponents({ SidecarContent: () => <div /> }),

  // The toast opens without its message.
  'toast-shows': { ...referenceTheme, Toast: (props) => <Toast {...props} message={null} /> },

  // The toast ignores isOpen, so it is always there and can never be dismissed.
  'toast-hidden': { ...referenceTheme, Toast: (props) => <Toast {...props} isOpen /> },

  // The input is never placed.
  'chat-input': withChat({ Input: () => null }),

  // A typed run is drawn without the app's message.
  'chat-intention-run': withChat({ IntentionRun: ({ line }) => <p>{line}</p> }),

  // The assistant's text is dropped.
  'chat-text': withChat({
    Text: (props) => (props.role === 'assistant' ? null : <Text {...props} />)
  }),

  // A finished tool run drops the app's answer.
  'chat-tool-done': withChat({
    ToolRun: (props) => <ToolRun {...props} output={undefined} />
  }),

  'chat-tool-label': withChat({
    ToolRun: (props) => <ToolRun {...props} label={props.name} />
  }),

  // A refused tool run drops the reason.
  'chat-tool-refused': withChat({
    ToolRun: (props) => <ToolRun {...props} errorText={undefined} />
  }),

  // A failed request isn't shown.
  'chat-error': withChat({ Error: () => null }),

  // The subtitle is left out.
  'chat-row-shows': withChat({
    Row: ({ row, ...props }) => <Row {...props} row={{ ...row, subtitle: undefined }} />
  }),

  // A click does nothing.
  'chat-row-chooses': withChat({ Row: (props) => <Row {...props} onChoose={() => {}} /> }),

  // The highlight isn't marked.
  'chat-row-highlight': withChat({
    Row: (props) => <Row {...props} isHighlighted={false} />
  })
};

// Checks that may also fail for a broken theme because they reach their own slot through the broken
// one; each must fail with its own message, marked "(precondition)" when its slot isn't the broken one.
// 'all': when the frames drop their children nothing renders, and every check fails at its own slot.
export const DEPENDENTS = {
  'children-pass-through': 'all',
  'input-narrows': ['input-message', 'no-matches'],
  'chat-input': [
    'chat-intention-run',
    'chat-text',
    'chat-tool-done',
    'chat-tool-label',
    'chat-tool-refused',
    'chat-error',
    'chat-row-shows',
    'chat-row-chooses',
    'chat-row-highlight'
  ]
};
