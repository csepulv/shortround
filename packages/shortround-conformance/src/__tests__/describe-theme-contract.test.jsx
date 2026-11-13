// The way a theme package uses this one: a test file that names its theme.
import { expect, test } from 'vitest';

import { loadChatModules } from '../chat-checks.js';
import { checksFor } from '../describe-theme-contract.js';
import { describeThemeContract } from '../index.js';
import { REFERENCE_CHAT, referenceTheme } from './themes/reference-theme.jsx';

describeThemeContract('the reference theme', referenceTheme);

const chatOnlyTheme = { components: { Chat: REFERENCE_CHAT }, Toast: referenceTheme.Toast };
// eslint-disable-next-line no-unused-vars -- the Chat group is taken out on purpose
const { Chat, ...paletteComponents } = referenceTheme.components;
const paletteOnlyTheme = { ...referenceTheme, components: paletteComponents };

describeThemeContract('a theme with only a Chat group and a Toast', chatOnlyTheme);

const groupsOf = (theme) => [...new Set(checksFor(theme).map(({ group }) => group))];

test("the checks follow the theme's groups", () => {
  expect(groupsOf(referenceTheme)).toEqual(['palette', 'toast', 'chat']);
  expect(groupsOf(paletteOnlyTheme)).toEqual(['palette', 'toast']);
  expect(groupsOf(chatOnlyTheme)).toEqual(['toast', 'chat']);
});

test('a Chat check without @shortround/chat installed says what to install', async () => {
  const missing = () => Promise.reject(new Error("Cannot find package '@shortround/chat'"));
  const present = () => Promise.resolve({});

  await expect(
    loadChatModules({ chat: missing, server: missing, ai: present, aiTest: present })
  ).rejects.toThrow(
    "The theme has components.Chat: its checks need @shortround/chat, ai and @ai-sdk/react installed (Cannot find package '@shortround/chat')"
  );
});

// Older theme packages passed the bare slots.
test('bare slots instead of a theme are refused, naming the theme object', () => {
  expect(() => describeThemeContract('slots only', referenceTheme.components)).toThrow(
    'describeThemeContract takes the theme object { components, Toast }'
  );
});
