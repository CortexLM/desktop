/**
 * Mock factory for file system operations
 */

import { vi } from 'vitest';

// `mock(fn)` was Bun's spy factory; `vi.fn(fn)` is the Vitest equivalent.
// Typed explicitly: an inferred type resolves into vitest's hoisted
// `@vitest/spy` path, which `tsc` rejects as non-portable (TS2742).
const mock: typeof vi.fn = vi.fn;

export interface MockFileSystem {
  files: Map<string, string>;
  directories: Set<string>;
}

/**
 * Create a mock file system
 */
export function createMockFS(): MockFileSystem & {
  readFile: ReturnType<typeof mock>;
  writeFile: ReturnType<typeof mock>;
  mkdir: ReturnType<typeof mock>;
  readdir: ReturnType<typeof mock>;
  stat: ReturnType<typeof mock>;
  exists: ReturnType<typeof mock>;
  reset: () => void;
} {
  const files = new Map<string, string>();
  const directories = new Set<string>(['/']);

  const readFile = mock(async (path: string) => {
    if (!files.has(path)) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return files.get(path);
  });

  const writeFile = mock(async (path: string, content: string) => {
    files.set(path, content);
  });

  const mkdir = mock(async (path: string) => {
    directories.add(path);
  });

  const readdir = mock(async (path: string) => {
    if (!directories.has(path)) {
      throw new Error(`ENOENT: no such file or directory, scandir '${path}'`);
    }
    const items: string[] = [];
    for (const filePath of files.keys()) {
      if (filePath.startsWith(path + '/')) {
        const relativePath = filePath.substring(path.length + 1);
        const firstSegment = relativePath.split('/')[0];
        if (!items.includes(firstSegment)) {
          items.push(firstSegment);
        }
      }
    }
    return items;
  });

  const stat = mock(async (path: string) => {
    const isFile = files.has(path);
    const isDirectory = directories.has(path);
    
    if (!isFile && !isDirectory) {
      throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
    }

    return {
      isFile: () => isFile,
      isDirectory: () => isDirectory,
      size: isFile ? files.get(path)!.length : 0,
      mtime: new Date()
    };
  });

  const exists = mock(async (path: string) => {
    return files.has(path) || directories.has(path);
  });

  const reset = () => {
    files.clear();
    directories.clear();
    directories.add('/');
    readFile.mockClear();
    writeFile.mockClear();
    mkdir.mockClear();
    readdir.mockClear();
    stat.mockClear();
    exists.mockClear();
  };

  return {
    files,
    directories,
    readFile,
    writeFile,
    mkdir,
    readdir,
    stat,
    exists,
    reset
  };
}
