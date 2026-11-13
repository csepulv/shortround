import { describe, expect, test, vi } from 'vitest';

import { CONTRACT_CHECKS } from '../contract-checks.js';
import { BROKEN_THEMES, DEPENDENTS } from './themes/broken-themes.jsx';
import { referenceTheme } from './themes/reference-theme.jsx';

const SLOTS = [
  'IntentionPalette.Frame',
  'IntentionPalette.Input',
  'IntentionPalette.Item',
  'IntentionPalette.Group',
  'IntentionPalette.NoMatches',
  'Sidekick.Popover',
  'Sidekick.Frame',
  'Sidekick.ControlBar',
  'SidecarContent',
  'Toast',
  'Chat.Frame',
  'Chat.Transcript',
  'Chat.Message',
  'Chat.Text',
  'Chat.IntentionRun',
  'Chat.ToolRun',
  'Chat.Error',
  'Chat.Composer',
  'Chat.Row',
  'Chat.Input'
];

const failureOf = (check, theme) =>
  check.run(theme).then(
    () => null,
    (error) => error
  );

const sharesASlot = (first, second) => first.slots.some((slot) => second.slots.includes(slot));

test('every slot has at least one check', () => {
  const unchecked = SLOTS.filter(
    (slot) => !CONTRACT_CHECKS.some((check) => check.slots.includes(slot))
  );

  expect(unchecked).toEqual([]);
});

test('a Chat group missing a slot fails every Chat check, naming the slot', async () => {
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
  // eslint-disable-next-line no-unused-vars -- the Row slot is taken out on purpose
  const { Row, ...chatWithoutRow } = referenceTheme.components.Chat;
  const theme = {
    ...referenceTheme,
    components: { ...referenceTheme.components, Chat: chatWithoutRow }
  };
  const chatChecks = CONTRACT_CHECKS.filter((check) => check.group === 'chat');

  const messages = [];
  for (const check of chatChecks) {
    messages.push((await failureOf(check, theme))?.message);
  }
  quiet.mockRestore();

  expect(chatChecks).toHaveLength(10);
  expect(messages.filter((message) => !message?.includes('components.Chat.Row'))).toEqual([]);
});

test('every check has a broken theme that proves it can fail', () => {
  const unproved = CONTRACT_CHECKS.map(({ id }) => id).filter((id) => !BROKEN_THEMES[id]);

  expect(unproved).toEqual([]);
});

describe.each(CONTRACT_CHECKS)('$id', (check) => {
  const broken = BROKEN_THEMES[check.id];
  const dependents = DEPENDENTS[check.id] ?? [];

  test('the reference theme passes', async () => {
    await check.run(referenceTheme);
  });

  // The failure must be this check's own (not an unrelated crash), naming its slot.
  test("the theme that breaks it fails with this check's own message", async () => {
    const error = await failureOf(check, broken);

    expect(error?.checkId).toBe(check.id);
    expect(error.message).toMatch(new RegExp(`^(${check.slots.join('|').replaceAll('.', '\\.')})`));
  });

  // A theme author must be told which slot is wrong: other checks pass, or fail with their own
  // message, marked as a precondition when they reach their slot through the broken one.
  test('the theme that breaks it passes the other checks, or fails them as declared', async () => {
    const wrong = [];
    for (const other of CONTRACT_CHECKS.filter(({ id }) => id !== check.id)) {
      const error = await failureOf(other, broken);
      if (!error) {
        continue;
      }
      const isEverything = dependents === 'all';
      const isDeclared = isEverything || dependents.includes(other.id);
      const isOwn = error.checkId === other.id;
      // When nothing renders, every check fails at its own slot; the frames' check names the cause.
      const isMarked =
        isEverything || sharesASlot(other, check) || error.message.includes('(precondition)');
      if (!(isDeclared && isOwn && isMarked)) {
        wrong.push(`${other.id}: ${error.message}`);
      }
    }

    expect(wrong).toEqual([]);
  });
});

// "The group of size controls": a named group must hold them, not sit empty beside them.
test('control-names fails when the named group does not hold the size controls', async () => {
  const { ControlBar } = referenceTheme.components.Sidekick;
  const groupBeside = {
    ...referenceTheme,
    components: {
      ...referenceTheme.components,
      Sidekick: {
        ...referenceTheme.components.Sidekick,
        ControlBar: ({ labels, ...props }) => (
          <>
            <div aria-label={labels.size} role="group" />
            <ControlBar {...props} labels={{ ...labels, size: 'Something else' }} />
          </>
        )
      }
    }
  };
  const check = CONTRACT_CHECKS.find(({ id }) => id === 'control-names');

  const error = await failureOf(check, groupBeside);

  expect(error?.checkId).toBe('control-names');
});
