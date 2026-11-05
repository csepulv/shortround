import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';
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
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      fileName: (format) => `react.${format}.js`,
      formats: ['es']
    },
    rollupOptions: {
      external: [
        '@shortround/core',
        'react',
        'react/jsx-runtime',
        'react-dom',
        'tiny-invariant',
        'cmdk',
        'framer-motion'
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        }
      }
    }
  }
});
