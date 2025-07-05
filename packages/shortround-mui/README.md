# @shortround/mui

Material-UI themed components for ShortRound command palette library.

## Installation

```bash
npm install @shortround/core @shortround/mui
```

**Peer Dependencies:**
```bash
npm install @mui/material @emotion/react @emotion/styled @mui/icons-material lucide-react
```

## Quick Start

```jsx
import { ShortRoundSidekick } from '@shortround/core';
import { MuiSidekickComponents, useMuiToast } from '@shortround/mui';

const intentions = [
  {
    id: 'search',
    title: 'Search Items',
    group: 'Actions',
    icon: 'search', // Uses Lucide React icons
    action: async (input) => {
      return { intentions: searchResults };
    }
  }
];

function App() {
  const { showToast, ToastProvider } = useMuiToast();

  return (
    <ToastProvider>
      <div>
        <h1>My App</h1>
        <ShortRoundSidekick 
          title="Command Palette"
          defaultIntentions={intentions}
          SidekickComponents={MuiSidekickComponents}
          showToast={showToast}
          installKeyboardShortcuts={true}
        />
      </div>
    </ToastProvider>
  );
}
```

## Components

### MuiSidekickComponents

Pre-built Material-UI components for the sidekick interface:

```jsx
import { MuiSidekickComponents } from '@shortround/mui';

// Contains:
// - IntentionPalette.Item, Input, Group, Frame, NoMatches
// - Sidekick.ControlBar, Frame, Popover  
// - SidecarContent
// - ThemeProvider
```

### Toast Integration

```jsx
import { useMuiToast, MuiToastProvider } from '@shortround/mui';

function MyComponent() {
  const { showToast } = useMuiToast();
  
  // Use in intention actions
  const intention = {
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

  return (
    <MuiToastProvider>
      <ShortRoundSidekick 
        showToast={showToast}
        // ... other props
      />
    </MuiToastProvider>
  );
}
```

## Theming

### Custom Theme

```jsx
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { MuiSidekickComponents } from '@shortround/mui';

const customTheme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
  },
  shape: {
    borderRadius: 8,
  },
});

// Override the default theme
const CustomSidekickComponents = {
  ...MuiSidekickComponents,
  ThemeProvider: ({ children }) => (
    <ThemeProvider theme={customTheme}>
      {children}
    </ThemeProvider>
  ),
};

function App() {
  return (
    <ShortRoundSidekick 
      SidekickComponents={CustomSidekickComponents}
      // ... other props
    />
  );
}
```

### Custom Components

You can replace individual components:

```jsx
import { MuiSidekickComponents } from '@shortround/mui';
import { MyCustomInput } from './MyCustomInput';

const CustomComponents = {
  ...MuiSidekickComponents,
  IntentionPalette: {
    ...MuiSidekickComponents.IntentionPalette,
    Input: MyCustomInput,
  },
};
```

## Icons

Icons use Lucide React by default. Supported icon names include:
- `search`, `settings`, `user`, `home`, `back`, `cancel`
- Any valid Lucide React icon name

Custom icon mapping:
```jsx
// In your intention
{
  id: 'custom',
  title: 'Custom Action',
  icon: 'star', // Maps to Lucide's Star icon
  action: async () => ({ shouldReset: true })
}
```

## Keyboard Shortcuts

The MUI components support keyboard shortcuts displayed in the interface:

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

Show validation messages in the input:

```jsx
{
  id: 'create-item',
  title: 'Create New Item',
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
```

## Complete Example

See the [todo-app example](https://github.com/csepulv/shortround/tree/main/examples/todo-app) for a full implementation showing:
- Multiple intention workflows
- Form validation
- Sidekick drawer usage
- Toast notifications
- Custom theming

## Other Packages

- **[@shortround/core](https://github.com/csepulv/shortround)** - Core hooks and functionality
- See the [GitHub repo](https://github.com/csepulv/shortround) for other package details and examples

## License

MIT 