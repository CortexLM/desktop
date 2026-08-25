import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'cortex-api',
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],
    passWithNoTests: false,
  },
});
