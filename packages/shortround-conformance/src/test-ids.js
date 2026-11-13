// The test hooks a theme puts on its slots, so the conformance suite (and an app's own tests) can find
// a theme's controls without knowing how it draws them.
export const TEST_IDS = {
  input: 'shortround-input',
  item: (intentionId) => `shortround-item-${intentionId}`,
  noMatches: 'shortround-no-matches',
  close: 'shortround-close',
  size: (size) => `shortround-size-${size}`,
  anchor: 'shortround-anchor',
  toast: 'shortround-toast',
  chatInput: 'shortround-chat-input'
};
