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
    const { unmount } = renderHook(() => useShortRoundKeyboardShortcuts({ onOpen, onClose: vi.fn() }));

    unmount();
    pressCtrlK();

    expect(onOpen).not.toHaveBeenCalled();
  });
});
