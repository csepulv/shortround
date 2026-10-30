import { act, fireEvent, render } from '@testing-library/react';

import { SidekickStoreProvider } from '../../hooks/useSidekick.js';
import { RevertIntentionIds } from '../../utils.js';
import { ShortRoundPalette } from '../ShortRoundPalette.jsx';

// A theme that only draws; core renders cmdk's input and rows (theme-provider M3).
const cmdkIntentionPalette = {
  Frame: ({ children }) => <div>{children}</div>,
  Input: ({ input }) => input,
  NoMatches: () => null,
  Group: () => null,
  Item: ({ intention }) => intention.title
};

const pressEnter = async (container) => {
  await act(async () => {
    fireEvent.keyDown(container.querySelector('[cmdk-root]'), { key: 'Enter' });
  });
};

const renderSubList = async (subIntentions) => {
  const open = {
    id: 'open',
    title: 'Open',
    group: 'Actions',
    action: () => ({
      intentions: subIntentions,
      includeRevertIntentions: [RevertIntentionIds.BACK, RevertIntentionIds.RESET]
    })
  };
  const view = render(
    <SidekickStoreProvider>
      <ShortRoundPalette IntentionPalette={cmdkIntentionPalette} defaultIntentions={[open]} />
    </SidekickStoreProvider>
  );
  await act(async () => {});
  await pressEnter(view.container);
  return view;
};

describe('the first highlight', () => {
  // Deferred (palette-friction plan, items 8 and 11): cmdk highlights the first row after every list swap.
  test.todo('Enter right after a list swap runs the first app row, not Cancel');
  test.todo('Enter in a typed-text prompt reaches the action without an arrow key');

  test('Back and Cancel stay at the top of the list', async () => {
    const go = { id: 'go', title: 'Go', group: 'Actions', action: vi.fn() };
    const { container } = await renderSubList([go]);

    const rowValues = [...container.querySelectorAll('[cmdk-item]')].map((row) =>
      row.getAttribute('data-value')
    );

    expect(rowValues).toEqual([RevertIntentionIds.RESET, RevertIntentionIds.BACK, 'go']);
  });
});
