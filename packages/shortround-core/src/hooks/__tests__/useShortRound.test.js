import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, test } from 'vitest';

import { NO_OP, RevertIntentionIds } from '../../utils.js';
import { useShortRound } from '../useShortRound.js';

const makeIntention = ({
  id,
  title,
  group,
  aliases = [],
  action = NO_OP,
  disabled,
  disableInputMatching
}) => ({
  id,
  title,
  group: group || title,
  aliases,
  action,
  disabled,
  disableInputMatching
});

describe('useShortRound', () => {
  let defaultIntentions, intentions;
  let first, second, third;
  let hook;
  beforeEach(async () => {
    first = { id: 'abc', title: 'Search', group: 'Actions', aliases: ['fetch items', 'find'] };
    second = { id: 'def', title: 'Read', group: 'Other', aliases: ['scan', 'find'] };
    third = { id: 'ghi', title: 'Write', group: 'Actions', aliases: ['scribe', 'pen'] };

    defaultIntentions = [first, second, third];
    intentions = [makeIntention({ id: '123' }), makeIntention({ id: '456' })];
    hook = renderHook(() => useShortRound({ defaultIntentions }));
  });
  describe('handle input changes', () => {
    test('should use fuzzy matching, title, group and aliases (preserve order)', async () => {
      act(() => {
        hook.result.current.onInputChange('ea');
      });
      expect(hook.result.current.intentions).toEqual([first, second]);

      act(() => {
        hook.result.current.onInputChange('act');
      });
      expect(hook.result.current.intentions).toEqual([first, third]);

      act(() => {
        hook.result.current.onInputChange('scri');
      });
      expect(hook.result.current.intentions).toEqual([third]);
    });
    test('should not match on id', async () => {
      act(() => {
        hook.result.current.onInputChange('abc');
      });
      expect(hook.result.current.intentions).toEqual([]);
    });
    test('should not match if input matching is disabled', async () => {
      second.action = vi.fn().mockResolvedValue({ intentions, disableInputMatching: true });

      await act(async () => {
        await hook.result.current.dispatch(second.id);
      });
      expect(hook.result.current.intentions).toEqual(intentions);
      act(() => {
        hook.result.current.onInputChange('doest change intentions');
      });
      expect(hook.result.current.intentions).toEqual(intentions);
    });
  });
  test('replacing defaultIntentions shows them and clears the input', async () => {
    const replaceable = renderHook((props) => useShortRound(props), {
      initialProps: { defaultIntentions }
    });
    act(() => {
      replaceable.result.current.onInputChange('some value');
    });

    replaceable.rerender({ defaultIntentions: [first] });

    expect(replaceable.result.current.intentions).toEqual([first]);
    expect(replaceable.result.current.inputValue).toEqual('');
  });
  // SL-22: whether history, disableInputMatching and the message also reset is undecided (refresh decision 12).
  test.todo('replacing defaultIntentions resets the whole workflow');
  describe('dispatch', () => {
    describe('intentions', () => {
      test('should only match on current intentions', async () => {
        await expect(
          act(async () => {
            await hook.result.current.dispatch('bad-id');
          })
        ).rejects.toThrow('Invariant failed: Unknown intention id: bad-id');
      });
      test('should handle new intentions, clear input', async () => {
        second.action = vi.fn().mockResolvedValue({ intentions });
        act(() => {
          hook.result.current.onInputChange('foo');
        });
        expect(hook.result.current.inputValue).toEqual('foo');

        await act(async () => {
          await hook.result.current.dispatch(second.id);
        });

        expect(second.action).toHaveBeenCalledWith('foo');
        expect(hook.result.current.intentions).toEqual(intentions);
        expect(hook.result.current.inputValue).toEqual('');
      });
      test('no match', async () => {
        second.action = () => ({
          intentions,
          includeRevertIntentions: [RevertIntentionIds.BACK]
        });
        await act(async () => {
          await hook.result.current.dispatch(second.id);
        });
        act(() => {
          hook.result.current.onInputChange('does not match anything in list');
        });
        expect(hook.result.current.intentions).toEqual([]);
      });
      test('should match on new intentions', async () => {
        second.action = () => ({ intentions });
        await act(async () => {
          await hook.result.current.dispatch(second.id);
        });
        act(() => {
          hook.result.current.onInputChange('not in list');
        });
        expect(hook.result.current.intentions).toEqual([]);
      });
    });
    test('an action that returns nothing leaves the intentions unchanged', async () => {
      second.action = () => undefined;
      const before = hook.result.current.intentions;

      await act(async () => {
        await hook.result.current.dispatch(second.id);
      });

      expect(hook.result.current.intentions).toEqual(before);
    });
    test.todo('should set first non system intent as selected (if none is specified)');
    test.todo('should manage breadcrumb trail');
  });
  describe('handle disabled and validation', () => {
    test('should intention.validate() on input change', () => {
      first.disabled = true;
      first.validate = vi.fn().mockImplementation(() => ({ valid: true }));
      third.disabled = true;
      third.validate = vi.fn().mockImplementation(() => ({ valid: false, message: 'Not Valid' }));

      expect(hook.result.current.inputMessage).toBeUndefined();

      act(() => {
        hook.result.current.onInputChange(''); // triggering validate
      });
      expect(first.validate).toHaveBeenCalled();
      expect(hook.result.current.intentions[0].disabled).toBeFalse();

      expect(third.validate).toHaveBeenCalled();
      expect(hook.result.current.intentions[2].disabled).toBeTrue();
      expect(hook.result.current.inputMessage).toEqual({ type: 'error', text: 'Not Valid' });
    });
    test('clears the message once the input is valid', () => {
      third.validate = (value) =>
        value === 'ok' ? { valid: true } : { valid: false, message: 'Not Valid' };

      act(() => {
        hook.result.current.onInputChange('bad');
      });
      expect(hook.result.current.inputMessage).toEqual({ type: 'error', text: 'Not Valid' });

      act(() => {
        hook.result.current.onInputChange('ok');
      });
      expect(hook.result.current.inputMessage).toBeUndefined();
    });
    test('clears the message on dispatch', async () => {
      third.validate = () => ({ valid: false, message: 'Not Valid' });
      second.action = () => ({ intentions });
      act(() => {
        hook.result.current.onInputChange('bad');
      });

      await act(async () => {
        await hook.result.current.dispatch(second.id);
      });

      expect(hook.result.current.inputMessage).toBeUndefined();
    });
    test('should not dispatch a disabled intention', async () => {
      second.disabled = true;
      second.action = () => ({ intentions });
      const before = hook.result.current.intentions;
      await act(async () => {
        await hook.result.current.dispatch(second.id);
      });
      expect(hook.result.current.intentions).toEqual(before);
    });
    test('rejecting a disabled intention says why and keeps the input', async () => {
      second.disabled = true;
      second.action = vi.fn();
      act(() => {
        hook.result.current.onInputChange('typed');
      });

      let result;
      await act(async () => {
        result = await hook.result.current.dispatch(second.id);
      });

      expect(result).toEqual({ isRejected: true });
      expect(second.action).not.toHaveBeenCalled();
      expect(hook.result.current.inputValue).toEqual('typed');
      expect(hook.result.current.inputMessage).toEqual({
        type: 'error',
        text: 'Not available right now'
      });
    });
    test('validates against the current input before running, even without an input change', async () => {
      const needsText = {
        id: 'needs-text',
        title: 'Name it',
        action: vi.fn(),
        validate: (value) => (value ? { valid: true } : { valid: false, message: 'Type a name' })
      };
      second.action = () => ({ intentions: [needsText], disableInputMatching: true });
      await act(async () => {
        await hook.result.current.dispatch(second.id);
      });

      let result;
      await act(async () => {
        result = await hook.result.current.dispatch(needsText.id);
      });

      expect(result).toEqual({ isRejected: true });
      expect(needsText.action).not.toHaveBeenCalled();
      expect(hook.result.current.inputMessage).toEqual({ type: 'error', text: 'Type a name' });
    });
  });
  describe('back, reset', () => {
    let secondIntentions, thirdIntentions;
    let secondActionResult, thirdActionResult;
    const dispatchSecondAndThirdIntentions = async (intentionsForThird = defaultIntentions) => {
      secondIntentions = [intentions[0], third];
      first.action = () => ({ shouldReset: true });
      thirdIntentions = intentionsForThird;
      secondActionResult = {
        intentions: secondIntentions,
        includeRevertIntentions: [RevertIntentionIds.BACK, RevertIntentionIds.RESET]
      };
      second.action = vi.fn(() => secondActionResult);
      thirdActionResult = {
        intentions: thirdIntentions,
        includeRevertIntentions: [RevertIntentionIds.BACK, RevertIntentionIds.RESET]
      };
      third.action = vi.fn(() => thirdActionResult);
      await act(async () => {
        await hook.result.current.dispatch(second.id);
      });
      expect(hook.result.current.intentions.length).toEqual(2);
      await act(async () => {
        await hook.result.current.dispatch(third.id);
      });
      expect(hook.result.current.intentions.length).toEqual(intentionsForThird.length);
    };
    test('should reset back to home', async () => {
      const itention = makeIntention({ id: 'be-done', action: () => ({ shouldReset: true }) });
      await dispatchSecondAndThirdIntentions([itention]);

      await act(async () => {
        await hook.result.current.dispatch(itention.id);
      });
      expect(hook.result.current.intentions).toEqual(defaultIntentions);
    });
    test('should handle back intention', async () => {
      await dispatchSecondAndThirdIntentions();
      await act(async () => {
        await hook.result.current.dispatch(RevertIntentionIds.BACK);
      });
      expect(second.action).toHaveBeenCalledTimes(1);
      expect(third.action).toHaveBeenCalledTimes(1);
      expect(hook.result.current.intentions).toEqual(secondIntentions);
      expect(hook.result.current.dispatchedStack).toEqual([
        { intention: second, result: secondActionResult }
      ]);
    });
    test('back leaves the previous history array unchanged', async () => {
      await dispatchSecondAndThirdIntentions();
      const historyBeforeBack = hook.result.current.dispatchedStack;

      await act(async () => {
        await hook.result.current.back();
      });

      expect(historyBeforeBack).toHaveLength(2);
      expect(hook.result.current.dispatchedStack).toHaveLength(1);
    });
    test('should handle back hook call', async () => {
      await dispatchSecondAndThirdIntentions();
      await act(async () => {
        await hook.result.current.back();
      });
      expect(second.action).toHaveBeenCalledTimes(1);
      expect(third.action).toHaveBeenCalledTimes(1);
      expect(hook.result.current.intentions).toEqual(secondIntentions);
      expect(hook.result.current.dispatchedStack).toEqual([
        { intention: second, result: secondActionResult }
      ]);
    });
    test('should handle reset intention', async () => {
      await dispatchSecondAndThirdIntentions();
      await act(async () => {
        await hook.result.current.dispatch(RevertIntentionIds.RESET);
      });
      expect(hook.result.current.intentions).toEqual(defaultIntentions);
      expect(hook.result.current.dispatchedStack).toEqual([]);
    });
    test('should handle reset hook call', async () => {
      await dispatchSecondAndThirdIntentions();
      await act(async () => {
        await hook.result.current.reset();
      });
      expect(hook.result.current.intentions).toEqual(defaultIntentions);
      expect(hook.result.current.dispatchedStack).toEqual([]);
    });
  });
  describe('Back after steps that bring no list', () => {
    const { BACK, RESET } = RevertIntentionIds;
    const subRow = { id: 'sub-row', title: 'Sub row', group: 'Sub', action: () => ({}) };
    const deepRow = { id: 'deep-row', title: 'Deep row', group: 'Deep', action: () => ({}) };
    const messageOnly = (id) => ({
      id,
      title: id,
      group: 'G',
      action: () => ({ message: 'done' })
    });
    const opensList = (id, rows) => ({
      id,
      title: id,
      group: 'G',
      action: () => ({ intentions: rows, includeRevertIntentions: [BACK, RESET] })
    });

    const run = async (current, ...ids) => {
      for (const id of ids) {
        await act(async () => {
          await current.result.current.dispatch(id);
        });
      }
    };
    const shownIds = (current) => current.result.current.intentions.map(({ id }) => id);

    test('a step with no list before a list does not count: Back goes to the start list', async () => {
      const startList = [messageOnly('msg'), opensList('ask', [subRow])];
      const current = renderHook(() => useShortRound({ defaultIntentions: startList }));

      await run(current, 'msg', 'ask', BACK);

      expect(shownIds(current)).toEqual(['msg', 'ask']);
    });

    test('a step with no list inside a list: one Back leaves that list', async () => {
      const startList = [opensList('ask', [messageOnly('note')])];
      const current = renderHook(() => useShortRound({ defaultIntentions: startList }));

      await run(current, 'ask', 'note', BACK);

      expect(shownIds(current)).toEqual(['ask']);
      expect(current.result.current.dispatchedStack).toEqual([]);
    });

    test('deeper down, Back returns to the list before the current one', async () => {
      const sub = opensList('sub', [messageOnly('note'), deepRow]);
      const startList = [opensList('ask', [sub, subRow])];
      const current = renderHook(() => useShortRound({ defaultIntentions: startList }));

      await run(current, 'ask', 'sub', 'note', BACK);

      expect(shownIds(current)).toEqual(['sub', 'sub-row']);
      expect(current.result.current.dispatchedStack.map(({ intention }) => intention.id)).toEqual([
        'ask'
      ]);
    });
  });
  describe('input resolver', () => {
    const kindRow = {
      id: 'kind::library',
      title: 'Kind: library',
      group: 'Refine',
      action: vi.fn(() => ({}))
    };
    const resolveKind = (text) => (text.startsWith('kind') ? [kindRow] : []);
    const renderWithResolver = (resolveDefaultInput = resolveKind) =>
      renderHook(() => useShortRound({ defaultIntentions, resolveDefaultInput }));

    test('shows resolved rows first, then the fuzzy matches', () => {
      const resolving = renderWithResolver((text) => (text === 'read' ? [kindRow] : []));

      act(() => {
        resolving.result.current.onInputChange('read');
      });

      expect(resolving.result.current.intentions).toEqual([kindRow, second]);
    });

    test('adds no rows while the input is empty', () => {
      const resolving = renderWithResolver(() => [kindRow]);

      expect(resolving.result.current.intentions).toEqual(defaultIntentions);
    });

    test('a resolved row can be dispatched', async () => {
      const resolving = renderWithResolver();
      act(() => {
        resolving.result.current.onInputChange('kind lib');
      });

      await act(async () => {
        await resolving.result.current.dispatch(kindRow.id);
      });

      expect(kindRow.action).toHaveBeenCalledWith('kind lib');
    });

    test('a new list brings its own resolver, or none', async () => {
      const resolving = renderWithResolver();
      const nextRow = { id: 'next', title: 'Next', action: vi.fn() };
      second.action = () => ({ intentions, resolveInput: () => [nextRow] });
      third.action = () => ({ intentions });

      await act(async () => {
        await resolving.result.current.dispatch(second.id);
      });
      act(() => {
        resolving.result.current.onInputChange('kind');
      });
      expect(resolving.result.current.intentions[0]).toBe(nextRow);

      await act(async () => {
        await resolving.result.current.dispatch(RevertIntentionIds.RESET);
      });
      await act(async () => {
        await resolving.result.current.dispatch(third.id);
      });
      act(() => {
        resolving.result.current.onInputChange('kind');
      });
      expect(resolving.result.current.intentions).not.toContain(kindRow);
    });

    test('Back restores the resolver of the previous list, Cancel the default one', async () => {
      const resolving = renderWithResolver();
      const nextRow = { id: 'next', title: 'Next', action: vi.fn() };
      second.action = () => ({ intentions, resolveInput: () => [nextRow] });
      const deeper = makeIntention({
        id: 'deeper',
        title: 'Deeper',
        action: () => ({ intentions: [first] })
      });
      intentions.push(deeper);

      await act(async () => {
        await resolving.result.current.dispatch(second.id);
      });
      await act(async () => {
        await resolving.result.current.dispatch(deeper.id);
      });
      await act(async () => {
        await resolving.result.current.dispatch(RevertIntentionIds.BACK);
      });
      act(() => {
        resolving.result.current.onInputChange('kind');
      });
      expect(resolving.result.current.intentions[0]).toBe(nextRow);

      await act(async () => {
        await resolving.result.current.dispatch(RevertIntentionIds.RESET);
      });
      act(() => {
        resolving.result.current.onInputChange('kind');
      });
      expect(resolving.result.current.intentions[0]).toBe(kindRow);
    });

    test('rows follow the app data when it changes, without retyping', () => {
      const data = { rows: [] };
      const resolving = renderWithResolver(() => data.rows);
      act(() => {
        resolving.result.current.onInputChange('kind ');
      });

      data.rows = [kindRow];
      resolving.rerender();

      expect(resolving.result.current.intentions[0]).toBe(kindRow);
    });

    test('a resolver that throws adds no rows and logs why, instead of breaking the palette', () => {
      const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const resolving = renderWithResolver(() => {
        throw new Error('no aggregations yet');
      });

      act(() => {
        resolving.result.current.onInputChange('read');
      });

      expect(resolving.result.current.intentions).toEqual([second]);
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining('resolveInput'),
        expect.objectContaining({ message: 'no aggregations yet' })
      );
      logError.mockRestore();
    });

    test('a resolved row with the id of a listed row appears once, as the resolved row', () => {
      const resolvedSecond = { ...second, title: 'Read: now' };
      const resolving = renderWithResolver(() => [resolvedSecond]);

      act(() => {
        resolving.result.current.onInputChange('read');
      });

      expect(resolving.result.current.intentions).toEqual([resolvedSecond]);
    });

    test('a new default resolver resets the list and the input, like new default intentions', () => {
      const resetting = renderHook((props) => useShortRound(props), {
        initialProps: { defaultIntentions, resolveDefaultInput: () => [] }
      });
      act(() => {
        resetting.result.current.onInputChange('some value');
      });

      resetting.rerender({ defaultIntentions, resolveDefaultInput: () => [] });

      expect(resetting.result.current.inputValue).toEqual('');
      expect(resetting.result.current.intentions).toEqual(defaultIntentions);
    });

    test('adds no rows during a typed-text step', async () => {
      const resolving = renderWithResolver(() => [kindRow]);
      second.action = () => ({
        intentions,
        disableInputMatching: true,
        resolveInput: () => [kindRow]
      });

      await act(async () => {
        await resolving.result.current.dispatch(second.id);
      });
      act(() => {
        resolving.result.current.onInputChange('kind');
      });

      expect(resolving.result.current.intentions).toEqual(intentions);
    });
  });
});
