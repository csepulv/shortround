import { render } from '@testing-library/react';

import { IntentionPaletteFrame } from '../IntentionPaletteFrame.jsx';

test('renders only its children', () => {
  const { container } = render(
    <IntentionPaletteFrame height="50vh">
      <span>child</span>
    </IntentionPaletteFrame>
  );

  expect(container).toHaveTextContent(/^child$/);
});

// The palette input's line hints: core's react input marks each word with `data-role`, and the theme colours them.
// With MUI's default theme: the command in primary, a broken word in error, the ghost faint.
test('colours the words of a typed line by their role', () => {
  const { container } = render(
    <IntentionPaletteFrame height="50vh">
      <span data-role="verb">search</span>
      <span data-role="text">grid</span>
      <span data-role="broken">zzz</span>
      <span data-role="ghost">ated</span>
    </IntentionPaletteFrame>
  );
  const colourOf = (role) =>
    window.getComputedStyle(container.querySelector(`[data-role="${role}"]`)).color;

  expect(colourOf('verb')).toBe('rgb(25, 118, 210)');
  expect(colourOf('broken')).toBe('rgb(211, 47, 47)');
  expect(colourOf('ghost')).not.toBe(colourOf('text'));
});

// The words are drawn under the input's own (transparent) text, so a role that changes a word's width moves every word
// after it away from the caret. Colour only.
test("a word's role leaves its width alone", () => {
  const { container } = render(
    <IntentionPaletteFrame height="50vh">
      {['verb', 'text', 'hint', 'param', 'value', 'unread', 'broken', 'ghost'].map((role) => (
        <span data-role={role} key={role}>
          word
        </span>
      ))}
    </IntentionPaletteFrame>
  );
  const widthStyles = [...container.querySelectorAll('[data-role]')].map((node) => {
    const { fontWeight, fontSize, fontFamily, letterSpacing, fontStyle } =
      window.getComputedStyle(node);
    return { role: node.dataset.role, fontWeight, fontSize, fontFamily, letterSpacing, fontStyle };
  });
  const [first] = widthStyles;

  widthStyles.forEach(({ role, ...styles }) =>
    expect({ role, ...styles }).toEqual({ ...first, role })
  );
});
