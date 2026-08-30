import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  root: 'src/ui',
  base: '/ui/',
  server: { cors: true },
  build: {
    outDir: '../../dist/ui',
    emptyOutDir: true,
  },
});
