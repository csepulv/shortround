export const RevertIntentionIds = Object.freeze({
  BACK: 'shortround::system::back',
  RESET: 'shortround::system::reset'
});

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

const cornerPositionKeys = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
const middlePositionKeys = ['left', 'top', 'right', 'bottom'];

const cycleNext = (current, includeCenter = true, positionKeys) => {
  const items = includeCenter ? ['center', ...positionKeys] : positionKeys;
  const idx = items.indexOf(current);
  return items[(idx + 1) % items.length || 0];
};

export const cycleCorners = (current, includeCenter) =>
  cycleNext(current, includeCenter, cornerPositionKeys);

export const cycleMiddlePositions = (current, includeCenter) =>
  cycleNext(current, includeCenter, middlePositionKeys);

export const Sizes = Object.freeze({
  COMPACT: 'compact',
  MEDIUM: 'medium',
  FULL: 'full'
});

// The accessible names of the control bar's controls. Core decides them, so switching theme can't change
// what a screen reader announces or what an app's tests find by name; themes apply them.
export const ControlLabels = Object.freeze({
  close: 'Close',
  anchor: 'Move palette',
  size: 'Palette size',
  sizes: Object.freeze({
    [Sizes.COMPACT]: 'Compact',
    [Sizes.MEDIUM]: 'Medium',
    [Sizes.FULL]: 'Full'
  })
});

// Back and Cancel's own group, kept apart from any app group (an app group may be called "Actions" too).
export const NAVIGATE_GROUP = 'Navigate';

const BACK_INTENTION = Object.freeze({
  id: RevertIntentionIds.BACK,
  title: 'Back',
  group: NAVIGATE_GROUP,
  icon: 'back'
});

const RESET_INTENTION = Object.freeze({
  id: RevertIntentionIds.RESET,
  title: 'Cancel',
  group: NAVIGATE_GROUP,
  icon: 'cancel'
});

const revertIntentions = Object.freeze([RESET_INTENTION, BACK_INTENTION]);

// A step in the dispatched stack that brought a list. Back moves between these; a step that only showed a message or
// changed the side panel left the list as it was.
export const bringsList = (step) => Boolean(step.result.intentions);

export const makeRevertIntentionsFor = (ids) =>
  ids ? revertIntentions.filter((int) => ids.includes(int.id)) : [];
