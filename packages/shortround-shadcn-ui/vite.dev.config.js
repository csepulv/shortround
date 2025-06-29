import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: []
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
}); 