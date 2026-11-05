// Check a command catalog (YAML) with the engine's own checks, then render it as a local HTML review page.
// Examples come from `<name>.examples.yaml` beside the catalog, when it exists, also checked by the engine.
// Usage (bundled, from the skill): node scripts/catalog-review.js <catalog.yaml> [out.html]
// Default output: <catalog>-review.html beside the catalog. The page is local-only; don't publish it.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// The engine is the source of truth for the format; the build bundles these modules into the script.
import { loadExamples } from '../../../../packages/shortround-core/src/catalog/examples.js';
import { checkCatalog } from '../../../../packages/shortround-core/src/catalog/load-catalog.js';
import { renderStatesPage } from './render-states.js';

function readText(filePath) {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

function loadCatalog(catalogPath) {
  const text = readText(catalogPath);
  if (text === null) {
    throw new Error(`No catalog at ${catalogPath}`);
  }
  return { ...checkCatalog(text), sourceName: path.basename(catalogPath) };
}

// `<name><suffix>` beside the catalog, whatever the catalog's extension.
function pathBeside(catalogPath, suffix) {
  const { dir, name } = path.parse(catalogPath);
  return path.join(dir, `${name}${suffix}`);
}

function loadExamplesBeside(catalogPath) {
  const text = readText(pathBeside(catalogPath, '.examples.yaml'));
  return text === null ? [] : loadExamples(text);
}

const [, , catalogPath, outArg] = process.argv;
if (!catalogPath) {
  console.error('Usage: node scripts/catalog-review.js <catalog.yaml> [out.html]');
  process.exit(1);
}
const outPath = outArg ?? pathBeside(catalogPath, '-review.html');
try {
  const page = renderStatesPage(loadCatalog(catalogPath), loadExamplesBeside(catalogPath));
  writeFileSync(outPath, page.html);
  console.log(`wrote ${outPath}: ${page.summary}`);
} catch (err) {
  // A catalog mistake is the expected failure while writing one: show the engine's message, not a stack.
  // I/O errors (they carry a code, such as EACCES) are unexpected: let them surface whole.
  if (err.code) {
    throw err;
  }
  console.error(err.message);
  process.exit(1);
}
