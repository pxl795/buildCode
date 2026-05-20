import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5178,
    strictPort: true,
    host: true
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
} as any);
