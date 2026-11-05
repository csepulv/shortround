import { defineConfig } from 'vitest/config';

// Core's tests run in Node, with no DOM: core is headless.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.js'],
    exclude: ['**/node_modules/**', '**/dist/**']
  }
});
