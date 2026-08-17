/**
 * File and directory helpers for tests
 */

import { mkdtemp, rm, writeFile, mkdir, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Create a temporary directory for tests
 */
export async function createTempDir(prefix = 'cortex-test-'): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

/**
 * Create a temporary file with content
 */
export async function createTempFile(
  content: string,
  options: { dir?: string; name?: string; extension?: string } = {}
): Promise<string> {
  const { dir, name = 'test-file', extension = 'txt' } = options;
  const tempDir = dir || await createTempDir();
  const filePath = join(tempDir, `${name}.${extension}`);
  
  await writeFile(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Create a test project structure
 */
export async function createTestProject(
  structure: Record<string, string | Record<string, string>>,
  baseDir?: string
): Promise<string> {
  const projectDir = baseDir || await createTempDir();

  async function createStructure(dir: string, struct: Record<string, any>): Promise<void> {
    for (const [name, content] of Object.entries(struct)) {
      const path = join(dir, name);
      
      if (typeof content === 'string') {
        // Create file
        await mkdir(join(path, '..'), { recursive: true });
        await writeFile(path, content, 'utf-8');
      } else {
        // Create directory and recurse
        await mkdir(path, { recursive: true });
        await createStructure(path, content);
      }
    }
  }

  await createStructure(projectDir, structure);
  return projectDir;
}

/**
 * Clean up temporary directory
 */
export async function cleanupTempDir(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true });
  } catch (error) {
    // Ignore errors
  }
}

/**
 * Read file content
 */
export async function readTestFile(path: string): Promise<string> {
  return readFile(path, 'utf-8');
}

/**
 * Create a test workspace with common files
 */
export async function createTestWorkspace(name = 'test-workspace'): Promise<{
  root: string;
  cleanup: () => Promise<void>;
}> {
  const root = await createTestProject({
    'package.json': JSON.stringify({
      name,
      version: '1.0.0',
      private: true
    }, null, 2),
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true
      }
    }, null, 2),
    'src': {
      'index.ts': 'export {}',
      'utils.ts': 'export const add = (a: number, b: number) => a + b;'
    },
    'tests': {
      'index.test.ts': ''
    },
    '.gitignore': 'node_modules\n.DS_Store\ndist'
  });

  return {
    root,
    cleanup: () => cleanupTempDir(root)
  };
}
