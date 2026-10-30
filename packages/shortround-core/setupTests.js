import '@testing-library/jest-dom';

import * as matchers from 'jest-extended';
import { vi } from 'vitest';
import { expect } from 'vitest';

expect.extend(matchers);

window.vi = vi;

// jsdom lacks these browser APIs; cmdk uses them for list sizing and keeping the selected item visible.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};
