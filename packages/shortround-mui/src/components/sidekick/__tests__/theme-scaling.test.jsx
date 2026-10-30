import { createTheme, ThemeProvider } from '@mui/material';
import { AnchorPositions, ControlLabels } from '@shortround/core';
import { render, screen } from '@testing-library/react';

import { IntentionPaletteFrame } from '../../intention-palette/IntentionPaletteFrame.jsx';
import { SidekickControlBar } from '../SidekickControlBar.jsx';
import { SidekickFrame } from '../SidekickFrame.jsx';
import { SidekickPopover } from '../SidekickPopover.jsx';

// A consumer theme unlike the example app's (spacing 4, radius 2): MUI's default
// spacing (8px) and a larger corner radius, as in Junk Drawer.
const consumerTheme = createTheme({ shape: { borderRadius: 8 } });

const renderInTheme = (ui) => render(<ThemeProvider theme={consumerTheme}>{ui}</ThemeProvider>);

const styleOf = (element) => window.getComputedStyle(element);

test('frame corners use the theme radius, not a multiple of it', () => {
  renderInTheme(
    <SidekickFrame commandWidth="40vw" height="50vh">
      <span data-testid="frame-child" />
    </SidekickFrame>
  );

  const frame = screen.getByTestId('frame-child').parentElement;
  expect(styleOf(frame).borderRadius).toBe('8px');
});

test('frame has an opaque paper background', () => {
  renderInTheme(
    <SidekickFrame commandWidth="40vw" height="50vh">
      <span data-testid="frame-child" />
    </SidekickFrame>
  );

  const frame = screen.getByTestId('frame-child').parentElement;
  expect(styleOf(frame).backgroundColor).toBe('rgb(255, 255, 255)');
});

test('popover corners use the theme radius, not a multiple of it', () => {
  renderInTheme(
    <SidekickPopover anchorOrigin={AnchorPositions.CENTER} height="50vh" totalWidth="40vw">
      <span data-testid="popover-child" />
    </SidekickPopover>
  );

  const popover = screen.getByTestId('popover-child').parentElement.parentElement;
  expect(styleOf(popover).borderRadius).toBe('8px');
});

test('control bar keeps its buttons off the edges and has an opaque background', () => {
  renderInTheme(
    <SidekickControlBar
      anchorOrigin={AnchorPositions.CENTER}
      cycleAnchorOrigin={vi.fn()}
      labels={ControlLabels}
      onClose={vi.fn()}
      setSize={vi.fn()}
      size="medium"
      title="Junk Drawer"
    />
  );

  const bar = screen.getByText('Junk Drawer').parentElement;
  expect(styleOf(bar).paddingLeft).toBe('8px');
  expect(styleOf(bar).paddingRight).toBe('8px');
  expect(styleOf(bar).backgroundColor).toBe('rgb(255, 255, 255)');
});

test('palette items use the theme radius, not a multiple of it', () => {
  renderInTheme(
    <IntentionPaletteFrame height="50vh">
      <div data-testid="item" {...{ 'cmdk-item': '' }} />
    </IntentionPaletteFrame>
  );

  expect(styleOf(screen.getByTestId('item')).borderRadius).toBe('8px');
});
