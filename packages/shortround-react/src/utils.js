// The React layer's own constants: layout in CSS, animation and naming. The constants a custom UI also needs
// (RevertIntentionIds, AnchorPositions, Sizes, ControlLabels, ...) are @shortround/core's.

export const NO_OP = () => {};

export const ANIMATION_DURATION = 0.35;

export const FULL_HEIGHT_POPOVER = '100vh';

// Where the sidekick sits for each anchor origin, in CSS alone: it follows the window as it resizes, and reading this
// module needs no browser.
export const AnchorPositionDetails = Object.freeze({
  center: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
  'top-left': { top: 0, left: 0 },
  top: { top: 0, left: '50%', transform: 'translateX(-50%)' },
  left: { top: '50%', left: 0, transform: 'translateY(-50%)' },
  'top-right': { top: 0, right: 0 },
  right: { top: '50%', right: 0, transform: 'translateY(-50%)' },
  'bottom-right': { bottom: 0, right: 0 },
  bottom: { bottom: 0, left: '50%', transform: 'translateX(-50%)' },
  'bottom-left': { bottom: 0, left: 0 }
});

export const SizeDetails = Object.freeze({
  compact: { height: 'auto' },
  medium: { height: '50vh' },
  full: { height: FULL_HEIGHT_POPOVER }
});

// The sidekick's accessible name when the app gives it no title.
export const DEFAULT_SIDEKICK_NAME = 'ShortRound';
