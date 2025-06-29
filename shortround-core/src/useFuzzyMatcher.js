import fuzzysort from 'fuzzysort';
import { useMemo } from 'react';

const aliasesText = (aliases) => (aliases && Array.isArray(aliases) ? aliases.join(' ') : '');

const makeFuzzyOption = (intention, index) => {
  const { id, title = '', group = '', aliases } = intention;
  return {
    id,
    index,
    text: `${title} ${group} ${aliasesText(aliases)}`,
    intention
  };
};

export function useFuzzyMatcher({ inputValue, intentions = [] }) {
  const fuzzyOptions = useMemo(() => intentions.map(makeFuzzyOption), [intentions]);

  const matchingIntentions = useMemo(() => {
    if (!inputValue || inputValue.trim().length === 0) {
      return intentions;
    }

    const matches = fuzzysort.go(inputValue, fuzzyOptions, {
      key: 'text',
      threshold: 0.5,
      // limit: 50,
      all: true
    });

    matches.sort((a, b) => a.obj.index - b.obj.index);
    return matches.map((m) => m.obj.intention);
  }, [inputValue, fuzzyOptions]);
  return matchingIntentions;
}
