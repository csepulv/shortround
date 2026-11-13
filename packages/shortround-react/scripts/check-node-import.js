// An app's Node code (server rendering, Node tests) imports @shortround/react's built entry, as published. Loading it
// must not need a browser. `src/__tests__/node-import.test.js` checks the source; this checks the build, so a bundled
// dependency that reads `window` is caught too. Run it after `pnpm build`. (Was core's check before the split.)
if (typeof window !== 'undefined') {
  throw new Error('check-node-import must run in plain Node, with no window');
}

// By the package's own name, so Node resolves it through `exports`, as an app would.
const react = await import('@shortround/react');

for (const name of ['ShortRoundSidekick', 'LineInput', 'useShortRoundComponents']) {
  if (typeof react[name] !== 'function') {
    throw new Error(`@shortround/react's built entry loaded without ${name}`);
  }
}

console.log('@shortround/react: the built entry imports in plain Node');
