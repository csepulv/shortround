import { resolve } from 'path';
import { defineConfig } from 'vite';

// Core is plain JavaScript with no UI: no React plugin, no JSX.
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      fileName: (format) => `core.${format}.js`,
      formats: ['es']
    },
    rollupOptions: {
      external: [
        'chrono-node',
        'damerau-levenshtein',
        'fuzzysort',
        'jsep',
        'tiny-invariant',
        'yaml',
        'zod',
        'zustand',
        'zustand/vanilla'
      ]
    }
  }
});
