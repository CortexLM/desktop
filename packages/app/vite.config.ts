import { defineConfig, loadEnv, type Plugin } from 'vite';
import solid from 'vite-plugin-solid';

// Not under a directory named `build`: `.gitignore` has a bare `build/`, which matches
// at any depth, so a module there is silently never committed and only CI notices.
import { withConnectSrc } from './src/security/connect-src.ts';

/**
 * Rewrites the page's `connect-src` for the origin this build targets.
 *
 * The literal in `index.html` allowed `https://api.cortex.foundation` only, which
 * blocked the realtime WebSocket (`wss:` is a separate CSP source) and made
 * `VITE_CORTEX_API_BASE_URL` inert in a built bundle.
 */
function cspPlugin(apiBaseUrl?: string): Plugin {
  return {
    name: 'cortex-connect-src',
    transformIndexHtml: (html) => withConnectSrc(html, apiBaseUrl),
  };
}

/**
 * The API origin for this build.
 *
 * Read through `loadEnv` rather than `process.env` so a `.env` file works the same
 * way it does for the `import.meta.env` the renderer reads — otherwise the policy
 * and the client could disagree about where the API is.
 */
function loadApiBase(mode: string): string | undefined {
  return loadEnv(mode, process.cwd(), 'VITE_').VITE_CORTEX_API_BASE_URL;
}

export default defineConfig(({ mode }) => ({
  plugins: [solid(), cspPlugin(loadApiBase(mode))],
  // Relative so the built bundle loads from Electron's file:// origin, where an absolute
  // /assets path resolves to the filesystem root.
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
}));
