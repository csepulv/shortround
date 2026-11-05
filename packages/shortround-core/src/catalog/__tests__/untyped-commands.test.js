// A command is typed by its name only when the name is a plain lowercase word, and otherwise by its aliases; one with
// neither is still a row but can't be typed. An adopter's test asserts there are none, or that the ones listed are
// meant to be rows only.
import { describe, expect, test } from 'vitest';

import { checkCatalog, findUntypedCommands } from '../../index.js';
import { readFixture } from './fixtures/read-fixture.js';

describe('commands with no typed form', () => {
  test('lists each command with neither a plain-word name nor an alias, with its label', () => {
    const catalog = checkCatalog(readFixture('search-palette-v3.yaml'));

    expect(findUntypedCommands(catalog)).toEqual([
      { command: 'openInService', label: 'Open in service' },
      { command: 'closePreview', label: 'Close preview' }
    ]);
  });

  test('a catalog whose commands all have a typed form lists none', () => {
    expect(findUntypedCommands(checkCatalog(readFixture('links-search.yaml')))).toEqual([]);
  });

  test('a command with an alias, or a planned one, is not listed', () => {
    const catalog = checkCatalog(`
version: 3
app: app
states:
  browsing: { start: true, commands: [search, clearFilters, exportAll] }
commands:
  search: { label: Search, run: app.search, params: {} }
  clearFilters: { label: Clear filters, aliases: [clear filters], run: app.clear, params: {} }
  exportAll: { label: Export all, planned: true, params: {} }
`);

    expect(findUntypedCommands(catalog)).toEqual([]);
  });
});
