# @shortround/core

Core library for ShortRound, providing the main hooks and functionality for command palette and sidekick interaction.

## Installation

```bash
npm install @shortround/core
```

This package provides the headless logic - you'll either need 
- a UI package like `@shortround/mui` for the visual components.
- provide your own components (see below)

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

**Returns:**
- `inputValue: string` - Current input text
- `onInputChange: (value: string) => void` - Update input and trigger fuzzy matching
- `intentions: Intention[]` - Filtered intentions based on input
- `dispatch: (intentionId: string) => Promise<IntentionActionResult>` - Execute an intention
- `reset: () => Promise<IntentionActionResult>` - Reset to default intentions
- `back: () => Promise<IntentionActionResult>` - Go back to previous intention set
- `inputMessage?: { type: string; text: string }` - Validation message to display
- `dispatchedStack: Intention[]` - History of executed intentions

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
      includeRevertIntentions: [RevertIntentionIds.BACK], // optional: add back/cancel
      message: 'Success!', // optional: toast notification
      sideEffects: {
        sidecarRenderer: () => <MyComponent /> // optional: show sidekick content
      }
    };
  }
}
```

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
import { AnchorPositions, Sizes } from '@shortround/core';

// Available anchor positions
AnchorPositions.CENTER, AnchorPositions.TOP_LEFT, etc.

// Available sizes
Sizes.COMPACT, Sizes.MEDIUM, Sizes.FULL
```

## TypeScript Support

This package includes full TypeScript definitions. Key types:

- `Intention` - Intention object structure
- `IntentionActionResult` - Action return type
- `SidekickStore` - Store interface
- `UseShortRoundResult` - Hook return type
- `UseSidekickResult` - Hook return type
- `SidekickComponents` - Interface for custom UI implementations

## Custom UI Components

While we provide pre-built UI packages like `@shortround/mui`, you can create your own `SidekickComponents` implementation. The `SidekickComponents` interface defines the required component structure:

```jsx
const MySidekickComponents = {
  IntentionPalette: {
    Frame: ({ height, children }) => <div style={{ height }}>{children}</div>,
    Input: ({ inputValue, onInputChange, inputMessage }) => (
      <input 
        value={inputValue} 
        onChange={(e) => onInputChange(e.target.value)}
        placeholder="Search..."
      />
    ),
    Item: ({ intention, onSelect }) => (
      <button onClick={() => onSelect(intention.id)}>
        {intention.title}
      </button>
    ),
    Group: ({ name }) => <div className="group-header">{name}</div>,
    NoMatches: ({ inputValue }) => <div>No matches for "{inputValue}"</div>
  },
  Sidekick: {
    Frame: ({ height, commandWidth, children }) => (
      <div style={{ height, width: commandWidth }}>{children}</div>
    ),
    ControlBar: ({ title, onClose, setSize, size, cycleAnchorOrigin }) => (
      <div>
        <span>{title}</span>
        <button onClick={onClose}>×</button>
        <button onClick={cycleAnchorOrigin}>⌖</button>
        <select value={size} onChange={(e) => setSize(e.target.value)}>
          <option value="compact">Compact</option>
          <option value="medium">Medium</option>
          <option value="full">Full</option>
        </select>
      </div>
    ),
    Popover: ({ anchorPosition, height, totalWidth, children }) => (
      <div style={{ position: 'fixed', ...anchorPosition, height, width: totalWidth }}>
        {children}
      </div>
    )
  },
  SidecarContent: ({ isOpen, renderSidecar, height }) => (
    <div style={{ height, display: isOpen ? 'block' : 'none' }}>
      {renderSidecar?.()}
    </div>
  ),
  ThemeProvider: ({ children }) => children
};

// Use your custom components
<ShortRoundSidekick 
  SidekickComponents={MySidekickComponents}
  defaultIntentions={intentions}
/>
```

**For a complete implementation example**, see the [@shortround/mui package source code](https://github.com/csepulv/shortround/tree/latest/packages/shortround-mui/src) which demonstrates proper component integration with Material-UI.

## Other Packages

- **[@shortround/mui](https://github.com/csepulv/shortround)** - Material-UI components
- See the [GitHub repo](https://github.com/csepulv/shortround) for other package details and examples

## License

MIT 
