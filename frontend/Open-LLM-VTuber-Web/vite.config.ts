import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: 'public',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@/components': resolve(__dirname, 'src/components'),
      '@context': resolve(__dirname, 'src/context'),
      '@/context': resolve(__dirname, 'src/context'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@/hooks': resolve(__dirname, 'src/hooks'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@/utils': resolve(__dirname, 'src/utils'),
      '@services': resolve(__dirname, 'src/services'),
      '@/services': resolve(__dirname, 'src/services'),
      '@assets': resolve(__dirname, 'src/assets'),
      '@/assets': resolve(__dirname, 'src/assets')
    }
  },
  server: {
    port: 3000
  }
});
