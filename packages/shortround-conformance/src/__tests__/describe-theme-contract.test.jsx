// The way a theme package uses this one: a test file that names its theme.
import { expect, test } from 'vitest';

import { describeThemeContract } from '../index.js';
import { referenceTheme } from './themes/reference-theme.jsx';

describeThemeContract('the reference theme', referenceTheme);

// Theme packages written for M1 passed the bare slots.
test('bare slots instead of a theme are refused, naming the theme object', () => {
  expect(() => describeThemeContract('slots only', referenceTheme.components)).toThrow(
    'describeThemeContract takes the theme object { components, Toast }'
  );
});
