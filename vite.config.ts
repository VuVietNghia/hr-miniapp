import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  envDir: '../..', // Nạp .env từ thư mục gốc dự án (relative so với src/ui)
  plugins: [react(), viteSingleFile()],
  root: 'src/ui',
  base: './', // Use relative path to avoid path resolution errors in embedded environments
  server: {
    cors: true,
  },
  build: {
    outDir: '../../dist/ui',
    emptyOutDir: true,
  },
});
