import { useMemo, useRef, useState } from 'react';
import invariant from 'tiny-invariant';

import { useFuzzyMatcher } from './useFuzzyMatcher';
import { SystemIntentionIds } from './utils';

const indexIntentions = (intentions) =>
  Object.fromEntries(intentions.map((item) => [item.id, item]));

export const BACK_INTENTION = {
  id: SystemIntentionIds.BACK,
  title: 'Back',
  group: 'Actions',
  icon: 'back'
};

export const CANCEL_INTENTION = {
  id: SystemIntentionIds.CANCEL,
  title: 'Cancel',
  group: 'Actions',
  icon: 'cancel'
};

const systemIntentionIds = [SystemIntentionIds.CANCEL, SystemIntentionIds.BACK];

const systemIntentions = [CANCEL_INTENTION, BACK_INTENTION];

export function useIntentional({ defaultIntentions }) {
  const [inputValue, setInputValue] = useState('');
  const [sideEffects, setSideEffects] = useState();
  const [currentIntentions, setCurrentIntentions] = useState(defaultIntentions);
  const [additionalIntentions, setAdditionalIntents] = useState([]);
  const [disableInputMatching, setDisableInputMatching] = useState(false);
  const matchingIntentions = useFuzzyMatcher({ inputValue, intentions: currentIntentions });
  const intentStackRef = useRef([]);

  const isSystemIntention = (intentionId) => systemIntentionIds.includes(intentionId);

  const intentionIndex = useMemo(() => indexIntentions(currentIntentions), [currentIntentions]);

  async function handleSystemIntention(intentionId) {
    switch (intentionId) {
      case SystemIntentionIds.CANCEL:
        intentStackRef.current = [];
        return { intentions: defaultIntentions };
      case SystemIntentionIds.BACK:
        intentStackRef.current.pop();
        const prev =
          intentStackRef.current.length > 0
            ? intentStackRef.current[intentStackRef.current.length - 1]
            : null;
        return prev ? prev.action(inputValue) : { intentions: defaultIntentions };
      default:
        return {};
    }
  }

  const resetIntentions = async () => dispatch(SystemIntentionIds.CANCEL);
  const back = async () => dispatch(SystemIntentionIds.BACK);

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
      intentStackRef.current.push(intention);
    }

    if (result.intentions) {
      setCurrentIntentions(result.intentions);
    }

    const addedIntents = result.systemIntentions
      ? systemIntentions.filter((int) => result.systemIntentions.includes(int.id))
      : [];
    setAdditionalIntents(addedIntents);

    setDisableInputMatching(result.disableInputMatching);
    setSideEffects(result.sideEffects);
    setInputValue('');
    if (result.shouldReset) {
      resetIntentions();
    }
    return result;
  };

  const updateInputValue = (newVal) => {
    setInputValue(newVal);
    const changes = [];
    currentIntentions.forEach((intention) => {
      if (intention.disabled) {
        const result = intention.validate?.(newVal);
        if (result) {
          changes.push({
            intentionId: intention.id,
            disabled: !result.valid,
            subtitle: result.message || ' '
          });
        }
      }
    });
    if (changes.length > 0) {
      setCurrentIntentions((existing) => {
        return existing.map((intention) => {
          const change = changes.find((c) => c.intentionId === intention.id);
          return change
            ? {
                ...intention,
                disabled: change.disabled,
                subtitle: change.subtitle || intention.subtitle
              }
            : intention;
        });
      });
    }
  };

  const availableIntentions = disableInputMatching
    ? [...additionalIntentions, ...currentIntentions]
    : [...additionalIntentions, ...matchingIntentions];
  return {
    inputValue,
    updateInputValue,
    intentions: availableIntentions,
    sideEffects,
    dispatch,
    cancel: resetIntentions,
    back,
    intentionStack: [...intentStackRef.current]
  };
}
