/**
 * IPC handler domain tests — filesystem, editor, git and database channels.
 *
 * Handlers are exported individually, so each is invoked directly. `electron` is
 * stubbed by the global preload (test/electron-mock.ts, wired through `preload`
 * in bunfig.toml); the filesystem handlers run against a real temp directory,
 * service layers are mocked.
 *
 * The handlers under test are pulled in with a top-level `await import()` below,
 * *after* the mocks are registered, so they link against the mocked modules.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fsSync from 'fs';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import {
  ipcMainMock,
  registeredHandlers,
  resetElectronMock,
} from '../../../../../../test/electron-mock';

// ---------------------------------------------------------------------------
// Service mocks
// ---------------------------------------------------------------------------

const gitServiceMock = {
  status: vi.fn(async () => ({
    branch: 'main',
    ahead: 0,
    behind: 0,
    files: [],
    isClean: true,
  })),
  commit: vi.fn(async () => ({ hash: 'deadbeefcafe', message: 'msg' })),
  push: vi.fn(async () => ({ pushed: 1 })),
  pull: vi.fn(async () => undefined),
  diff: vi.fn(async () => ({ diff: 'diff --git a b', hunks: [] })),
};

const formatDocumentMock = vi.fn(async (req: { content: string }) => ({
  formatted: req.content.trim(),
  changes: [],
}));

const databaseServiceMock = {
  query: vi.fn(async () => ({ rows: [{ id: 1 }], rowCount: 1 })),
  execute: vi.fn(async () => ({ changes: 1, lastInsertRowid: 5 })),
};

// Spreading `importOriginal()` keeps every export the tests don't override; a
// factory returning only the overrides would drop the rest (e.g. the
// `GitService` class and `FormatError`) and break link-time imports.
//
// Getters and arrows defer the mock lookups: `vi.mock` is hoisted above these
// declarations, so an eager read would hit the temporal dead zone.
vi.mock('../../../services/git-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/git-service')>()),
  get gitService() {
    return gitServiceMock;
  },
}));
vi.mock('../../../services/format-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/format-service')>()),
  formatDocument: (...args: Parameters<typeof formatDocumentMock>) =>
    formatDocumentMock(...args),
}));
vi.mock('../../../services/database-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/database-service')>()),
  getDatabaseService: () => databaseServiceMock,
}));

// Imported dynamically so the mock factories above resolve against the
// already-initialised consts in this file (see file header).
const {
  FILESYSTEM_CHANNELS,
  handleReadDir,
  handleReadFile,
  handleWriteFile,
  registerFilesystemHandlers,
  unregisterFilesystemHandlers,
} = await import('../filesystem-handlers');
const {
  EDITOR_CHANNELS,
  handleFormatDocument,
  handleOpenFile,
  handleSaveFile,
  registerEditorHandlers,
  unregisterEditorHandlers,
} = await import('../editor-handlers');
const {
  GIT_CHANNELS,
  handleGitCommit,
  handleGitDiff,
  handleGitPull,
  handleGitPush,
  handleGitStatus,
  registerGitHandlers,
  unregisterGitHandlers,
} = await import('../git-handlers');
const {
  DATABASE_CHANNELS,
  handleDBExecute,
  handleDBQuery,
  registerDatabaseHandlers,
  unregisterDatabaseHandlers,
} = await import('../database-handlers');
const { ErrorCode } = await import('../shared/error-codes');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Handler = (event: unknown, request: unknown) => Promise<{
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string; details?: unknown };
}>;

const event = { sender: { send: vi.fn() } } as unknown as Parameters<Handler>[0];

async function ok<T>(handler: Handler, request: unknown): Promise<T> {
  const response = await handler(event, request);
  if (!response.success) {
    throw new Error(`Expected success, got ${JSON.stringify(response.error)}`);
  }
  return response.data as T;
}

async function fail(
  handler: Handler,
  request: unknown
): Promise<{ code: string; message: string; details?: unknown }> {
  const response = await handler(event, request);
  if (response.success) {
    throw new Error(`Expected failure, got ${JSON.stringify(response.data)}`);
  }
  return response.error!;
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'cortex-ipc-'));
  resetElectronMock();
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ===========================================================================
// Filesystem
// ===========================================================================

describe('filesystem handlers', () => {
  describe('handleReadFile', () => {
    it('returns the content and stats', async () => {
      const file = path.join(tmpDir, 'a.txt');
      await fs.writeFile(file, 'hello world');

      const data = await ok<{ content: string; stats: { size: number; mtime: number } }>(
        handleReadFile as Handler,
        { path: file }
      );

      expect(data.content).toBe('hello world');
      expect(data.stats.size).toBe(11);
      expect(data.stats.mtime).toBeGreaterThan(0);
    });

    it('honours an explicit encoding', async () => {
      const file = path.join(tmpDir, 'b.txt');
      await fs.writeFile(file, 'hi');

      const data = await ok<{ content: string }>(handleReadFile as Handler, {
        path: file,
        encoding: 'base64',
      });

      expect(data.content).toBe(Buffer.from('hi').toString('base64'));
    });

    it('reads an empty file', async () => {
      const file = path.join(tmpDir, 'empty.txt');
      await fs.writeFile(file, '');

      const data = await ok<{ content: string; stats: { size: number } }>(
        handleReadFile as Handler,
        { path: file }
      );

      expect(data.content).toBe('');
      expect(data.stats.size).toBe(0);
    });

    it('maps a missing file to FILE_NOT_FOUND', async () => {
      const error = await fail(handleReadFile as Handler, {
        path: path.join(tmpDir, 'missing.txt'),
      });

      expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
    });

    it('rejects an empty path', async () => {
      const error = await fail(handleReadFile as Handler, { path: '' });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.message).toBe('Validation failed');
    });

    it('rejects a missing path field and reports the issues', async () => {
      const error = await fail(handleReadFile as Handler, {});

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(Array.isArray(error.details)).toBe(true);
    });

    it('rejects an unsupported encoding', async () => {
      const error = await fail(handleReadFile as Handler, { path: '/tmp/x', encoding: 'utf-32' });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects a non-object payload', async () => {
      const error = await fail(handleReadFile as Handler, 'not-an-object');

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('handleWriteFile', () => {
    it('writes and reports the byte count', async () => {
      const file = path.join(tmpDir, 'out.txt');

      const data = await ok<{ success: boolean; bytesWritten: number }>(
        handleWriteFile as Handler,
        { path: file, content: 'abcde' }
      );

      expect(data.success).toBe(true);
      expect(data.bytesWritten).toBe(5);
      expect(await fs.readFile(file, 'utf-8')).toBe('abcde');
    });

    it('accepts empty content', async () => {
      const data = await ok<{ bytesWritten: number }>(handleWriteFile as Handler, {
        path: path.join(tmpDir, 'empty.txt'),
        content: '',
      });

      expect(data.bytesWritten).toBe(0);
    });

    it('counts multi-byte characters by byte length', async () => {
      const data = await ok<{ bytesWritten: number }>(handleWriteFile as Handler, {
        path: path.join(tmpDir, 'uni.txt'),
        content: '→',
      });

      expect(data.bytesWritten).toBe(3);
    });

    it('overwrites an existing file', async () => {
      const file = path.join(tmpDir, 'over.txt');
      await fs.writeFile(file, 'a much longer old content');

      await ok(handleWriteFile as Handler, { path: file, content: 'new' });

      expect(await fs.readFile(file, 'utf-8')).toBe('new');
    });

    it('fails when the parent directory is missing', async () => {
      const error = await fail(handleWriteFile as Handler, {
        path: path.join(tmpDir, 'nope', 'deep.txt'),
        content: 'x',
      });

      expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
    });

    it('rejects non-string content', async () => {
      const error = await fail(handleWriteFile as Handler, { path: '/tmp/x', content: 123 });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('handleReadDir', () => {
    beforeEach(async () => {
      await fs.writeFile(path.join(tmpDir, 'root.txt'), 'r');
      await fs.mkdir(path.join(tmpDir, 'sub'));
      await fs.writeFile(path.join(tmpDir, 'sub', 'nested.txt'), 'nn');
    });

    it('lists immediate children with their type', async () => {
      const data = await ok<{ entries: Array<{ name: string; type: string }> }>(
        handleReadDir as Handler,
        { path: tmpDir }
      );

      expect(data.entries.map((e) => e.name).sort()).toEqual(['root.txt', 'sub']);
      expect(data.entries.find((e) => e.name === 'sub')?.type).toBe('directory');
      expect(data.entries.find((e) => e.name === 'root.txt')?.type).toBe('file');
    });

    it('recurses when asked', async () => {
      const data = await ok<{ entries: Array<{ name: string }> }>(handleReadDir as Handler, {
        path: tmpDir,
        recursive: true,
      });

      expect(data.entries.map((e) => e.name).sort()).toEqual(['nested.txt', 'root.txt', 'sub']);
    });

    it('reports size and mtime', async () => {
      const data = await ok<{ entries: Array<{ name: string; size: number; mtime: number }> }>(
        handleReadDir as Handler,
        { path: tmpDir }
      );

      const file = data.entries.find((e) => e.name === 'root.txt')!;
      expect(file.size).toBe(1);
      expect(file.mtime).toBeGreaterThan(0);
    });

    it('returns absolute paths', async () => {
      const data = await ok<{ entries: Array<{ path: string }> }>(handleReadDir as Handler, {
        path: tmpDir,
      });

      for (const entry of data.entries) {
        expect(path.isAbsolute(entry.path)).toBe(true);
      }
    });

    it('classifies a symlink as symlink', async () => {
      await fs.symlink(path.join(tmpDir, 'root.txt'), path.join(tmpDir, 'link.txt'));

      const data = await ok<{ entries: Array<{ name: string; type: string }> }>(
        handleReadDir as Handler,
        { path: tmpDir }
      );

      // readdir's Dirent reports the link itself, so type is derived from
      // `isSymbolicLink()` even though `fs.stat` follows it for size/mtime.
      expect(data.entries.find((e) => e.name === 'link.txt')?.type).toBe('symlink');
    });

    it('returns an empty list for an empty directory', async () => {
      const empty = path.join(tmpDir, 'empty-dir');
      await fs.mkdir(empty);

      const data = await ok<{ entries: unknown[] }>(handleReadDir as Handler, { path: empty });

      expect(data.entries).toEqual([]);
    });

    it('fails for a missing directory', async () => {
      const error = await fail(handleReadDir as Handler, { path: path.join(tmpDir, 'ghost') });

      expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
    });

    it('handles a deeply nested tree', async () => {
      let deep = tmpDir;
      for (const segment of ['l1', 'l2', 'l3']) {
        deep = path.join(deep, segment);
        await fs.mkdir(deep);
      }
      await fs.writeFile(path.join(deep, 'deep.txt'), 'x');

      const data = await ok<{ entries: Array<{ name: string }> }>(handleReadDir as Handler, {
        path: tmpDir,
        recursive: true,
      });

      expect(data.entries.map((e) => e.name)).toContain('deep.txt');
    });
  });

  describe('registration', () => {
    it('registers all three channels', () => {
      registerFilesystemHandlers();

      for (const channel of FILESYSTEM_CHANNELS) {
        expect(registeredHandlers.has(channel)).toBe(true);
      }
    });

    it('removes all three channels', () => {
      registerFilesystemHandlers();

      unregisterFilesystemHandlers();

      for (const channel of FILESYSTEM_CHANNELS) {
        expect(registeredHandlers.has(channel)).toBe(false);
      }
      expect(ipcMainMock.removeHandler).toHaveBeenCalledTimes(FILESYSTEM_CHANNELS.length);
    });
  });
});

// ===========================================================================
// Editor
// ===========================================================================

describe('editor handlers', () => {
  describe('handleOpenFile', () => {
    it('returns content, language and stats', async () => {
      const file = path.join(tmpDir, 'code.ts');
      await fs.writeFile(file, 'export const x = 1;');

      const data = await ok<{ content: string; language: string; stats: { size: number } }>(
        handleOpenFile as Handler,
        { path: file }
      );

      expect(data.content).toBe('export const x = 1;');
      expect(data.language).toBe('typescript');
      expect(data.stats.size).toBe(19);
    });

    it.each([
      ['a.js', 'javascript'],
      ['a.tsx', 'typescript'],
      ['a.py', 'python'],
      ['a.rs', 'rust'],
      ['a.json', 'json'],
      ['a.md', 'markdown'],
      ['a.sql', 'sql'],
      ['a.unknown', 'plaintext'],
      ['LICENSE', 'plaintext'],
    ])('detects %s as %s', async (name, language) => {
      const file = path.join(tmpDir, name);
      await fs.writeFile(file, '');

      const data = await ok<{ language: string }>(handleOpenFile as Handler, { path: file });

      expect(data.language).toBe(language);
    });

    it('matches the extension case-insensitively', async () => {
      const file = path.join(tmpDir, 'Component.TSX');
      await fs.writeFile(file, '');

      const data = await ok<{ language: string }>(handleOpenFile as Handler, { path: file });

      expect(data.language).toBe('typescript');
    });

    it('accepts an optional workspaceId', async () => {
      const file = path.join(tmpDir, 'a.ts');
      await fs.writeFile(file, '');

      const data = await ok<{ language: string }>(handleOpenFile as Handler, {
        path: file,
        workspaceId: 'ws-1',
      });

      expect(data.language).toBe('typescript');
    });

    it('fails for a missing file', async () => {
      const error = await fail(handleOpenFile as Handler, { path: path.join(tmpDir, 'gone.ts') });

      expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
    });

    it('rejects an empty path', async () => {
      const error = await fail(handleOpenFile as Handler, { path: '' });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('handleSaveFile', () => {
    it('saves and returns the mtime', async () => {
      const file = path.join(tmpDir, 'save.ts');

      const data = await ok<{ success: boolean; mtime: number }>(handleSaveFile as Handler, {
        path: file,
        content: 'const a = 1;',
      });

      expect(data.success).toBe(true);
      expect(data.mtime).toBeGreaterThan(0);
      expect(await fs.readFile(file, 'utf-8')).toBe('const a = 1;');
    });

    it('saves empty content', async () => {
      const file = path.join(tmpDir, 'blank.ts');

      await ok(handleSaveFile as Handler, { path: file, content: '' });

      expect(await fs.readFile(file, 'utf-8')).toBe('');
    });

    it('requires a content field', async () => {
      const error = await fail(handleSaveFile as Handler, { path: '/tmp/x' });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('fails when the directory does not exist', async () => {
      const error = await fail(handleSaveFile as Handler, {
        path: path.join(tmpDir, 'nope', 'a.ts'),
        content: 'x',
      });

      expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
    });
  });

  describe('handleFormatDocument', () => {
    beforeEach(() => {
      formatDocumentMock.mockClear();
    });

    it('delegates to the format service', async () => {
      const data = await ok<{ formatted: string }>(handleFormatDocument as Handler, {
        path: '/tmp/a.ts',
        content: '  const x = 1;  ',
        language: 'typescript',
      });

      expect(formatDocumentMock).toHaveBeenCalledWith({
        path: '/tmp/a.ts',
        content: '  const x = 1;  ',
        language: 'typescript',
      });
      expect(data.formatted).toBe('const x = 1;');
    });

    it('requires a language', async () => {
      const error = await fail(handleFormatDocument as Handler, {
        path: '/tmp/a.ts',
        content: 'x',
      });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('maps a FormatError to FORMAT_ERROR', async () => {
      formatDocumentMock.mockImplementationOnce(async () => {
        const error = new Error('Unexpected token');
        error.name = 'FormatError';
        throw error;
      });

      const error = await fail(handleFormatDocument as Handler, {
        path: '/tmp/a.ts',
        content: 'const =',
        language: 'typescript',
      });

      expect(error.code).toBe(ErrorCode.FORMAT_ERROR);
      expect(error.message).toBe('Unexpected token');
    });
  });

  describe('registration', () => {
    it('registers and unregisters the editor channels', () => {
      registerEditorHandlers();
      for (const channel of EDITOR_CHANNELS) {
        expect(registeredHandlers.has(channel)).toBe(true);
      }

      unregisterEditorHandlers();
      for (const channel of EDITOR_CHANNELS) {
        expect(registeredHandlers.has(channel)).toBe(false);
      }
    });
  });
});

// ===========================================================================
// Git
// ===========================================================================

describe('git handlers', () => {
  beforeEach(() => {
    Object.values(gitServiceMock).forEach((m) => m.mockClear());
  });

  describe('handleGitStatus', () => {
    it('forwards the repo path and returns the status', async () => {
      const data = await ok<{ branch: string; isClean: boolean }>(handleGitStatus as Handler, {
        repoPath: '/repo',
      });

      expect(gitServiceMock.status).toHaveBeenCalledWith('/repo');
      expect(data.branch).toBe('main');
      expect(data.isClean).toBe(true);
    });

    it('rejects an empty repo path', async () => {
      const error = await fail(handleGitStatus as Handler, { repoPath: '' });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects a missing repo path', async () => {
      const error = await fail(handleGitStatus as Handler, {});

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('handleGitCommit', () => {
    it('forwards the message and file list', async () => {
      const data = await ok<{ hash: string }>(handleGitCommit as Handler, {
        repoPath: '/repo',
        message: 'feat: add',
        files: ['a.ts', 'b.ts'],
      });

      expect(gitServiceMock.commit).toHaveBeenCalledWith('/repo', 'feat: add', ['a.ts', 'b.ts']);
      expect(data.hash).toBe('deadbeefcafe');
    });

    it('omits files when not provided', async () => {
      await ok(handleGitCommit as Handler, { repoPath: '/repo', message: 'chore' });

      expect(gitServiceMock.commit).toHaveBeenCalledWith('/repo', 'chore', undefined);
    });

    it('requires a non-empty message', async () => {
      const error = await fail(handleGitCommit as Handler, { repoPath: '/repo', message: '' });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects a non-array files field', async () => {
      const error = await fail(handleGitCommit as Handler, {
        repoPath: '/repo',
        message: 'm',
        files: 'a.ts',
      });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('handleGitPush', () => {
    it('defaults the remote to origin', async () => {
      await ok(handleGitPush as Handler, { repoPath: '/repo' });

      expect(gitServiceMock.push).toHaveBeenCalledWith('/repo', 'origin', undefined);
    });

    it('forwards an explicit remote and branch', async () => {
      await ok(handleGitPush as Handler, {
        repoPath: '/repo',
        remote: 'upstream',
        branch: 'develop',
      });

      expect(gitServiceMock.push).toHaveBeenCalledWith('/repo', 'upstream', 'develop');
    });

    it('returns the pushed count', async () => {
      const data = await ok<{ pushed: number }>(handleGitPush as Handler, { repoPath: '/repo' });

      expect(data.pushed).toBe(1);
    });
  });

  describe('handleGitPull', () => {
    it('reports success', async () => {
      const data = await ok<{ success: boolean; filesChanged: number }>(
        handleGitPull as Handler,
        { repoPath: '/repo' }
      );

      expect(data.success).toBe(true);
      expect(data.filesChanged).toBe(0);
      expect(gitServiceMock.pull).toHaveBeenCalledWith('/repo', 'origin', undefined);
    });

    it('surfaces a merge conflict', async () => {
      gitServiceMock.pull.mockImplementationOnce(async () => {
        throw new Error('CONFLICT: merge conflict in a.ts');
      });

      const error = await fail(handleGitPull as Handler, { repoPath: '/repo' });

      expect(error.message).toContain('CONFLICT');
    });
  });

  describe('handleGitDiff', () => {
    it('defaults staged to false', async () => {
      await ok(handleGitDiff as Handler, { repoPath: '/repo' });

      expect(gitServiceMock.diff).toHaveBeenCalledWith('/repo', undefined, false);
    });

    it('forwards a path and the staged flag', async () => {
      await ok(handleGitDiff as Handler, { repoPath: '/repo', path: 'a.ts', staged: true });

      expect(gitServiceMock.diff).toHaveBeenCalledWith('/repo', 'a.ts', true);
    });

    it('rejects a non-boolean staged flag', async () => {
      const error = await fail(handleGitDiff as Handler, { repoPath: '/repo', staged: 'yes' });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('error mapping', () => {
    it('maps "not found" ahead of "git"', async () => {
      gitServiceMock.status.mockImplementationOnce(async () => {
        throw new Error('git repository not found');
      });

      const error = await fail(handleGitStatus as Handler, { repoPath: '/repo' });

      expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
    });

    it('maps a git message to GIT_ERROR', async () => {
      gitServiceMock.status.mockImplementationOnce(async () => {
        throw new Error('git index is locked');
      });

      const error = await fail(handleGitStatus as Handler, { repoPath: '/repo' });

      expect(error.code).toBe(ErrorCode.GIT_ERROR);
    });

    it('maps a permission failure to PERMISSION_DENIED', async () => {
      gitServiceMock.status.mockImplementationOnce(async () => {
        throw new Error('EACCES: permission denied');
      });

      const error = await fail(handleGitStatus as Handler, { repoPath: '/repo' });

      expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
    });

    it('maps anything else to UNKNOWN_ERROR and keeps the stack', async () => {
      gitServiceMock.status.mockImplementationOnce(async () => {
        throw new Error('something weird');
      });

      const error = await fail(handleGitStatus as Handler, { repoPath: '/repo' });

      expect(error.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect((error.details as { stack: string }).stack).toContain('Error');
    });

    it('maps a non-Error throwable to UNKNOWN_ERROR', async () => {
      gitServiceMock.status.mockImplementationOnce(async () => {
        throw 'a bare string';
      });

      const error = await fail(handleGitStatus as Handler, { repoPath: '/repo' });

      expect(error.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(error.message).toBe('An unknown error occurred');
      expect(error.details).toBe('a bare string');
    });
  });

  describe('registration', () => {
    it('registers and unregisters all five git channels', () => {
      registerGitHandlers();
      expect(GIT_CHANNELS.every((c) => registeredHandlers.has(c))).toBe(true);

      unregisterGitHandlers();
      expect(GIT_CHANNELS.some((c) => registeredHandlers.has(c))).toBe(false);
    });
  });
});

// ===========================================================================
// Database
// ===========================================================================

describe('database handlers', () => {
  beforeEach(() => {
    databaseServiceMock.query.mockClear();
    databaseServiceMock.execute.mockClear();
  });

  describe('handleDBQuery', () => {
    it('forwards the query with an empty params default', async () => {
      const data = await ok<{ rows: unknown[] }>(handleDBQuery as Handler, {
        query: 'SELECT * FROM workspaces',
      });

      expect(databaseServiceMock.query).toHaveBeenCalledWith('SELECT * FROM workspaces', []);
      expect(data.rows).toHaveLength(1);
    });

    it('forwards bound params', async () => {
      await ok(handleDBQuery as Handler, {
        query: 'SELECT * FROM t WHERE id = ?',
        params: [42],
      });

      expect(databaseServiceMock.query).toHaveBeenCalledWith('SELECT * FROM t WHERE id = ?', [42]);
    });

    it('rejects an empty query', async () => {
      const error = await fail(handleDBQuery as Handler, { query: '' });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects a missing query', async () => {
      const error = await fail(handleDBQuery as Handler, {});

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects non-array params', async () => {
      const error = await fail(handleDBQuery as Handler, { query: 'SELECT 1', params: 'x' });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('maps a DatabaseError to DATABASE_ERROR', async () => {
      databaseServiceMock.query.mockImplementationOnce(async () => {
        const error = new Error('only read queries are allowed');
        error.name = 'DatabaseError';
        throw error;
      });

      const error = await fail(handleDBQuery as Handler, { query: 'DELETE FROM t' });

      expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
    });

    it('maps a DatabaseConnectionError subclass to DATABASE_ERROR', async () => {
      databaseServiceMock.query.mockImplementationOnce(async () => {
        const error = new Error('database is locked');
        error.name = 'DatabaseConnectionError';
        throw error;
      });

      const error = await fail(handleDBQuery as Handler, { query: 'SELECT 1' });

      expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
    });
  });

  describe('handleDBExecute', () => {
    it('forwards the statement list', async () => {
      const statements = [
        { query: 'INSERT INTO t (v) VALUES (?)', params: ['a'] },
        { query: 'UPDATE t SET v = ?', params: ['b'] },
      ];

      const data = await ok<{ changes: number }>(handleDBExecute as Handler, { statements });

      expect(databaseServiceMock.execute).toHaveBeenCalledWith(statements);
      expect(data.changes).toBe(1);
    });

    it('requires at least one statement', async () => {
      const error = await fail(handleDBExecute as Handler, { statements: [] });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects a statement with an empty query', async () => {
      const error = await fail(handleDBExecute as Handler, { statements: [{ query: '' }] });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('accepts a statement without params', async () => {
      await ok(handleDBExecute as Handler, { statements: [{ query: 'DELETE FROM t WHERE id = 1' }] });

      expect(databaseServiceMock.execute).toHaveBeenCalled();
    });

    it('surfaces a rejected destructive statement', async () => {
      databaseServiceMock.execute.mockImplementationOnce(async () => {
        const error = new Error('DROP TABLE is not permitted');
        error.name = 'DatabaseError';
        throw error;
      });

      const error = await fail(handleDBExecute as Handler, {
        statements: [{ query: 'DROP TABLE workspaces' }],
      });

      expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
      expect(error.message).toContain('not permitted');
    });
  });

  describe('registration', () => {
    it('registers and unregisters both database channels', () => {
      registerDatabaseHandlers();
      expect(DATABASE_CHANNELS.every((c) => registeredHandlers.has(c))).toBe(true);

      unregisterDatabaseHandlers();
      expect(DATABASE_CHANNELS.some((c) => registeredHandlers.has(c))).toBe(false);
    });
  });
});
