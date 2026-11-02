import { act, fireEvent, render, screen } from '@testing-library/react';

import { createSidekickStore } from '../../hooks/useSidekick.js';
import { ShortRoundSidekick } from '../ShortRoundSidekick.jsx';

const Pass = ({ children }) => <div>{children}</div>;

const stubSidekickComponents = {
  IntentionPalette: {
    Frame: Pass,
    Input: () => null,
    Item: () => null,
    Group: () => null,
    NoMatches: () => null
  },
  Sidekick: {
    Frame: Pass,
    Popover: Pass,
    ControlBar: ({ onClose }) => <button data-testid="control-bar-close" onClick={onClose} />
  },
  SidecarContent: () => null
};

const renderOpenSidekick = (onClose) => {
  const store = createSidekickStore({ isOpen: true });
  render(
    <ShortRoundSidekick
      SidekickComponents={stubSidekickComponents}
      defaultIntentions={[]}
      onClose={onClose}
      sidekickStore={store}
    />
  );
  return store;
};

describe('ShortRoundSidekick onClose', () => {
  test('is called when the control bar closes the sidekick', () => {
    const onClose = vi.fn();
    renderOpenSidekick(onClose);

    act(() => screen.getByTestId('control-bar-close').click());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Escape closes the sidekick only from inside it (theme-provider M3).
  test('is called when Escape closes the sidekick', () => {
    const onClose = vi.fn();
    renderOpenSidekick(onClose);

    act(() => fireEvent.keyDown(screen.getByTestId('control-bar-close'), { key: 'Escape' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('is called when the app closes the sidekick through the store', () => {
    const onClose = vi.fn();
    const store = renderOpenSidekick(onClose);

    act(() => store.set({ isOpen: false }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('is not called while the sidekick stays open or opens', () => {
    const onClose = vi.fn();
    const store = createSidekickStore({ isOpen: false });
    render(
      <ShortRoundSidekick
        SidekickComponents={stubSidekickComponents}
        defaultIntentions={[]}
        onClose={onClose}
        sidekickStore={store}
      />
    );

    act(() => store.set({ isOpen: true }));

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ShortRoundSidekick initialSidekickState', () => {
  test('naming only a corner places the theme Popover there', () => {
    const Popover = vi.fn(({ children }) => <div>{children}</div>);
    render(
      <ShortRoundSidekick
        SidekickComponents={{
          ...stubSidekickComponents,
          Sidekick: { ...stubSidekickComponents.Sidekick, Popover }
        }}
        defaultIntentions={[]}
        initialSidekickState={{ isOpen: true, anchorOrigin: 'bottom-left' }}
      />
    );

    expect(Popover.mock.lastCall[0]).toMatchObject({
      anchorOrigin: 'bottom-left',
      anchorPosition: { bottom: 0, left: 0 }
    });
  });
});

describe('ShortRoundSidekick resolveDefaultInput', () => {
  test('rows resolved from typed text appear and can be chosen', async () => {
    const choose = vi.fn(() => ({}));
    const kindRow = {
      id: 'kind::library',
      title: 'Kind: library',
      group: 'Refine',
      action: choose
    };
    // A theme that only draws: core renders cmdk's input and rows (theme-provider M3).
    const typingPalette = {
      ...stubSidekickComponents.IntentionPalette,
      Input: ({ input }) => input,
      Item: ({ intention }) => <span data-testid={`item-${intention.id}`} />
    };
    render(
      <ShortRoundSidekick
        SidekickComponents={{ ...stubSidekickComponents, IntentionPalette: typingPalette }}
        defaultIntentions={[]}
        resolveDefaultInput={(text) => (text.startsWith('kind') ? [kindRow] : [])}
        sidekickStore={createSidekickStore({ isOpen: true })}
      />
    );

    fireEvent.change(screen.getByTestId('shortround-input'), { target: { value: 'kind lib' } });
    await act(async () => {
      screen.getByTestId('item-kind::library').click();
    });

    expect(choose).toHaveBeenCalledWith('kind lib');
  });
});

describe('ShortRoundSidekick resolveDefaultFallbackInput', () => {
  test('rows for unmatched text appear after the list and can be chosen', async () => {
    const send = vi.fn(() => ({}));
    const fallback = (text, { matches }) =>
      matches.length ? [] : [{ id: 'send', title: `Send: ${text}`, group: 'Chat', action: send }];
    const typingPalette = {
      ...stubSidekickComponents.IntentionPalette,
      Input: ({ input }) => input,
      Item: ({ intention }) => <span data-testid={`item-${intention.id}`} />
    };
    render(
      <ShortRoundSidekick
        SidekickComponents={{ ...stubSidekickComponents, IntentionPalette: typingPalette }}
        defaultIntentions={[{ id: 'open', title: 'Open', group: 'Files', action: () => ({}) }]}
        resolveDefaultFallbackInput={fallback}
        sidekickStore={createSidekickStore({ isOpen: true })}
      />
    );

    fireEvent.change(screen.getByTestId('shortround-input'), { target: { value: 'zzqx' } });
    await act(async () => {
      screen.getByTestId('item-send').click();
    });

    expect(send).toHaveBeenCalledWith('zzqx');
  });

  // The palette draws rows by group, in the order groups first appear, so where a fallback row is drawn depends on
  // its group.
  const drawnOrderAfterTyping = (fallbackGroup) => {
    const fallback = (text) => [
      { id: 'chat', title: `Send as chat: ${text}`, group: fallbackGroup, action: () => ({}) }
    ];
    render(
      <ShortRoundSidekick
        SidekickComponents={{
          ...stubSidekickComponents,
          IntentionPalette: {
            ...stubSidekickComponents.IntentionPalette,
            Input: ({ input }) => input
          }
        }}
        defaultIntentions={[
          { id: 'a', title: 'alpha', action: () => ({}) },
          { id: 'b', title: 'alpha file', group: 'Files', action: () => ({}) }
        ]}
        resolveDefaultFallbackInput={fallback}
        sidekickStore={createSidekickStore({ isOpen: true })}
      />
    );
    fireEvent.change(screen.getByTestId('shortround-input'), { target: { value: 'alpha' } });
    return screen
      .getAllByTestId(/^shortround-item-/)
      .map((row) => row.getAttribute('data-testid').replace('shortround-item-', ''));
  };

  test('rows in a group of their own are drawn after every match', () => {
    expect(drawnOrderAfterTyping('Chat')).toEqual(['a', 'b', 'chat']);
  });

  test("a row with no group, beside an ungrouped match, is drawn in that match's group", () => {
    expect(drawnOrderAfterTyping(undefined)).toEqual(['a', 'chat', 'b']);
  });
});
