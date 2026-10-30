import { readFileSync } from 'node:fs';

import { expect, test, vi } from 'vitest';

import { buildPalette, findExampleFailures, loadCatalog, loadExamples } from '../index.js';

const README = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
const readYamlBlock = (firstLine) =>
  README.match(new RegExp(`\`\`\`yaml\\n(${firstLine}[\\s\\S]*?)\`\`\``))[1];

const makeBindings = () => ({
  app: {
    search: { setSort: () => {}, setMatch: vi.fn() },
    sortOptions: { rows: () => [{ value: 'relevance', title: 'Relevance' }] }
  }
});

// Keeps the README's example catalog working as the format changes.
test('the README catalog loads, resolves a typed line, and calls with its args', async () => {
  const bindings = makeBindings();

  const palette = buildPalette(loadCatalog(readYamlBlock('version: 2'), bindings), {
    backIntentionId: 'back'
  });

  expect(palette.intentions.map((item) => item.id)).toEqual([
    'app.search.setSort',
    'app.search.matchAny'
  ]);
  expect(palette.resolveInput('sort relevance')[0].id).toBe('app.search.setSort::relevance');

  await palette.intentions.find((intention) => intention.title === 'Match any').action('');
  expect(bindings.app.search.setMatch).toHaveBeenCalledExactlyOnceWith('any');
});

test("the README's examples file holds for the README's catalog", () => {
  const palette = buildPalette(loadCatalog(readYamlBlock('version: 2'), makeBindings()), {
    backIntentionId: 'back'
  });

  expect(findExampleFailures(palette, loadExamples(readYamlBlock('examples:')))).toEqual([]);
});
