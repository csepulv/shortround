# @shortround/mui

Material-UI themed components for ShortRound command palette library. It is a theme for `@shortround/react`, which
it takes as a peer, with `@shortround/core`.

## Installation

```bash
npm install @shortround/core @shortround/react @shortround/mui
```

**Peer Dependencies:**
```bash
npm install @mui/material @emotion/react @emotion/styled lucide-react
```

React 18.2 or 19 (with `react-dom`). `@mui/material` 5, 6, 7 or 9; on React 19, MUI's own peers need `@mui/material`
5.16.8 or later.

Upgrading from an earlier version? Upgrade `@shortround/core`, `@shortround/react` and `@shortround/mui` together (they share one version), and see the
[migration guide](https://github.com/csepulv/shortround/blob/main/MIGRATING.md).

## Quick Start

Hand `muiTheme` to `ShortRoundProvider` once, at your app's root, inside your MUI `ThemeProvider` if you have one. Below it, app
code imports only `@shortround/react` and `@shortround/core`.

```jsx
import { ShortRoundProvider, ShortRoundSidekick } from '@shortround/react';
import { muiTheme } from '@shortround/mui';

const intentions = [
  {
    id: 'search',
    title: 'Search Items',
    group: 'Actions',
    icon: 'search', // see Icons below
    action: async (input) => {
      return { intentions: searchResults };
    }
  }
];

// App code: no MUI-specific ShortRound imports.
function App() {
  return (
    <>
      <h1>My App</h1>
      <ShortRoundSidekick
        title="Command Palette"
        defaultIntentions={intentions}
        installKeyboardShortcuts={true}
      />
    </>
  );
}

// The root: the one place the theme is chosen.
root.render(
  <ShortRoundProvider theme={muiTheme}>
    <App />
  </ShortRoundProvider>
);
```

## Components

### muiTheme

The theme for `ShortRoundProvider`: `{ components: MuiSidekickComponents, Toast }`, where `Toast` draws the
provider's toasts as a MUI Snackbar that hides itself after 4 seconds (or on a click elsewhere).

### MuiSidekickComponents

Pre-built Material-UI components for the sidekick interface (the theme's `components`):

```jsx
import { MuiSidekickComponents } from '@shortround/mui';

// Contains:
// - IntentionPalette.Item, Input, Group, Frame, NoMatches
// - Sidekick.ControlBar, Frame, Popover  
// - SidecarContent
```

### Toast Integration

An action that returns a `message` shows it as a toast, drawn by `muiTheme`'s Toast. App code can show its own
toasts with `@shortround/react`'s `useShortRoundToast()`, anywhere below `ShortRoundProvider`:

```jsx
import { ShortRoundSidekick, useShortRoundToast } from '@shortround/react';

const saveIntention = {
  id: 'save',
  title: 'Save Item',
  action: async (input) => {
    // ... save logic
    return {
      message: 'Item saved successfully!',
      shouldReset: true
    };
  }
};

function Sidekick() {
  const { showToast } = useShortRoundToast();
  return (
    <>
      <button onClick={() => showToast({ message: 'Hello' })}>Say hello</button>
      <ShortRoundSidekick defaultIntentions={[saveIntention]} />
    </>
  );
}
```

Apps written for 0.2.x, which pass `SidekickComponents={MuiSidekickComponents}` and a `showToast` from
`useMuiToast()` inside `MuiToastProvider`, still work once they import `ShortRoundSidekick` from `@shortround/react`
(see the migration guide): those props override the provider.

## Theming

### Custom Theme

`@shortround/mui` simply consumes whatever MUI theme is already present in your React tree.  
This keeps things predictable—just customize the theme exactly the same way you would in any MUI-only project.

MUI's `ThemeProvider` goes above `ShortRoundProvider`, so the palette and its toasts both use your theme.

```jsx
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { ShortRoundProvider } from '@shortround/react';
import { muiTheme } from '@shortround/mui';

// Your application theme
const myTheme = createTheme({
  palette: {
    primary: { main: '#546570' },
  },
  spacing: 4,
  shape: { borderRadius: 4 }
});

root.render(
  <ThemeProvider theme={myTheme}>
    <ShortRoundProvider theme={muiTheme}>
      <App />
    </ShortRoundProvider>
  </ThemeProvider>
);
```

For a working reference see [`examples/todo-app/src/MuiSidekickDemo.jsx`](../../examples/todo-app/src/MuiSidekickDemo.jsx)
(the root) and [`SidekickPalette.jsx`](../../examples/todo-app/src/SidekickPalette.jsx) (app code).

### Custom Components

You can replace individual components and hand the result to `ShortRoundProvider`:

```jsx
import { muiTheme } from '@shortround/mui';
import { MyCustomInput } from './MyCustomInput';

const customTheme = {
  ...muiTheme,
  components: {
    ...muiTheme.components,
    IntentionPalette: {
      ...muiTheme.components.IntentionPalette,
      Input: MyCustomInput,
    },
  },
};
```

Slots only draw: an Input receives `input` (ShortRound's input element) to place, an Item draws inside
ShortRound's row, and the ControlBar applies the names in `labels`. The props for each slot are in
`@shortround/react`'s README ("Custom UI Components") and types; `@shortround/conformance` checks a custom slot.

With a catalog's palette, the input colours each word of a typed line by its role and greys the ghost text (the rest
of the next word); `disableLineHints` on the sidekick turns this off (`@shortround/react`'s README, "Line hints").

## Icons

MUI's own icons are Lucide React icons, drawn at 18px in the theme's `action.active` colour. Its names:
`search`, `settings`, `home`, `person`, `folder`, `file`, `code`, `palette`, `dashboard`, `notification`. Back and
Cancel have their own (`back`, `cancel`).

- Any other name shows a question mark, so a misspelling stands out.
- An intention with no `icon` shows none; its row keeps the space, so titles line up.
- To use your own icons, from any library, give `ShortRoundProvider` an icon registry: see Icons in
  `@shortround/react`'s README.
- The icons are on `MuiSidekickComponents.icons`, so an app passing `SidekickComponents` directly gets them too.

```jsx
{
  id: 'open-settings',
  title: 'Open Settings',
  icon: 'settings',
  action: async () => ({ shouldReset: true })
}
```

## Keyboard Shortcuts

An intention's `shortcut` is shown on its row, as a hint. ShortRound doesn't bind the keys; if the shortcut should
work outside the palette, the app handles it:

```jsx
{
  id: 'save',
  title: 'Save Document',
  shortcut: 'Cmd+S',
  action: async () => {
    // Save logic
    return { message: 'Document saved!' };
  }
}
```

## Sidekick Drawer

The sidekick drawer shows additional content alongside the command palette:

```jsx
const intention = {
  id: 'edit-item',
  title: 'Edit Item',
  action: async (input) => {
    return {
      sideEffects: {
        sidecarRenderer: () => (
          <div style={{ padding: '16px' }}>
            <h3>Edit Form</h3>
            <form>
              {/* Your form content */}
            </form>
          </div>
        )
      }
    };
  }
};
```

## Validation

Show validation messages in the input. The input also filters the list, so ask for free text in a step of its own,
with matching turned off (`disableInputMatching`); otherwise a name that doesn't match the row's title hides the row:

```jsx
{
  id: 'create-item',
  title: 'Create New Item',
  action: () => ({
    intentions: [
      {
        id: 'create-item::name',
        title: 'Create',
        subtitle: 'Type a name',
        validate: (input) => {
          if (!input.trim()) {
            return { valid: false, message: 'Name is required' };
          }
          if (input.length < 3) {
            return { valid: false, message: 'Name must be at least 3 characters' };
          }
          return { valid: true };
        },
        action: async (input) => {
          // Create item logic
          return { message: `Created "${input}"`, shouldReset: true };
        }
      }
    ],
    disableInputMatching: true
  })
}
```

## Complete Example

See the [todo-app example](https://github.com/csepulv/shortround/tree/main/examples/todo-app) for a full implementation showing:
- Multiple intention workflows
- Form validation
- Sidekick drawer usage
- Toast notifications
- Custom theming

## Other Packages

- **[@shortround/react](https://github.com/csepulv/shortround/tree/main/packages/shortround-react)** - The palette, sidekick, provider and theme contract for React
- **[@shortround/core](https://github.com/csepulv/shortround/tree/main/packages/shortround-core)** - The palette without a UI
- See the [GitHub repo](https://github.com/csepulv/shortround) for other package details and examples

## License

MIT 
