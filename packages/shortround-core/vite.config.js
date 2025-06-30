import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import { transformWithEsbuild } from 'vite';

export default defineConfig({
  plugins: [
    {
      name: 'load+transform-js-files-as-jsx',
      async transform(code, id) {
        if (!id.match(/src\/.*\.js$/) && !id.match(/src\/.*\.jsx$/)) {
          return null;
        }

        return transformWithEsbuild(code, id, {
          loader: 'jsx',
          jsx: 'automatic'
        });
      }
    },
    react()
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'ShortRoundCore',
      fileName: 'core',
      formats: ['es']
    },
    rollupOptions: {
      external: ['react', 'fuzzysort', 'tiny-invariant'],
      output: {
        globals: {
          react: 'React'
        }
      }
    }
  }
});
