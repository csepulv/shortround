// The theme contract as checks: each renders ShortRound under a ShortRoundProvider with the theme and acts
// as a user would, finding the theme's controls by the contract's test hooks. A check throws a
// ContractError naming the slot and what it expected; when it reaches its slot through another one and
// that fails, the message says "(precondition)" and names the slot it went through.
import { ControlLabels, createSidekickStore, Sizes } from '@shortround/core';
import { ShortRoundProvider, ShortRoundSidekick, useShortRoundToast } from '@shortround/react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';

import { CHAT_CHECKS } from './chat-checks.js';
import {
  actAndSettle,
  click,
  defineCheck,
  expectThat,
  findByHook,
  installJsdomShims,
  typeInto
} from './check-tools.js';
import { TEST_IDS } from './test-ids.js';

const TITLE = 'Contract palette';
const PANEL_TEXT = 'Contract panel content';
const REJECTION = 'Not allowed here';
const NO_MATCH = 'zzqx';
const TOAST_TEXT = 'Contract toast';
const CONTRACT_ICON_ID = 'shortround-contract-icon';

const ContractIcon = () => createElement('i', { 'data-testid': CONTRACT_ICON_ID });

// Known intentions; `ran` records which actions ran. Typing anything shows `strict`'s rejection.
function makeIntentions(ran) {
  const record = (id) => () => {
    ran.push(id);
  };
  return [
    {
      id: 'open',
      title: 'Open file',
      subtitle: 'From disk',
      group: 'Files',
      action: record('open')
    },
    { id: 'save', title: 'Save file', group: 'Files', action: record('save') },
    { id: 'locked', title: 'Locked', group: 'Admin', disabled: true, action: record('locked') },
    {
      id: 'strict',
      title: 'Strict',
      group: 'Admin',
      validate: () => ({ valid: false, message: REJECTION }),
      action: record('strict')
    },
    // A title with none of the letters of "save", so typing "save" still narrows to one row.
    {
      id: 'notify',
      title: 'Notify',
      group: 'Admin',
      action: () => {
        ran.push('notify');
        return { message: TOAST_TEXT };
      }
    }
  ];
}

// Renders the open palette as an app would (the theme from a provider, no slot props, optionally the app's
// icons), runs `exercise` against it, and always cleans up.
async function withPalette(theme, exercise, { icons } = {}) {
  installJsdomShims();
  const ran = [];
  const store = createSidekickStore({ isOpen: true });
  render(
    createElement(
      ShortRoundProvider,
      { theme, icons },
      createElement(ShortRoundSidekick, {
        defaultIntentions: makeIntentions(ran),
        sidekickStore: store,
        title: TITLE
      })
    )
  );
  try {
    await exercise({ ran, store });
  } finally {
    cleanup();
  }
}

const SHOW_TOAST_ID = 'shortround-contract-show-toast';

function ToastButton() {
  const { showToast } = useShortRoundToast();
  return createElement('button', {
    'data-testid': SHOW_TOAST_ID,
    onClick: () => showToast({ message: TOAST_TEXT }),
    type: 'button'
  });
}

async function withProvider(theme, exercise) {
  render(createElement(ShortRoundProvider, { theme }, createElement(ToastButton)));
  try {
    await exercise();
  } finally {
    cleanup();
  }
}

const listedRows = () => document.querySelectorAll('[data-testid^="shortround-item-"]');

// For checks that reach their slot by typing: text that matches nothing must empty the list.
async function typeNoMatch(slot) {
  await typeInto(
    findByHook(TEST_IDS.input, `${slot}: (precondition) IntentionPalette.Input`),
    NO_MATCH
  );
  expectThat(
    listedRows().length === 0,
    `${slot}: (precondition) typing into IntentionPalette.Input did not reach ShortRound`
  );
}

export const CONTRACT_CHECKS = [
  defineCheck({
    group: 'palette',
    id: 'children-pass-through',
    slots: ['Sidekick.Popover', 'Sidekick.Frame', 'IntentionPalette.Frame'],
    obligation: 'render their children: the palette appears',
    verify: (theme) =>
      withPalette(theme, () => {
        findByHook(
          TEST_IDS.item('open'),
          'Sidekick.Popover, Sidekick.Frame or IntentionPalette.Frame'
        );
      })
  }),
  defineCheck({
    group: 'palette',
    id: 'input-narrows',
    slots: ['IntentionPalette.Input'],
    obligation: "places core's input: typing narrows the rows",
    verify: (theme) =>
      withPalette(theme, async () => {
        await typeInto(findByHook(TEST_IDS.input, 'IntentionPalette.Input'), 'save');
        expectThat(
          screen.queryByTestId(TEST_IDS.item('save')) &&
            !screen.queryByTestId(TEST_IDS.item('open')),
          'IntentionPalette.Input: typing "save" did not narrow the rows to "Save file"'
        );
      })
  }),
  defineCheck({
    group: 'palette',
    id: 'input-message',
    slots: ['IntentionPalette.Input'],
    obligation: 'shows the input message',
    verify: (theme) =>
      withPalette(theme, async () => {
        await typeNoMatch('IntentionPalette.Input');
        await waitFor(() =>
          expectThat(
            screen.queryByText(REJECTION),
            `IntentionPalette.Input: the message "${REJECTION}" is not shown`
          )
        );
      })
  }),
  defineCheck({
    group: 'palette',
    id: 'item-shows',
    slots: ['IntentionPalette.Item'],
    obligation: "shows the intention's title and subtitle",
    verify: (theme) =>
      withPalette(theme, () => {
        const item = findByHook(TEST_IDS.item('open'), 'IntentionPalette.Item');
        expectThat(
          item.textContent.includes('Open file') && item.textContent.includes('From disk'),
          'IntentionPalette.Item: "Open file" and its subtitle "From disk" are not both shown'
        );
      })
  }),
  // The app's override for one row reaches the theme as `icon`, whatever icons the theme has of its own.
  defineCheck({
    group: 'palette',
    id: 'item-icon',
    slots: ['IntentionPalette.Item'],
    obligation: 'shows the icon it is given',
    verify: (theme) =>
      withPalette(
        theme,
        () => {
          const item = findByHook(TEST_IDS.item('open'), 'IntentionPalette.Item');
          expectThat(
            item.querySelector(`[data-testid="${CONTRACT_ICON_ID}"]`),
            'IntentionPalette.Item: the icon it was given is not shown'
          );
        },
        { icons: { intentions: { open: ContractIcon } } }
      )
  }),
  defineCheck({
    group: 'palette',
    id: 'group-name',
    slots: ['IntentionPalette.Group'],
    obligation: "shows each group's name",
    verify: (theme) =>
      withPalette(theme, () => {
        expectThat(
          screen.queryByText('Files') && screen.queryByText('Admin'),
          'IntentionPalette.Group: the group names "Files" and "Admin" are not both shown'
        );
      })
  }),
  defineCheck({
    group: 'palette',
    id: 'no-matches',
    slots: ['IntentionPalette.NoMatches'],
    obligation: 'when nothing matches, says so, naming the typed text',
    verify: (theme) =>
      withPalette(theme, async () => {
        await typeNoMatch('IntentionPalette.NoMatches');
        const noMatches = findByHook(TEST_IDS.noMatches, 'IntentionPalette.NoMatches');
        expectThat(
          noMatches.textContent.includes(NO_MATCH),
          `IntentionPalette.NoMatches: the typed text "${NO_MATCH}" is not shown`
        );
      })
  }),
  defineCheck({
    group: 'palette',
    id: 'control-title',
    slots: ['Sidekick.ControlBar'],
    obligation: 'shows the title',
    verify: (theme) =>
      withPalette(theme, () => {
        // Core also labels cmdk's input with the title; that label is core's, not the control bar's.
        const shown = screen
          .queryAllByText(TITLE)
          .filter((element) => !element.closest('[cmdk-label]'));
        expectThat(shown.length > 0, `Sidekick.ControlBar: the title "${TITLE}" is not shown`);
      })
  }),
  defineCheck({
    group: 'palette',
    id: 'control-close',
    slots: ['Sidekick.ControlBar'],
    obligation: 'the close control closes the palette',
    verify: (theme) =>
      withPalette(theme, async ({ store }) => {
        await click(findByHook(TEST_IDS.close, 'Sidekick.ControlBar'));
        expectThat(
          !store.get().isOpen,
          'Sidekick.ControlBar: the close control did not close the palette'
        );
      })
  }),
  // The palette opens at medium, so compact first: each click changes the size.
  defineCheck({
    group: 'palette',
    id: 'control-size',
    slots: ['Sidekick.ControlBar'],
    obligation: 'the size controls set each size',
    verify: (theme) =>
      withPalette(theme, async ({ store }) => {
        for (const size of [Sizes.COMPACT, Sizes.MEDIUM, Sizes.FULL]) {
          await click(findByHook(TEST_IDS.size(size), 'Sidekick.ControlBar'));
          expectThat(
            store.get().size === size,
            `Sidekick.ControlBar: the "${size}" control did not set the size`
          );
        }
      })
  }),
  defineCheck({
    group: 'palette',
    id: 'control-anchor',
    slots: ['Sidekick.ControlBar'],
    obligation: 'the position control moves the palette',
    verify: (theme) =>
      withPalette(theme, async ({ store }) => {
        const before = store.get().anchorOrigin;
        await click(findByHook(TEST_IDS.anchor, 'Sidekick.ControlBar'));
        expectThat(
          store.get().anchorOrigin !== before,
          'Sidekick.ControlBar: the position control did not move the palette'
        );
      })
  }),
  // Core decides the names (ControlLabels) and passes them as `labels`; each control, and the size group,
  // must carry its own, so a screen reader and an app's tests find the same controls whatever the theme.
  defineCheck({
    group: 'palette',
    id: 'control-names',
    slots: ['Sidekick.ControlBar'],
    obligation: "each control, and the size group, is named with core's labels",
    verify: (theme) =>
      withPalette(theme, () => {
        const expectNamed = (role, name, testId) => {
          const named = screen.queryAllByRole(role, { name });
          const hooked = testId ? findByHook(testId, 'Sidekick.ControlBar') : null;
          expectThat(
            named.length === 1 && (!hooked || named[0] === hooked),
            `Sidekick.ControlBar: no ${role} named "${name}"${testId ? ` (data-testid="${testId}")` : ''}; apply the labels ShortRound passes`
          );
        };
        expectNamed('button', ControlLabels.close, TEST_IDS.close);
        expectNamed('button', ControlLabels.anchor, TEST_IDS.anchor);
        expectNamed('group', ControlLabels.size);
        const group = screen.getByRole('group', { name: ControlLabels.size });
        for (const size of Object.values(Sizes)) {
          expectNamed('button', ControlLabels.sizes[size], TEST_IDS.size(size));
          expectThat(
            group.contains(findByHook(TEST_IDS.size(size), 'Sidekick.ControlBar')),
            `Sidekick.ControlBar: the "${size}" control is not inside the group named "${ControlLabels.size}"`
          );
        }
      })
  }),
  // Opened through the store, as an intention's sidecar renderer would, so no other slot is involved.
  defineCheck({
    group: 'palette',
    id: 'sidecar',
    slots: ['SidecarContent'],
    obligation: "shows the side panel's content when it opens",
    verify: (theme) =>
      withPalette(theme, async ({ store }) => {
        await actAndSettle(() =>
          store.set({
            internalSidecarRenderer: () => createElement('p', null, PANEL_TEXT),
            isSidecarOpen: true
          })
        );
        await waitFor(() =>
          expectThat(
            screen.queryByText(PANEL_TEXT),
            "SidecarContent: the side panel's content is not shown"
          )
        );
      })
  }),
  defineCheck({
    group: 'toast',
    id: 'toast-shows',
    slots: ['Toast'],
    obligation: 'shows a message while it is open',
    verify: (theme) =>
      withProvider(theme, async () => {
        await click(screen.getByTestId(SHOW_TOAST_ID));
        await waitFor(() =>
          expectThat(
            findByHook(TEST_IDS.toast, 'Toast').textContent.includes(TOAST_TEXT),
            `Toast: the message "${TOAST_TEXT}" is not shown`
          )
        );
      })
  }),
  // Before any message the toast is closed; a Toast drawn regardless of isOpen could never be dismissed.
  defineCheck({
    group: 'toast',
    id: 'toast-hidden',
    slots: ['Toast'],
    obligation: 'shows nothing while it is closed',
    verify: (theme) =>
      withProvider(theme, () => {
        expectThat(
          screen.queryAllByTestId(TEST_IDS.toast).length === 0,
          `Toast: an element with data-testid="${TEST_IDS.toast}" is shown while the toast is closed (render nothing unless isOpen)`
        );
      })
  }),
  ...CHAT_CHECKS
];
