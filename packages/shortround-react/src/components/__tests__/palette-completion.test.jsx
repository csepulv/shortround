import { act, fireEvent, render, screen } from '@testing-library/react';

import { SidekickStoreProvider } from '../../hooks/useSidekick.js';
import { ShortRoundPalette } from '../ShortRoundPalette.jsx';

// A theme that only draws, as in ShortRoundPalette.test.jsx.
const stubIntentionPalette = {
  Frame: ({ children }) => <div>{children}</div>,
  Input: ({ input }) => input,
  NoMatches: () => null,
  Group: ({ name }) => <span>{name}</span>,
  Item: ({ intention }) => <span>{intention.title}</span>
};

const renderPalette = (props) =>
  render(
    <SidekickStoreProvider>
      <ShortRoundPalette IntentionPalette={stubIntentionPalette} {...props} />
    </SidekickStoreProvider>
  );

const input = () => screen.getByTestId('shortround-input');

describe('completion rows', () => {
  test('selecting one rewrites the input and runs nothing', () => {
    const action = vi.fn();
    renderPalette({
      defaultIntentions: [{ id: 'next:search', title: 'search', completion: 'search ', action }]
    });

    fireEvent.click(screen.getByText('search'));

    expect(input()).toHaveValue('search ');
    expect(action).not.toHaveBeenCalled();
  });

  // cmdk trims item values; a completion's id often ends with its text's trailing space.
  test('a row whose id ends with a space still selects (Enter on the highlighted row)', () => {
    const action = vi.fn();
    renderPalette({
      defaultIntentions: [
        {
          id: 'next:add with tags react ',
          title: 'react',
          completion: 'add with tags react ',
          action
        }
      ]
    });

    fireEvent.keyDown(input(), { key: 'Enter' });

    expect(input()).toHaveValue('add with tags react ');
    expect(action).not.toHaveBeenCalled();
  });

  test('Tab applies the first enabled completion row', () => {
    const action = vi.fn();
    renderPalette({
      defaultIntentions: [
        { id: 'run', title: 'Run now', action },
        { id: 'next:off', title: 'off', completion: 'off ', disabled: true, action },
        { id: 'next:find', title: 'find', completion: 'find ', action }
      ]
    });

    fireEvent.keyDown(input(), { key: 'Tab' });

    expect(input()).toHaveValue('find ');
    expect(action).not.toHaveBeenCalled();
  });

  test('Tab does nothing special when there is no completion row', () => {
    renderPalette({ defaultIntentions: [{ id: 'run', title: 'Run now', action: vi.fn() }] });

    const event = fireEvent.keyDown(input(), { key: 'Tab' });

    expect(event).toBe(true);
    expect(input()).toHaveValue('');
  });
});

describe('a resolver that says its rows changed', () => {
  function makeLateResolver() {
    let rows = [];
    let listener;
    const resolveInput = () => rows;
    resolveInput.subscribe = (onChange) => {
      listener = onChange;
      return () => {
        listener = undefined;
      };
    };
    return {
      resolveInput,
      land: (landed) => {
        rows = landed;
        listener?.();
      },
      isSubscribed: () => listener !== undefined
    };
  }

  test('core renders again with the new rows, though the input is unchanged', () => {
    const late = makeLateResolver();
    renderPalette({ defaultIntentions: [], resolveDefaultInput: late.resolveInput });
    fireEvent.change(input(), { target: { value: 'tags re' } });
    expect(screen.queryByText('Tags: react')).not.toBeInTheDocument();

    act(() => late.land([{ id: 'late', title: 'Tags: react', action: vi.fn() }]));

    expect(screen.getByText('Tags: react')).toBeInTheDocument();
  });

  test('core unsubscribes when the palette goes away', () => {
    const late = makeLateResolver();
    const { unmount } = renderPalette({
      defaultIntentions: [],
      resolveDefaultInput: late.resolveInput
    });
    expect(late.isSubscribed()).toBe(true);

    unmount();

    expect(late.isSubscribed()).toBe(false);
  });
});
