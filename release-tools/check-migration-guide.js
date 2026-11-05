// Release gate: the version the published packages are at needs a "## <version>" section in MIGRATING.md. Versions are
// set by hand in the manifests, so `pnpm verify` runs this: a bump without its section fails the gate. Usage:
// node release-tools/check-migration-guide.js [--guide <path>] (default: MIGRATING.md at the repository root).
import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'Usage: node release-tools/check-migration-guide.js [--guide <path>]';

// The published packages, grouped by the version their manifests are at. Private packages aren't published.
export function releasesByVersion(manifests) {
  const byVersion = new Map();
  for (const { name, version, private: isPrivate } of manifests) {
    if (isPrivate) {
      continue;
    }
    byVersion.set(version, [...(byVersion.get(version) ?? []), name]);
  }
  return [...byVersion].map(([version, packages]) => ({ version, packages }));
}

const hasSection = (guideText, version) =>
  guideText
    .split(/\r?\n/)
    .some((line) => line === `## ${version}` || line.startsWith(`## ${version} `));

export const missingSections = (releases, guideText) =>
  releases.filter(({ version }) => !hasSection(guideText, version));

export function describeMissing(missing, guideName = 'MIGRATING.md') {
  const versions = missing.map(({ version, packages }) => `${version} (${packages.join(', ')})`);
  const headings = missing.map(({ version }) => `"## ${version}"`);
  return [
    `${guideName} has no section for ${versions.join(', ')}.`,
    `Add a ${headings.join(', ')} section, written from the changes since the last release, for the people upgrading.`,
    'A release with nothing to act on still gets one line, such as "No action needed".'
  ].join('\n');
}

// Every package's manifest under packages/.
function readManifests(root = ROOT) {
  const packagesDir = path.join(root, 'packages');
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) =>
      JSON.parse(readFileSync(path.join(packagesDir, entry.name, 'package.json'), 'utf8'))
    );
}

function readGuide(guidePath) {
  try {
    return readFileSync(guidePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

export function guidePathFrom(args, root = ROOT) {
  const flag = args.indexOf('--guide');
  if (flag === -1) {
    return path.join(root, 'MIGRATING.md');
  }
  const guidePath = args[flag + 1];
  if (!guidePath) {
    throw new Error(USAGE);
  }
  return path.resolve(guidePath);
}

// Compared as real paths: started through a symlink, argv[1] keeps the link while import.meta.url resolves it, and a
// plain comparison would skip the check and exit 0.
export function isRunDirectly(scriptPath, moduleUrl, { realpath = realpathSync } = {}) {
  if (!scriptPath) {
    return false;
  }
  return realpath(scriptPath) === realpath(fileURLToPath(moduleUrl));
}

function main() {
  const guidePath = guidePathFrom(process.argv);
  const missing = missingSections(releasesByVersion(readManifests()), readGuide(guidePath));
  if (missing.length > 0) {
    console.error(
      describeMissing(
        missing,
        guidePath.startsWith(ROOT + path.sep) ? path.relative(ROOT, guidePath) : guidePath
      )
    );
    process.exit(1);
  }
}

if (isRunDirectly(process.argv[1], import.meta.url)) {
  main();
}
