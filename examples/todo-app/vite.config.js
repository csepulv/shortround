import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv, transformWithEsbuild } from 'vite';

import { chatPlugin } from './server/chat-plugin.js';

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shortround/core': path.resolve(__dirname, '../../packages/shortround-core/src/index.js'),
      '@shortround/react': path.resolve(__dirname, '../../packages/shortround-react/src/index.js'),
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
    react(),
    chatPlugin({ apiKey: loadEnv(mode, __dirname, '').ANTHROPIC_API_KEY })
  ],
  optimizeDeps: {
    force: true,
    exclude: ['@shortround/core', '@shortround/react', '@shortround/mui', '@shortround/chat'],
    esbuildOptions: {
      loader: {
        '.js': 'jsx'
      }
    }
  }
}));
