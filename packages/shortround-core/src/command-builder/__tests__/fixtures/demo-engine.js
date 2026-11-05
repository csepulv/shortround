// The demo's engine: Search and Add bookmark and their stub lookups. The tags lookup can be made slow or failing, so
// loading and failure can be seen.

import { makeCommandBuilder } from '../../engine.js';
import { ADD, makeLookups, SEARCH } from './commands.js';

const SLOW_MS = 500;

export const TAGS_MODES = { normal: 'Normal', slow: 'Slow (half a second)', failing: 'Failing' };

export function makeDemoEngine({ tagsMode = 'normal' }) {
  const lookups = makeLookups();
  const tags = lookups['facetValues.tags'];
  const replacements = {
    slow: (context) => new Promise((resolve) => setTimeout(() => resolve(tags(context)), SLOW_MS)),
    failing: () =>
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('demo: tags service down')), SLOW_MS)
      )
  };
  const tagsLookup = replacements[tagsMode] ?? tags;
  return makeCommandBuilder({
    commands: [SEARCH, ADD],
    lookups: { ...lookups, 'facetValues.tags': tagsLookup }
  });
}

// Running a command shows its call; there is no app behind it.
export const runDemo = (call) => ({ message: `${call.run}(${JSON.stringify(call.args)})` });
