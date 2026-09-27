import { render, screen } from '@testing-library/react';

import { NoMatches } from '../NoMatches.jsx';

test('shows the unmatched input', () => {
  render(<NoMatches inputValue="zzz" />);

  expect(screen.getByText('No results found for "zzz"')).toBeInTheDocument();
});
