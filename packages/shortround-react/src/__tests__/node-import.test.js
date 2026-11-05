// @vitest-environment node

// An app's Node tests import code that imports @shortround/react; the import must not need a browser.
test('react imports with no window', async () => {
  expect(typeof window).toBe('undefined');

  const react = await import('../index.js');

  expect(react.ShortRoundSidekick).toBeTypeOf('function');
});
