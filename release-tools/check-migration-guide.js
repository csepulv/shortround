// Release gate: every version about to be released needs a "## <version>" section in MIGRATING.md.
// `pnpm cs:version` runs this before bumping anything. Usage: node release-tools/check-migration-guide.js
// [--guide <path>] (default: MIGRATING.md at the repository root).
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'Usage: node release-tools/check-migration-guide.js [--guide <path>]';

// Packages changesets is about to release, grouped by the version they will have. Private packages it
// leaves unversioned come back as type "none".
export function releasesByVersion(status) {
  const byVersion = new Map();
  for (const { name, type, newVersion } of status.releases) {
    if (type === 'none') {
      continue;
    }
    byVersion.set(newVersion, [...(byVersion.get(newVersion) ?? []), name]);
  }
  return [...byVersion].map(([version, packages]) => ({ version, packages }));
}

const hasSection = (guideText, version) =>
  guideText
    .split(/\r?\n/)
    .some((line) => line === `## ${version}` || line.startsWith(`## ${version} `));

export const missingSections = (releases, guideText) =>
  releases.filter(({ version }) => !hasSection(guideText, version));

export function describeMissing(missing, changesetIds, guideName = 'MIGRATING.md') {
  const versions = missing.map(({ version, packages }) => `${version} (${packages.join(', ')})`);
  const headings = missing.map(({ version }) => `"## ${version}"`);
  return [
    `${guideName} has no section for ${versions.join(', ')}.`,
    `Add a ${headings.join(', ')} section, written from the pending changesets: ${changesetIds.join(', ')}.`,
    'A release with nothing to act on still gets one line, such as "No action needed".'
  ].join('\n');
}

// `changeset status --output` joins its path onto the working directory, even an absolute one, so the file is
// written inside the repository, in a temporary folder under node_modules/.cache (ignored by git).
function readChangesetStatus() {
  const cache = path.join(ROOT, 'node_modules', '.cache');
  mkdirSync(cache, { recursive: true });
  const directory = mkdtempSync(path.join(cache, 'shortround-release-'));
  const file = path.relative(ROOT, path.join(directory, 'status.json'));
  try {
    execFileSync('pnpm', ['exec', 'changeset', 'status', `--output=${file}`], {
      cwd: ROOT,
      stdio: 'pipe'
    });
    return JSON.parse(readFileSync(path.join(ROOT, file), 'utf8'));
  } catch (error) {
    if (error.stderr) {
      throw new Error(`changeset status failed:\n${error.stdout}${error.stderr}`, { cause: error });
    }
    throw error;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
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
  const status = readChangesetStatus();
  const missing = missingSections(releasesByVersion(status), readGuide(guidePath));
  if (missing.length > 0) {
    console.error(
      describeMissing(
        missing,
        status.changesets.map(({ id }) => id),
        guidePath.startsWith(ROOT + path.sep) ? path.relative(ROOT, guidePath) : guidePath
      )
    );
    process.exit(1);
  }
}

if (isRunDirectly(process.argv[1], import.meta.url)) {
  main();
}
