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
