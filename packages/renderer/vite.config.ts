import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// `mode` is 'production' for `vite build` and 'development' for `vite`/`vite dev`.
// We key off it instead of process.env.NODE_ENV, which is not set by the
// `bun run build` scripts and therefore made the old check unreliable.
export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      // Fast Refresh optimizations
      fastRefresh: true
    })
  ],
  root: resolve(__dirname, 'src'),
  base: './',
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/index.html'),
      output: {
        // Code splitting optimizations
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['lucide-react', 'class-variance-authority', 'clsx', 'tailwind-merge']
        },
        // Optimize chunk names
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Minification optimizations
    minify: 'esbuild',
    // Chunk size warnings
    chunkSizeWarningLimit: 1000,
    // Source maps: full maps in dev for debugging, none shipped in production.
    // Production maps cost ~4MB on disk and are not needed by end users.
    sourcemap: mode !== 'production',
    // CSS code splitting
    cssCodeSplit: true,
    // Optimize deps
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    },
    // Target modern browsers
    target: 'esnext',
    // Report compressed size
    reportCompressedSize: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 5173,
    strictPort: true
  },
  // Optimize deps
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'lucide-react',
      'clsx',
      'tailwind-merge'
    ],
    exclude: [
      // Exclude heavy modules that should be lazy loaded
      'monaco-editor',
      'xterm'
    ]
  },
  // Enable esbuild optimizations
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
    legalComments: 'none',
    treeShaking: true
  }
}));
