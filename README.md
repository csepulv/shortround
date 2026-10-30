# ShortRound

A React component library for building command palettes with "Sidekick" functionality - an enhanced command palette that
can display additional content alongside your command options.

## What is ShortRound?

ShortRound provides a flexible command palette system where:

- **Intentions** are commands that users can search and execute
  - Intentions can have `aliases` to enable fuzzy matching 
  - An `intention` can perform an `action`
    - **Action**: save a file, change a setting, display `Sidekick` content, and provide the next set of `intentions` (allows for state machines, sub pages, ...) 
- **Sidekick** a drawer that can display additional content next to the command palette (intention list).
- user input is "fuzzy matched"

## Quick Start

```bash
npm install @shortround/core @shortround/mui
```

Choose the theme once, at your app's root:

```jsx
import { ShortRoundProvider } from '@shortround/core';
import { muiTheme } from '@shortround/mui';

root.render(
  <ShortRoundProvider theme={muiTheme}>
    <App />
  </ShortRoundProvider>
);
```

Everything below the root uses only `@shortround/core`:

```jsx
import { ShortRoundSidekick } from '@shortround/core';

const intentions = [
  {
    id: 'search',
    title: 'Search Items',
    group: 'Actions',
    action: async (input) => {
      // Your search logic here
      return { intentions: searchResults };
    }
  },
  {
    id: 'settings',
    title: 'Open Settings',
    group: 'Navigation',
    action: async () => {
      // Navigate to settings
      return { shouldReset: true };
    }
  }
];

function App() {
  return (
    <div>
      <h1>My App</h1>
      <ShortRoundSidekick
        title="Short Round"
        defaultIntentions={intentions}
        installKeyboardShortcuts={true}
      />
    </div>
  );
}
```

Press `Cmd+K` (or `Ctrl+K`) to open the command palette. Switching to another theme changes only the root.

## Packages

- **[@shortround/core](packages/shortround-core)** - Core hooks and functionality
- **[@shortround/mui](packages/shortround-mui)** - Material-UI themed components
- **[@shortround/catalog](packages/shortround-catalog)** - Builds a palette from a YAML catalog of your app's states
  and commands, including typed lines such as `sort created newest` (new in 0.3.0). The
  [`catalog-discovery` skill](skills/catalog-discovery) helps a coding agent map an existing app into a catalog
- **@shortround/shadcn-ui** - shadcn/ui themed components _(coming soon)_

## Examples

Check out the [todo-app example](examples/todo-app) for a complete implementation showing:

- Multiple intention workflows
- Sidekick drawer usage
- Form validation
- Toast notifications

## Key Concepts

### Intentions

An intention is a command that users can execute:

```jsx
{
  id: 'unique-id',
  title: 'Display Name',
  group: 'Category',
  aliases: ['alternative', 'search', 'terms'],
  icon: 'icon-name',
  action: async (input) => {
    // Return new intentions, show sidecar, etc.
    return { intentions: newIntentions };
  }
}
```

### Actions

Actions can return:

- `intentions` - New set of commands to display
- `shouldReset` - Close the palette
- `sideEffects.sidecarRenderer` - Show content in the sidekick drawer
- `message` - Display a toast notification
- `includeRevertIntentions` - Add back/cancel buttons

### Sidekick Store

The sidekick manages the overlay positioning, sizing, and drawer state. It's fully customizable and can be controlled
programmatically.

## Documentation

For detailed API documentation and advanced usage, see the individual package READMEs:

- [Core Package Documentation](packages/shortround-core/README.md)
- [MUI Package Documentation](packages/shortround-mui/README.md)
- [Catalog Package Documentation](packages/shortround-catalog/README.md)

Upgrading? [MIGRATING.md](MIGRATING.md) lists what each release asks of your app, release by release.

## License

MIT 
