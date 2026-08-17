/**
 * Performance benchmarks for file operations
 */

import { describe, beforeEach } from 'vitest';
import { bench } from './bench-harness';
import { createMockFS, createTestWorkspace } from '@cortex-ide/test-utils';

describe('File Operations Performance', () => {
  let fs: ReturnType<typeof createMockFS>;

  beforeEach(async () => {
    fs = createMockFS();

    // readdir only lists registered directories, so create it before seeding.
    await fs.mkdir('/workspace');

    // Seed with test files
    for (let i = 0; i < 100; i++) {
      fs.files.set(`/workspace/file-${i}.ts`, `export const value${i} = ${i};`);
    }
  });

  bench('read single file', async () => {
    await fs.readFile('/workspace/file-0.ts');
  }, { metric: 'file_read_single' });

  bench('read multiple files sequentially', async () => {
    for (let i = 0; i < 10; i++) {
      await fs.readFile(`/workspace/file-${i}.ts`);
    }
  }, { metric: 'file_read_sequential_10' });

  bench('read multiple files in parallel', async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      fs.readFile(`/workspace/file-${i}.ts`)
    );
    await Promise.all(promises);
  }, { metric: 'file_read_parallel_10' });

  bench('write single file', async () => {
    await fs.writeFile('/workspace/new-file.ts', 'export const test = true;');
  }, { metric: 'file_write_single' });

  bench('write multiple files', async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      fs.writeFile(`/workspace/new-${i}.ts`, `export const value = ${i};`)
    );
    await Promise.all(promises);
  }, { metric: 'file_write_parallel_10' });

  bench('directory listing', async () => {
    await fs.readdir('/workspace');
  }, { metric: 'dir_listing' });

  bench('stat operations', async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      fs.stat(`/workspace/file-${i}.ts`)
    );
    await Promise.all(promises);
  }, { metric: 'file_stat_10' });
});

describe('Large File Operations Performance', () => {
  let fs: ReturnType<typeof createMockFS>;

  beforeEach(() => {
    fs = createMockFS();
  });

  bench('read 1MB file', async () => {
    const content = 'x'.repeat(1024 * 1024); // 1MB
    await fs.writeFile('/large.txt', content);
    await fs.readFile('/large.txt');
  }, { metric: 'file_read_1mb' });

  bench('write 1MB file', async () => {
    const content = 'x'.repeat(1024 * 1024); // 1MB
    await fs.writeFile('/large.txt', content);
  }, { metric: 'file_write_1mb' });

  bench('process 100 small files', async () => {
    const operations = Array.from({ length: 100 }, (_, i) => 
      fs.writeFile(`/file-${i}.ts`, `export const v = ${i};`)
    );
    await Promise.all(operations);
  }, { metric: 'file_write_100' });
});
