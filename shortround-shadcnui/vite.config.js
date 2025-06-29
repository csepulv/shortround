import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: []
  },
  css: {
    postcss: './postcss.config.js'
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'ShortroundShadcnui',
      fileName: 'shadcnui',
      formats: ['es']
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        '@shortround/core',
        'framer-motion',
        '@emotion/is-prop-valid',
        '@emotion/styled',
        '@radix-ui/react-dialog',
        '@radix-ui/react-popover',
        '@radix-ui/react-slot',
        '@radix-ui/react-toggle',
        '@radix-ui/react-toggle-group',
        'lucide-react',
        'cmdk',
        'clsx',
        'tailwind-merge',
        'class-variance-authority'
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        },
        assetFileNames: 'styles.[ext]'
      }
    },
    cssCodeSplit: false
  }
});
