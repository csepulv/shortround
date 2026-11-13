# @shortround/react

ShortRound for React: the command palette and sidekick, their hooks, the provider that chooses a theme, and the theme
contract. It draws [`@shortround/core`](https://github.com/csepulv/shortround/tree/main/packages/shortround-core),
which holds the palette's state, matching, the catalog engine and the constants, with no UI.

## Installation

```bash
npm install @shortround/core @shortround/react
```

For the MUI theme the examples use: `npm install @shortround/mui`, with its peers (see its README).

`@shortround/core` is a peer: your app installs it, and imports the constants and stores from it. So are `react` and
`react-dom`, 18.2 or 19. The package is ES modules only. The look comes from
- a theme package like `@shortround/mui`, or
- your own components (see Custom UI Components).

It can be imported outside a browser, so your Node tests can import code that imports it.

Upgrading from an earlier version? See the
[migration guide](https://github.com/csepulv/shortround/blob/main/MIGRATING.md).

## Choosing a theme: ShortRoundProvider

An app chooses its theme once, at its root. Below the provider, app code depends only on this package and
`@shortround/core`.

```jsx
import { ShortRoundProvider, ShortRoundSidekick, useShortRoundToast } from '@shortround/react';
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

- A theme is `{ components, Toast }`: slot groups and a Toast view. The provider holds the toast's state; the theme
  only draws it. Define the theme at module scope (or memoize it): a Toast or slot component created during render
  remounts on every render.
- Each slot group is needed only by what draws it. `ShortRoundSidekick` needs `IntentionPalette`, `Sidekick` and
  `SidecarContent`, and throws when it mounts, naming any it misses; `@shortround/chat`'s chat needs `Chat`. So an app
  that draws only the chat gives a theme with `Chat` and a `Toast`.
- `useShortRoundComponents()` gives the nearest provider's `theme.components` (or `null`), for a package that draws
  through a slot group of its own.
- An action's `message` is shown as a toast.
- A nested `ShortRoundProvider` wins for its subtree.
- `ShortRoundSidekick`'s `SidekickComponents` and `showToast` props (the 0.2.x way to choose a look) override the provider; each prop
  overrides only its own part (slots or toast). Without a provider, `SidekickComponents` is required. Define the
  slot components at module scope too: a slot component created during render remounts on every render, which
  moves focus back into the palette.
- `ShortRoundProvider` and `SidekickStoreProvider` are separate: one chooses the theme, the other shares one
  palette's state (see Sidekick Store).

## A palette from a catalog

An app with a catalog hands the sidekick the palette `buildPalette` returns, instead of `defaultIntentions` and the
two resolvers:

```jsx
<ShortRoundSidekick title="Short Round" palette={palette} />
```

The sidekick opens on `palette.current()` (the commands the app's state allows now) with that state's side panel.
While it is open, it follows `palette.notify()`: call it when your app's state changes outside the palette, and the
list re-reads. Build the palette once. See `@shortround/core`'s
[ADOPTING-A-CATALOG.md](https://github.com/csepulv/shortround/blob/main/packages/shortround-core/ADOPTING-A-CATALOG.md).

**Line hints.** With a palette, the input shows how the line is being read: each word marked with its role, and, when the
caret is at the end of the line, the rest of the next word as ghost text (`@shortround/mui` greys it). Tab completes through the line, wherever the caret is; Enter runs the
highlighted row as before. Pickers and typed-text steps show the plain input. Turn the hints off with
`disableLineHints`:

```jsx
<ShortRoundSidekick palette={palette} disableLineHints />
```

A theme colours the words: each is a `span` with `data-role` (`verb`, `text`, `hint`, `param`, `value`, `unread`,
`broken`, and `ghost` for the ghost), inside the element the theme's `IntentionPalette.Input` slot already receives.
`@shortround/mui` colours them from its theme's palette. The words line up under the input on their own: they copy
the input's position and text style. A theme's `data-role` rules should change only colour and decoration: the
words sit under the input's own text, so anything that changes a word's width (weight, size, font, letter spacing)
moves the words after it away from the caret.

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
A modal of your own that holds focus (such as MUI's `Drawer` or `Dialog`) pulls focus back from the sidekick's input,
so it can't be typed in while that modal is open; give the modal `disableEnforceFocus` (MUI:
`ModalProps={{ disableEnforceFocus: true }}` on a `Drawer`).

- **Cmd/Ctrl+K** opens it from anywhere, or brings focus back into it when it is already open.
  `installKeyboardShortcuts={false}` turns off this global shortcut only.
- On open, focus moves to its input (to the sidekick itself in compact size); on close, focus returns to where it
  was, unless the user has since moved it elsewhere in the page. After a row is clicked, focus goes back to the
  input, so typing carries on.
- **Escape** closes it when pressed inside it, so Escape in your own dialogs and fields stays yours. Content inside
  the sidekick (a widget in the side panel) sees Escape first and can keep it with `event.preventDefault()`.
- **Enter** runs the highlighted row. After every new list the highlight is on the list's first enabled row of your
  own, so the first Enter in a picker or a typed-text prompt runs it rather than Back. On a completion row (see Typed
  input), Enter completes the input instead of running anything.
- **Tab**, with a catalog palette, first completes through the line (see Line hints). Otherwise it completes the input
  with the first enabled completion row, when the list has one; otherwise Tab moves focus as usual.
- **Arrow keys** move through the rows and wrap around at either end. Back and Cancel, when a list shows them, are
  drawn at the top under **Navigate** but come last for the keyboard: ArrowUp from the first row reaches them.
- It is announced as a dialog named by `title` (or "ShortRound"), and its controls carry `ControlLabels`.
- `ShortRoundSidekick`'s `onClose` is called after the sidekick closes, whatever closed it: the close control,
  Escape, or the app through the store.

## Hooks

### useShortRound

Manages the list of intentions and fuzzy matching of user input, for a palette you draw yourself. It is
`@shortround/core`'s palette store (`createPaletteStore`) as a hook.

```jsx
import { useShortRound } from '@shortround/react';

const { 
  inputValue, 
  onInputChange, 
  intentions, 
  revertIntentions,
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
- `resolveDefaultFallbackInput?: ResolveFallbackInput` - Adds rows after the default list's matches (see Typed input).
  `ShortRoundSidekick` takes the same prop

**Returns:**
- `inputValue: string` - Current input text
- `onInputChange: (value: string) => void` - Update input and trigger fuzzy matching
- `intentions: Intention[]` - Filtered intentions based on input
- `revertIntentions: Intention[]` - The Back and Cancel rows the current list asked for; draw them under Navigate
  (see System Intentions)
- `dispatch: (intentionId: string) => Promise<IntentionActionResult>` - Choose a row, as `ShortRoundSidekick` does: a
  completion row sets the input; any other runs, and keeps the Back and Cancel its result asks for
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
import { useSidekick } from '@shortround/react';

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
- `initial?: Partial<SidekickStoreState>` - Initial state overrides, used only when there is no `store` and no
  `SidekickStoreProvider` above

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
  completion: 'search grid with ', // optional: a completion row sets the input to this; action isn't called
  validate: (input) => ({ valid: input.length > 0, message: 'Type a name first' }), // optional: a returned message shows
  action: async (input) => {
    // Your logic here
    return {
      intentions: newIntentions, // optional: new intention set
      shouldReset: false, // optional: close palette
      disableInputMatching: false, // optional, with intentions: that list ignores typed text (a typed-text step)
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
- A resolver whose rows can change while the input doesn't (an async lookup landed) may carry
  `subscribe(listener)`, returning a function that stops the listening. The palette subscribes to the current
  resolver, renders again each time the listener is called, and unsubscribes when the resolver is replaced or the
  palette unmounts.

```js
const resolveInput = (text) => engine.rowsFor(text); // (engine is your app's)
resolveInput.subscribe = (listener) => engine.onChange(listener); // returns an unsubscribe function
```

A row with `completion` is a completion row: choosing it (Enter or a click) sets the input to `completion` and keeps
the palette open; its `action` isn't called and Back doesn't step back over it. Tab applies the first enabled
completion row. A resolver can offer completions beside runnable rows, so a user builds a line step by step: `search`
→ `search grid with ` → `search grid with tags react`.

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

### Line hints in your own input: LineInput

The sidekick's input shows each typed word coloured by its role and the rest of the next word as ghost text. A host
with its own input (a chat, an editor's command field) gets the same drawing with `LineInput`: wrap the input, pass
its ref, and pass a command line's state. The input stays on top with its text made transparent, so typing, the caret
and selection stay native.

```jsx
import { useRef, useSyncExternalStore } from 'react';
import { LineInput } from '@shortround/react';

function CommandField({ line }) {
  // line: a command line from @shortround/core (palette.commandLine(), or runtime.commandLine())
  const inputRef = useRef(null);
  const lineState = useSyncExternalStore(line.subscribe, line.getState);
  return (
    <LineInput inputRef={inputRef} lineState={lineState}>
      <input
        ref={inputRef}
        value={lineState.text}
        onChange={(event) => line.change(event.target.value, event.target.selectionStart)}
      />
    </LineInput>
  );
}
```

- Each word is a `<span data-role="…">` (`verb`, `text`, `hint`, `param`, `value`, `unread`, `broken`) and the ghost a
  `<span data-role="ghost">`, inside `data-testid="shortround-line-shadow"`. Colour them in your stylesheet.
- The line is drawn on one line. Pass `lineState={null}` while the text has a line break (a `<textarea>`), and the
  input shows as it is.
- A chat line's state should go through core's `drawnLineState`, so a line that reads as chat isn't drawn as a broken
  command.

`@shortround/core`'s catalog engine (`loadCatalog`, `buildPalette`) builds the intentions, the resolver and (given
one) the fallback from a YAML catalog: see its
[CATALOG.md](https://github.com/csepulv/shortround/tree/main/packages/shortround-core/CATALOG.md).

## System Intentions

ShortRound provides built-in system intentions for navigation, from `@shortround/core`:

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

`ShortRoundSidekick` draws them. A palette of your own on `useShortRound` draws the hook's `revertIntentions`, and
chooses one with `dispatch` (for example `dispatch(RevertIntentionIds.BACK)`).

## Sidekick Store

For advanced usage, you can create and manage the sidekick store manually. The store is `@shortround/core`'s; it works
outside React too.

```jsx
import { createSidekickStore } from '@shortround/core';
import { SidekickStoreProvider } from '@shortround/react';

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

From `@shortround/core`:

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

- `UseShortRoundResult` - Hook return type
- `UseSidekickResult` - Hook return type
- `AnchorPositionStyle` - The CSS position `useSidekick` returns as `anchorPosition`
- `SidekickComponents` - Interface for custom UI implementations
- `ShortRoundTheme` - What `ShortRoundProvider` takes: `{ components, Toast }`
- `IconRegistry` - The app's own icons: `{ Icon, names, intentions }` (see Icons)
- `ToastProps` - The Toast view's props

The headless types are `@shortround/core`'s: `Intention`, `IntentionActionResult`, `SidekickStore`, `SidecarReducer`,
`SidecarChange`, `SidecarReason` (see The side panel), and `ResolveInput`, `ResolveFallbackInput` (see Typed input).

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

- **[@shortround/core](https://github.com/csepulv/shortround/tree/main/packages/shortround-core)** - The palette
  without a UI: its state, matching, the catalog engine and the constants
- **[@shortround/mui](https://github.com/csepulv/shortround/tree/main/packages/shortround-mui)** - Material-UI components
- See the [GitHub repo](https://github.com/csepulv/shortround) for other package details and examples

## License

MIT 
