export const NO_OP = () => {};

export const ANIMATION_DURATION = 0.35;

export const RevertIntentionIds = Object.freeze({
  BACK: 'shortround::system::back',
  RESET: 'shortround::system::reset'
});

export const FULL_HEIGHT_POPOVER = '100vh';

export const AnchorPositions = Object.freeze({
  CENTER: 'center',
  TOP_LEFT: 'top-left',
  TOP_RIGHT: 'top-right',
  BOTTOM_RIGHT: 'bottom-right',
  BOTTOM_LEFT: 'bottom-left',
  TOP: 'top',
  RIGHT: 'right',
  BOTTOM: 'bottom',
  LEFT: 'left'
});

export const AnchorPositionDetails = Object.freeze({
  center: {
    top: window.innerHeight / 2,
    left: window.innerWidth / 2,
    transform: 'translate(-50%, -50%)'
  },
  'top-left': { top: 0, left: 0 },
  top: {
    left: window.innerHeight / 2,
    top: 0,
    transform: 'translate(-25%, 0)'
  },
  left: {
    top: window.innerHeight / 2,
    left: 0,
    transform: 'translate(0, -50%)'
  },
  'top-right': { top: 0, right: 0 },
  right: {
    top: window.innerHeight / 2,
    right: 0,
    transform: 'translate(0, -50%)'
  },
  'bottom-right': { bottom: 0, right: 0 },
  bottom: {
    left: window.innerHeight / 2,
    bottom: 0,
    transform: 'translate(-25%,0)'
  },
  'bottom-left': { bottom: 0, left: 0 }
});

const cornerPositionKeys = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
const middlePositionKeys = ['left', 'top', 'right', 'bottom'];

const cycleNext = (current, includeCenter = true, positionKeys) => {
  const items = includeCenter ? ['center', ...positionKeys] : positionKeys;
  const idx = items.indexOf(current);
  return items[(idx + 1) % items.length || 0];
};

export const cycleCorners = (current, includeCenter) => {
  return cycleNext(current, includeCenter, cornerPositionKeys);
};

export const cycleMiddlePositions = (current, includeCenter) => {
  return cycleNext(current, includeCenter, middlePositionKeys);
};

export const Sizes = Object.freeze({
  COMPACT: 'compact',
  MEDIUM: 'medium',
  FULL: 'full'
});

export const SizeDetails = Object.freeze({
  compact: { height: 'auto' },
  medium: { height: '50vh' },
  full: { height: FULL_HEIGHT_POPOVER }
});

const BACK_INTENTION = Object.freeze({
  id: RevertIntentionIds.BACK,
  title: 'Back',
  group: 'Actions',
  icon: 'back'
});

const RESET_INTENTION = Object.freeze({
  id: RevertIntentionIds.RESET,
  title: 'Cancel',
  group: 'Actions',
  icon: 'cancel'
});

const revertIntentions = Object.freeze([RESET_INTENTION, BACK_INTENTION]);

export const makeRevertIntentionsFor = (ids) =>
  ids ? revertIntentions.filter((int) => ids.includes(int.id)) : [];
