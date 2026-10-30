import { AnchorPositions, ControlLabels } from '@shortround/core';
import { render, screen } from '@testing-library/react';

import { SidekickControlBar } from '../SidekickControlBar.jsx';

const renderControlBar = (props) =>
  render(
    <SidekickControlBar
      anchorOrigin={AnchorPositions.CENTER}
      cycleAnchorOrigin={vi.fn()}
      labels={ControlLabels}
      onClose={vi.fn()}
      setSize={vi.fn()}
      size="medium"
      title="Short Round"
      {...props}
    />
  );

test('clicking the selected size keeps it', () => {
  const setSize = vi.fn();
  renderControlBar({ setSize, size: 'medium' });

  screen.getByRole('button', { name: ControlLabels.sizes.medium }).click();

  expect(setSize).not.toHaveBeenCalled();
});

test('clicking another size selects it', () => {
  const setSize = vi.fn();
  renderControlBar({ setSize, size: 'medium' });

  screen.getByRole('button', { name: ControlLabels.sizes.full }).click();

  expect(setSize).toHaveBeenCalledWith('full');
});

test.each(Object.values(AnchorPositions))('renders the %s anchor position', (anchorOrigin) => {
  renderControlBar({ anchorOrigin });

  expect(screen.getByText('Short Round')).toBeInTheDocument();
});

test("the close and position controls carry core's names", () => {
  renderControlBar();

  expect(screen.getByRole('button', { name: ControlLabels.close })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: ControlLabels.anchor })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: ControlLabels.size })).toBeInTheDocument();
});
