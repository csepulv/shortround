// The search palette test catalog over a stub app, as a runtime; and a small catalog whose one param the app holds.
// Every run is logged. Search, preview and closing the preview return a message; next returns none.
import { buildCatalogRuntime } from '../../catalog-runtime.js';
import { loadCatalog } from '../../load-catalog.js';
import { readFixture } from './read-fixture.js';

const SEARCH_CATALOG = readFixture('search-palette-v3.yaml');

export const RESULTS = [
  { value: 'w1', title: '1. Grid layout notes', aliases: ['1'] },
  { value: 'w2', title: '2. CSS grid guide', aliases: ['2'] }
];

const rows = (values) => values.map(([value, title]) => ({ value, title }));
const titleOf = (value) => RESULTS.find((result) => result.value === value)?.title ?? value;

function makeLog() {
  const log = [];
  const logged = (name, args, message) => {
    log.push(`${name}(${JSON.stringify(args)})`);
    return message === undefined ? undefined : { message };
  };
  return { log, logged };
}

export function makeSearchApp({ hasServiceLink = false } = {}) {
  const app = { previewedId: null };
  const { log, logged } = makeLog();
  const bindings = {
    app: {
      conditions: { previewed: () => app.previewedId !== null },
      sortOptions: { rows: () => rows([['relevance', 'Relevance']]) },
      search: {
        apply: (args) => logged('search.apply', args, describeSearch(args)),
        facetValueRows: ({ key }) =>
          key === 'tags'
            ? rows([
                ['design', 'design'],
                ['react', 'react']
              ])
            : rows([['last-week', 'last week']])
      },
      results: {
        rows: () => RESULTS,
        preview: (args) => {
          app.previewedId = args.result;
          return logged('results.preview', args, `Previewing ${titleOf(args.result)}`);
        },
        next: (args) => logged('results.next', args),
        openInService: (args) => logged('results.openInService', args, 'Opened in the service'),
        closePreview: (args) => {
          app.previewedId = null;
          return logged('results.closePreview', args, 'Closed the preview');
        },
        previewedHasServiceLink: () => hasServiceLink
      }
    }
  };
  const runtime = buildCatalogRuntime(loadCatalog(SEARCH_CATALOG, bindings));
  return { app, runtime, log };
}

function describeSearch({ term, tags }) {
  return tags?.length ? `Searched for ${term}, tagged ${tags.join(', ')}` : `Searched for ${term}`;
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
      note:
        label: Note
        default: true
        argSource: { freeform: true, type: text }
      result:
        label: Result
        aliases: [result]
        argSource: { lookup: app.results.rows, current: app.results.previewedId }
`;

/** A catalog whose `share` takes the result the app holds (`argSource.current`), or one given. */
export function makeAppHeldApp() {
  const app = { previewedId: null };
  const { log, logged } = makeLog();
  const bindings = {
    app: {
      share: (args) => logged('share', args, `Shared ${args.result}`),
      results: { rows: () => RESULTS, previewedId: () => app.previewedId }
    }
  };
  const runtime = buildCatalogRuntime(loadCatalog(APP_HELD_CATALOG, bindings));
  return { app, runtime, log };
}
