import { describe, expect, test } from 'vitest';

import {
  describeMissing,
  guidePathFrom,
  isRunDirectly,
  missingSections,
  releasesByVersion
} from '../check-migration-guide.js';

// The packages' manifests (trimmed to the fields the check reads). Versions are set by hand, so the version in each
// published manifest is the one being released.
const manifests = [
  { name: '@shortround/core', version: '0.5.0' },
  { name: '@shortround/react', version: '0.5.0' },
  { name: '@shortround/mui', version: '0.5.0' },
  { name: '@shortround/conformance', version: '0.0.0', private: true }
];

describe('releasesByVersion', () => {
  test('groups the published packages by their version, skipping private ones', () => {
    expect(releasesByVersion(manifests)).toEqual([
      { version: '0.5.0', packages: ['@shortround/core', '@shortround/react', '@shortround/mui'] }
    ]);
  });

  test('keeps different versions apart', () => {
    const mixed = [
      { name: '@shortround/core', version: '0.5.1' },
      { name: '@shortround/mui', version: '0.5.0' }
    ];

    expect(releasesByVersion(mixed)).toEqual([
      { version: '0.5.1', packages: ['@shortround/core'] },
      { version: '0.5.0', packages: ['@shortround/mui'] }
    ]);
  });

  test('is empty when nothing is published', () => {
    expect(releasesByVersion([{ name: 'x', version: '0.0.0', private: true }])).toEqual([]);
  });
});

describe('missingSections', () => {
  const releases = [{ version: '0.3.0', packages: ['@shortround/core'] }];

  test('a "## 0.3.0" heading covers 0.3.0', () => {
    expect(missingSections(releases, '# Migrating\n\n## 0.3.0\n\nText.\n')).toEqual([]);
  });

  test('text after the version is allowed', () => {
    expect(missingSections(releases, '## 0.3.0 (core, MUI)\n')).toEqual([]);
  });

  test('a release without its heading is missing', () => {
    expect(missingSections(releases, '# Migrating\n\n## 0.2.3\n')).toEqual(releases);
  });

  test('another heading level does not count', () => {
    expect(missingSections(releases, '### 0.3.0\n')).toEqual(releases);
  });

  test('0.3.10 does not cover 0.3.1', () => {
    const patch = [{ version: '0.3.1', packages: ['@shortround/core'] }];

    expect(missingSections(patch, '## 0.3.10\n')).toEqual(patch);
  });

  test('the version mentioned in prose does not count', () => {
    expect(missingSections(releases, 'See 0.3.0 below.\n## 0.2.3\n')).toEqual(releases);
  });

  test('a guide with Windows line endings has its heading found', () => {
    expect(missingSections(releases, '# Migrating\r\n\r\n## 0.3.0\r\n\r\nText.\r\n')).toEqual([]);
  });
});

describe('guidePathFrom', () => {
  test('defaults to MIGRATING.md at the repository root', () => {
    expect(guidePathFrom(['node', 'check.js'], '/repo')).toBe('/repo/MIGRATING.md');
  });

  test('takes the path after --guide', () => {
    expect(guidePathFrom(['node', 'check.js', '--guide', '/tmp/guide.md'], '/repo')).toBe(
      '/tmp/guide.md'
    );
  });

  test('refuses --guide without a path', () => {
    expect(() => guidePathFrom(['node', 'check.js', '--guide'], '/repo')).toThrow(
      'Usage: node release-tools/check-migration-guide.js [--guide <path>]'
    );
  });
});

describe('isRunDirectly', () => {
  const moduleUrl = 'file:///repo/release-tools/check-migration-guide.js';

  test('is true when started through a symlink to the script', () => {
    const realpath = (filePath) => filePath.replace('/link', '/repo');

    expect(
      isRunDirectly('/link/release-tools/check-migration-guide.js', moduleUrl, { realpath })
    ).toBe(true);
  });

  test('is false when another script imports it', () => {
    const realpath = (filePath) => filePath;

    expect(isRunDirectly('/repo/node_modules/vitest/cli.js', moduleUrl, { realpath })).toBe(false);
  });

  test('is false without a script path', () => {
    expect(isRunDirectly(undefined, moduleUrl)).toBe(false);
  });
});

describe('describeMissing', () => {
  test('names the versions and the packages', () => {
    const message = describeMissing([
      { version: '0.5.0', packages: ['@shortround/core', '@shortround/mui'] }
    ]);

    expect(message).toBe(
      'MIGRATING.md has no section for 0.5.0 (@shortround/core, @shortround/mui).\n' +
        'Add a "## 0.5.0" section, written from the changes since the last release, for the people upgrading.\n' +
        'A release with nothing to act on still gets one line, such as "No action needed".'
    );
  });

  test('names the guide it read, when that is not MIGRATING.md', () => {
    const message = describeMissing(
      [{ version: '0.3.0', packages: ['@shortround/core'] }],
      'draft-guide.md'
    );

    expect(message.split('\n')[0]).toBe(
      'draft-guide.md has no section for 0.3.0 (@shortround/core).'
    );
  });
});
