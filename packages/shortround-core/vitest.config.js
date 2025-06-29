import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { transformWithEsbuild } from 'vite';
import path from 'path';

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
      '@': path.resolve(__dirname, 'src')
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './setupTests.js',
    include: ['**/*.test.{js,jsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    transformMode: {
      web: [/\.[jt]sx$/]
    }
  }
});
