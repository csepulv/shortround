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

const { Input, Item, NoMatches } = referenceTheme.components.IntentionPalette;
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
  'toast-hidden': { ...referenceTheme, Toast: (props) => <Toast {...props} isOpen /> }
};

// Checks that may also fail for a broken theme because they reach their own slot through the broken
// one; each must fail with its own message, marked "(precondition)" when its slot isn't the broken one.
// 'all': when the frames drop their children nothing renders, and every check fails at its own slot.
export const DEPENDENTS = {
  'children-pass-through': 'all',
  'input-narrows': ['input-message', 'no-matches']
};
