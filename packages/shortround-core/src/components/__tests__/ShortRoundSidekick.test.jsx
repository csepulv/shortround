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
