import { act, render, screen } from '@testing-library/react';

import { useShortRoundToast } from '../../hooks/useShortRoundTheme.js';
import { ShortRoundProvider } from '../ShortRoundProvider.jsx';
import { ShortRoundSidekick } from '../ShortRoundSidekick.jsx';

const Pass = ({ children }) => <div>{children}</div>;

// A stub theme whose control bar and toast carry the theme's name, so a test can tell which theme drew them.
const makeTheme = (name) => ({
  components: {
    IntentionPalette: {
      Frame: Pass,
      Input: () => null,
      Item: ({ intention }) => <span data-testid={`item-${intention.id}`} />,
      Group: () => null,
      NoMatches: () => null
    },
    Sidekick: {
      Frame: Pass,
      Popover: Pass,
      ControlBar: () => <span data-testid={`control-bar-${name}`} />
    },
    SidecarContent: () => null
  },
  Toast: ({ isOpen, message, onClose }) =>
    isOpen ? (
      <div data-testid={`toast-${name}`}>
        {message}
        <button data-testid={`toast-close-${name}`} onClick={onClose} />
      </div>
    ) : null
});

const themeA = makeTheme('a');
const themeB = makeTheme('b');

const savingIntention = (id = 'save') => ({
  id,
  title: 'Save',
  group: 'Files',
  action: () => ({ message: 'Saved' })
});

// App code: imports only core, names no theme.
function App({ intentions = [savingIntention()] }) {
  const { showToast } = useShortRoundToast();
  return (
    <>
      <button data-testid="app-toast" onClick={() => showToast({ message: 'Hello' })} />
      <ShortRoundSidekick defaultIntentions={intentions} initialSidekickState={{ isOpen: true }} />
    </>
  );
}

const choose = (testId) =>
  act(async () => {
    screen.getByTestId(testId).click();
  });

// React reports a render error on the console as well as throwing it.
function expectRenderToThrow(element, message) {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expect(() => render(element)).toThrow(message);
  } finally {
    consoleError.mockRestore();
  }
}

describe('ShortRoundProvider: the same app code under two themes', () => {
  test.each([
    ['a', themeA],
    ['b', themeB]
  ])("theme %s draws the palette and the app's toast", async (name, theme) => {
    render(
      <ShortRoundProvider theme={theme}>
        <App />
      </ShortRoundProvider>
    );

    expect(screen.getByTestId(`control-bar-${name}`)).toBeTruthy();
    await choose('app-toast');
    expect(screen.getByTestId(`toast-${name}`).textContent).toBe('Hello');
  });
});

describe('ShortRoundProvider: toasts', () => {
  test("an intention's message appears in the theme's toast, and onClose closes it", async () => {
    render(
      <ShortRoundProvider theme={themeA}>
        <App />
      </ShortRoundProvider>
    );

    await choose('item-save');
    expect(screen.getByTestId('toast-a').textContent).toBe('Saved');

    await choose('toast-close-a');
    expect(screen.queryByTestId('toast-a')).toBeNull();
  });

  test('useShortRoundToast outside a provider throws, naming ShortRoundProvider', () => {
    expectRenderToThrow(<App />, /ShortRoundProvider/);
  });

  test('a theme without a Toast is refused', () => {
    expectRenderToThrow(
      <ShortRoundProvider theme={{ components: themeA.components }}>
        <span />
      </ShortRoundProvider>,
      /Toast/
    );
  });

  test('a theme missing a slot group is refused, naming the group', () => {
    const { Sidekick, ...withoutSidekick } = themeA.components;
    expect(Sidekick).toBeTruthy();
    expectRenderToThrow(
      <ShortRoundProvider theme={{ ...themeA, components: withoutSidekick }}>
        <span />
      </ShortRoundProvider>,
      /components\.Sidekick/
    );
  });
});

describe('ShortRoundSidekick: props from 0.2.x keep working', () => {
  const renderWithProps = (showToast) => (
    <ShortRoundSidekick
      SidekickComponents={themeA.components}
      defaultIntentions={[savingIntention()]}
      initialSidekickState={{ isOpen: true }}
      showToast={showToast}
    />
  );

  test('slots and showToast come from props when there is no provider', async () => {
    const showToast = vi.fn();
    render(renderWithProps(showToast));

    expect(screen.getByTestId('control-bar-a')).toBeTruthy();
    await choose('item-save');
    expect(showToast).toHaveBeenCalledWith({ message: 'Saved' });
  });

  test("inside a provider, the props still win over the provider's theme", async () => {
    const showToast = vi.fn();
    render(<ShortRoundProvider theme={themeB}>{renderWithProps(showToast)}</ShortRoundProvider>);

    expect(screen.getByTestId('control-bar-a')).toBeTruthy();
    expect(screen.queryByTestId('control-bar-b')).toBeNull();
    await choose('item-save');
    expect(showToast).toHaveBeenCalledWith({ message: 'Saved' });
    expect(screen.queryByTestId('toast-b')).toBeNull();
  });

  test('each prop overrides only its own part: slots from the prop, the toast from the provider', async () => {
    render(
      <ShortRoundProvider theme={themeB}>
        <ShortRoundSidekick
          SidekickComponents={themeA.components}
          defaultIntentions={[savingIntention()]}
          initialSidekickState={{ isOpen: true }}
        />
      </ShortRoundProvider>
    );

    expect(screen.getByTestId('control-bar-a')).toBeTruthy();
    await choose('item-save');
    expect(screen.getByTestId('toast-b').textContent).toBe('Saved');
  });

  test('with neither props nor a provider, it throws, naming ShortRoundProvider', () => {
    expectRenderToThrow(
      <ShortRoundSidekick defaultIntentions={[]} initialSidekickState={{ isOpen: true }} />,
      /ShortRoundProvider/
    );
  });
});

describe('ShortRoundProvider: nested providers', () => {
  test("the inner provider's theme and toast win for its subtree; the outer keeps its own", async () => {
    render(
      <ShortRoundProvider theme={themeA}>
        <ShortRoundSidekick
          defaultIntentions={[savingIntention('outer-save')]}
          initialSidekickState={{ isOpen: true }}
        />
        <ShortRoundProvider theme={themeB}>
          <ShortRoundSidekick
            defaultIntentions={[savingIntention('inner-save')]}
            initialSidekickState={{ isOpen: true }}
          />
        </ShortRoundProvider>
      </ShortRoundProvider>
    );

    expect(screen.getAllByTestId('control-bar-a')).toHaveLength(1);
    expect(screen.getAllByTestId('control-bar-b')).toHaveLength(1);

    await choose('item-inner-save');
    expect(screen.getByTestId('toast-b').textContent).toBe('Saved');
    expect(screen.queryByTestId('toast-a')).toBeNull();

    await choose('item-outer-save');
    expect(screen.getByTestId('toast-a').textContent).toBe('Saved');
  });
});
