// Core's search palette test catalog over a stub app, as a runtime built through @shortround/core's entry. Every app
// call is logged; preview and closePreview change the state and tell the runtime, as an app would.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildCatalogRuntime, loadCatalog } from '@shortround/core';

const CATALOG_TEXT = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../shortround-core/src/catalog/__tests__/fixtures/search-palette-v3.yaml'
  ),
  'utf8'
);

const RESULTS = [
  { value: 'w1', title: '1. Grid layout notes', aliases: ['1'] },
  { value: 'w2', title: '2. CSS grid guide', aliases: ['2'] }
];

const rows = (values) => values.map(([value, title]) => ({ value, title }));
const titleOf = (value) => RESULTS.find((result) => result.value === value)?.title ?? value;

/** `failSearch`: the app's search throws, as a broken app call would. */
export function makeSearchRuntime({ failSearch = false, searchOutput } = {}) {
  const app = { previewedId: null };
  const log = [];
  let runtime;
  const logged = (name, args, message) => {
    log.push(`${name}(${JSON.stringify(args)})`);
    return message === undefined ? undefined : { message };
  };
  const bindings = {
    app: {
      conditions: { previewed: () => app.previewedId !== null },
      sortOptions: { rows: () => rows([['relevance', 'Relevance']]) },
      search: {
        apply: (args) => {
          if (failSearch) {
            throw new Error('app exploded');
          }
          const outcome = logged('search.apply', args, `Searched for ${args.term}`);
          return searchOutput === undefined ? outcome : { ...outcome, output: searchOutput };
        },
        facetValueRows: () => rows([['design', 'design']])
      },
      results: {
        rows: () => RESULTS,
        preview: (args) => {
          app.previewedId = args.result;
          runtime.notify();
          return logged('results.preview', args, `Previewing ${titleOf(args.result)}`);
        },
        next: (args) => logged('results.next', args),
        openInService: (args) => logged('results.openInService', args),
        closePreview: (args) => {
          app.previewedId = null;
          runtime.notify();
          return logged('results.closePreview', args, 'Closed the preview');
        },
        previewedHasServiceLink: () => false
      }
    }
  };
  runtime = buildCatalogRuntime(loadCatalog(CATALOG_TEXT, bindings));
  return { app, runtime, log };
}

const APP_HELD_CATALOG = `
version: 3
app: app
states:
  reading:
    start: true
    commands: [share]
commands:
  share:
    label: Share
    run: app.share
    params:
      note: { label: Note, default: true, argSource: { freeform: true, type: text } }
      result:
        label: Result
        aliases: [result]
        argSource: { lookup: app.results.rows, current: app.results.previewedId }
`;

/** A catalog whose `share` takes the result the app holds; `app.previewedId` is that result. */
export function makeAppHeldRuntime() {
  const app = { previewedId: null };
  const log = [];
  const bindings = {
    app: {
      share: (args) => {
        log.push(`share(${JSON.stringify(args)})`);
        return { message: `Shared ${args.result}` };
      },
      results: { rows: () => RESULTS, previewedId: () => app.previewedId }
    }
  };
  return { app, runtime: buildCatalogRuntime(loadCatalog(APP_HELD_CATALOG, bindings)), log };
}
