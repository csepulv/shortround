import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  buildCatalogRuntime,
  checkCatalog,
  findInvalidToolNames,
  loadCatalog
} from '../../index.js';
import { readFixture } from './fixtures/read-fixture.js';

const LONG_NAME = 'a'.repeat(65);
const LONGEST_NAME = 'b'.repeat(64);

const CATALOG = `
version: 3
app: app
states:
  browsing: { start: true, commands: [search, notes.archive, ${LONG_NAME}, ${LONGEST_NAME}, save-draft_2] }
commands:
  search: { label: Search, run: app.search, params: {} }
  notes.archive: { label: Archive note, run: app.archive, params: {} }
  ${LONG_NAME}: { label: Long, run: app.long, params: {} }
  ${LONGEST_NAME}: { label: Longest, run: app.longest, params: {} }
  save-draft_2: { label: Save draft, run: app.saveDraft, params: {} }
  old.export: { label: Export, planned: true, params: {} }
`;

describe('command names that cannot be tool names', () => {
  test('the fixture catalogs have none', () => {
    expect(findInvalidToolNames(checkCatalog(readFixture('search-palette-v3.yaml')))).toEqual([]);
    expect(findInvalidToolNames(checkCatalog(readFixture('links-search.yaml')))).toEqual([]);
  });

  test('lists a name with other characters, and one longer than 64; a planned command is left out', () => {
    expect(findInvalidToolNames(checkCatalog(CATALOG))).toEqual([
      {
        command: 'notes.archive',
        reason: 'a tool name has only letters, digits, _ and -'
      },
      { command: LONG_NAME, reason: 'a tool name has at most 64 characters' }
    ]);
  });
});

describe("the runtime's tools leave them out", () => {
  afterEach(() => vi.restoreAllMocks());

  const makeRuntime = (log) => {
    const run = (name) => () => log.push(name);
    return buildCatalogRuntime(
      loadCatalog(CATALOG, {
        app: {
          search: run('search'),
          archive: run('archive'),
          long: run('long'),
          longest: run('longest'),
          saveDraft: run('saveDraft')
        }
      })
    );
  };

  test('with one warning naming them, however many times the tools are built', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const runtime = makeRuntime([]);

    const first = await runtime.tools();
    await runtime.tools();

    expect(first.map((tool) => tool.name)).toEqual(['search', LONGEST_NAME, 'save-draft_2']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      `These commands can't be a model's tools, so the model isn't offered them: notes.archive (a tool name has only letters, digits, _ and -), ${LONG_NAME} (a tool name has at most 64 characters)`
    );
  });

  test('a catalog with none warns nothing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const runtime = buildCatalogRuntime(
      loadCatalog(
        'version: 3\napp: app\nstates:\n  s: { start: true, commands: [go] }\ncommands:\n  go: { label: Go, run: app.go, params: {} }\n',
        { app: { go: () => {} } }
      )
    );

    await runtime.tools();

    expect(warn).not.toHaveBeenCalled();
  });

  test('the command still runs from a typed line', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = [];
    const runtime = makeRuntime(log);
    const line = runtime.commandLine();

    line.change('archive note', 'archive note'.length);
    await line.submit();

    expect(log).toEqual(['archive']);
  });
});
