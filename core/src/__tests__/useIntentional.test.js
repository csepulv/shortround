import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, test } from 'vitest';
import {
  BACK_INTENTION,
  CANCEL_INTENTION,
  useIntentional
} from "../useIntentional.js";

import { SystemIntentIds, NO_OP } from '../utils.js';

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

describe('useIntentional', () => {
  let defaultIntentions, intentions;
  let first, second, third;
  let hook;
  beforeEach(async () => {
    first = { id: 'abc', title: 'Search', group: 'Actions', aliases: ['fetch items', 'find'] };
    second = { id: 'def', title: 'Read', group: 'Other', aliases: ['scan', 'find'] };
    third = { id: 'ghi', title: 'Write', group: 'Actions', aliases: ['scribe', 'pen'] };

    defaultIntentions = [first, second, third];
    intentions = [makeIntention({ id: '123' }), makeIntention({ id: '456' })];
    hook = renderHook(() => useIntentional({ defaultIntentions }));
  });
  describe('handle input changes', () => {
    test('should use fuzzy matching, title, group and aliases (preserve order)', async () => {
      act(() => {
        hook.result.current.updateInputValue('ea');
      });
      expect(hook.result.current.intentions).toEqual([first, second]);

      act(() => {
        hook.result.current.updateInputValue('act');
      });
      expect(hook.result.current.intentions).toEqual([first, third]);

      act(() => {
        hook.result.current.updateInputValue('scri');
      });
      expect(hook.result.current.intentions).toEqual([third]);
    });
    test('should not match on id', async () => {
      act(() => {
        hook.result.current.updateInputValue('abc');
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
        hook.result.current.updateInputValue('doest change intentions');
      });
      expect(hook.result.current.intentions).toEqual(intentions);
    });
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
          hook.result.current.updateInputValue('foo');
        });
        expect(hook.result.current.inputValue).toEqual('foo');

        await act(async () => {
          await hook.result.current.dispatch(second.id);
        });

        expect(second.action).toHaveBeenCalledWith('foo');
        expect(hook.result.current.intentions).toEqual(intentions);
        expect(hook.result.current.inputValue).toEqual('');
      });
      test('should include back, cancel as requested', async () => {
        second.action = () => ({
          intentions,
          systemIntentions: [SystemIntentIds.BACK, SystemIntentIds.CANCEL]
        });
        await act(async () => {
          await hook.result.current.dispatch(second.id);
        });
        expect(hook.result.current.intentions).toEqual([
          CANCEL_INTENTION,
          BACK_INTENTION,
          ...intentions
        ]);
      });
      test('should include system intentions if input doesnt match', async () => {
        second.action = () => ({
          intentions,
          systemIntentions: [SystemIntentIds.BACK]
        });
        await act(async () => {
          await hook.result.current.dispatch(second.id);
        });
        act(() => {
          hook.result.current.updateInputValue('does not match anything in list');
        });
        expect(hook.result.current.intentions).toEqual([BACK_INTENTION]);
      });
      test('should match on new intentions', async () => {
        second.action = () => ({ intentions });
        await act(async () => {
          await hook.result.current.dispatch(second.id);
        });
        act(() => {
          hook.result.current.updateInputValue('not in list');
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

      act(() => {
        hook.result.current.updateInputValue(''); // triggering validate
      });
      expect(first.validate).toHaveBeenCalled();
      expect(hook.result.current.intentions[0].disabled).toBeFalse();

      expect(third.validate).toHaveBeenCalled();
      expect(hook.result.current.intentions[2].disabled).toBeTrue();
      expect(hook.result.current.intentions[2].subtitle).toEqual('Not Valid');
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
  describe('back, cancel', () => {
    let secondIntentions, thirdIntentions;
    const dispatchSecondAndThirdIntentions = async () => {
      secondIntentions = [intentions[0], third];
      thirdIntentions = defaultIntentions;
      second.action = () => ({
        intentions: secondIntentions,
        systemIntentions: [SystemIntentIds.BACK, SystemIntentIds.CANCEL]
      });
      third.action = () => ({
        intentions: thirdIntentions,
        systemIntentions: [SystemIntentIds.BACK, SystemIntentIds.CANCEL]
      });
      await act(async () => {
        await hook.result.current.dispatch(second.id);
      });
      expect(hook.result.current.intentions.length).toEqual(4);

      await act(async () => {
        await hook.result.current.dispatch(third.id);
      });
      expect(hook.result.current.intentions.length).toEqual(5);
    };
    test('should handle back intention', async () => {
      await dispatchSecondAndThirdIntentions();
      await act(async () => {
        await hook.result.current.dispatch(SystemIntentIds.BACK);
      });
      expect(hook.result.current.intentions).toEqual([
        CANCEL_INTENTION,
        BACK_INTENTION,
        ...secondIntentions
      ]);
      expect(hook.result.current.intentionStack).toEqual([second]);
    });
    test('should handle back hook call', async () => {
      await dispatchSecondAndThirdIntentions();
      await act(async () => {
        await hook.result.current.back();
      });
      expect(hook.result.current.intentions).toEqual([
        CANCEL_INTENTION,
        BACK_INTENTION,
        ...secondIntentions
      ]);
      expect(hook.result.current.intentionStack).toEqual([second]);
    });
    test('should handle cancel intention', async () => {
      await dispatchSecondAndThirdIntentions();
      await act(async () => {
        await hook.result.current.dispatch(SystemIntentIds.CANCEL);
      });
      expect(hook.result.current.intentions).toEqual(defaultIntentions);
      expect(hook.result.current.intentionStack).toEqual([]);
    });
    test('should handle cancel hook call', async () => {
      await dispatchSecondAndThirdIntentions();
      await act(async () => {
        await hook.result.current.cancel();
      });
      expect(hook.result.current.intentions).toEqual(defaultIntentions);
      expect(hook.result.current.intentionStack).toEqual([]);
    });
  });
});
