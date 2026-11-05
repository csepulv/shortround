import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, transformWithEsbuild } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shortround/core': path.resolve(
        __dirname,
        '../../packages/shortround-core/src/index.dev.js'
      ),
      '@shortround/react': path.resolve(
        __dirname,
        '../../packages/shortround-react/src/index.dev.js'
      ),
      '@shortround/mui': path.resolve(__dirname, '../../packages/shortround-mui/src/index.js')
    },
    conditions: ['development', 'import', 'module', 'browser', 'default']
  },
  plugins: [
    {
      name: 'load+transform-js-files-as-jsx',
      async transform(code, id) {
        if (!id.match(/src\/.*\.js$/)) {
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
  optimizeDeps: {
    force: true,
    exclude: ['@shortround/core', '@shortround/react', '@shortround/mui'],
    esbuildOptions: {
      loader: {
        '.js': 'jsx'
      }
    }
  }
});
