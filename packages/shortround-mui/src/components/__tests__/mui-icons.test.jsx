// MUI's own icons: what a row shows when the app gives ShortRound no icons of its own.
import { createSidekickStore, RevertIntentionIds } from '@shortround/core';
import { ShortRoundProvider, ShortRoundSidekick } from '@shortround/react';
import { act, render, screen } from '@testing-library/react';

import { muiTheme } from '../../mui-theme.js';
import { MuiSidekickComponents } from '../../MuiSidekickComponents.js';

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};

const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

const subList = [
  { id: 'find', title: 'Find', group: 'Files', icon: 'search', action: () => ({}) },
  { id: 'odd', title: 'Odd', group: 'Files', icon: 'nonsense', action: () => ({}) },
  { id: 'plain', title: 'Plain', group: 'Files', action: () => ({}) }
];
const open = {
  id: 'open',
  title: 'Open',
  group: 'Files',
  action: () => ({
    intentions: subList,
    includeRevertIntentions: [RevertIntentionIds.BACK, RevertIntentionIds.RESET]
  })
};

async function renderSubList() {
  render(
    <ShortRoundProvider theme={muiTheme}>
      <ShortRoundSidekick
        defaultIntentions={[open]}
        sidekickStore={createSidekickStore({ isOpen: true })}
      />
    </ShortRoundProvider>
  );
  act(() => screen.getByTestId('shortround-item-open').click());
  await settle();
}

const iconIn = (id) => screen.getByTestId(`shortround-item-${id}`).querySelector('svg');
const spaceIn = (id) =>
  screen.getByTestId(`shortround-item-${id}`).querySelectorAll('[data-testid="mui-icon-space"]');

describe("MUI's icons", () => {
  test('a known name draws its icon; an unknown one the placeholder', async () => {
    await renderSubList();

    expect(iconIn('find')).toHaveClass('lucide-search');
    expect(iconIn('odd')).toHaveClass('lucide-circle-question-mark');
  });

  test('Back and Cancel draw their own icons', async () => {
    await renderSubList();

    expect(iconIn(RevertIntentionIds.BACK)).toHaveClass('lucide-arrow-left');
    expect(iconIn(RevertIntentionIds.RESET)).toHaveClass('lucide-x');
  });

  test('a row with no icon draws none, but keeps the space', async () => {
    await renderSubList();

    expect(iconIn('plain')).toBeNull();
    expect(spaceIn('plain')).toHaveLength(1);
    expect(spaceIn('find')).toHaveLength(1);
  });

  test('icons draw at 18px, with no MUI props passed to lucide', async () => {
    await renderSubList();

    expect(iconIn('find')).toHaveAttribute('width', '18');
    expect(iconIn('find')).not.toHaveAttribute('sx');
  });

  // Lucide draws in currentColor, so the space's colour is the icon's.
  test("icons take the theme's action.active colour", async () => {
    await renderSubList();

    expect(spaceIn('find')[0]).toHaveStyle({ color: 'rgba(0, 0, 0, 0.54)' });
  });

  test('the defaults travel with the slots, for apps wired without a provider', () => {
    expect(Object.keys(MuiSidekickComponents.icons).sort()).toEqual(
      [
        'back',
        'cancel',
        'code',
        'dashboard',
        'file',
        'folder',
        'home',
        'notification',
        'palette',
        'person',
        'search',
        'settings',
        'unknown'
      ].sort()
    );
  });
});
