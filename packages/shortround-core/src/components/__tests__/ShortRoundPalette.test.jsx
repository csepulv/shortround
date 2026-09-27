import { act, render, screen } from '@testing-library/react';

import { ShortRoundPalette } from '../ShortRoundPalette.jsx';
import { SidekickStoreProvider } from '../../hooks/useSidekick.js';

const makeStubIntentionPalette = (selections = []) => ({
  Frame: ({ children }) => <div>{children}</div>,
  Input: () => null,
  NoMatches: () => null,
  Group: ({ name }) => <span>{name}</span>,
  Item: ({ intention, onSelect }) => (
    <button
      data-testid={`item-${intention.id}`}
      onClick={() => selections.push(onSelect(intention.id))}
    />
  )
});

const renderPalette = (defaultIntentions, IntentionPalette = makeStubIntentionPalette()) =>
  render(
    <SidekickStoreProvider>
      <ShortRoundPalette defaultIntentions={defaultIntentions} IntentionPalette={IntentionPalette} />
    </SidekickStoreProvider>
  );

test('the intention list gets a valid height', () => {
  const { container } = renderPalette([]);

  expect(container.querySelector('[cmdk-list]').style.height).toBe('calc(50vh - 107px)');
});

test('selecting a disabled intention completes without error', async () => {
  const selections = [];
  renderPalette(
    [{ id: 'off', title: 'Off', group: 'Actions', disabled: true, action: vi.fn() }],
    makeStubIntentionPalette(selections)
  );

  act(() => screen.getByTestId('item-off').click());

  await act(async () => {
    await expect(selections[0]).resolves.toBeUndefined();
  });
});
