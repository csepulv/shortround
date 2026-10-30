import { act, render, screen } from '@testing-library/react';

import { createSidekickStore, SidekickStoreProvider } from '../../hooks/useSidekick.js';
import { RevertIntentionIds } from '../../utils.js';
import { ShortRoundPalette } from '../ShortRoundPalette.jsx';

// A theme that only draws (theme-provider M3): core renders cmdk's rows, and clicks reach them.
const stubIntentionPalette = {
  Frame: ({ children }) => <div>{children}</div>,
  Input: ({ input }) => input,
  NoMatches: () => null,
  Group: ({ name }) => <span>{name}</span>,
  Item: ({ intention }) => <span>{intention.title}</span>
};

const renderPalette = (defaultIntentions) =>
  render(
    <SidekickStoreProvider>
      <ShortRoundPalette
        IntentionPalette={stubIntentionPalette}
        defaultIntentions={defaultIntentions}
      />
    </SidekickStoreProvider>
  );

test('the intention list gets a valid height', () => {
  const { container } = renderPalette([]);

  expect(container.querySelector('[cmdk-list]').style.height).toBe('calc(50vh - 107px)');
});

// Choosing an intention runs it asynchronously.
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

const clickAndSettle = async (id) => {
  act(() => screen.getByTestId(`shortround-item-${id}`).click());
  await settle();
};

test('clicking a disabled intention runs nothing and completes without error', async () => {
  const action = vi.fn();
  renderPalette([{ id: 'off', title: 'Off', group: 'Actions', disabled: true, action }]);

  await clickAndSettle('off');

  expect(action).not.toHaveBeenCalled();
});

test('a rejected selection keeps Back and the sidecar', async () => {
  const store = createSidekickStore();
  const strict = {
    id: 'strict',
    title: 'Strict',
    group: 'Actions',
    validate: () => ({ valid: false, message: 'Not allowed here' }),
    action: vi.fn()
  };
  const preview = {
    id: 'preview',
    title: 'Preview',
    group: 'Actions',
    action: () => ({
      intentions: [strict],
      includeRevertIntentions: [RevertIntentionIds.BACK],
      sideEffects: { sidecarRenderer: () => 'details' }
    })
  };
  render(
    <SidekickStoreProvider store={store}>
      <ShortRoundPalette IntentionPalette={stubIntentionPalette} defaultIntentions={[preview]} />
    </SidekickStoreProvider>
  );
  await clickAndSettle('preview');

  // Not typed first: typing marks an invalid intention disabled, and cmdk ignores clicks on disabled rows.
  // Untyped, the row is enabled and dispatch's own validation rejects it.
  await clickAndSettle('strict');

  expect(strict.action).not.toHaveBeenCalled();
  expect(screen.getByTestId(`shortround-item-${RevertIntentionIds.BACK}`)).toBeInTheDocument();
  expect(store.get().isSidecarOpen).toBe(true);
});

describe('the sidecar', () => {
  const renderWithOpenSidecar = async (nextResult) => {
    const store = createSidekickStore();
    const next = { id: 'next', title: 'Next', group: 'Actions', action: () => nextResult };
    const preview = {
      id: 'preview',
      title: 'Preview',
      group: 'Actions',
      action: () => ({ intentions: [next], sideEffects: { sidecarRenderer: () => 'details' } })
    };
    render(
      <SidekickStoreProvider store={store}>
        <ShortRoundPalette IntentionPalette={stubIntentionPalette} defaultIntentions={[preview]} />
      </SidekickStoreProvider>
    );
    await clickAndSettle('preview');
    await clickAndSettle('next');
    return store;
  };

  test('stays open after a result without a renderer', async () => {
    const store = await renderWithOpenSidecar({});

    expect(store.get().isSidecarOpen).toBe(true);
  });

  test('closes when a result asks for it', async () => {
    const store = await renderWithOpenSidecar({ sideEffects: { closeSidecar: true } });

    expect(store.get().isSidecarOpen).toBe(false);
  });

  test('closes on Cancel, which returns to the start', async () => {
    const store = await renderWithOpenSidecar({
      includeRevertIntentions: [RevertIntentionIds.RESET]
    });

    await clickAndSettle(RevertIntentionIds.RESET);

    expect(store.get().isSidecarOpen).toBe(false);
  });
});
