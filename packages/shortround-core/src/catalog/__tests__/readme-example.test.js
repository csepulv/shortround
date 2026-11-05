import { readFileSync } from 'node:fs';

import { expect, test, vi } from 'vitest';

import { buildPalette, findExampleFailures, loadCatalog, loadExamples } from '../index.js';

const README = readFileSync(new URL('../../../CATALOG.md', import.meta.url), 'utf8');
const readYamlBlock = (firstLine) =>
  README.match(new RegExp(`\`\`\`yaml\\n(${firstLine}[\\s\\S]*?)\`\`\``))[1];

const makeBindings = () => ({
  app: {
    search: { apply: vi.fn() },
    sortOptions: { rows: () => [{ value: 'relevance', title: 'Relevance' }] }
  }
});

const buildReadmePalette = (bindings) =>
  buildPalette(loadCatalog(readYamlBlock('version: 3'), bindings), { backIntentionId: 'back' });

// Keeps CATALOG.md's example catalog working as the format changes.
test('the CATALOG.md catalog loads, reads a typed line, and runs once with its args', async () => {
  const bindings = makeBindings();
  const palette = buildReadmePalette(bindings);

  expect(palette.intentions.map(({ id, title }) => [id, title])).toEqual([
    ['app.search.sort', 'Sort'],
    ['app.search.match.any', 'Match any']
  ]);
  expect(palette.resolveInput('sort relevance').find((row) => row.call).call.args).toEqual({
    sort: 'relevance'
  });

  await palette.intentions.find((intention) => intention.title === 'Match any').action('');
  expect(bindings.app.search.apply).toHaveBeenCalledExactlyOnceWith({ match: 'any' });
});

test("CATALOG.md's examples file holds for its catalog", () => {
  expect(
    findExampleFailures(
      buildReadmePalette(makeBindings()),
      loadExamples(readYamlBlock('examples:'))
    )
  ).toEqual([]);
});
