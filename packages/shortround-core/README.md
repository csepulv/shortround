# @shortround/core

Core library for ShortRound, providing the main hooks and functionality for command palette and sidekick interaction.

## Installation

```bash
npm install @shortround/core
```

This package provides the headless logic - you'll either need 
- a UI package like `@shortround/mui` for the visual components.
- provide your own components (see below)

Upgrading from an earlier version? See the
[migration guide](https://github.com/csepulv/shortround/blob/main/MIGRATING.md).

## Choosing a theme: ShortRoundProvider

An app chooses its theme once, at its root. Below the provider, app code depends only on this package.

```jsx
import { ShortRoundProvider, ShortRoundSidekick, useShortRoundToast } from '@shortround/core';
import { muiTheme } from '@shortround/mui'; // the root is the only place that names a theme

root.render(
  <ShortRoundProvider theme={muiTheme}>
    <App />
  </ShortRoundProvider>
);

// Anywhere below:
<ShortRoundSidekick title="Short Round" defaultIntentions={intentions} />;
const { showToast } = useShortRoundToast(); // shows a toast in the theme's Toast
```

- A theme is `{ components, Toast }`: the `SidekickComponents` slots and a Toast view. The provider holds the
  toast's state; the theme only draws it. Define the theme at module scope (or memoize it): a theme object built
  on every render remounts its Toast.
- An action's `message` is shown as a toast.
- A nested `ShortRoundProvider` wins for its subtree.
- `ShortRoundSidekick`'s `SidekickComponents` and `showToast` props, as in 0.2.x, override the provider; each prop
  overrides only its own part (slots or toast). Without a provider, `SidekickComponents` is required. Define the
  slot components at module scope too: a slot component created during render remounts on every render, which
  moves focus back into the palette.
- `ShortRoundProvider` and `SidekickStoreProvider` are separate: one chooses the theme, the other shares one
  palette's state (see Sidekick Store).

## Keyboard, focus and screen readers

The sidekick is a non-modal dialog: the page stays usable while it's open, and clicking outside doesn't close it.

- **Cmd/Ctrl+K** opens it from anywhere, or brings focus back into it when it is already open.
  `installKeyboardShortcuts={false}` turns off this global shortcut only.
- On open, focus moves to its input (to the sidekick itself in compact size); on close, focus returns to where it
  was, unless the user has since moved it elsewhere in the page. After a row is clicked, focus goes back to the
  input, so typing carries on.
- **Escape** closes it when pressed inside it, so Escape in your own dialogs and fields stays yours. Content inside
  the sidekick (a widget in the side panel) sees Escape first and can keep it with `event.preventDefault()`.
- It is announced as a dialog named by `title` (or "ShortRound"), and its controls carry `ControlLabels`.
- `ShortRoundSidekick`'s `onClose` is called after the sidekick closes, whatever closed it: the close control,
  Escape, or the app through the store.

## Core Hooks

### useShortRound

Manages the list of intentions and fuzzy matching of user input.

```jsx
import { useShortRound } from '@shortround/core';

const { 
  inputValue, 
  onInputChange, 
  intentions, 
  dispatch, 
  reset, 
  back,
  inputMessage,
  dispatchedStack 
} = useShortRound({ 
  defaultIntentions 
});
```

**Parameters:**
- `defaultIntentions: Intention[]` - Initial set of intentions to display
- `resolveDefaultInput?: (text: string) => Intention[]` - Turns typed text into extra rows for the default list
  (see Typed input). `ShortRoundSidekick` takes the same prop

**Returns:**
- `inputValue: string` - Current input text
- `onInputChange: (value: string) => void` - Update input and trigger fuzzy matching
- `intentions: Intention[]` - Filtered intentions based on input
- `dispatch: (intentionId: string) => Promise<IntentionActionResult>` - Execute an intention
- `reset: () => Promise<IntentionActionResult>` - Reset to default intentions
- `back: () => Promise<IntentionActionResult>` - Go back to previous intention set
- `inputMessage?: { type: string; text: string }` - Validation message to display
- `dispatchedStack: { intention: Intention; result: IntentionActionResult }[]` - History of executed intentions,
  each with the result its action returned

### useSidekick

UI controller that manages the popover (overlay) and sidekick drawer.

```jsx
import { useSidekick } from '@shortround/core';

const {
  isOpen,
  isSidecarOpen,
  onOpen,
  onClose,
  setSidecarRenderer,
  closeSidecar,
  height,
  anchorOrigin,
  cycleAnchorOrigin,
  // ... other properties
} = useSidekick({
  store, // optional: external store
  initial: { size: 'medium' } // optional: initial state
});
```

**Parameters:**
- `store?: SidekickStore` - External store instance
- `initial?: Partial<SidekickStoreState>` - Initial state overrides

**Returns:** Full sidekick state and control methods (see TypeScript definitions for complete interface)

## Intention Object

```jsx
{
  id: 'unique-identifier',
  title: 'Display Name',
  group: 'Category Name',
  aliases: ['search', 'terms'], // optional
  icon: 'icon-name', // optional
  disabled: false, // optional
  validate: (input) => ({ valid: true, message: 'Optional error' }), // optional
  action: async (input) => {
    // Your logic here
    return {
      intentions: newIntentions, // optional: new intention set
      shouldReset: false, // optional: close palette
      disableInputMatching: false, // optional: disable fuzzy search
      resolveInput: (text) => [], // optional: rows from typed text, for the new list (see Typed input)
      includeRevertIntentions: [RevertIntentionIds.BACK], // optional: add back/cancel
      message: 'Success!', // optional: toast notification
      sideEffects: {
        sidecarRenderer: () => <MyComponent /> // optional: show sidekick content
      }
    };
  }
}
```

## Typed input

A resolver turns what the user types into rows of its own, so a line such as `sort created newest` can become one
row that runs directly. The default list's resolver is `resolveDefaultInput`; a list an action returns brings its
own as `resolveInput`, or none.

- Resolved rows show first, then the fuzzy matches; a resolved row with a listed row's id replaces it.
- Back restores the previous list's resolver.
- A resolver runs on every render while text is typed, so keep it quick and synchronous. One that throws adds no
  rows and logs why. It adds nothing during a typed-text step (`disableInputMatching`).
- Memoize it, like `defaultIntentions`: a new resolver resets the list and the input.

`@shortround/catalog` builds the intentions and the resolver from a YAML catalog.

## System Intentions

ShortRound provides built-in system intentions for navigation:

```jsx
import { RevertIntentionIds, makeRevertIntentionsFor } from '@shortround/core';

// Available system intentions
RevertIntentionIds.BACK   // Go back to previous intention set
RevertIntentionIds.RESET  // Reset to default intentions

// Include them in your action results
return {
  intentions: myIntentions,
  includeRevertIntentions: [RevertIntentionIds.BACK, RevertIntentionIds.RESET]
};
```

## Sidekick Store

For advanced usage, you can create and manage the sidekick store manually:

```jsx
import { createSidekickStore, SidekickStoreProvider } from '@shortround/core';

const store = createSidekickStore({
  size: 'full',
  anchorOrigin: 'center',
  commandWidth: '50vw'
});

function App() {
  return (
    <SidekickStoreProvider store={store}>
      {/* Your components */}
    </SidekickStoreProvider>
  );
}
```

## Constants

```jsx
import { AnchorPositions, ControlLabels, Sizes } from '@shortround/core';

// Available anchor positions
AnchorPositions.CENTER, AnchorPositions.TOP_LEFT, etc.

// Available sizes
Sizes.COMPACT, Sizes.MEDIUM, Sizes.FULL

// The control bar's accessible names, passed to a theme's ControlBar as `labels`
ControlLabels.close, ControlLabels.anchor, ControlLabels.size, ControlLabels.sizes.compact
```

## TypeScript Support

This package includes full TypeScript definitions. Key types:

- `Intention` - Intention object structure
- `IntentionActionResult` - Action return type
- `SidekickStore` - Store interface
- `UseShortRoundResult` - Hook return type
- `UseSidekickResult` - Hook return type
- `SidekickComponents` - Interface for custom UI implementations
- `ShortRoundTheme` - What `ShortRoundProvider` takes: `{ components, Toast }`
- `ToastProps` - The Toast view's props

## Custom UI Components

While we provide pre-built UI packages like `@shortround/mui`, you can create your own theme. Slots only draw:
ShortRound renders cmdk (the input, each row, keyboard and selection), moves focus and announces the sidekick, so a
theme imports no cmdk. Row styling goes in the palette frame, through cmdk's attributes (`[cmdk-item]`,
`[data-selected="true"]`). The test hooks (`data-testid`) below are the ones the conformance suite looks for.

```jsx
const SIZES = ['compact', 'medium', 'full'];

const MySidekickComponents = {
  IntentionPalette: {
    Frame: ({ height, children }) => <div style={{ height }}>{children}</div>,
    // `input` is ShortRound's input element; place it.
    Input: ({ input, inputMessage }) => (
      <div>
        {input}
        {inputMessage && <p>{inputMessage.text}</p>}
      </div>
    ),
    // Drawn inside ShortRound's row, which handles click, keyboard and disabled.
    Item: ({ intention }) => (
      <div>
        <span>{intention.title}</span>
        {intention.subtitle && <small>{intention.subtitle}</small>}
      </div>
    ),
    Group: ({ name }) => <div className="group-header">{name}</div>,
    NoMatches: ({ inputValue }) => (
      <div data-testid="shortround-no-matches">No matches for "{inputValue}"</div>
    )
  },
  Sidekick: {
    Frame: ({ height, commandWidth, children }) => (
      <div style={{ height, width: commandWidth }}>{children}</div>
    ),
    // `labels` are ShortRound's accessible names (ControlLabels); apply them.
    ControlBar: ({ title, labels, onClose, setSize, cycleAnchorOrigin }) => (
      <div>
        <span>{title}</span>
        <button aria-label={labels.anchor} data-testid="shortround-anchor" onClick={cycleAnchorOrigin}>
          ⌖
        </button>
        <div aria-label={labels.size} role="group">
          {SIZES.map((size) => (
            <button
              aria-label={labels.sizes[size]}
              data-testid={`shortround-size-${size}`}
              key={size}
              onClick={() => setSize(size)}
            >
              {size[0].toUpperCase()}
            </button>
          ))}
        </div>
        <button aria-label={labels.close} data-testid="shortround-close" onClick={onClose}>
          ×
        </button>
      </div>
    ),
    Popover: ({ anchorPosition, height, totalWidth, children }) => (
      <div style={{ position: 'fixed', ...anchorPosition, height, width: totalWidth, display: 'flex' }}>
        {children}
      </div>
    )
  },
  SidecarContent: ({ isOpen, renderSidecar, height }) => (
    <div style={{ height, display: isOpen ? 'block' : 'none' }}>
      {renderSidecar?.()}
    </div>
  )
};

// A theme is the slots plus a Toast view; ShortRoundProvider holds the toast's state.
const myTheme = {
  components: MySidekickComponents,
  Toast: ({ isOpen, message, onClose }) =>
    isOpen ? (
      <div data-testid="shortround-toast" role="status" onClick={onClose}>
        {message}
      </div>
    ) : null
};

// Use your theme at the app's root
<ShortRoundProvider theme={myTheme}>
  <App />
</ShortRoundProvider>
```

What each slot must do, beyond its props, is written in the JSDoc on `SidekickComponents` in this package's types.
To check a theme against those obligations, run the conformance suite from your theme's tests: see
[`@shortround/conformance`](https://github.com/csepulv/shortround/tree/main/packages/shortround-conformance)
(GitHub only, not on npm).

**For a complete implementation example**, see the [@shortround/mui package source code](https://github.com/csepulv/shortround/tree/main/packages/shortround-mui/src) which demonstrates proper component integration with Material-UI.

## Other Packages

- **[@shortround/mui](https://github.com/csepulv/shortround)** - Material-UI components
- **[@shortround/catalog](https://www.npmjs.com/package/@shortround/catalog)** - Builds intentions and a typed-input resolver from a YAML catalog
- See the [GitHub repo](https://github.com/csepulv/shortround) for other package details and examples

## License

MIT 
