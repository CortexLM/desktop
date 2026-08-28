import { describe, expect, it } from 'vitest';

import {
  autonomyAllowsExecute,
  executeBand,
  isBlockedCommand,
  isForbiddenShellWrite,
  resolveAutonomy,
  toolsForPolicy,
} from '../autonomy';
import type { ToolDefinition } from '../types';

const schema = { type: 'object' as const, properties: {} };
const tools: ToolDefinition[] = [
  { name: 'Read', description: 'read', risk: 'safe', parameters: schema },
  { name: 'Create', description: 'write', risk: 'write', parameters: schema },
  { name: 'Execute', description: 'shell', risk: 'exec', parameters: schema },
  { name: 'AskUser', description: 'ask', risk: 'safe', parameters: schema },
];

describe('executeBand', () => {
  it('classifies blocked, off, low, medium, and high commands', () => {
    expect(executeBand('git push --force origin main')).toBe('blocked');
    expect(executeBand('sed -i s/a/b/ file')).toBe('blocked');
    expect(executeBand('git status')).toBe('off');
    expect(executeBand('bun run test')).toBe('low');
    expect(executeBand('mkdir foo')).toBe('medium');
    expect(executeBand('curl https://example.com')).toBe('high');
  });
});

describe('isBlockedCommand / isForbiddenShellWrite', () => {
  it('matches representative never-run and file-write patterns', () => {
    expect(isBlockedCommand('git push --force origin main')).toBe(true);
    expect(isBlockedCommand('git reset --hard')).toBe(true);
    expect(isBlockedCommand('drop table users')).toBe(true);
    expect(isBlockedCommand('chmod -R 777 /tmp')).toBe(true);
    expect(isBlockedCommand('ls')).toBe(false);
    expect(isForbiddenShellWrite('sed -i s/a/b/ file')).toBe(true);
    expect(isForbiddenShellWrite('tee out.txt')).toBe(true);
    expect(isForbiddenShellWrite('echo hello')).toBe(false);
  });
});

describe('autonomyAllowsExecute', () => {
  it('narrows the allowed band by level', () => {
    expect(autonomyAllowsExecute('off', 'git status')).toBe(true);
    expect(autonomyAllowsExecute('off', 'bun run test')).toBe(false);
    expect(autonomyAllowsExecute('low', 'bun run test')).toBe(true);
    expect(autonomyAllowsExecute('low', 'bun add x')).toBe(false);
    expect(autonomyAllowsExecute('medium', 'mkdir foo')).toBe(true);
    expect(autonomyAllowsExecute('medium', 'curl https://x')).toBe(false);
    expect(autonomyAllowsExecute('high', 'curl https://x')).toBe(true);
    expect(autonomyAllowsExecute('high', 'git push --force origin main')).toBe(false);
  });
});

describe('toolsForPolicy', () => {
  it('hides mutators in plan mode and when autonomy is off', () => {
    const plan = toolsForPolicy(tools, { mode: 'plan' }).map((tool) => tool.name);
    expect(plan).toContain('Read');
    expect(plan).not.toContain('Create');

    const off = toolsForPolicy(tools, { autonomy: 'off' }).map((tool) => tool.name);
    expect(off).toContain('Execute');
    expect(off).not.toContain('Create');
    expect(off).toContain('Read');

    const ask = toolsForPolicy(tools, { mode: 'ask' }).map((tool) => tool.name);
    expect(ask).not.toContain('Create');
    expect(toolsForPolicy(tools, { autonomy: 'medium' }).map((tool) => tool.name)).toContain('Create');
  });
});

describe('resolveAutonomy', () => {
  it('prefers an explicit override then the runtime default', () => {
    expect(resolveAutonomy('interactive', 'high')).toBe('high');
    expect(resolveAutonomy('interactive')).toBe('medium');
    expect(resolveAutonomy('headless')).toBe('off');
    expect(resolveAutonomy(undefined)).toBe('medium');
  });
});
