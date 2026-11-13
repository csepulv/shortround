import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

// The packages are released together, at one version: a test holds it, since nothing computes versions any more. A
// dependent's peer on another of them is `^<that version>`, one 0.x minor.
const manifestOf = (folder) =>
  JSON.parse(
    readFileSync(new URL(`../../packages/${folder}/package.json`, import.meta.url), 'utf8')
  );

const core = manifestOf('shortround-core');
const react = manifestOf('shortround-react');
const mui = manifestOf('shortround-mui');
const chat = manifestOf('shortround-chat');

describe('the packages released together', () => {
  test('core, react, mui and chat are at one version', () => {
    expect({ react: react.version, mui: mui.version, chat: chat.version }).toEqual({
      react: core.version,
      mui: core.version,
      chat: core.version
    });
  });

  test("react's and mui's peers on the others are ^ that version", () => {
    const range = `^${core.version}`;

    expect(react.peerDependencies['@shortround/core']).toBe(range);
    expect(mui.peerDependencies['@shortround/core']).toBe(range);
    expect(mui.peerDependencies['@shortround/react']).toBe(range);
    expect(chat.peerDependencies['@shortround/core']).toBe(range);
    expect(chat.peerDependencies['@shortround/react']).toBe(range);
  });

  test('in the workspace, they link each other', () => {
    expect(react.devDependencies['@shortround/core']).toBe('workspace:*');
    expect(mui.devDependencies['@shortround/core']).toBe('workspace:*');
    expect(mui.devDependencies['@shortround/react']).toBe('workspace:*');
    expect(chat.devDependencies['@shortround/core']).toBe('workspace:*');
    expect(chat.devDependencies['@shortround/react']).toBe('workspace:*');
  });
});
