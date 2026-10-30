import { defineConfig } from 'vitest/config';

// The release tools' own tests, apart from the packages' tests. This folder ships to the public mirror.
export default defineConfig({
  test: {
    include: ['release-tools/**/__tests__/**/*.test.js']
  }
});
