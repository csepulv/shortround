import { act, render, screen } from '@testing-library/react';

import { createSidekickStore } from '../../hooks/useSidekick.js';
import { ShortRoundSidekick } from '../ShortRoundSidekick.jsx';

const Pass = ({ children }) => <div>{children}</div>;

// A theme that only draws; its side panel shows what core renders there.
const stubComponents = {
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
  SidecarContent: ({ isOpen, renderSidecar }) =>
    isOpen ? <div data-testid="sidecar">{renderSidecar()}</div> : null
};

const CHAT = () => 'chat';
const PANEL = () => 'start panel';

const renderSidekick = ({ store, ...props }) =>
  render(
    <ShortRoundSidekick
      SidekickComponents={stubComponents}
      defaultIntentions={[]}
      sidekickStore={store}
      {...props}
    />
  );

const sidecarText = () => screen.queryByTestId('sidecar')?.textContent ?? null;

describe('ShortRoundSidekick sidecarReducer', () => {
  test('the app opens and closes the sidecar from outside React, through the reducer', () => {
    const store = createSidekickStore({ isOpen: true });
    const reasons = [];
    renderSidekick({
      store,
      sidecarReducer: (current, proposed, { reason }) => {
        reasons.push(reason);
        return proposed;
      }
    });

    act(() => store.openSidecar(CHAT));
    expect(sidecarText()).toBe('chat');

    act(() => store.closeSidecar());
    expect(sidecarText()).toBeNull();
    // Mounted open, so the palette's opening came first.
    expect(reasons).toEqual(['open', 'app', 'app']);
  });

  test('closing clears the sidecar whatever the reducer would keep, without asking it', () => {
    const store = createSidekickStore({ isOpen: true });
    const reasons = [];
    renderSidekick({
      store,
      sidecarReducer: (current, proposed, { reason }) => {
        reasons.push(reason);
        return current.renderer ? current : proposed;
      }
    });
    act(() => store.openSidecar(CHAT));

    act(() => store.set({ isOpen: false }));

    expect(store.get().internalSidecarRenderer).toBeNull();
    expect(reasons).toEqual(['open', 'app']);
  });

  test('closing from the control bar clears it too', () => {
    const store = createSidekickStore({ isOpen: true });
    renderSidekick({ store, sidecarReducer: (current) => current });
    act(() => store.openSidecar(CHAT));

    act(() => screen.getByTestId('control-bar-close').click());

    expect(store.get().internalSidecarRenderer).toBeNull();
  });

  test('opening asks the reducer, which can bring the sidecar back', () => {
    const store = createSidekickStore({ isOpen: false });
    const calls = [];
    renderSidekick({
      store,
      sidecarReducer: (current, proposed, { reason }) => {
        calls.push([proposed, reason]);
        return reason === 'open' ? { renderer: CHAT } : proposed;
      }
    });

    act(() => store.set({ isOpen: true }));

    expect(calls).toEqual([[{ renderer: null }, 'open']]);
    expect(sidecarText()).toBe('chat');
  });

  test('opening replaces a panel the app set while the palette was closed', () => {
    const store = createSidekickStore({ isOpen: false });
    renderSidekick({ store });
    act(() => store.openSidecar(CHAT));

    act(() => store.set({ isOpen: true }));

    expect(sidecarText()).toBeNull();
  });

  test('a reducer that returns current for open keeps a panel set while closed', () => {
    const store = createSidekickStore({ isOpen: false });
    renderSidekick({
      store,
      sidecarReducer: (current, proposed, { reason }) => (reason === 'open' ? current : proposed)
    });
    act(() => store.openSidecar(CHAT));

    act(() => store.set({ isOpen: true }));

    expect(sidecarText()).toBe('chat');
  });
});

describe('ShortRoundSidekick defaultSidecarRenderer', () => {
  test('the start list’s panel shows when the palette opens', () => {
    const store = createSidekickStore({ isOpen: false });
    renderSidekick({ store, defaultSidecarRenderer: PANEL });

    act(() => store.set({ isOpen: true }));

    expect(sidecarText()).toBe('start panel');
  });

  test('without one, opening shows no sidecar, as before', () => {
    const store = createSidekickStore({ isOpen: false });
    renderSidekick({ store });

    act(() => store.set({ isOpen: true }));

    expect(sidecarText()).toBeNull();
  });
});
