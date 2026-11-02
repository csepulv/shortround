// @vitest-environment node

// An app's Node tests import code that imports core; the import must not need a browser.
test('core imports with no window', async () => {
  expect(typeof window).toBe('undefined');

  const core = await import('../index.js');

  expect(core.ShortRoundSidekick).toBeTypeOf('function');
});
