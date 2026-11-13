// A command is typed by its name when the name is a plain lowercase word, by its label when the label is plain words,
// and by its aliases; one with none of these is still a row but can't be typed. An adopter's test asserts there are
// none, or that the ones listed are meant to be rows only.
import { describe, expect, test } from 'vitest';

import { checkCatalog, findUntypedCommands } from '../../index.js';
import { readFixture } from './fixtures/read-fixture.js';

describe('commands with no typed form', () => {
  test('a command whose label is plain words is typed by it, so the search catalog lists none', () => {
    expect(findUntypedCommands(checkCatalog(readFixture('search-palette-v3.yaml')))).toEqual([]);
  });

  test('a catalog whose commands all have a typed form lists none', () => {
    expect(findUntypedCommands(checkCatalog(readFixture('links-search.yaml')))).toEqual([]);
  });

  test('lists each command with no plain-word name, no plain-word label and no alias, with its label', () => {
    const catalog = checkCatalog(`
version: 3
app: app
states:
  browsing: { start: true, commands: [search, clearFilters, exportCsv, exportAll] }
commands:
  search: { label: Search, run: app.search, params: {} }
  clearFilters: { label: Clear filters, run: app.clear, params: {} }
  exportCsv: { label: Export (CSV), run: app.exportCsv, params: {} }
  exportAll: { label: Export all…, planned: true, params: {} }
`);

    expect(findUntypedCommands(catalog)).toEqual([{ command: 'exportCsv', label: 'Export (CSV)' }]);
  });

  test('a command with an alias is not listed, whatever its label', () => {
    const catalog = checkCatalog(`
version: 3
app: app
states:
  browsing: { start: true, commands: [exportCsv] }
commands:
  exportCsv: { label: Export (CSV), aliases: [export csv], run: app.exportCsv, params: {} }
`);

    expect(findUntypedCommands(catalog)).toEqual([]);
  });
});
