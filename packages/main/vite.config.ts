import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => ({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index'
    },
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: [
        // Externalize every Node builtin, both bare ('fs') and prefixed ('node:fs').
        // The main process runs in Node, so these must never be bundled or
        // shimmed with Vite's browser-compat stubs.
        /^node:/,
        // Bun-native modules (e.g. bun:sqlite) are runtime-provided, never bundled.
        /^bun:/,
        'electron',
        'path',
        'fs',
        'url',
        'crypto',
        'os',
        'events',
        'fs/promises',
        'child_process',
        'tty',
        'net',
        'worker_threads',
        'simple-git',
        'node-pty',
        // Native module: loads its .node binding through the CommonJS `bindings`
        // package, which relies on `__filename`. Bundling it into the ESM output
        // makes `__filename is not defined` throw at DB init time.
        'better-sqlite3',
        'chokidar',
        'node-cron',
        'monaco-editor',
        'xterm',
        'util',
        'zlib',
        'http',
        'https',
        'stream',
        'electron-log',
        'electron-updater'
      ]
    },
    // Source maps in dev only; not shipped to users.
    sourcemap: mode !== 'production',
    minify: false,
    target: 'node20'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
}));
