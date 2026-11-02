// An app's Node code (server rendering, Node tests) imports core's built entry, as published. Loading it must not
// need a browser. `src/__tests__/node-import.test.js` checks the source; this checks the build, so a bundled
// dependency that reads `window` is caught too. Run it after `pnpm build`.
if (typeof window !== 'undefined') {
  throw new Error('check-node-import must run in plain Node, with no window');
}

// By the package's own name, so Node resolves it through `exports`, as an app would.
const core = await import('@shortround/core');

if (typeof core.ShortRoundSidekick !== 'function') {
  throw new Error("@shortround/core's built entry loaded without ShortRoundSidekick");
}

console.log('@shortround/core: the built entry imports in plain Node');
