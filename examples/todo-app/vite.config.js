import { defineConfig, transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shortround/core': path.resolve(
        __dirname,
        '../../packages/shortround-core/src/index.dev.js'
      ),
      '@shortround/mui': path.resolve(
        __dirname,
        '../../packages/shortround-mui/src/index.js'
      ),
      '@shortround/shadcn-ui': path.resolve(
        __dirname,
        '../../packages/shortround-shadcn-ui/src/index.js'
      )
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
    exclude: ['@shortround/core', '@shortround/mui', '@shortround/shadcn-ui'],
    esbuildOptions: {
      loader: {
        '.js': 'jsx'
      }
    }
  }
});
