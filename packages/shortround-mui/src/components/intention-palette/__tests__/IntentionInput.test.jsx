import { render, screen } from '@testing-library/react';
import { Command } from 'cmdk';

import { IntentionInput } from '../IntentionInput.jsx';

test('shows the validation message text', () => {
  render(
    <Command>
      <IntentionInput
        inputValue="!"
        inputMessage={{ type: 'error', text: 'Name is invalid' }}
        onInputChange={vi.fn()}
      />
    </Command>
  );

  expect(screen.getByText('Name is invalid')).toBeInTheDocument();
});
