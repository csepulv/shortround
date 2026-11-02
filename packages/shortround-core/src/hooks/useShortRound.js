import { useEffect, useState } from 'react';
import invariant from 'tiny-invariant';

import { bringsList, RevertIntentionIds } from '../utils.js';
import { useFuzzyMatcher } from './useFuzzyMatcher.js';

const indexIntentions = (intentions) =>
  Object.fromEntries(intentions.map((item) => [item.id, item]));

const revertIntentionIds = [RevertIntentionIds.RESET, RevertIntentionIds.BACK];

const UNAVAILABLE_MESSAGE = 'Not available right now';

// A resolver error must not take the palette down: log it with the input, and show no resolved rows.
function resolveTypedInput(resolveInput, inputValue) {
  try {
    return resolveInput(inputValue) ?? [];
  } catch (error) {
    console.error(`ShortRound resolveInput failed for "${inputValue}"`, error);
    return [];
  }
}

// A fallback error must not take the palette down either: log it with the input, and add no rows.
function resolveFallbackRows(resolveFallbackInput, inputValue, matches) {
  try {
    return resolveFallbackInput(inputValue, { matches }) ?? [];
  } catch (error) {
    console.error(`ShortRound resolveFallbackInput failed for "${inputValue}"`, error);
    return [];
  }
}

// A resolved row replaces a listed row with the same id.
const withoutIds = (intentions, replacements) => {
  const ids = new Set(replacements.map(({ id }) => id));
  return intentions.filter(({ id }) => !ids.has(id));
};

// Validates against the input at dispatch time: the last onInputChange may not have run for this list.
function findRejection(intention, inputValue) {
  const validation = intention.validate?.(inputValue);
  if (validation) {
    return validation.valid ? undefined : (validation.message ?? UNAVAILABLE_MESSAGE);
  }
  return intention.disabled ? UNAVAILABLE_MESSAGE : undefined;
}

// `resolveDefaultInput` (optional) turns typed text into extra rows for the default list, and
// `resolveDefaultFallbackInput` (optional) adds rows after the list's matches. A result that brings a new list brings
// its own of each, or none.
export function useShortRound({
  defaultIntentions,
  resolveDefaultInput,
  resolveDefaultFallbackInput
}) {
  const [inputValue, setInputValue] = useState('');
  const [inputMessage, setInputMessage] = useState();
  const [dispatchedStack, setDispatchedStack] = useState([]);
  const [currentIntentions, setCurrentIntentions] = useState(defaultIntentions);
  const [disableInputMatching, setDisableInputMatching] = useState(false);
  const [resolveInput, setResolveInput] = useState(() => resolveDefaultInput);
  const [resolveFallback, setResolveFallback] = useState(() => resolveDefaultFallbackInput);
  const matchingIntentions = useFuzzyMatcher({ inputValue, intentions: currentIntentions });

  const isSystemIntention = (intentionId) => revertIntentionIds.includes(intentionId);

  useEffect(() => {
    setCurrentIntentions(defaultIntentions);
    setResolveInput(() => resolveDefaultInput);
    setResolveFallback(() => resolveDefaultFallbackInput);
    setInputValue('');
  }, [defaultIntentions, resolveDefaultInput, resolveDefaultFallbackInput]);

  // Not memoized: the resolver reads live app data (facet counts, results) that can change while the
  // input doesn't.
  const isMatchingTypedText = !disableInputMatching && Boolean(inputValue.trim());
  const resolvedIntentions =
    isMatchingTypedText && resolveInput ? resolveTypedInput(resolveInput, inputValue) : [];
  const matches = [...resolvedIntentions, ...withoutIds(matchingIntentions, resolvedIntentions)];
  // After the matches, and never in place of a listed row.
  const fallbackIntentions =
    isMatchingTypedText && resolveFallback
      ? withoutIds(resolveFallbackRows(resolveFallback, inputValue, matches), matches)
      : [];

  const intentionIndex = indexIntentions([
    ...currentIntentions,
    ...resolvedIntentions,
    ...fallbackIntentions
  ]);

  const makeStartResult = () => ({
    intentions: [...defaultIntentions],
    resolveInput: resolveDefaultInput,
    resolveFallbackInput: resolveDefaultFallbackInput,
    sideEffects: { closeSidecar: true }
  });

  async function handleSystemIntention(intentionId) {
    switch (intentionId) {
      case RevertIntentionIds.RESET:
        setDispatchedStack([]);
        return makeStartResult();
      // Back leaves the current list: it drops the step that brought it, and any after it, and shows the list of the
      // last earlier step that brought one.
      case RevertIntentionIds.BACK: {
        const currentListStep = dispatchedStack.findLastIndex(bringsList);
        const remaining = currentListStep >= 0 ? dispatchedStack.slice(0, currentListStep) : [];
        setDispatchedStack(remaining);
        const earlierList = remaining.findLast(bringsList);
        return earlierList ? earlierList.result : makeStartResult();
      }
      default:
        return {};
    }
  }

  const resetIntentions = async () => dispatch(RevertIntentionIds.RESET);
  const back = async () => dispatch(RevertIntentionIds.BACK);

  /*
    TODO; consider context
    action maybe should have: other info about where it is, screen, etc
      - way to launch sidebar content
    way return messages/notifications
   */

  const dispatch = async (intentionId) => {
    let result;
    if (isSystemIntention(intentionId)) {
      result = await handleSystemIntention(intentionId);
    } else {
      const intention = intentionIndex[intentionId];
      invariant(intention, `Unknown intention id: ${intentionId}`);
      const rejection = findRejection(intention, inputValue);
      if (rejection) {
        setInputMessage({ type: 'error', text: rejection });
        return { isRejected: true };
      }

      result = (await intention.action(inputValue)) ?? {};
      setDispatchedStack([...dispatchedStack, { intention, result }]);
    }

    if (result.intentions) {
      setCurrentIntentions(result.intentions);
      setResolveInput(() => result.resolveInput);
      setResolveFallback(() => result.resolveFallbackInput);
    }

    setDisableInputMatching(result.disableInputMatching);
    setInputValue('');
    setInputMessage(undefined);
    if (result.shouldReset) {
      resetIntentions();
    }
    return result;
  };

  const onInputChange = (newVal) => {
    setInputValue(newVal);
    const validations = [];
    const messages = new Set();
    currentIntentions.forEach((intention) => {
      if (intention.validate) {
        const result = intention.validate(newVal);
        if (result) {
          validations.push({
            intentionId: intention.id,
            disabled: !result.valid
          });
          if (result.message) {
            messages.add(result.message);
          }
        }
      }
    });
    if (validations.length > 0) {
      setCurrentIntentions((existing) =>
        existing.map((intention) => {
          const change = validations.find((c) => c.intentionId === intention.id);
          return change
            ? {
                ...intention,
                disabled: change.disabled
              }
            : intention;
        })
      );
    }
    const text = Array.from(messages).join(', ');
    setInputMessage(text ? { type: 'error', text } : undefined);
  };

  const availableIntentions = disableInputMatching
    ? currentIntentions
    : [...matches, ...fallbackIntentions];
  return {
    inputValue,
    inputMessage,
    onInputChange,
    intentions: availableIntentions,
    dispatch,
    reset: resetIntentions,
    back,
    dispatchedStack
  };
}
