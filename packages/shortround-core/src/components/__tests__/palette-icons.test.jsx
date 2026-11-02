import { render, screen, within } from '@testing-library/react';

import { createSidekickStore } from '../../hooks/useSidekick.js';
import { ShortRoundProvider } from '../ShortRoundProvider.jsx';
import { ShortRoundSidekick } from '../ShortRoundSidekick.jsx';

const Pass = ({ children }) => <div>{children}</div>;

const AppIcon = ({ name }) => <i data-testid="app-icon">{name}</i>;
const SpecialIcon = () => <i data-testid="special-icon" />;
const ThemeSettings = () => <i data-testid="theme-settings" />;

// A theme that only draws: its Item shows the icon core hands it.
const stubComponents = {
  IntentionPalette: {
    Frame: Pass,
    Input: () => null,
    Item: ({ intention, icon }) => <span data-testid={`row-${intention.id}`}>{icon}</span>,
    Group: () => null,
    NoMatches: () => null
  },
  Sidekick: { Frame: Pass, Popover: Pass, ControlBar: () => null },
  SidecarContent: () => null,
  icons: { settings: ThemeSettings }
};
const stubTheme = { components: stubComponents, Toast: () => null };

const rows = (...specs) =>
  specs.map(([id, icon]) => ({ id, title: id, group: 'Actions', icon, action: () => {} }));

const renderWithProvider = (icons, intentions) =>
  render(
    <ShortRoundProvider icons={icons} theme={stubTheme}>
      <ShortRoundSidekick
        defaultIntentions={intentions}
        sidekickStore={createSidekickStore({ isOpen: true })}
      />
    </ShortRoundProvider>
  );

const rowOf = (id) => screen.getByTestId(`row-${id}`);

describe('icons from the registry', () => {
  test("an app's own Icon draws every named row, with names mapping first", () => {
    renderWithProvider(
      { Icon: AppIcon, names: { chat: 'forum' } },
      rows(['chat', 'chat'], ['find', 'search'], ['plain', undefined])
    );

    expect(within(rowOf('chat')).getByTestId('app-icon')).toHaveTextContent('forum');
    expect(within(rowOf('find')).getByTestId('app-icon')).toHaveTextContent('search');
    expect(rowOf('plain')).toBeEmptyDOMElement();
  });

  test('one intention gets its own icon', () => {
    renderWithProvider(
      { Icon: AppIcon, intentions: { send: SpecialIcon } },
      rows(['send', 'chat'], ['other', undefined])
    );

    expect(within(rowOf('send')).getByTestId('special-icon')).toBeInTheDocument();
    expect(rowOf('other')).toBeEmptyDOMElement();
  });

  test("without a registry, the theme's icons", () => {
    renderWithProvider(undefined, rows(['prefs', 'settings']));

    expect(within(rowOf('prefs')).getByTestId('theme-settings')).toBeInTheDocument();
  });
});

describe('icons without a provider', () => {
  test("an app passing SidekickComponents keeps the theme's icons", () => {
    render(
      <ShortRoundSidekick
        SidekickComponents={stubComponents}
        defaultIntentions={rows(['prefs', 'settings'])}
        sidekickStore={createSidekickStore({ isOpen: true })}
      />
    );

    expect(within(rowOf('prefs')).getByTestId('theme-settings')).toBeInTheDocument();
  });
});
