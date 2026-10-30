import { render, screen } from '@testing-library/react';

import { IntentionInput } from '../IntentionInput.jsx';

// Core renders the input element (theme-provider M3); the theme places it and shows the message.
test("places core's input and shows the validation message text", () => {
  render(
    <IntentionInput
      input={<input data-testid="core-input" />}
      inputMessage={{ type: 'error', text: 'Name is invalid' }}
    />
  );

  expect(screen.getByTestId('core-input')).toBeInTheDocument();
  expect(screen.getByText('Name is invalid')).toBeInTheDocument();
});
