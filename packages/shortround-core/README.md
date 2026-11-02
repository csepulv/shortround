# @shortround/core

Core library for ShortRound, providing the main hooks and functionality for command palette and sidekick interaction.

## Installation

```bash
npm install @shortround/core
```

This package provides the headless logic - you'll either need 
- a UI package like `@shortround/mui` for the visual components.
- provide your own components (see below)

It can be imported outside a browser, so your Node tests can import code that imports it.

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

## Icons

An intention's `icon` is a name. Without anything more, the theme draws its own icon for that name (see the theme's
README for its names). To use your own icons, from any library, give the provider an icon registry once:

```jsx
const icons = {
  Icon: MaterialSymbol,                  // draws any name: <Icon name="forum" />
  names: { chat: 'forum' },              // an intention's icon name → the name Icon (or the theme) knows
  intentions: { 'app.send': ChatBubble } // an icon for one intention, by its id
};

<ShortRoundProvider theme={muiTheme} icons={icons}>
  <App />
</ShortRoundProvider>
```

Each row's icon is the first that applies:

1. the intention's entry in `intentions`, by id (even if the intention has no `icon`);
2. none, when the intention has no `icon`; the theme keeps the space, so titles line up;
3. for Back and Cancel, the theme's icons;
4. otherwise the name, mapped by `names`, drawn by `Icon`;
5. without `Icon`, the theme's icon for the name;
6. the theme's placeholder, for a name it doesn't know.

- `Icon` draws every named row but Back and Cancel. An icon font can't tell a name it lacks, so with `Icon` the
  placeholder doesn't appear.
- Back and Cancel keep the theme's icons, since your icon set may have no name for them. To change them, use
  `intentions: { [RevertIntentionIds.BACK]: MyBack }`.
- Your icons draw at the size you give them.
- Define the registry at module scope (or memoize it), like the theme.

## The side panel (sidecar)

The side panel shows content beside the palette. By default, palette navigation drives it:

- an action's result opens it (`sideEffects.sidecarRenderer`) or closes it (`sideEffects.closeSidecar`); a result
  with neither leaves it as it is;
- Back replays the result of the last earlier step that brought a list (a step that only showed a message or
  changed the panel doesn't count);
- Back to the start list and Cancel show the start list's panel (`defaultSidecarRenderer`), or close it;
- opening the palette shows the start list's panel, if any;
- closing the palette, however it closes, clears it. The panel never outlives the palette.

To decide changes yourself, give `ShortRoundSidekick` a `sidecarReducer`. Core proposes each change but a close, with
a reason, and applies what the reducer returns:

```jsx
// Keep the chat across Back and Cancel, and bring it back when the palette opens again.
// (renderChat and chat.wasShowing are your app's: its chat renderer, and whether the chat showed at the last close.)
const keepChat = (current, proposed, { reason }) => {
  if (reason === 'open') return chat.wasShowing ? { renderer: renderChat } : proposed;
  if (['start', 'reset', 'back'].includes(reason) && current.renderer === renderChat) return current;
  return proposed;
};

<ShortRoundSidekick defaultIntentions={intentions} sidecarReducer={keepChat} />
```

- A change is `{ renderer }` or `{ renderer: null }`; `current` has the same shape. Returning `current` keeps the
  panel as it is, without remounting its content.
- Reasons: `result`, `back`, `start` (Back to the start list), `reset` (Cancel), `open`, `app`.
- From app code, inside or outside React: `store.openSidecar(renderer)` and `store.closeSidecar()` (reason `app`), or
  `useSidekick()`'s `setSidecarRenderer` and `closeSidecar`, which do the same. Call them while the palette is open:
  opening the palette replaces a panel set while it was closed, unless your reducer keeps it (returns `current` for
  `open`).

## Keyboard, focus and screen readers

The sidekick is a non-modal dialog: the page stays usable while it's open, and clicking outside doesn't close it.

- **Cmd/Ctrl+K** opens it from anywhere, or brings focus back into it when it is already open.
  `installKeyboardShortcuts={false}` turns off this global shortcut only.
- On open, focus moves to its input (to the sidekick itself in compact size); on close, focus returns to where it
  was, unless the user has since moved it elsewhere in the page. After a row is clicked, focus goes back to the
  input, so typing carries on.
- **Escape** closes it when pressed inside it, so Escape in your own dialogs and fields stays yours. Content inside
  the sidekick (a widget in the side panel) sees Escape first and can keep it with `event.preventDefault()`.
- **Enter** runs the highlighted row. After every new list the highlight is on the list's first enabled row of your
  own, so the first Enter in a picker or a typed-text prompt runs it rather than Back.
- **Arrow keys** move through the rows and wrap around at either end. Back and Cancel, when a list shows them, are
  drawn at the top under **Navigate** but come last for the keyboard: ArrowUp from the first row reaches them.
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
  each with the result its action returned. Back drops the step that brought the current list, and the steps after
  it, and returns to the list of the last earlier step that brought one; a step whose result brings no list
  (`intentions`) leaves the list, and its Back and Cancel, as they are

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

**Returns:** Full sidekick state and control methods (see TypeScript definitions for complete interface). Among
them, `anchorPosition` is the CSS position for the current `anchorOrigin`; it is worked out, not stored.

## Intention Object

```jsx
{
  id: 'unique-identifier',
  title: 'Display Name',
  group: 'Category Name', // optional: rows without one share one unnamed group
  aliases: ['search', 'terms'], // optional
  icon: 'icon-name', // optional: a name (see Icons)
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

A fallback adds rows after the matches, such as "Send as chat: <text>" for a question no command matches. The default
list's is `resolveDefaultFallbackInput`; a list an action returns brings its own as `resolveFallbackInput`, or none (a
picker, say).

```jsx
// (chat.send is your app's.)
const sendAsChat = (text, { matches }) =>
  matches.length
    ? []
    : [{ id: 'send-as-chat', title: `Send as chat: ${text}`, group: 'Chat', action: () => chat.send(text) }];

<ShortRoundSidekick defaultIntentions={intentions} resolveDefaultFallbackInput={sendAsChat} />
```

- It's called while text is typed (not on a blank input, not during a typed-text step) with `matches`: what the list
  shows before it, typed-line rows then fuzzy matches. Return rows only when `matches` is empty for an "unmatched"
  row, or always to offer them after any matches.
- Its rows can be chosen; a row whose id is already listed is left out. They come last when their `group` is one no
  match uses (`Chat` above). A row in a match's group, or with no group while ungrouped matches show, is drawn at the
  end of that group, before later groups.
- Start and Cancel restore the default list's; Back restores the earlier list's.
- Keep it quick and synchronous, and memoize it: a new function resets the list and the input. So read app state that
  changes (such as whether the chat shows) when the fallback runs, through a ref or a store, rather than closing over
  it. One that throws adds no rows and logs why.

`@shortround/catalog` builds the intentions, the resolver and (given one) the fallback from a YAML catalog.

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

They form a group of their own, `Navigate`, separate from any group of yours (even one with the same name), drawn
at the top of the list and last for the keyboard (see Keyboard, focus and screen readers).

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

To open the palette somewhere else, name the place: `createSidekickStore({ anchorOrigin: 'bottom-left' })`, or the
same in `ShortRoundSidekick`'s `initialSidekickState`. Each of the nine `AnchorPositions` is placed with CSS alone,
so it stays in place when the window is resized.

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
- `AnchorPositionStyle` - The CSS position `useSidekick` returns as `anchorPosition`
- `SidekickComponents` - Interface for custom UI implementations
- `ShortRoundTheme` - What `ShortRoundProvider` takes: `{ components, Toast }`
- `IconRegistry` - The app's own icons: `{ Icon, names, intentions }` (see Icons)
- `SidecarReducer`, `SidecarChange`, `SidecarReason` - The side panel's reducer (see The side panel)
- `ResolveInput`, `ResolveFallbackInput` - Rows from typed text, and rows after the matches (see Typed input)
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
    // Drawn inside ShortRound's row, which handles click, keyboard and disabled. ShortRound chooses `icon`;
    // the space stays when there is none, so titles line up.
    Item: ({ intention, icon }) => (
      <div>
        <span style={{ display: 'inline-block', width: 18 }}>{icon}</span>
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
  ),
  // The theme's icons by name; `back` and `cancel` for Back and Cancel, `unknown` for a name it doesn't know.
  // Kept with the slots, so apps passing SidekickComponents without a provider get them too.
  // (SearchIcon and the others stand for your own icon components.)
  icons: { search: SearchIcon, back: BackIcon, cancel: CancelIcon, unknown: UnknownIcon }
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
