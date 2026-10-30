import { describe, expect, test } from 'vitest';

import {
  describeMissing,
  guidePathFrom,
  isRunDirectly,
  missingSections,
  releasesByVersion
} from '../check-migration-guide.js';

// The shape `changeset status --output=<file>` writes (trimmed to the fields the check reads).
const status = {
  changesets: [{ id: 'behaviour-into-core' }, { id: 'input-resolver' }],
  releases: [
    { name: '@shortround/core', type: 'minor', oldVersion: '0.2.3', newVersion: '0.3.0' },
    { name: '@shortround/mui', type: 'minor', oldVersion: '0.2.3', newVersion: '0.3.0' },
    { name: '@shortround/conformance', type: 'none', oldVersion: '0.0.0', newVersion: '0.0.0' }
  ]
};

describe('releasesByVersion', () => {
  test('groups the packages being released by their new version, skipping unreleased ones', () => {
    expect(releasesByVersion(status)).toEqual([
      { version: '0.3.0', packages: ['@shortround/core', '@shortround/mui'] }
    ]);
  });

  test('keeps different versions apart', () => {
    const mixed = {
      releases: [
        { name: '@shortround/core', type: 'patch', oldVersion: '0.3.0', newVersion: '0.3.1' },
        { name: '@shortround/mui', type: 'minor', oldVersion: '0.3.0', newVersion: '0.4.0' }
      ]
    };

    expect(releasesByVersion(mixed)).toEqual([
      { version: '0.3.1', packages: ['@shortround/core'] },
      { version: '0.4.0', packages: ['@shortround/mui'] }
    ]);
  });

  test('is empty when nothing is pending', () => {
    expect(releasesByVersion({ releases: [] })).toEqual([]);
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
  test('names the versions, the packages and the pending changesets', () => {
    const message = describeMissing(
      [{ version: '0.3.0', packages: ['@shortround/core', '@shortround/mui'] }],
      ['behaviour-into-core', 'input-resolver']
    );

    expect(message).toBe(
      'MIGRATING.md has no section for 0.3.0 (@shortround/core, @shortround/mui).\n' +
        'Add a "## 0.3.0" section, written from the pending changesets: behaviour-into-core, input-resolver.\n' +
        'A release with nothing to act on still gets one line, such as "No action needed".'
    );
  });

  test('names the guide it read, when that is not MIGRATING.md', () => {
    const message = describeMissing(
      [{ version: '0.3.0', packages: ['@shortround/core'] }],
      ['input-resolver'],
      'draft-guide.md'
    );

    expect(message.split('\n')[0]).toBe(
      'draft-guide.md has no section for 0.3.0 (@shortround/core).'
    );
  });
});
