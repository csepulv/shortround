// @vitest-environment node

// An app's Node tests, or a host with no browser (a server, an editor extension), import core; it must not need one.
test('core imports with no window, and exports the headless pieces', async () => {
  expect(typeof window).toBe('undefined');

  const core = await import('../index.js');

  expect(core.createSidekickStore).toBeTypeOf('function');
  expect(core.matchIntentions).toBeTypeOf('function');
  expect(core.makeCommandBuilder).toBeTypeOf('function');
  expect(core.makeCommandLine).toBeTypeOf('function');
  expect(core.findUntypedCommands).toBeTypeOf('function');
  expect(core.findInvalidToolNames).toBeTypeOf('function');
  expect(core.buildCatalogRuntime).toBeTypeOf('function');
  expect(core.makeChatLine).toBeTypeOf('function');
  expect(core.RevertIntentionIds.BACK).toBe('shortround::system::back');
  expect(core).not.toHaveProperty('ShortRoundSidekick');
});
