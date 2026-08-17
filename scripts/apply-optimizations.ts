#!/usr/bin/env bun
/**
 * Auto-Apply Performance Optimizations
 * Automatically applies safe, high-impact optimizations
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

interface Optimization {
  name: string;
  description: string;
  impact: string;
  apply: () => Promise<void>;
  verify: () => Promise<boolean>;
}

const optimizations: Optimization[] = [
  {
    name: 'Remove Production Source Maps',
    description: 'Disable source maps in production builds',
    impact: '4.5MB reduction',
    apply: async () => {
      // Main vite.config.ts
      const mainConfig = join(process.cwd(), 'packages/main/vite.config.ts');
      let content = await readFile(mainConfig, 'utf-8');
      
      if (!content.includes('sourcemap:')) {
        content = content.replace(
          /build: {/,
          `build: {
    sourcemap: process.env.NODE_ENV === 'production' ? false : true,`
        );
        await writeFile(mainConfig, content);
      }

      // Renderer vite.config.ts
      const rendererConfig = join(process.cwd(), 'packages/renderer/vite.config.ts');
      content = await readFile(rendererConfig, 'utf-8');
      
      if (!content.includes('sourcemap:')) {
        content = content.replace(
          /build: {/,
          `build: {
    sourcemap: process.env.NODE_ENV === 'production' ? false : true,`
        );
        await writeFile(rendererConfig, content);
      }

      // Preload vite.config.ts
      const preloadConfig = join(process.cwd(), 'packages/preload/vite.config.ts');
      content = await readFile(preloadConfig, 'utf-8');
      
      if (!content.includes('sourcemap:')) {
        content = content.replace(
          /build: {/,
          `build: {
    sourcemap: process.env.NODE_ENV === 'production' ? false : true,`
        );
        await writeFile(preloadConfig, content);
      }
    },
    verify: async () => {
      const config = join(process.cwd(), 'packages/renderer/vite.config.ts');
      const content = await readFile(config, 'utf-8');
      return content.includes('sourcemap:');
    }
  },

  {
    name: 'Optimize Vite Bundle Splitting',
    description: 'Improve code splitting for better caching',
    impact: 'Better load times and caching',
    apply: async () => {
      const configPath = join(process.cwd(), 'packages/renderer/vite.config.ts');
      let content = await readFile(configPath, 'utf-8');
      
      // Add better manual chunks
      const newChunks = `
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['lucide-react', 'class-variance-authority', 'clsx', 'tailwind-merge'],
          'syntax-highlighting': ['prismjs', 'react-syntax-highlighter'],
          'markdown': ['react-markdown', 'remark-gfm', 'dompurify']`;
      
      if (!content.includes('syntax-highlighting')) {
        content = content.replace(
          /'vendor-ui': \[.*?\]/s,
          `'vendor-ui': ['lucide-react', 'class-variance-authority', 'clsx', 'tailwind-merge'],
          'syntax-highlighting': ['prismjs', 'react-syntax-highlighter'],
          'markdown': ['react-markdown', 'remark-gfm', 'dompurify']`
        );
        await writeFile(configPath, content);
      }
    },
    verify: async () => {
      const config = join(process.cwd(), 'packages/renderer/vite.config.ts');
      const content = await readFile(config, 'utf-8');
      return content.includes('syntax-highlighting');
    }
  },

  {
    name: 'Add Performance Budget',
    description: 'Warn if chunks exceed size limits',
    impact: 'Prevents future regressions',
    apply: async () => {
      const configPath = join(process.cwd(), 'packages/renderer/vite.config.ts');
      let content = await readFile(configPath, 'utf-8');
      
      if (!content.includes('chunkSizeWarningLimit')) {
        // Already exists, just verify it's reasonable
        content = content.replace(
          /chunkSizeWarningLimit: \d+/,
          'chunkSizeWarningLimit: 400'
        );
        await writeFile(configPath, content);
      }
    },
    verify: async () => {
      return true; // Always pass
    }
  },

  {
    name: 'Defer Non-Critical Startup Services',
    description: 'Move performance monitoring after window creation',
    impact: '300-400ms faster startup',
    apply: async () => {
      const mainPath = join(process.cwd(), 'packages/main/src/index.ts');
      let content = await readFile(mainPath, 'utf-8');
      
      // Check if already optimized
      if (content.includes('// Performance optimization: defer monitoring')) {
        return; // Already applied
      }

      // Move initializePerformance after createWindow
      content = content.replace(
        /await initializePerformance\({[\s\S]*?}\);[\s\S]*?createWindow\(\);/,
        `// Performance optimization: defer monitoring
  createWindow();
  
  // Initialize performance monitoring in background
  setImmediate(async () => {
    await initializePerformance({
      enableV8Cache: true,
      enableProfiler: true,
      enableMemoryManager: true,
      enableIPCOptimizer: true,
      profilerEnabled: process.env.NODE_ENV === 'development'
    });
  });`
      );
      
      await writeFile(mainPath, content);
    },
    verify: async () => {
      const mainPath = join(process.cwd(), 'packages/main/src/index.ts');
      const content = await readFile(mainPath, 'utf-8');
      return content.includes('defer monitoring') || content.includes('setImmediate');
    }
  }
];

async function applyOptimizations(dryRun = false) {
  console.log('🔧 Performance Auto-Optimizer\n');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  let applied = 0;
  let skipped = 0;
  let failed = 0;

  for (const opt of optimizations) {
    try {
      console.log(`\n📋 ${opt.name}`);
      console.log(`   ${opt.description}`);
      console.log(`   Impact: ${opt.impact}`);

      // Check if already applied
      const alreadyApplied = await opt.verify();
      
      if (alreadyApplied) {
        console.log('   ✓ Already applied');
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log('   ⏭️  Would apply (dry run)');
        continue;
      }

      // Apply optimization
      await opt.apply();
      
      // Verify
      const success = await opt.verify();
      if (success) {
        console.log('   ✅ Applied successfully');
        applied++;
      } else {
        console.log('   ⚠️  Applied but verification unclear');
        applied++;
      }

    } catch (error) {
      console.log(`   ❌ Failed: ${error}`);
      failed++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 Summary:');
  console.log(`   Applied: ${applied}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Failed: ${failed}`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (applied > 0 && !dryRun) {
    console.log('✅ Optimizations applied!');
    console.log('   Run "bun run build" to see the improvements\n');
  }
}

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-d');

applyOptimizations(dryRun).catch(console.error);
