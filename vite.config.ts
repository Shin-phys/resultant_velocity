import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`        … GitHub Pages 用（dist/、複数ファイル）
// `npm run build:single` … 1ファイルの試用版（dist-single/index.html）
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
}));
