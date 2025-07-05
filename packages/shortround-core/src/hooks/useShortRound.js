import { useEffect, useMemo, useRef, useState } from 'react';
import invariant from 'tiny-invariant';

import { useFuzzyMatcher } from './useFuzzyMatcher.js';
import { RevertIntentionIds } from '../utils.js';

const indexIntentions = (intentions) =>
  Object.fromEntries(intentions.map((item) => [item.id, item]));

const revertIntentionIds = [RevertIntentionIds.RESET, RevertIntentionIds.BACK];

export function useShortRound({ defaultIntentions }) {
  const [inputValue, setInputValue] = useState('');
  const [inputMessage, setInputMessage] = useState();
  const [dispatchedStack, setDispatchedStack] = useState([]);
  const [currentIntentions, setCurrentIntentions] = useState(defaultIntentions);
  const [disableInputMatching, setDisableInputMatching] = useState(false);
  const matchingIntentions = useFuzzyMatcher({ inputValue, intentions: currentIntentions });

  const isSystemIntention = (intentionId) => revertIntentionIds.includes(intentionId);

  useEffect(() => {
    setCurrentIntentions(defaultIntentions);
    setInputValue('');
  }, [defaultIntentions]);

  const intentionIndex = useMemo(() => indexIntentions(currentIntentions), [currentIntentions]);

  async function handleSystemIntention(intentionId) {
    switch (intentionId) {
      case RevertIntentionIds.RESET:
        setDispatchedStack([]);
        return { intentions: [...defaultIntentions] };
      case RevertIntentionIds.BACK:
        dispatchedStack.pop();
        setDispatchedStack(dispatchedStack);
        const prev =
          dispatchedStack.length > 0 ? dispatchedStack[dispatchedStack.length - 1] : null;
        return prev ? prev.result : { intentions: [...defaultIntentions] };
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
      if (intention.disabled) {
        return;
      }

      result = await intention.action(inputValue);
      setDispatchedStack([...dispatchedStack, { intention, result }]);
    }

    if (result.intentions) {
      setCurrentIntentions(result.intentions);
    }

    setDisableInputMatching(result.disableInputMatching);
    setInputValue('');
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
          if (result.message) messages.add(result.message);
        }
      }
    });
    if (validations.length > 0) {
      setCurrentIntentions((existing) => {
        return existing.map((intention) => {
          const change = validations.find((c) => c.intentionId === intention.id);
          return change
            ? {
                ...intention,
                disabled: change.disabled
              }
            : intention;
        });
      });
    }
    const text = Array.from(messages).join(', ');
    if (text) setInputMessage({ type: 'error', text });
  };

  const availableIntentions = disableInputMatching ? currentIntentions : matchingIntentions;
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
