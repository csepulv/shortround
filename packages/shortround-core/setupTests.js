import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { expect } from 'vitest';
import * as matchers from 'jest-extended';

expect.extend(matchers);

window.vi = vi;
