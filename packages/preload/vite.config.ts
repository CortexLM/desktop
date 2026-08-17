import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => ({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['cjs'],
      fileName: 'index'
    },
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: ['electron']
    },
    // Source maps in dev only; not shipped to users.
    sourcemap: mode !== 'production',
    minify: false,
    target: 'chrome120'
  }
}));
