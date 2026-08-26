/**
 * AutomationService unit tests
 *
 * External dependencies (chokidar, node-cron, git-service, ai-service,
 * child_process) are mocked with `vi.mock` so the tests exercise the real
 * AutomationService logic without touching the filesystem, the clock or git.
 *
 * The service under test is pulled in with a top-level `await import()` below,
 * *after* the mock registrations, so it links against the mocked modules.
 *
 * `vi.mock` is hoisted above every declaration in this file, so no factory may
 * read a top-level `const` eagerly. Each one forwards through an arrow instead,
 * which defers the lookup until the mocked module is first imported — by then
 * the consts are initialised.
 *
 * Workspace modules spread `importOriginal()` so the exports this file does not
 * override keep their real implementations; a factory returning only the
 * overrides would drop the rest (e.g. the `GitService` class).
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { EventEmitter } from 'events';

/**
 * Portable replacement for Bun's `Bun.sleep(ms)`: resolves after `ms` real
 * milliseconds. No test in this suite uses fake timers, so real-time waits
 * keep the original semantics.
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));



// ---------------------------------------------------------------------------
// Mocks — must be registered before importing the service under test
// ---------------------------------------------------------------------------

/** Fake chokidar watcher that lets tests fire filesystem events manually. */
class FakeWatcher extends EventEmitter {
  closed = false;
  readonly patterns: string | string[];
  readonly options: Record<string, unknown>;

  constructor(patterns: string | string[], options: Record<string, unknown>) {
    super();
    this.patterns = patterns;
    this.options = options;
  }

  close = vi.fn(async () => {
    this.closed = true;
  });
}

const createdWatchers: FakeWatcher[] = [];
const watchMock = vi.fn((patterns: string | string[], options: Record<string, unknown>) => {
  const watcher = new FakeWatcher(patterns, options);
  createdWatchers.push(watcher);
  return watcher;
});

/** Fake node-cron task capturing the callback so tests can trigger it. */
interface FakeTask {
  cron: string;
  options: Record<string, unknown>;
  callback: () => Promise<void> | void;
  stop: ReturnType<typeof vi.fn>;
  stopped: boolean;
}

const createdTasks: FakeTask[] = [];
const scheduleMock = vi.fn(
  (cron: string, callback: () => Promise<void> | void, options: Record<string, unknown> = {}) => {
    const task: FakeTask = {
      cron,
      options,
      callback,
      stopped: false,
      stop: vi.fn(() => {
        task.stopped = true;
      }),
    };
    createdTasks.push(task);
    return task;
  }
);

const gitServiceMock = {
  commit: vi.fn(async () => ({ hash: 'abcdef1234567890', message: 'done' })),
  push: vi.fn(async () => ({ pushed: 2 })),
  pull: vi.fn(async () => undefined),
  createBranch: vi.fn(async () => undefined),
};

const aiSendMessageMock = vi.fn(async () => ({ content: 'ai-response' }));
const aiCreateSessionMock = vi.fn(async () => ({ id: 'session-1' }));
const getAIServiceMock = vi.fn(() => ({
  createSession: aiCreateSessionMock,
  sendMessage: aiSendMessageMock,
}));

/** Fake spawned child process for run_script actions. */
class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
}

let spawnBehaviour: (child: FakeChildProcess) => void = (child) => {
  queueMicrotask(() => {
    child.stdout.emit('data', Buffer.from('ok'));
    child.emit('close', 0);
  });
};

const spawnCalls: Array<{ shell: string; args: string[]; options: Record<string, unknown> }> = [];
const spawnMock = vi.fn((shell: string, args: string[], options: Record<string, unknown>) => {
  spawnCalls.push({ shell, args, options });
  const child = new FakeChildProcess();
  spawnBehaviour(child);
  return child;
});

vi.mock('chokidar', () => ({
  watch: (...args: Parameters<typeof watchMock>) => watchMock(...args),
}));
vi.mock('node-cron', () => ({
  schedule: (...args: Parameters<typeof scheduleMock>) => scheduleMock(...args),
}));
vi.mock('child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('child_process')>()),
  spawn: (...args: Parameters<typeof spawnMock>) => spawnMock(...args),
}));
vi.mock('../git-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../git-service')>()),
  gitService: gitServiceMock,
}));
vi.mock('../ai-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../ai-service')>()),
  getAIService: (...args: Parameters<typeof getAIServiceMock>) => getAIServiceMock(...args),
}));

// Imported dynamically so the mock factories above resolve against the
// already-initialised consts in this file (see file header).
const {
  AutomationService,
  automationService,
} = await import('../automation-service');

type Action = import('../automation-service').Action;
type Automation = import('../automation-service').Automation;
type AutomationLog = import('../automation-service').AutomationLog;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const notification: Action = {
  type: 'notification',
  title: 'Build finished',
  message: 'All green',
  level: 'success',
};

function manualAutomation(
  overrides: Partial<Omit<Automation, 'id' | 'createdAt' | 'updatedAt'>> = {}
): Omit<Automation, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    workspaceId: 'ws-1',
    name: 'Notify on demand',
    enabled: false,
    trigger: { type: 'manual' },
    actions: [notification],
    ...overrides,
  };
}

function resetMocks(): void {
  createdWatchers.length = 0;
  createdTasks.length = 0;
  spawnCalls.length = 0;
  watchMock.mockClear();
  scheduleMock.mockClear();
  spawnMock.mockClear();
  gitServiceMock.commit.mockClear();
  gitServiceMock.push.mockClear();
  gitServiceMock.pull.mockClear();
  gitServiceMock.createBranch.mockClear();
  aiSendMessageMock.mockClear();
  aiCreateSessionMock.mockClear();
  spawnBehaviour = (child) => {
    queueMicrotask(() => {
      child.stdout.emit('data', Buffer.from('ok'));
      child.emit('close', 0);
    });
  };
}

describe('AutomationService', () => {
  let service: InstanceType<typeof AutomationService>;
  let consoleLogSpy: MockInstance<typeof console.log>;
  let consoleErrorSpy: MockInstance<typeof console.error>;

  beforeEach(() => {
    resetMocks();
    service = new AutomationService();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    await service.cleanup();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  describe('createAutomation', () => {
    it('assigns an id and timestamps', async () => {
      const before = Date.now();
      const created = await service.createAutomation(manualAutomation());

      expect(created.id).toMatch(/^automation_\d+_[a-z0-9]+$/);
      expect(created.createdAt).toBeGreaterThanOrEqual(before);
      expect(created.updatedAt).toBe(created.createdAt);
      expect(created.name).toBe('Notify on demand');
    });

    it('emits automation:created with the new automation', async () => {
      const listener = vi.fn();
      service.on('automation:created', listener);

      const created = await service.createAutomation(manualAutomation());

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0]).toEqual(created);
    });

    it('does not activate triggers when disabled', async () => {
      await service.createAutomation(
        manualAutomation({
          enabled: false,
          trigger: { type: 'schedule', cron: '* * * * *' },
        })
      );

      expect(scheduleMock).not.toHaveBeenCalled();
    });

    it('activates triggers when enabled', async () => {
      await service.createAutomation(
        manualAutomation({
          enabled: true,
          trigger: { type: 'schedule', cron: '*/5 * * * *', timezone: 'Europe/Paris' },
        })
      );

      expect(scheduleMock).toHaveBeenCalledTimes(1);
      expect(createdTasks[0].cron).toBe('*/5 * * * *');
      expect(createdTasks[0].options).toEqual({ timezone: 'Europe/Paris' });
    });

    it('generates unique ids for automations created in the same tick', async () => {
      const [a, b, c] = await Promise.all([
        service.createAutomation(manualAutomation()),
        service.createAutomation(manualAutomation()),
        service.createAutomation(manualAutomation()),
      ]);

      expect(new Set([a.id, b.id, c.id]).size).toBe(3);
    });
  });

  describe('updateAutomation', () => {
    it('merges updates and bumps updatedAt', async () => {
      const created = await service.createAutomation(manualAutomation());
      const updated = await service.updateAutomation(created.id, { name: 'Renamed' });

      expect(updated.name).toBe('Renamed');
      expect(updated.id).toBe(created.id);
      expect(updated.createdAt).toBe(created.createdAt);
      expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
    });

    it('emits automation:updated', async () => {
      const created = await service.createAutomation(manualAutomation());
      const listener = vi.fn();
      service.on('automation:updated', listener);

      await service.updateAutomation(created.id, { name: 'Renamed' });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('throws for an unknown id', async () => {
      await expect(service.updateAutomation('nope', { name: 'x' })).rejects.toThrow(
        'Automation nope not found'
      );
    });

    it('tears down the old trigger and rebuilds it', async () => {
      const created = await service.createAutomation(
        manualAutomation({ enabled: true, trigger: { type: 'schedule', cron: '* * * * *' } })
      );
      expect(createdTasks).toHaveLength(1);

      await service.updateAutomation(created.id, {
        trigger: { type: 'schedule', cron: '0 * * * *' },
      });

      expect(createdTasks[0].stopped).toBe(true);
      expect(createdTasks).toHaveLength(2);
      expect(createdTasks[1].cron).toBe('0 * * * *');
    });

    it('leaves the trigger down when disabling', async () => {
      const created = await service.createAutomation(
        manualAutomation({ enabled: true, trigger: { type: 'schedule', cron: '* * * * *' } })
      );

      await service.updateAutomation(created.id, { enabled: false });

      expect(createdTasks[0].stopped).toBe(true);
      expect(createdTasks).toHaveLength(1);
    });
  });

  describe('deleteAutomation', () => {
    it('removes the automation and its logs', async () => {
      const created = await service.createAutomation(manualAutomation());
      await service.runAutomation(created.id);
      expect(service.getAutomationLogs(created.id)).toHaveLength(1);

      await service.deleteAutomation(created.id);

      expect(service.getAutomation(created.id)).toBeUndefined();
      expect(service.getAutomationLogs(created.id)).toEqual([]);
    });

    it('emits automation:deleted with the id', async () => {
      const created = await service.createAutomation(manualAutomation());
      const listener = vi.fn();
      service.on('automation:deleted', listener);

      await service.deleteAutomation(created.id);

      expect(listener).toHaveBeenCalledWith(created.id);
    });

    it('throws for an unknown id', async () => {
      await expect(service.deleteAutomation('ghost')).rejects.toThrow(
        'Automation ghost not found'
      );
    });

    it('closes an active file watcher', async () => {
      const created = await service.createAutomation(
        manualAutomation({
          enabled: true,
          trigger: {
            type: 'file_watch',
            patterns: ['**/*.ts'],
            events: ['change'],
            workspacePath: '/repo',
          },
        })
      );

      await service.deleteAutomation(created.id);

      expect(createdWatchers[0].closed).toBe(true);
    });
  });

  describe('listAutomations / getAutomation', () => {
    it('returns every automation when no workspace filter is given', async () => {
      await service.createAutomation(manualAutomation({ workspaceId: 'ws-1' }));
      await service.createAutomation(manualAutomation({ workspaceId: 'ws-2' }));

      expect(service.listAutomations()).toHaveLength(2);
    });

    it('filters by workspaceId', async () => {
      await service.createAutomation(manualAutomation({ workspaceId: 'ws-1' }));
      await service.createAutomation(manualAutomation({ workspaceId: 'ws-2' }));

      const result = service.listAutomations('ws-2');

      expect(result).toHaveLength(1);
      expect(result[0].workspaceId).toBe('ws-2');
    });

    it('returns an empty list for an unknown workspace', async () => {
      await service.createAutomation(manualAutomation({ workspaceId: 'ws-1' }));

      expect(service.listAutomations('ws-missing')).toEqual([]);
    });

    it('returns undefined for an unknown automation', () => {
      expect(service.getAutomation('missing')).toBeUndefined();
    });
  });

  describe('toggleAutomation', () => {
    it('enables a disabled automation and starts its trigger', async () => {
      const created = await service.createAutomation(
        manualAutomation({ enabled: false, trigger: { type: 'schedule', cron: '* * * * *' } })
      );

      const toggled = await service.toggleAutomation(created.id, true);

      expect(toggled.enabled).toBe(true);
      expect(createdTasks).toHaveLength(1);
    });

    it('disables an enabled automation and stops its trigger', async () => {
      const created = await service.createAutomation(
        manualAutomation({ enabled: true, trigger: { type: 'schedule', cron: '* * * * *' } })
      );

      const toggled = await service.toggleAutomation(created.id, false);

      expect(toggled.enabled).toBe(false);
      expect(createdTasks[0].stopped).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Triggers
  // -------------------------------------------------------------------------

  describe('file_watch trigger', () => {
    it('registers a chokidar watcher with the configured patterns', async () => {
      await service.createAutomation(
        manualAutomation({
          enabled: true,
          trigger: {
            type: 'file_watch',
            patterns: ['src/**/*.ts', 'package.json'],
            events: ['add', 'change'],
            workspacePath: '/repo',
          },
        })
      );

      expect(watchMock).toHaveBeenCalledTimes(1);
      const watcher = createdWatchers[0];
      expect(watcher.patterns).toEqual(['src/**/*.ts', 'package.json']);
      expect(watcher.options.cwd).toBe('/repo');
      expect(watcher.options.ignoreInitial).toBe(true);
      expect(watcher.listenerCount('add')).toBe(1);
      expect(watcher.listenerCount('change')).toBe(1);
    });

    it('only listens to the requested events', async () => {
      await service.createAutomation(
        manualAutomation({
          enabled: true,
          trigger: {
            type: 'file_watch',
            patterns: ['**/*'],
            events: ['unlink'],
            workspacePath: '/repo',
          },
        })
      );

      const watcher = createdWatchers[0];
      expect(watcher.listenerCount('unlink')).toBe(1);
      expect(watcher.listenerCount('add')).toBe(0);
      expect(watcher.listenerCount('change')).toBe(0);
    });

    it('runs the automation when a watched file changes', async () => {
      const created = await service.createAutomation(
        manualAutomation({
          enabled: true,
          trigger: {
            type: 'file_watch',
            patterns: ['**/*.ts'],
            events: ['change'],
            workspacePath: '/repo',
          },
        })
      );
      const completed = vi.fn();
      service.on('automation:completed', completed);

      createdWatchers[0].emit('change', 'src/index.ts');
      await sleep(5);

      expect(completed).toHaveBeenCalledTimes(1);
      const logs = service.getAutomationLogs(created.id);
      expect(logs).toHaveLength(1);
      expect(logs[0].status).toBe('success');
    });

    it('passes the triggering event and path to the action', async () => {
      await service.createAutomation(
        manualAutomation({
          enabled: true,
          trigger: {
            type: 'file_watch',
            patterns: ['**/*.ts'],
            events: ['change'],
            workspacePath: '/repo',
          },
          actions: [
            {
              type: 'ai_task',
              prompt: 'Review',
              model: 'gpt-4',
              provider: 'openai',
            },
          ],
        })
      );

      createdWatchers[0].emit('change', 'src/index.ts');
      await sleep(5);

      expect(aiSendMessageMock).toHaveBeenCalledTimes(1);
      const prompt = String((aiSendMessageMock.mock.calls[0] as unknown as [unknown, string])[1]);
      expect(prompt).toContain('Review');
      expect(prompt).toContain('src/index.ts');
      expect(prompt).toContain('change');
    });

    it('swallows watcher-triggered execution errors', async () => {
      const created = await service.createAutomation(
        manualAutomation({
          enabled: true,
          trigger: {
            type: 'file_watch',
            patterns: ['**/*.ts'],
            events: ['change'],
            workspacePath: '/repo',
          },
        })
      );

      // Force a concurrency error by marking the automation as already running.
      const first = service.runAutomation(created.id);
      createdWatchers[0].emit('change', 'src/index.ts');
      await first;
      await sleep(5);

      // The watcher error is logged, not thrown.
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('schedule trigger', () => {
    it('registers the cron expression', async () => {
      await service.createAutomation(
        manualAutomation({
          enabled: true,
          trigger: { type: 'schedule', cron: '30 2 * * *' },
        })
      );

      expect(createdTasks[0].cron).toBe('30 2 * * *');
    });

    it('executes the automation when the cron callback fires', async () => {
      const created = await service.createAutomation(
        manualAutomation({
          enabled: true,
          trigger: { type: 'schedule', cron: '* * * * *' },
        })
      );

      await createdTasks[0].callback();

      const logs = service.getAutomationLogs(created.id);
      expect(logs).toHaveLength(1);
      expect(logs[0].status).toBe('success');
    });

    it('logs but does not throw when a scheduled run fails', async () => {
      const created = await service.createAutomation(
        manualAutomation({
          enabled: true,
          trigger: { type: 'schedule', cron: '* * * * *' },
        })
      );

      const inFlight = service.runAutomation(created.id);
      await createdTasks[0].callback();
      await inFlight;

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('git_hook and manual triggers', () => {
    it('logs that git hooks are not implemented yet', async () => {
      await service.createAutomation(
        manualAutomation({
          enabled: true,
          trigger: { type: 'git_hook', hook: 'pre-commit', repoPath: '/repo' },
        })
      );

      const logged = consoleLogSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(logged).toContain('Git hook trigger');
      expect(watchMock).not.toHaveBeenCalled();
      expect(scheduleMock).not.toHaveBeenCalled();
    });

    it('creates no watcher or scheduler for manual triggers', async () => {
      await service.createAutomation(manualAutomation({ enabled: true }));

      expect(watchMock).not.toHaveBeenCalled();
      expect(scheduleMock).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  describe('notification action', () => {
    it('emits a notification event and reports the title', async () => {
      const created = await service.createAutomation(manualAutomation());
      const listener = vi.fn();
      service.on('notification', listener);

      const log = await service.runAutomation(created.id);

      expect(listener).toHaveBeenCalledWith({
        title: 'Build finished',
        message: 'All green',
        level: 'success',
      });
      expect(log.actionResults[0].output).toBe('Notification sent: Build finished');
    });
  });

  describe('run_script action', () => {
    it('spawns the script and captures stdout', async () => {
      const created = await service.createAutomation(
        manualAutomation({
          actions: [{ type: 'run_script', script: 'echo hi', cwd: '/tmp' }],
        })
      );
      spawnBehaviour = (child) => {
        queueMicrotask(() => {
          child.stdout.emit('data', Buffer.from('hello '));
          child.stdout.emit('data', Buffer.from('world'));
          child.emit('close', 0);
        });
      };

      const log = await service.runAutomation(created.id);

      expect(log.status).toBe('success');
      expect(log.actionResults[0].output).toBe('hello world');
      expect(spawnCalls[0].args).toEqual(['-c', 'echo hi']);
      expect(spawnCalls[0].options.cwd).toBe('/tmp');
    });

    it('uses the configured shell and merges env vars', async () => {
      const created = await service.createAutomation(
        manualAutomation({
          actions: [
            { type: 'run_script', script: 'ls', shell: '/bin/zsh', env: { FOO: 'bar' } },
          ],
        })
      );

      await service.runAutomation(created.id);

      expect(spawnCalls[0].shell).toBe('/bin/zsh');
      expect((spawnCalls[0].options.env as Record<string, string>).FOO).toBe('bar');
    });

    it('defaults cwd to process.cwd()', async () => {
      const created = await service.createAutomation(
        manualAutomation({ actions: [{ type: 'run_script', script: 'pwd' }] })
      );

      await service.runAutomation(created.id);

      expect(spawnCalls[0].options.cwd).toBe(process.cwd());
    });

    it('fails the log when the script exits non-zero', async () => {
      const created = await service.createAutomation(
        manualAutomation({ actions: [{ type: 'run_script', script: 'false' }] })
      );
      spawnBehaviour = (child) => {
        queueMicrotask(() => {
          child.stderr.emit('data', Buffer.from('boom'));
          child.emit('close', 3);
        });
      };

      const log = await service.runAutomation(created.id);

      expect(log.status).toBe('error');
      expect(log.error).toContain('Script exited with code 3');
      expect(log.error).toContain('boom');
      expect(log.actionResults[0].status).toBe('error');
    });

    it('propagates spawn errors', async () => {
      const created = await service.createAutomation(
        manualAutomation({ actions: [{ type: 'run_script', script: 'nope' }] })
      );
      spawnBehaviour = (child) => {
        queueMicrotask(() => child.emit('error', new Error('ENOENT')));
      };

      const log = await service.runAutomation(created.id);

      expect(log.status).toBe('error');
      expect(log.error).toBe('ENOENT');
    });
  });

  describe('ai_task action', () => {
    it('creates a session with the requested provider and model', async () => {
      const created = await service.createAutomation(
        manualAutomation({
          actions: [
            { type: 'ai_task', prompt: 'Summarise', model: 'claude-3', provider: 'anthropic' },
          ],
        })
      );

      const log = await service.runAutomation(created.id);

      expect(aiCreateSessionMock).toHaveBeenCalledWith('anthropic', 'claude-3');
      expect(log.actionResults[0].output).toBe('ai-response');
    });

    it('sends the bare prompt when there is no trigger data', async () => {
      const created = await service.createAutomation(
        manualAutomation({
          actions: [{ type: 'ai_task', prompt: 'Summarise', model: 'gpt-4', provider: 'openai' }],
        })
      );

      await service.runAutomation(created.id);

      expect(aiSendMessageMock).toHaveBeenCalledWith('session-1', 'Summarise');
    });

    it('appends serialised trigger data to the prompt', async () => {
      const created = await service.createAutomation(
        manualAutomation({
          actions: [{ type: 'ai_task', prompt: 'Summarise', model: 'gpt-4', provider: 'openai' }],
        })
      );

      await service.runAutomation(created.id, { event: 'change', path: 'a.ts' });

      const prompt = String((aiSendMessageMock.mock.calls[0] as unknown as [unknown, string])[1]);
      expect(prompt).toContain('Summarise');
      expect(prompt).toContain('Trigger data:');
      expect(prompt).toContain('"path": "a.ts"');
    });

    it('records an error when the AI call rejects', async () => {
      const created = await service.createAutomation(
        manualAutomation({
          actions: [{ type: 'ai_task', prompt: 'x', model: 'gpt-4', provider: 'openai' }],
        })
      );
      aiSendMessageMock.mockImplementationOnce(async () => {
        throw new Error('rate limited');
      });

      const log = await service.runAutomation(created.id);

      expect(log.status).toBe('error');
      expect(log.error).toBe('rate limited');
    });
  });

  describe('git_operation action', () => {
    it('commits with the provided message and files', async () => {
      const created = await service.createAutomation(
        manualAutomation({
          actions: [
            {
              type: 'git_operation',
              operation: 'commit',
              repoPath: '/repo',
              params: { message: 'chore: auto', files: ['a.ts'] },
            },
          ],
        })
      );

      const log = await service.runAutomation(created.id);

      expect(gitServiceMock.commit).toHaveBeenCalledWith('/repo', 'chore: auto', ['a.ts']);
      expect(log.actionResults[0].output).toBe('Committed: abcdef1 - done');
    });

    it('falls back to a default commit message', async () => {
      const created = await service.createAutomation(
        manualAutomation({
          actions: [{ type: 'git_operation', operation: 'commit', repoPath: '/repo' }],
        })
      );

      await service.runAutomation(created.id);

      expect(gitServiceMock.commit).toHaveBeenCalledWith('/repo', 'Automated commit', undefined);
    });

    it('pushes and reports the commit count', async () => {
      const created = await service.createAutomation(
        manualAutomation({
          actions: [
            {
              type: 'git_operation',
              operation: 'push',
              repoPath: '/repo',
              params: { remote: 'origin', branch: 'main' },
            },
          ],
        })
      );

      const log = await service.runAutomation(created.id);

      expect(gitServiceMock.push).toHaveBeenCalledWith('/repo', 'origin', 'main');
      expect(log.actionResults[0].output).toBe('Pushed 2 commit(s)');
    });

    it('pulls', async () => {
      const created = await service.createAutomation(
        manualAutomation({
          actions: [{ type: 'git_operation', operation: 'pull', repoPath: '/repo' }],
        })
      );

      const log = await service.runAutomation(created.id);

      expect(gitServiceMock.pull).toHaveBeenCalledWith('/repo', undefined, undefined);
      expect(log.actionResults[0].output).toBe('Pull completed');
    });

    it('creates a branch', async () => {
      const created = await service.createAutomation(
        manualAutomation({
          actions: [
            {
              type: 'git_operation',
              operation: 'branch',
              repoPath: '/repo',
              params: { branchName: 'feat/x', checkout: true },
            },
          ],
        })
      );

      const log = await service.runAutomation(created.id);

      expect(gitServiceMock.createBranch).toHaveBeenCalledWith('/repo', 'feat/x', true);
      expect(log.actionResults[0].output).toBe('Branch feat/x created');
    });

    it('rejects an unknown git operation', async () => {
      const created = await service.createAutomation(
        manualAutomation({
          actions: [
            {
              type: 'git_operation',
              operation: 'rebase' as 'commit',
              repoPath: '/repo',
            },
          ],
        })
      );

      const log = await service.runAutomation(created.id);

      expect(log.status).toBe('error');
      expect(log.error).toBe('Unknown git operation: rebase');
    });

    it('records git failures as action errors', async () => {
      const created = await service.createAutomation(
        manualAutomation({
          actions: [{ type: 'git_operation', operation: 'push', repoPath: '/repo' }],
        })
      );
      gitServiceMock.push.mockImplementationOnce(async () => {
        throw new Error('rejected: non-fast-forward');
      });

      const log = await service.runAutomation(created.id);

      expect(log.status).toBe('error');
      expect(log.error).toBe('rejected: non-fast-forward');
    });
  });

  describe('unknown action type', () => {
    it('produces a descriptive error', async () => {
      const created = await service.createAutomation(
        manualAutomation({ actions: [{ type: 'teleport' } as unknown as Action] })
      );

      const log = await service.runAutomation(created.id);

      expect(log.status).toBe('error');
      expect(log.error).toBe('Unknown action type: teleport');
    });
  });

  // -------------------------------------------------------------------------
  // Execution semantics
  // -------------------------------------------------------------------------

  describe('runAutomation', () => {
    it('throws for an unknown automation', async () => {
      await expect(service.runAutomation('missing')).rejects.toThrow(
        'Automation missing not found'
      );
    });

    it('runs every action in order', async () => {
      const created = await service.createAutomation(
        manualAutomation({
          actions: [
            { type: 'notification', title: 'first', message: 'm', level: 'info' },
            { type: 'notification', title: 'second', message: 'm', level: 'info' },
            { type: 'notification', title: 'third', message: 'm', level: 'info' },
          ],
        })
      );

      const log = await service.runAutomation(created.id);

      expect(log.actionResults).toHaveLength(3);
      expect(log.actionResults.map((r) => r.output ?? '')).toEqual([
        'Notification sent: first',
        'Notification sent: second',
        'Notification sent: third',
      ]);
    });

    it('stops at the first failing action', async () => {
      const created = await service.createAutomation(
        manualAutomation({
          actions: [
            { type: 'notification', title: 'ok', message: 'm', level: 'info' },
            { type: 'git_operation', operation: 'boom' as 'commit', repoPath: '/repo' },
            { type: 'notification', title: 'never', message: 'm', level: 'info' },
          ],
        })
      );

      const log = await service.runAutomation(created.id);

      expect(log.actionResults).toHaveLength(2);
      expect(log.actionResults[0].status).toBe('success');
      expect(log.actionResults[1].status).toBe('error');
      expect(log.status).toBe('error');
    });

    it('records timing and completion metadata on success', async () => {
      const created = await service.createAutomation(manualAutomation());

      const log = await service.runAutomation(created.id);

      expect(log.automationId).toBe(created.id);
      expect(log.id).toMatch(/^log_\d+_[a-z0-9]+$/);
      expect(log.startedAt).toBeLessThanOrEqual(log.completedAt as number);
      expect(log.actionResults[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('emits started then completed', async () => {
      const created = await service.createAutomation(manualAutomation());
      const order: string[] = [];
      service.on('automation:started', () => order.push('started'));
      service.on('automation:completed', () => order.push('completed'));

      await service.runAutomation(created.id);

      expect(order).toEqual(['started', 'completed']);
    });

    it('emits automation:failed with the error', async () => {
      const created = await service.createAutomation(
        manualAutomation({
          actions: [{ type: 'git_operation', operation: 'bad' as 'commit', repoPath: '/r' }],
        })
      );
      const listener = vi.fn();
      service.on('automation:failed', listener);

      await service.runAutomation(created.id);

      expect(listener).toHaveBeenCalledTimes(1);
      const payload = listener.mock.calls[0][0] as { error: Error; log: AutomationLog };
      expect(payload.error).toBeInstanceOf(Error);
      expect(payload.log.status).toBe('error');
    });

    it('resolves (not rejects) when an action fails', async () => {
      const created = await service.createAutomation(
        manualAutomation({
          actions: [{ type: 'git_operation', operation: 'bad' as 'commit', repoPath: '/r' }],
        })
      );

      const log = await service.runAutomation(created.id);

      expect(log.status).toBe('error');
    });

    it('handles non-Error throwables', async () => {
      const created = await service.createAutomation(
        manualAutomation({
          actions: [{ type: 'ai_task', prompt: 'x', model: 'm', provider: 'openai' }],
        })
      );
      aiSendMessageMock.mockImplementationOnce(async () => {
        throw 'plain string failure';
      });

      const log = await service.runAutomation(created.id);

      expect(log.status).toBe('error');
      expect(log.error).toBe('plain string failure');
    });
  });

  describe('concurrency', () => {
    it('rejects a second concurrent run of the same automation', async () => {
      const created = await service.createAutomation(
        manualAutomation({ actions: [{ type: 'run_script', script: 'sleep' }] })
      );
      spawnBehaviour = (child) => {
        setTimeout(() => child.emit('close', 0), 25);
      };

      const first = service.runAutomation(created.id);
      await expect(service.runAutomation(created.id)).rejects.toThrow('is already running');
      await first;
    });

    it('allows a new run once the previous one finished', async () => {
      const created = await service.createAutomation(manualAutomation());

      await service.runAutomation(created.id);
      const second = await service.runAutomation(created.id);

      expect(second.status).toBe('success');
      expect(service.getAutomationLogs(created.id)).toHaveLength(2);
    });

    it('clears the running flag even after a failure', async () => {
      const created = await service.createAutomation(
        manualAutomation({
          actions: [{ type: 'git_operation', operation: 'bad' as 'commit', repoPath: '/r' }],
        })
      );

      await service.runAutomation(created.id);
      const retry = await service.runAutomation(created.id);

      expect(retry.status).toBe('error');
      expect(service.getAutomationLogs(created.id)).toHaveLength(2);
    });

    it('runs different automations in parallel', async () => {
      const a = await service.createAutomation(manualAutomation({ name: 'a' }));
      const b = await service.createAutomation(manualAutomation({ name: 'b' }));
      spawnBehaviour = (child) => {
        setTimeout(() => child.emit('close', 0), 10);
      };

      const [logA, logB] = await Promise.all([
        service.runAutomation(a.id),
        service.runAutomation(b.id),
      ]);

      expect(logA.status).toBe('success');
      expect(logB.status).toBe('success');
    });
  });

  // -------------------------------------------------------------------------
  // Logs
  // -------------------------------------------------------------------------

  describe('getAutomationLogs', () => {
    it('returns an empty array when nothing ran', async () => {
      const created = await service.createAutomation(manualAutomation());

      expect(service.getAutomationLogs(created.id)).toEqual([]);
    });

    it('returns an empty array for an unknown automation', () => {
      expect(service.getAutomationLogs('missing')).toEqual([]);
    });

    it('accumulates one log per run', async () => {
      const created = await service.createAutomation(manualAutomation());

      await service.runAutomation(created.id);
      await service.runAutomation(created.id);
      await service.runAutomation(created.id);

      expect(service.getAutomationLogs(created.id)).toHaveLength(3);
    });

    it('returns the most recent logs when limited', async () => {
      const created = await service.createAutomation(manualAutomation());
      for (let i = 0; i < 5; i += 1) {
        await service.runAutomation(created.id);
      }
      const all = service.getAutomationLogs(created.id);

      const limited = service.getAutomationLogs(created.id, 2);

      expect(limited).toHaveLength(2);
      expect(limited[1].id).toBe(all[4].id);
    });

    it('keeps logs isolated per automation', async () => {
      const a = await service.createAutomation(manualAutomation({ name: 'a' }));
      const b = await service.createAutomation(manualAutomation({ name: 'b' }));

      await service.runAutomation(a.id);

      expect(service.getAutomationLogs(a.id)).toHaveLength(1);
      expect(service.getAutomationLogs(b.id)).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  describe('cleanup', () => {
    it('closes watchers, stops schedulers and clears state', async () => {
      await service.createAutomation(
        manualAutomation({
          enabled: true,
          trigger: {
            type: 'file_watch',
            patterns: ['**/*'],
            events: ['change'],
            workspacePath: '/repo',
          },
        })
      );
      await service.createAutomation(
        manualAutomation({ enabled: true, trigger: { type: 'schedule', cron: '* * * * *' } })
      );

      await service.cleanup();

      expect(createdWatchers[0].closed).toBe(true);
      expect(createdTasks[0].stopped).toBe(true);
      expect(service.listAutomations()).toEqual([]);
    });

    it('is safe to call twice', async () => {
      await service.createAutomation(manualAutomation());

      await service.cleanup();
      await service.cleanup();

      expect(service.listAutomations()).toEqual([]);
    });

    it('drops logs', async () => {
      const created = await service.createAutomation(manualAutomation());
      await service.runAutomation(created.id);

      await service.cleanup();

      expect(service.getAutomationLogs(created.id)).toEqual([]);
    });
  });

  describe('singleton export', () => {
    it('exposes a shared AutomationService instance', () => {
      expect(automationService).toBeInstanceOf(AutomationService);
      expect(automationService).toBeInstanceOf(EventEmitter);
    });
  });
});
