import { act, fireEvent, render } from '@testing-library/react';

import { SidekickStoreProvider } from '../../hooks/useSidekick.js';
import { RevertIntentionIds } from '../../utils.js';
import { ShortRoundPalette } from '../ShortRoundPalette.jsx';

const { BACK, RESET } = RevertIntentionIds;

// A theme that only draws; core renders cmdk's input and rows (theme-provider M3).
const cmdkIntentionPalette = {
  Frame: ({ children }) => <div>{children}</div>,
  Input: ({ input }) => input,
  NoMatches: () => null,
  Group: ({ name }) => <span>{name}</span>,
  Item: ({ intention }) => intention.title
};

const press = async (container, key) => {
  await act(async () => {
    fireEvent.keyDown(container.querySelector('[cmdk-root]'), { key });
  });
};

const type = async (container, text) => {
  await act(async () => {
    fireEvent.change(container.querySelector('[cmdk-input]'), { target: { value: text } });
  });
};

const highlighted = (container) =>
  container.querySelector('[cmdk-item][data-selected="true"]')?.getAttribute('data-value');

const rowValues = (container) =>
  [...container.querySelectorAll('[cmdk-item]')].map((row) => row.getAttribute('data-value'));

const navigateGroup = (container) =>
  container.querySelector(`[cmdk-item][data-value="${BACK}"]`)?.closest('[cmdk-group]');

// "Open" brings `result`; pressing Enter on it swaps the list, so the next Enter comes right after a swap.
const openSubList = async (result) => {
  const open = { id: 'open', title: 'Open', group: 'Actions', action: () => result };
  const view = render(
    <SidekickStoreProvider>
      <ShortRoundPalette IntentionPalette={cmdkIntentionPalette} defaultIntentions={[open]} />
    </SidekickStoreProvider>
  );
  await act(async () => {});
  await press(view.container, 'Enter');
  return view;
};

const makePicker = () => {
  const ran = vi.fn();
  const rows = ['One', 'Two'].map((title) => ({
    id: title.toLowerCase(),
    title,
    group: 'Actions',
    action: () => ran(title)
  }));
  return { ran, result: { intentions: rows, includeRevertIntentions: [BACK, RESET] } };
};

describe('the first highlight', () => {
  test('Enter right after a list swap runs the first app row, not Cancel', async () => {
    const { ran, result } = makePicker();
    const { container } = await openSubList(result);

    expect(highlighted(container)).toBe('one');
    await press(container, 'Enter');

    expect(ran).toHaveBeenCalledWith('One');
  });

  test('typing a value and pressing Enter runs that value', async () => {
    const { ran, result } = makePicker();
    const { container } = await openSubList(result);

    await type(container, 'Two');
    await press(container, 'Enter');

    expect(ran).toHaveBeenCalledWith('Two');
  });

  test('Enter in a typed-text prompt reaches the action without an arrow key', async () => {
    const ran = vi.fn();
    const step = {
      id: 'note',
      title: 'Note text',
      group: 'Actions',
      action: (typed) => ran(typed)
    };
    const { container } = await openSubList({
      intentions: [step],
      disableInputMatching: true,
      includeRevertIntentions: [BACK]
    });

    await type(container, 'notes');
    await press(container, 'Enter');

    expect(ran).toHaveBeenCalledWith('notes');
  });

  test('skips a disabled first row', async () => {
    const { result } = makePicker();
    result.intentions[0] = { ...result.intentions[0], disabled: true };
    const { container } = await openSubList(result);

    expect(highlighted(container)).toBe('two');
  });

  // A keyboard habit from before: in a text prompt, ArrowDown now leaves the step for Back.
  test('in a typed-text prompt, ArrowDown from the step reaches Back', async () => {
    const step = { id: 'note', title: 'Note text', group: 'Actions', action: vi.fn() };
    const { container } = await openSubList({
      intentions: [step],
      disableInputMatching: true,
      includeRevertIntentions: [BACK]
    });

    await press(container, 'ArrowDown');

    expect(highlighted(container)).toBe(BACK);
  });
});

describe('arrow keys', () => {
  test('wrap around in a list without Back or Cancel', async () => {
    const rows = ['a', 'b'].map((id) => ({ id, title: id, group: 'Actions', action: vi.fn() }));
    const { container } = render(
      <SidekickStoreProvider>
        <ShortRoundPalette IntentionPalette={cmdkIntentionPalette} defaultIntentions={rows} />
      </SidekickStoreProvider>
    );
    await act(async () => {});

    await press(container, 'ArrowUp');
    expect(highlighted(container)).toBe('b');

    await press(container, 'ArrowDown');
    expect(highlighted(container)).toBe('a');
  });
});

describe('Back and Cancel', () => {
  test('come last in the DOM, in their own group named Navigate, drawn first', async () => {
    const { result } = makePicker();
    const { container } = await openSubList(result);

    expect(rowValues(container)).toEqual(['one', 'two', RESET, BACK]);
    expect(navigateGroup(container)).toHaveTextContent('Navigate');
    expect(navigateGroup(container)).toHaveStyle({ order: '-1' });
    expect(navigateGroup(container).parentElement).toHaveStyle({
      display: 'flex',
      flexDirection: 'column'
    });
  });

  test('do not share a group with app rows in a group named Actions', async () => {
    const { result } = makePicker();
    const { container } = await openSubList(result);

    const appRow = container.querySelector('[cmdk-item][data-value="one"]');
    expect(navigateGroup(container).contains(appRow)).toBe(false);
  });

  test('do not share a group with app rows in a group also named Navigate', async () => {
    const { result } = makePicker();
    result.intentions = result.intentions.map((row) => ({ ...row, group: 'Navigate' }));
    const { container } = await openSubList(result);

    const appRow = container.querySelector('[cmdk-item][data-value="one"]');
    expect(navigateGroup(container).contains(appRow)).toBe(false);
    expect(container.querySelectorAll('[cmdk-group]')).toHaveLength(2);
  });

  test('ArrowUp from the first app row reaches Back; ArrowDown from Back returns', async () => {
    const { result } = makePicker();
    const { container } = await openSubList(result);

    await press(container, 'ArrowUp');
    expect(highlighted(container)).toBe(BACK);

    await press(container, 'ArrowDown');
    expect(highlighted(container)).toBe('one');
  });

  // cmdk scrolls the highlighted row into view, not the theme's heading above it.
  test('highlighting one brings the Navigate group, heading included, into view', async () => {
    const { result } = makePicker();
    const { container } = await openSubList(result);
    const scrolled = vi.spyOn(navigateGroup(container), 'scrollIntoView');

    await press(container, 'ArrowUp');
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));

    expect(scrolled).toHaveBeenCalledWith({ block: 'nearest' });
  });
});
