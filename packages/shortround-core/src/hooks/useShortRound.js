import { useEffect, useState } from 'react';
import invariant from 'tiny-invariant';

import { RevertIntentionIds } from '../utils.js';
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

// `resolveDefaultInput` (optional) turns typed text into extra rows for the default list; a result that brings a new
// list brings its own `resolveInput`, or none.
export function useShortRound({ defaultIntentions, resolveDefaultInput }) {
  const [inputValue, setInputValue] = useState('');
  const [inputMessage, setInputMessage] = useState();
  const [dispatchedStack, setDispatchedStack] = useState([]);
  const [currentIntentions, setCurrentIntentions] = useState(defaultIntentions);
  const [disableInputMatching, setDisableInputMatching] = useState(false);
  const [resolveInput, setResolveInput] = useState(() => resolveDefaultInput);
  const matchingIntentions = useFuzzyMatcher({ inputValue, intentions: currentIntentions });

  const isSystemIntention = (intentionId) => revertIntentionIds.includes(intentionId);

  useEffect(() => {
    setCurrentIntentions(defaultIntentions);
    setResolveInput(() => resolveDefaultInput);
    setInputValue('');
  }, [defaultIntentions, resolveDefaultInput]);

  // Not memoized: the resolver reads live app data (facet counts, results) that can change while the
  // input doesn't.
  const resolvedIntentions =
    disableInputMatching || !resolveInput || !inputValue.trim()
      ? []
      : resolveTypedInput(resolveInput, inputValue);

  const intentionIndex = indexIntentions([...currentIntentions, ...resolvedIntentions]);

  const makeStartResult = () => ({
    intentions: [...defaultIntentions],
    resolveInput: resolveDefaultInput,
    sideEffects: { closeSidecar: true }
  });

  async function handleSystemIntention(intentionId) {
    switch (intentionId) {
      case RevertIntentionIds.RESET:
        setDispatchedStack([]);
        return makeStartResult();
      case RevertIntentionIds.BACK: {
        const remaining = dispatchedStack.slice(0, -1);
        setDispatchedStack(remaining);
        const prev = remaining.at(-1);
        return prev ? prev.result : makeStartResult();
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
    : [...resolvedIntentions, ...withoutIds(matchingIntentions, resolvedIntentions)];
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
