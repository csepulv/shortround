import { createSidekickStore } from '@shortround/core';
import { act, render, renderHook, screen } from '@testing-library/react';
import { useState } from 'react';

import {
  SidekickStoreProvider,
  useShortRoundKeyboardShortcuts,
  useSidekick
} from '../useSidekick.js';

const pressCtrlK = () =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));

function OpenStateProbe() {
  const { isOpen, onOpen } = useSidekick();
  return (
    <>
      <span data-testid="is-open">{String(isOpen)}</span>
      <button data-testid="open" onClick={onOpen} />
    </>
  );
}

function RerenderingParent() {
  const [count, setCount] = useState(0);
  return (
    <>
      <button data-testid="rerender-parent" onClick={() => setCount(count + 1)} />
      <SidekickStoreProvider>
        <OpenStateProbe />
      </SidekickStoreProvider>
    </>
  );
}

describe('SidekickStoreProvider', () => {
  test('keeps its store when the parent re-renders', () => {
    render(<RerenderingParent />);

    act(() => screen.getByTestId('open').click());
    act(() => screen.getByTestId('rerender-parent').click());

    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
  });

  test('a nested provider shares the ancestor store', () => {
    function OuterOpener() {
      const { onOpen } = useSidekick();
      return <button data-testid="outer-open" onClick={onOpen} />;
    }
    render(
      <SidekickStoreProvider>
        <OuterOpener />
        <SidekickStoreProvider>
          <OpenStateProbe />
        </SidekickStoreProvider>
      </SidekickStoreProvider>
    );

    act(() => screen.getByTestId('outer-open').click());

    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
  });
});

describe('useSidekick setSize', () => {
  test('rejects an unknown size and keeps the current one', () => {
    const { result } = renderHook(() => useSidekick());

    expect(() => act(() => result.current.setSize(null))).toThrow('Unknown size: null');
    expect(result.current.size).toBe('medium');
  });
});

describe('useSidekick anchor position', () => {
  const positionFor = (init) =>
    renderHook(() => useSidekick({ store: createSidekickStore(init) })).result.current
      .anchorPosition;

  test('a store created with only a corner opens in that corner', () => {
    expect(positionFor({ anchorOrigin: 'bottom-left' })).toEqual({ bottom: 0, left: 0 });
  });

  test.each([
    ['center', { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }],
    ['top-left', { top: 0, left: 0 }],
    ['top', { top: 0, left: '50%', transform: 'translateX(-50%)' }],
    ['top-right', { top: 0, right: 0 }],
    ['right', { top: '50%', right: 0, transform: 'translateY(-50%)' }],
    ['bottom-right', { bottom: 0, right: 0 }],
    ['bottom', { bottom: 0, left: '50%', transform: 'translateX(-50%)' }],
    ['bottom-left', { bottom: 0, left: 0 }],
    ['left', { top: '50%', left: 0, transform: 'translateY(-50%)' }]
  ])('%s is placed by CSS alone, whatever the window size', (origin, expected) => {
    expect(positionFor({ anchorOrigin: origin })).toEqual(expected);
  });

  test('the default is the center', () => {
    expect(positionFor()).toEqual({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
  });

  // An app that worked around 0.3.0 by storing a position as well keeps working.
  test('a position stored beside the corner is ignored', () => {
    expect(positionFor({ anchorOrigin: 'bottom-left', anchorPosition: { top: 5 } })).toEqual({
      bottom: 0,
      left: 0
    });
  });

  test('moving the corner moves the position', () => {
    const store = createSidekickStore();
    const { result } = renderHook(() => useSidekick({ store }));

    act(() => result.current.setAnchorOrigin('top-right'));
    expect(result.current.anchorPosition).toEqual({ top: 0, right: 0 });

    act(() => result.current.cycleAnchorOrigin());
    expect(result.current.anchorOrigin).toBe('bottom-right');
    expect(result.current.anchorPosition).toEqual({ bottom: 0, right: 0 });
  });
});

describe('useShortRoundKeyboardShortcuts', () => {
  test('uses the latest callbacks', () => {
    const firstOnOpen = vi.fn();
    const latestOnOpen = vi.fn();
    const { rerender } = renderHook((props) => useShortRoundKeyboardShortcuts(props), {
      initialProps: { onOpen: firstOnOpen, onClose: vi.fn() }
    });

    rerender({ onOpen: latestOnOpen, onClose: vi.fn() });
    pressCtrlK();

    expect(firstOnOpen).not.toHaveBeenCalled();
    expect(latestOnOpen).toHaveBeenCalledTimes(1);
  });

  test('stops listening after unmount', () => {
    const onOpen = vi.fn();
    const { unmount } = renderHook(() =>
      useShortRoundKeyboardShortcuts({ onOpen, onClose: vi.fn() })
    );

    unmount();
    pressCtrlK();

    expect(onOpen).not.toHaveBeenCalled();
  });
});
