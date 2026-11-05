// The sidekick is a non-modal dialog: focus moves in on open and back on close,
// Escape closes it only from inside, the page stays usable, and it is announced by name.
import { createSidekickStore } from '@shortround/core';
import { Sizes } from '@shortround/core';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { ShortRoundProvider } from '../ShortRoundProvider.jsx';
import { ShortRoundSidekick } from '../ShortRoundSidekick.jsx';

const Pass = ({ children }) => <div>{children}</div>;

const drawOnlyTheme = {
  components: {
    IntentionPalette: {
      Frame: Pass,
      Input: ({ input }) => input,
      Item: ({ intention }) => intention.title,
      Group: () => null,
      NoMatches: () => null
    },
    Sidekick: { Frame: Pass, Popover: Pass, ControlBar: ({ title }) => <span>{title}</span> },
    SidecarContent: ({ isOpen, renderSidecar }) => (isOpen ? renderSidecar() : null)
  },
  Toast: () => null
};

const intentions = [{ id: 'open', title: 'Open', group: 'Files', action: () => ({}) }];

function renderPage({
  title = 'Bookmarks',
  initial = {},
  installKeyboardShortcuts,
  defaultIntentions = intentions
} = {}) {
  const store = createSidekickStore(initial);
  render(
    <ShortRoundProvider theme={drawOnlyTheme}>
      <button data-testid="outside-button" type="button">
        Page button
      </button>
      <input data-testid="outside-input" />
      <ShortRoundSidekick
        defaultIntentions={defaultIntentions}
        installKeyboardShortcuts={installKeyboardShortcuts}
        sidekickStore={store}
        title={title}
      />
    </ShortRoundProvider>
  );
  return store;
}

const open = (store) => act(() => store.set({ isOpen: true }));
const pressEscapeOn = (element) => act(() => fireEvent.keyDown(element, { key: 'Escape' }));
const focus = (testId) => act(() => screen.getByTestId(testId).focus());

describe('focus', () => {
  test('moves into the input when the sidekick opens', () => {
    const store = renderPage();
    focus('outside-button');

    open(store);

    expect(document.activeElement).toBe(screen.getByTestId('shortround-input'));
  });

  test('returns to where it was when Escape closes the sidekick', () => {
    const store = renderPage();
    focus('outside-button');
    open(store);
    expect(document.activeElement).toBe(screen.getByTestId('shortround-input'));

    pressEscapeOn(screen.getByTestId('shortround-input'));

    expect(store.get().isOpen).toBe(false);
    expect(document.activeElement).toBe(screen.getByTestId('outside-button'));
  });

  test('stays where the user put it, if they moved to the page before the sidekick closed', () => {
    const store = renderPage();
    focus('outside-button');
    open(store);
    focus('outside-input');

    act(() => store.set({ isOpen: false }));

    expect(document.activeElement).toBe(screen.getByTestId('outside-input'));
  });

  test('moves to the dialog in compact size, which has no input', () => {
    const store = renderPage({ initial: { size: Sizes.COMPACT } });
    focus('outside-button');

    open(store);

    expect(document.activeElement).toBe(screen.getByRole('dialog'));
  });
});

describe('Escape', () => {
  test('pressed in the page leaves the sidekick open', () => {
    const store = renderPage();
    open(store);
    focus('outside-input');

    pressEscapeOn(screen.getByTestId('outside-input'));

    expect(store.get().isOpen).toBe(true);
  });

  test('Cmd/Ctrl+K still opens the sidekick from anywhere', () => {
    const store = renderPage();
    focus('outside-input');

    act(() => fireEvent.keyDown(screen.getByTestId('outside-input'), { key: 'k', ctrlKey: true }));

    expect(store.get().isOpen).toBe(true);
  });
});

describe('announced', () => {
  test('is a non-modal dialog named by the title', () => {
    const store = renderPage();
    open(store);

    const dialog = screen.getByRole('dialog', { name: 'Bookmarks' });
    expect(dialog.getAttribute('aria-modal')).toBe('false');
  });

  test('is named "ShortRound" when there is no title', () => {
    // null, not undefined: undefined would take renderPage's default title.
    const store = renderPage({ title: null });
    open(store);

    expect(screen.getByRole('dialog', { name: 'ShortRound' })).toBeTruthy();
  });

  test("labels cmdk's input with the title", () => {
    const store = renderPage();
    open(store);

    expect(screen.getAllByLabelText('Bookmarks')).toContain(screen.getByTestId('shortround-input'));
  });
});

describe('Escape belongs to whatever has focus', () => {
  test('closes from inside even when the global shortcuts are off; Ctrl+K then does nothing', () => {
    const store = renderPage({ installKeyboardShortcuts: false });
    act(() => fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true }));
    expect(store.get().isOpen).toBe(false);
    open(store);

    pressEscapeOn(screen.getByTestId('shortround-input'));

    expect(store.get().isOpen).toBe(false);
  });

  test('a widget in the side panel that handles Escape itself keeps the sidekick open', () => {
    const store = renderPage();
    open(store);
    const keepEscape = (event) => event.key === 'Escape' && event.preventDefault();
    act(() =>
      store.set({
        isSidecarOpen: true,
        internalSidecarRenderer: () => <input data-testid="panel-widget" onKeyDown={keepEscape} />
      })
    );

    pressEscapeOn(screen.getByTestId('panel-widget'));

    expect(store.get().isOpen).toBe(true);
  });
});

describe('the page stays usable', () => {
  test('clicking in the page leaves the sidekick open', () => {
    const store = renderPage();
    open(store);
    const pageButton = screen.getByTestId('outside-button');

    act(() => {
      fireEvent.pointerDown(pageButton);
      fireEvent.mouseDown(pageButton);
      fireEvent.mouseUp(pageButton);
      fireEvent.click(pageButton);
    });

    expect(store.get().isOpen).toBe(true);
  });

  test('Cmd+K (the meta key) opens the sidekick', () => {
    const store = renderPage();

    act(() => fireEvent.keyDown(document.body, { key: 'k', metaKey: true }));

    expect(store.get().isOpen).toBe(true);
  });
});

describe('focus finds its way back', () => {
  test('Cmd/Ctrl+K while open brings focus back into the sidekick', () => {
    const store = renderPage();
    open(store);
    focus('outside-input');

    act(() => fireEvent.keyDown(screen.getByTestId('outside-input'), { key: 'k', ctrlKey: true }));

    expect(document.activeElement).toBe(screen.getByTestId('shortround-input'));
  });

  test('when the app switches to compact while the input has focus, focus moves to the dialog', () => {
    const store = renderPage();
    open(store);
    expect(document.activeElement).toBe(screen.getByTestId('shortround-input'));

    act(() => store.set({ size: Sizes.COMPACT }));

    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    pressEscapeOn(document.activeElement);
    expect(store.get().isOpen).toBe(false);
  });
});

describe('choosing a row by click', () => {
  const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

  test('returns focus to the input, so typing goes on (a click leaves it on the list)', async () => {
    const store = renderPage();
    open(store);
    act(() => document.querySelector('[cmdk-list]').focus());

    act(() => screen.getByTestId('shortround-item-open').click());
    await settle();

    expect(document.activeElement).toBe(screen.getByTestId('shortround-input'));
  });

  test('leaves focus where an intention moved it', async () => {
    const toPage = {
      id: 'to-page',
      title: 'To page',
      group: 'Files',
      action: () => {
        screen.getByTestId('outside-input').focus();
        return {};
      }
    };
    const store = renderPage({ defaultIntentions: [toPage] });
    open(store);
    act(() => document.querySelector('[cmdk-list]').focus());

    act(() => screen.getByTestId('shortround-item-to-page').click());
    await settle();

    expect(document.activeElement).toBe(screen.getByTestId('outside-input'));
  });
});
