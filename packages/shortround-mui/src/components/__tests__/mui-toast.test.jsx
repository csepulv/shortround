import { ShortRoundProvider, useShortRoundToast } from '@shortround/react';
import { act, render, screen } from '@testing-library/react';

import { muiTheme } from '../../mui-theme.js';

function ShowToastButton() {
  const { showToast } = useShortRoundToast();
  return <button data-testid="show-toast" onClick={() => showToast({ message: 'Saved' })} />;
}

afterEach(() => {
  vi.useRealTimers();
});

// The toast lives at the app's root, so it must not wait for a click to go away (or it follows the user
// to the next page).
test("muiTheme's toast hides itself after 4 seconds", () => {
  vi.useFakeTimers();
  render(
    <ShortRoundProvider theme={muiTheme}>
      <ShowToastButton />
    </ShortRoundProvider>
  );

  act(() => screen.getByTestId('show-toast').click());
  expect(screen.getByTestId('shortround-toast').textContent).toContain('Saved');

  act(() => vi.advanceTimersByTime(3900));
  expect(screen.queryByTestId('shortround-toast')).not.toBeNull();

  act(() => vi.advanceTimersByTime(100)); // the 4-second timer closes the toast
  act(() => vi.advanceTimersByTime(1000)); // then the Snackbar's exit transition runs
  expect(screen.queryByTestId('shortround-toast')).toBeNull();
});
