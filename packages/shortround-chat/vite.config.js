import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';

const EXTERNAL = [
  '@ai-sdk/react',
  '@shortround/core',
  '@shortround/react',
  'ai',
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-markdown',
  'remark-gfm',
  'zod'
];

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.js'),
        server: resolve(__dirname, 'src/server.js')
      },
      formats: ['es'],
      fileName: (format, name) => `${name}.js`
    },
    rollupOptions: { external: EXTERNAL }
  }
});
