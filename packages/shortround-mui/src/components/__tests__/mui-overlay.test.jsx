// MUI's Popover portals its children a render after it mounts; core's focus handling must still reach the
// input and return focus on close.
import { createSidekickStore } from '@shortround/core';
import { ShortRoundProvider, ShortRoundSidekick } from '@shortround/react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { muiTheme } from '../../mui-theme.js';

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};

const intentions = [{ id: 'open', title: 'Open', group: 'Files', action: () => ({}) }];

test("focus moves into MUI's portalled palette on open and returns on Escape", () => {
  const store = createSidekickStore();
  render(
    <ShortRoundProvider theme={muiTheme}>
      <button data-testid="outside-button" type="button">
        Page button
      </button>
      <ShortRoundSidekick defaultIntentions={intentions} sidekickStore={store} title="Bookmarks" />
    </ShortRoundProvider>
  );
  act(() => screen.getByTestId('outside-button').focus());

  act(() => store.set({ isOpen: true }));
  expect(document.activeElement).toBe(screen.getByTestId('shortround-input'));
  expect(screen.getByRole('dialog', { name: 'Bookmarks' })).toBeTruthy();

  act(() => fireEvent.keyDown(screen.getByTestId('shortround-input'), { key: 'Escape' }));
  expect(store.get().isOpen).toBe(false);
  expect(document.activeElement).toBe(screen.getByTestId('outside-button'));
});
