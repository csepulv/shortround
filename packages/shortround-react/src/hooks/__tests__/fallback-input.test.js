import { RevertIntentionIds } from '@shortround/core';
import { act, renderHook } from '@testing-library/react';

import { useShortRound } from '../useShortRound.js';

const sendAsChat = vi.fn();
const chatRow = (text) => ({
  id: 'send-as-chat',
  title: `Send as chat: ${text}`,
  group: 'Chat',
  action: () => sendAsChat(text)
});

const ids = (result) => result.current.intentions.map(({ id }) => id);

const type = (result, text) => act(() => result.current.onInputChange(text));

// The start list and its fallback are made once, as an app memoizes them.
function setup({ fallback, intentions } = {}) {
  const defaultIntentions = intentions ?? [
    { id: 'close', title: 'Close batch', group: 'Batches', action: () => ({}) },
    { id: 'open', title: 'Open batch', group: 'Batches', action: () => ({}) }
  ];
  const resolveDefaultFallbackInput =
    fallback ?? vi.fn((text, { matches }) => (matches.length ? [] : [chatRow(text)]));
  const hook = renderHook(() => useShortRound({ defaultIntentions, resolveDefaultFallbackInput }));
  return { ...hook, fallback: resolveDefaultFallbackInput };
}

describe('resolveDefaultFallbackInput', () => {
  test('typed text that matches nothing gets the fallback’s row, which can be chosen', async () => {
    const { result } = setup();

    type(result, 'why was this escalated');
    expect(ids(result)).toEqual(['send-as-chat']);

    await act(() => result.current.dispatch('send-as-chat'));
    expect(sendAsChat).toHaveBeenCalledWith('why was this escalated');
  });

  test('with matches, it is still called with them, and its rows come after', () => {
    const fallback = vi.fn((text) => [chatRow(text)]);
    const { result } = setup({ fallback });

    type(result, 'close');

    expect(ids(result)).toEqual(['close', 'send-as-chat']);
    expect(fallback).toHaveBeenLastCalledWith('close', {
      matches: [expect.objectContaining({ id: 'close' })]
    });
  });

  test('a blank input calls nothing', () => {
    const { result, fallback } = setup();

    type(result, '   ');

    expect(fallback).not.toHaveBeenCalled();
  });

  test('a fallback row with an id already listed is left out', () => {
    const fallback = () => [{ id: 'close', title: 'Another close', action: () => ({}) }];
    const { result } = setup({ fallback });

    type(result, 'close');

    expect(result.current.intentions.map(({ title }) => title)).toEqual(['Close batch']);
  });

  test('a fallback that throws is logged, and the matches still show', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = setup({
      fallback: () => {
        throw new Error('broken');
      }
    });

    type(result, 'close');

    expect(ids(result)).toEqual(['close']);
    expect(consoleError).toHaveBeenCalledWith(
      'ShortRound resolveFallbackInput failed for "close"',
      expect.any(Error)
    );
    consoleError.mockRestore();
  });
});

describe('a list’s own fallback', () => {
  const pickerRow = { id: 'batch-7', title: 'Batch 7', group: 'Batches', action: () => ({}) };
  const listFallback = vi.fn((text) => [{ ...chatRow(text), id: 'list-fallback' }]);
  const textStepFallback = vi.fn(() => [chatRow('from a text step')]);
  const intentions = [
    {
      id: 'pick',
      title: 'Pick a batch',
      group: 'Batches',
      // A picker's list brings no fallback.
      action: () => ({
        intentions: [pickerRow],
        includeRevertIntentions: [RevertIntentionIds.BACK]
      })
    },
    {
      id: 'review',
      title: 'Review',
      group: 'Batches',
      action: () => ({
        intentions: [
          { id: 'next', title: 'Next result', group: 'Review', action: () => ({}) },
          {
            id: 'deeper',
            title: 'Deeper',
            group: 'Review',
            // A deeper list that brings no fallback of its own.
            action: () => ({
              intentions: [{ id: 'leaf', title: 'Leaf', group: 'Deeper', action: () => ({}) }],
              includeRevertIntentions: [RevertIntentionIds.BACK]
            })
          }
        ],
        resolveFallbackInput: listFallback,
        includeRevertIntentions: [RevertIntentionIds.BACK, RevertIntentionIds.RESET]
      })
    },
    {
      id: 'note',
      title: 'Note',
      group: 'Batches',
      action: () => ({
        intentions: [{ id: 'note-text', title: 'Note text', group: 'Note', action: () => ({}) }],
        disableInputMatching: true,
        // Even a text step that brings a fallback doesn't get it called: typed text there is the step's value.
        resolveFallbackInput: textStepFallback,
        includeRevertIntentions: [RevertIntentionIds.BACK]
      })
    }
  ];

  test('a list that brings none has none (a picker)', async () => {
    const { result, fallback } = setup({ intentions });
    await act(() => result.current.dispatch('pick'));
    fallback.mockClear();

    type(result, 'zzz');

    expect(fallback).not.toHaveBeenCalled();
    expect(ids(result)).toEqual([]);
  });

  test('a text step calls nothing', async () => {
    const { result, fallback } = setup({ intentions });
    await act(() => result.current.dispatch('note'));
    fallback.mockClear();

    type(result, 'some notes');

    expect(fallback).not.toHaveBeenCalled();
    expect(textStepFallback).not.toHaveBeenCalled();
    expect(ids(result)).toEqual(['note-text']);
  });

  test('Back to an earlier list restores that list’s fallback', async () => {
    const { result } = setup({ intentions });
    await act(() => result.current.dispatch('review'));
    await act(() => result.current.dispatch('deeper'));
    type(result, 'zzz');
    expect(ids(result)).toEqual([]);

    await act(() => result.current.dispatch(RevertIntentionIds.BACK));
    type(result, 'zzz');

    expect(ids(result)).toEqual(['list-fallback']);
  });

  test('a list brings its own; Back and Cancel restore the start list’s', async () => {
    const { result, fallback } = setup({ intentions });
    await act(() => result.current.dispatch('review'));

    type(result, 'zzz');
    expect(ids(result)).toEqual(['list-fallback']);

    await act(() => result.current.dispatch(RevertIntentionIds.BACK));
    type(result, 'zzz');
    expect(ids(result)).toEqual(['send-as-chat']);

    await act(() => result.current.dispatch('review'));
    await act(() => result.current.dispatch(RevertIntentionIds.RESET));
    fallback.mockClear();
    type(result, 'zzz');
    expect(fallback).toHaveBeenCalled();
    expect(ids(result)).toEqual(['send-as-chat']);
  });
});
