import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, test } from 'vitest';
import { useShortRound } from '../useShortRound.js';

import { NO_OP, RevertIntentionIds } from '../../utils.js';

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
  test('should changing defaultIntentions resets state', async () => {
    second.action = vi.fn().mockResolvedValue({ intentions, disableInputMatching: true });
    await act(async () => {
      await hook.result.current.dispatch(second.id);
    });
    expect(hook.result.current.intentions).toEqual(intentions);
    act(() => {
      hook.result.current.onInputChange('some value');
    });

    hook = renderHook(() => useShortRound({ defaultIntentions: [first] }));
    expect(hook.result.current.intentions).toEqual([first]);
    expect(hook.result.current.inputValue).toEqual('');
  });
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
    test('should set first non system intent as selected (if none is specified)', () => {});
    test('should manage breadcrumb trail', () => {});
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
    test('should not dispatch a disabled intention', async () => {
      second.disabled = true;
      second.action = () => ({ intentions });
      const before = hook.result.current.intentions;
      await act(async () => {
        await hook.result.current.dispatch(second.id);
      });
      expect(hook.result.current.intentions).toEqual(before);
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
});
