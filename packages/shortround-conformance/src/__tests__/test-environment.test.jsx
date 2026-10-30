// The suite works whatever the theme's test file does with timers, and names the slot for a misplaced hook.
import { beforeAll, expect, test, vi } from 'vitest';

import { CONTRACT_CHECKS } from '../contract-checks.js';
import { describeThemeContract } from '../index.js';
import { TEST_IDS } from '../test-ids.js';
import { referenceTheme } from './themes/reference-theme.jsx';

// A theme's own tests may use fake timers; the contract's checks need real ones.
beforeAll(() => {
  vi.useFakeTimers();
});

describeThemeContract('the reference theme, with fake timers in its test file', referenceTheme);

test('a hook used twice is reported against its slot', async () => {
  const { components } = referenceTheme;
  const Input = components.IntentionPalette.Input;
  const doubled = {
    ...referenceTheme,
    components: {
      ...components,
      IntentionPalette: {
        ...components.IntentionPalette,
        Input: (props) => (
          <>
            <Input {...props} />
            <span data-testid={TEST_IDS.input} />
          </>
        )
      }
    }
  };
  const check = CONTRACT_CHECKS.find(({ id }) => id === 'input-narrows');

  await expect(check.run(doubled)).rejects.toThrow(
    'IntentionPalette.Input: more than one element with data-testid="shortround-input"'
  );
});
