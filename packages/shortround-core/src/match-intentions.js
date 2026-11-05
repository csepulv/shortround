import fuzzysort from 'fuzzysort';

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

// The palette's matching: fuzzysort over each intention's title, group and aliases, threshold 0.5, kept in list
// order. A blank input matches everything. Exported so a host can know what the palette would show (a host had
// copied this rule to learn when the palette shows nothing).
export function matchIntentions(inputValue, intentions = []) {
  if (!inputValue || inputValue.trim().length === 0) {
    return intentions;
  }

  const matches = fuzzysort.go(inputValue, intentions.map(makeFuzzyOption), {
    key: 'text',
    threshold: 0.5,
    all: true
  });

  matches.sort((a, b) => a.obj.index - b.obj.index);
  return matches.map((m) => m.obj.intention);
}
