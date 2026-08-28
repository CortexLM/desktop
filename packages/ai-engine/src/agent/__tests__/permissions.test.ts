import { describe, expect, it } from 'vitest';

import {
  InMemoryPermissionGate,
  matchRules,
  riskForTool,
  summarizeCall,
  targetForCall,
} from '../permissions';
import type { ToolDefinition } from '../types';

const schema = { type: 'object' as const, properties: {} };

describe('InMemoryPermissionGate', () => {
  it('allows always, matched rules, and safe tools', async () => {
    const gate = new InMemoryPermissionGate({
      autoAllowSafe: true,
      alwaysAllow: ['Read'],
      rules: [{ action: 'deny', tool: 'Execute', pattern: 'rm *' }],
    });
    expect(
      await gate.decide({ id: '1', tool: 'Read', risk: 'safe', summary: 'Read a.ts', path: 'a.ts' }),
    ).toBe('allow-always');
    expect(
      await gate.decide({
        id: '2',
        tool: 'Execute',
        risk: 'exec',
        summary: 'rm',
        path: 'rm -rf /',
      }),
    ).toBe('deny');
    expect(await gate.decide({ id: '3', tool: 'Grep', risk: 'safe', summary: 'Grep' })).toBe(
      'allow-once',
    );
  });

  it('resolves a pending ask and remembers allow-always', async () => {
    const requests: Array<{ id: string }> = [];
    const gate = new InMemoryPermissionGate({
      autoAllowSafe: false,
      onRequest: (request) => requests.push(request),
    });
    const pending = gate.decide({
      id: 'ask',
      tool: 'Create',
      risk: 'write',
      summary: 'Create a.ts',
      path: 'a.ts',
    });
    expect(requests).toHaveLength(1);
    gate.resolve('ask', 'allow-always');
    await expect(pending).resolves.toBe('allow-always');
    expect(
      await gate.decide({
        id: 'later',
        tool: 'Create',
        risk: 'write',
        summary: 'Create a.ts',
        path: 'a.ts',
      }),
    ).toBe('allow-always');
    gate.resolve('missing', 'deny');
  });

  it('scopes rules to an agent name', async () => {
    const gate = new InMemoryPermissionGate({
      autoAllowSafe: false,
      agentName: 'scout',
      rules: [{ action: 'allow', tool: 'Create', agent: 'scout' }],
    });
    gate.setAgentName('scout');
    gate.addRule({ action: 'deny', tool: 'Execute' });
    expect(
      await gate.decide({
        id: '1',
        tool: 'Create',
        risk: 'write',
        summary: 'Create',
        agent: 'scout',
      }),
    ).toBe('allow-once');
    expect(
      await gate.decide({
        id: '2',
        tool: 'Execute',
        risk: 'exec',
        summary: 'Execute',
        agent: 'scout',
      }),
    ).toBe('deny');
  });
});

describe('permission helpers', () => {
  it('matches glob rules and summarizes a call', () => {
    expect(matchRules([{ action: 'deny', tool: 'Read', pattern: 'src/**' }], 'Read', 'src/a.ts')).toBe(
      'deny',
    );
    expect(matchRules([{ action: 'allow', tool: '*', agent: 'other' }], 'Read', 'a.ts', 'scout')).toBe(
      null,
    );
    expect(matchRules([{ action: 'deny', tool: 'Read', agent: 'scout' }], 'Read', 'a.ts')).toBe(null);
    expect(matchRules([{ action: 'allow', tool: 'Edit' }], 'Read', 'a.ts')).toBe(null);
    const tool: ToolDefinition = { name: 'Read', description: '', risk: 'safe', parameters: schema };
    expect(riskForTool(tool)).toBe('safe');
    expect(riskForTool(undefined)).toBe('exec');
    expect(summarizeCall('Read', { path: 'a.ts' })).toBe('Read a.ts');
    expect(summarizeCall('Execute', { command: 'ls' })).toBe('Execute ls');
    expect(summarizeCall('FetchUrl', { url: 'https://x' })).toBe('FetchUrl https://x');
    expect(summarizeCall('AskUser', {})).toBe('AskUser');
    expect(targetForCall({ path: 'a.ts' })).toBe('a.ts');
    expect(targetForCall({ command: 'ls' })).toBe('ls');
    expect(targetForCall({ url: 'https://x' })).toBe('https://x');
    expect(targetForCall({})).toBeUndefined();
  });
});
