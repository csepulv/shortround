// Core is headless: a host with no browser and no React (a server, an editor extension, a Node test) imports core's
// built entry, as published, and drives the palette. `src/__tests__/node-import.test.js` checks the source; this checks
// the build, so a bundled dependency that reads `window` or pulls in React is caught too. It covers the scenario "a
// custom UI drives the palette without React". Run it after `pnpm build`.
import { createRequire } from 'node:module';

const fail = (message) => {
  throw new Error(`check-node-import: ${message}`);
};

if (typeof window !== 'undefined') {
  fail('must run in plain Node, with no window');
}

// React must not be reachable from core: nothing core loads could then quietly depend on it.
const requireFromCore = createRequire(new URL('../package.json', import.meta.url));
const findsReact = (() => {
  try {
    requireFromCore.resolve('react');
    return true;
  } catch {
    // Not resolvable is the expected outcome.
    return false;
  }
})();
if (findsReact) {
  fail('react resolves from @shortround/core; core must not depend on it');
}

// By the package's own name, so Node resolves it through `exports`, as an app would.
const core = await import('@shortround/core');

for (const name of [
  'createPaletteStore',
  'createSidekickStore',
  'matchIntentions',
  'loadCatalog',
  'buildPalette',
  'makeCommandBuilder',
  'makeCommandLine',
  'findUntypedCommands'
]) {
  if (typeof core[name] !== 'function') {
    fail(`the built entry has no ${name}`);
  }
}
if ('ShortRoundSidekick' in core) {
  fail('the built entry still exports ShortRoundSidekick, a React component');
}

// Drive the palette as a custom UI would: type, choose a row that brings a list, go Back.
const leaf = { id: 'leaf', title: 'Leaf', action: () => ({}) };
const open = {
  id: 'open',
  title: 'Open things',
  action: () => ({ intentions: [leaf], includeRevertIntentions: [core.RevertIntentionIds.BACK] })
};
const palette = core.createPaletteStore({ defaultIntentions: [open] });
palette.changeInput('open');
const typed = palette
  .rows()
  .map(({ id }) => id)
  .join(',');
await palette.select('open');
const opened = palette
  .rows()
  .map(({ id }) => id)
  .join(',');
await palette.select(core.RevertIntentionIds.BACK);
const back = palette
  .rows()
  .map(({ id }) => id)
  .join(',');

if (typed !== 'open' || opened !== 'leaf' || back !== 'open') {
  fail(
    `the palette read "${typed}", then "${opened}", then "${back}"; expected "open", "leaf", "open"`
  );
}

// Read a typed whole command, so the engine's own dependencies (a CommonJS one among them) load from the build.
const engine = core.makeCommandBuilder({
  commands: [
    {
      name: 'find',
      label: 'Find',
      aliases: [],
      run: 'app.find',
      params: {
        term: { label: 'Term', default: true, argSource: { freeform: true, type: 'text' } }
      }
    }
  ],
  lookups: {}
});
const [reading] = engine.read('find grid').readings;
if (reading?.call?.args?.term !== 'grid') {
  fail(`the engine read "find grid" as ${JSON.stringify(reading?.call)}; expected the term "grid"`);
}

// Drive a command line over the same engine, as a non-React host (an editor's slash command) would: type, submit.
const ran = [];
const line = core.makeCommandLine({ builder: engine, run: (call) => ran.push(call.args) });
line.change('find grid');
await line.submit();
if (ran.length !== 1 || ran[0].term !== 'grid' || line.getState().text !== '') {
  fail(
    `the command line ran ${JSON.stringify(ran)} and left "${line.getState().text}"; expected one run of "grid"`
  );
}

console.log(
  '@shortround/core: the built entry imports in plain Node, without React, drives the palette, reads a typed command and runs a command line'
);
