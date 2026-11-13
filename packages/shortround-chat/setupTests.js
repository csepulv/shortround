import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library unmounts after each test only when vitest's globals are on; this package doesn't turn them on.
afterEach(cleanup);

if (typeof window !== 'undefined') {
  Element.prototype.scrollIntoView ??= () => {};
}
