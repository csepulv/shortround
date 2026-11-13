import { existsSync, readdirSync, readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

// What each published package ships. The bundle checks read the built `dist/`: `pnpm verify` builds before it runs
// these tests, so the gate checks a fresh build; run alone, they check whatever was built last.
const packageUrl = (folder, path) => new URL(`../../packages/${folder}/${path}`, import.meta.url);

const manifestOf = (folder) => JSON.parse(readFileSync(packageUrl(folder, 'package.json'), 'utf8'));

const bundleOf = (folder) =>
  readdirSync(packageUrl(folder, 'dist'))
    .filter((name) => name.endsWith('.js'))
    .map((name) => readFileSync(packageUrl(folder, `dist/${name}`), 'utf8'))
    .join('\n');

// A bundled copy of React's JSX runtime carries React's internals; it breaks under any React but the one it came from.
// React 18 and 19 name them differently (read from 18.2.0's jsx-runtime and 19.3.1's development jsx-runtime). 19's
// production jsx-runtime carries neither name, so the import check above is the main guard.
const REACT_INTERNALS = [
  '__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED',
  '__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE'
];
const IMPORTS_JSX_RUNTIME = /from\s*["']react\/jsx-runtime["']/;

// React 18 and 19 are both supported: checked once on React 19; development stays on 18.
const REACT_RANGE = '^18.2.0 || ^19.0.0';

describe('what each package ships', () => {
  test('each package ships its changelog', () => {
    expect(manifestOf('shortround-core').files).toEqual(
      expect.arrayContaining(['CHANGELOG.md', 'CHANGELOG-catalog.md'])
    );
    expect(manifestOf('shortround-react').files).toContain('CHANGELOG.md');
    expect(manifestOf('shortround-mui').files).toContain('CHANGELOG.md');
    expect(manifestOf('shortround-chat').files).toContain('CHANGELOG.md');
  });

  // A name in `files` that matches nothing ships nothing, silently.
  test.each(['shortround-core', 'shortround-react', 'shortround-mui', 'shortround-chat'])(
    "every changelog %s's files names exists",
    (folder) => {
      const changelogs = manifestOf(folder).files.filter((name) => name.startsWith('CHANGELOG'));

      changelogs.forEach((name) => expect(existsSync(packageUrl(folder, name))).toBe(true));
    }
  );

  test.each(['shortround-react', 'shortround-mui', 'shortround-chat'])(
    "%s uses the app's JSX runtime, not a bundled copy",
    (folder) => {
      const bundle = bundleOf(folder);

      expect(bundle).toMatch(IMPORTS_JSX_RUNTIME);
      REACT_INTERNALS.forEach((internals) => expect(bundle).not.toContain(internals));
    }
  );

  // Without it pnpm sends no access level, and npm publishes a new scoped package restricted.
  test.each(['shortround-core', 'shortround-react', 'shortround-mui', 'shortround-chat'])(
    '%s publishes publicly',
    (folder) => {
      expect(manifestOf(folder).publishConfig).toEqual({ access: 'public' });
    }
  );

  test('react and mui accept React 18 and 19 as peers', () => {
    expect(manifestOf('shortround-react').peerDependencies).toMatchObject({
      react: REACT_RANGE,
      'react-dom': REACT_RANGE
    });
    expect(manifestOf('shortround-mui').peerDependencies).toMatchObject({ react: REACT_RANGE });
    expect(manifestOf('shortround-chat').peerDependencies).toMatchObject({
      react: REACT_RANGE,
      'react-dom': REACT_RANGE
    });
  });

  test('chat ships both entries, each with its declarations, and no bundled dependency', () => {
    const manifest = manifestOf('shortround-chat');

    expect(manifest.exports).toEqual({
      '.': { types: './src/index.d.ts', import: './dist/index.js', default: './dist/index.js' },
      './server': {
        types: './src/server.d.ts',
        import: './dist/server.js',
        default: './dist/server.js'
      }
    });
    expect(manifest.files).toEqual(
      expect.arrayContaining(['dist', 'src/index.d.ts', 'src/server.d.ts'])
    );
    ['src/index.d.ts', 'src/server.d.ts', 'dist/index.js', 'dist/server.js'].forEach((path) =>
      expect(existsSync(packageUrl('shortround-chat', path))).toBe(true)
    );
    const bundle = bundleOf('shortround-chat');
    [
      'ai',
      '@ai-sdk/react',
      '@shortround/core',
      '@shortround/react',
      'react',
      'react-markdown',
      'remark-gfm',
      'zod'
    ].forEach((name) => expect(bundle).toMatch(new RegExp(`from\\s*["']${name}["']`)));
  });
});
