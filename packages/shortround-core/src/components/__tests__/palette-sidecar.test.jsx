import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';

import { createSidekickStore } from '../../hooks/useSidekick.js';
import { RevertIntentionIds } from '../../utils.js';
import { ShortRoundSidekick } from '../ShortRoundSidekick.jsx';

const { BACK, RESET } = RevertIntentionIds;

const Pass = ({ children }) => <div>{children}</div>;

// A theme that only draws: rows are clickable, and the side panel shows what core renders there.
const stubComponents = {
  IntentionPalette: {
    Frame: Pass,
    Input: ({ input }) => input,
    Item: ({ intention }) => <span>{intention.title}</span>,
    Group: () => null,
    NoMatches: () => null
  },
  Sidekick: { Frame: Pass, Popover: Pass, ControlBar: () => null },
  SidecarContent: ({ isOpen, renderSidecar }) =>
    isOpen ? <div data-testid="sidecar">{renderSidecar()}</div> : null
};

// The chat's view counts its mounts, so a test can tell "kept" from "closed and shown again".
let chatMounts = 0;
function ChatView() {
  useEffect(() => {
    chatMounts += 1;
  }, []);
  return 'chat';
}
const CHAT = () => <ChatView />;
const PANEL = () => 'start panel';

const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
const choose = async (id) => {
  act(() => screen.getByTestId(`shortround-item-${id}`).click());
  await settle();
};
const sidecarText = () => screen.queryByTestId('sidecar')?.textContent ?? null;

// "Ask" opens the chat and a sub-list with Back and Cancel; "Hide" in it closes the chat; "Next" goes one step deeper.
const makeIntentions = () => {
  const hide = {
    id: 'hide',
    title: 'Hide chat',
    group: 'Chat',
    action: () => ({ sideEffects: { closeSidecar: true } })
  };
  const next = {
    id: 'next',
    title: 'Next',
    group: 'Chat',
    action: () => ({ intentions: [hide], includeRevertIntentions: [BACK, RESET] })
  };
  const ask = {
    id: 'ask',
    title: 'Ask',
    group: 'Chat',
    action: () => ({
      intentions: [next, hide],
      includeRevertIntentions: [BACK, RESET],
      sideEffects: { sidecarRenderer: CHAT }
    })
  };
  return [ask];
};

const renderSidekick = (props) => {
  const store = createSidekickStore({ isOpen: true });
  render(
    <ShortRoundSidekick
      SidekickComponents={stubComponents}
      defaultIntentions={makeIntentions()}
      sidekickStore={store}
      {...props}
    />
  );
  return store;
};

const recordingReducer =
  (calls) =>
  (current, proposed, { reason }) => {
    calls.push({ reason, proposed: proposed.renderer });
    return proposed;
  };

describe("the palette's sidecar changes go through the reducer", () => {
  test('an action that opens it: result', async () => {
    const calls = [];
    renderSidekick({ sidecarReducer: recordingReducer(calls) });

    await choose('ask');

    expect(calls.at(-1)).toEqual({ reason: 'result', proposed: CHAT });
  });

  test('Back from the first step: start, proposing no panel', async () => {
    const calls = [];
    renderSidekick({ sidecarReducer: recordingReducer(calls) });
    await choose('ask');

    await choose(BACK);

    expect(calls.at(-1)).toEqual({ reason: 'start', proposed: null });
  });

  test('Back from a deeper step: back, replaying that step’s result', async () => {
    const calls = [];
    renderSidekick({ sidecarReducer: recordingReducer(calls) });
    await choose('ask');
    await choose('next');

    await choose(BACK);

    expect(calls.at(-1)).toEqual({ reason: 'back', proposed: CHAT });
  });

  test('Cancel: reset, proposing no panel', async () => {
    const calls = [];
    renderSidekick({ sidecarReducer: recordingReducer(calls) });
    await choose('ask');

    await choose(RESET);

    expect(calls.at(-1)).toEqual({ reason: 'reset', proposed: null });
  });

  test('an action with no side effects proposes nothing', async () => {
    const calls = [];
    renderSidekick({ sidecarReducer: recordingReducer(calls) });
    await choose('ask');
    const before = calls.length;

    await choose('next');

    expect(calls).toHaveLength(before);
  });
});

describe('steps that bring no list', () => {
  const hasRow = (id) => screen.queryByTestId(`shortround-item-${id}`) !== null;

  test("keep the list's Back and Cancel", async () => {
    renderSidekick();
    await choose('ask');

    await choose('hide');

    expect(hasRow(BACK)).toBe(true);
    expect(hasRow(RESET)).toBe(true);
  });

  test("don't count for Back: start, proposing the start list's panel", async () => {
    const calls = [];
    const note = { id: 'note', title: 'Note', group: 'Chat', action: () => ({ message: 'noted' }) };
    renderSidekick({
      defaultIntentions: [note, ...makeIntentions()],
      defaultSidecarRenderer: PANEL,
      sidecarReducer: recordingReducer(calls)
    });
    await choose('note');
    await choose('ask');

    await choose(BACK);

    expect(calls.at(-1)).toEqual({ reason: 'start', proposed: PANEL });
  });
});

describe("the start list's panel", () => {
  test('comes back on Back to the start and on Cancel', async () => {
    renderSidekick({ defaultSidecarRenderer: PANEL });
    expect(sidecarText()).toBe('start panel');

    await choose('ask');
    expect(sidecarText()).toBe('chat');
    await choose(BACK);
    expect(sidecarText()).toBe('start panel');

    await choose('ask');
    await choose(RESET);
    expect(sidecarText()).toBe('start panel');
  });
});

// FU-15: an app's chat panel, kept by a reducer instead of a store subscription.
describe('a chat kept until Hide chat', () => {
  test('stays across Back and Cancel without remounting, clears on close, returns on open', async () => {
    chatMounts = 0;
    let wasChatShowing = false;
    const keepChat = (current, proposed, { reason }) => {
      if (reason === 'open') {
        return wasChatShowing ? { renderer: CHAT } : proposed;
      }
      if (['start', 'reset', 'back'].includes(reason) && current.renderer === CHAT) {
        return current;
      }
      return proposed;
    };
    const store = renderSidekick({ sidecarReducer: keepChat });

    await choose('ask');
    await choose(BACK);
    expect(sidecarText()).toBe('chat');
    await choose('ask');
    await choose(RESET);
    expect(sidecarText()).toBe('chat');
    expect(chatMounts).toBe(1);

    wasChatShowing = store.get().internalSidecarRenderer === CHAT;
    act(() => store.set({ isOpen: false }));
    expect(store.get().internalSidecarRenderer).toBeNull();
    act(() => store.set({ isOpen: true }));
    expect(sidecarText()).toBe('chat');

    await choose('ask');
    await choose('hide');
    expect(sidecarText()).toBeNull();
  });
});
