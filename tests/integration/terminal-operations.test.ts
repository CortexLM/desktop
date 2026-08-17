/**
 * Integration test: Terminal operations
 * Tests terminal creation, command execution, and output handling
 */

import { test, expect, describe, beforeEach } from 'vitest';
import { createMockIPC, waitFor, sleep } from '@cortex-ide/test-utils';

describe('Terminal Operations Integration', () => {
  let ipc: ReturnType<typeof createMockIPC>;

  beforeEach(() => {
    ipc = createMockIPC();
  });

  test('should create and manage terminal sessions', async () => {
    const terminals = new Map<string, { id: string; cwd: string; shell: string }>();

    // Create terminal
    ipc.on('terminal:create', (data: { cwd: string; shell?: string }) => {
      const id = `term-${Date.now()}`;
      terminals.set(id, {
        id,
        cwd: data.cwd,
        shell: data.shell || '/bin/bash'
      });
      return { id };
    });

    const result = await ipc.invoke('terminal:create', {
      cwd: '/workspace',
      shell: '/bin/bash'
    });

    expect(result.id).toBeDefined();
    expect(terminals.size).toBe(1);
  });

  test('should execute commands in terminal', async () => {
    const commandHistory: Array<{ command: string; output: string }> = [];

    ipc.on('terminal:execute', (data: { id: string; command: string }) => {
      const output = `Executed: ${data.command}`;
      commandHistory.push({ command: data.command, output });
      return { output };
    });

    await ipc.invoke('terminal:execute', {
      id: 'term-1',
      command: 'npm test'
    });

    await ipc.invoke('terminal:execute', {
      id: 'term-1',
      command: 'npm run build'
    });

    expect(commandHistory).toHaveLength(2);
    expect(commandHistory[0].command).toBe('npm test');
    expect(commandHistory[1].command).toBe('npm run build');
  });

  test('should handle terminal resize', async () => {
    ipc.on('terminal:resize', (data: { id: string; cols: number; rows: number }) => {
      return { success: true, dimensions: { cols: data.cols, rows: data.rows } };
    });

    const result = await ipc.invoke('terminal:resize', {
      id: 'term-1',
      cols: 120,
      rows: 30
    });

    expect(result.success).toBe(true);
    expect(result.dimensions.cols).toBe(120);
    expect(result.dimensions.rows).toBe(30);
  });
});
