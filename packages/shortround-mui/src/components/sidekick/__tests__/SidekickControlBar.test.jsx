import { render, screen } from '@testing-library/react';
import { AnchorPositions } from '@shortround/core';

import { SidekickControlBar } from '../SidekickControlBar.jsx';

const renderControlBar = (props) =>
  render(
    <SidekickControlBar
      title="Short Round"
      anchorOrigin={AnchorPositions.CENTER}
      cycleAnchorOrigin={vi.fn()}
      onClose={vi.fn()}
      setSize={vi.fn()}
      size="medium"
      {...props}
    />
  );

test('clicking the selected size keeps it', () => {
  const setSize = vi.fn();
  renderControlBar({ setSize, size: 'medium' });

  screen.getByRole('button', { name: 'medium' }).click();

  expect(setSize).not.toHaveBeenCalled();
});

test('clicking another size selects it', () => {
  const setSize = vi.fn();
  renderControlBar({ setSize, size: 'medium' });

  screen.getByRole('button', { name: 'full' }).click();

  expect(setSize).toHaveBeenCalledWith('full');
});

test.each(Object.values(AnchorPositions))('renders the %s anchor position', (anchorOrigin) => {
  renderControlBar({ anchorOrigin });

  expect(screen.getByText('Short Round')).toBeInTheDocument();
});
