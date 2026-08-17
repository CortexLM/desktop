/**
 * Tool contract tests: schema shape and dispatcher robustness against the
 * malformed arguments a model will eventually produce.
 */

import { CATContextManager } from '../context-manager';
import {
  CONTEXT_TOOL_DEFINITIONS,
  dispatchContextTool,
  getContextToolDefinition,
  isContextToolName,
} from '../tool-definitions';
import { buildTestRepo } from './fixtures';

function makeManager() {
  return new CATContextManager({
    provider: buildTestRepo(),
    maxTokens: 20_000,
    reserveForOutput: 2000,
  });
}

describe('CONTEXT_TOOL_DEFINITIONS', () => {
  it('exposes the four context tools', () => {
    expect(CONTEXT_TOOL_DEFINITIONS.map((d) => d.name)).toEqual([
      'get_more_context',
      'forget_context',
      'summarize_context',
      'search_codebase',
    ]);
  });

  it('gives every tool an object schema and a usable description', () => {
    for (const definition of CONTEXT_TOOL_DEFINITIONS) {
      expect(definition.parameters.type).toBe('object');
      expect(Object.keys(definition.parameters.properties).length).toBeGreaterThan(0);
      // Descriptions must convey when to call, not only what it does.
      expect(definition.description.length).toBeGreaterThan(60);
    }
  });

  it('marks required parameters', () => {
    expect(getContextToolDefinition('forget_context')?.parameters.required).toEqual(['items']);
    expect(getContextToolDefinition('summarize_context')?.parameters.required).toEqual(['range']);
    expect(getContextToolDefinition('search_codebase')?.parameters.required).toEqual(['query']);
    // get_more_context accepts files or symbols, so neither is required alone.
    expect(getContextToolDefinition('get_more_context')?.parameters.required).toBeUndefined();
  });

  it('recognizes tool names', () => {
    expect(isContextToolName('search_codebase')).toBe(true);
    expect(isContextToolName('rm_rf')).toBe(false);
  });
});

describe('dispatchContextTool', () => {
  it('routes a valid call to the manager', async () => {
    const manager = makeManager();
    const result = await dispatchContextTool(manager, 'search_codebase', { query: 'auth session' });

    expect(result.ok).toBe(true);
    expect(result.tool).toBe('search_codebase');
    expect(result.addedItemIds?.length).toBeGreaterThan(0);
  });

  it('accepts a JSON string argument payload', async () => {
    const manager = makeManager();
    const result = await dispatchContextTool(
      manager,
      'get_more_context',
      JSON.stringify({ files: ['src/auth/session.ts'] }),
    );

    expect(result.ok).toBe(true);
    expect(result.tokenDelta).toBeGreaterThan(0);
  });

  it('reports unknown tools without throwing', async () => {
    const manager = makeManager();
    const result = await dispatchContextTool(manager, 'delete_repo', {});

    expect(result.ok).toBe(false);
    expect(result.error).toContain('unknown tool');
    expect(result.message).toContain('Available:');
  });

  it('rejects non-object arguments', async () => {
    const manager = makeManager();

    expect((await dispatchContextTool(manager, 'search_codebase', 'not json')).ok).toBe(false);
    expect((await dispatchContextTool(manager, 'search_codebase', 42)).ok).toBe(false);
    expect((await dispatchContextTool(manager, 'search_codebase', ['a'])).ok).toBe(false);
  });

  it('returns a corrective message for a missing query', async () => {
    const manager = makeManager();
    const result = await dispatchContextTool(manager, 'search_codebase', {});

    expect(result.ok).toBe(false);
    expect(result.message).toContain('`query`');
  });

  it('returns a corrective message for an empty forget list', async () => {
    const manager = makeManager();
    const result = await dispatchContextTool(manager, 'forget_context', { items: [] });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('`items`');
  });

  it('returns a corrective message for a malformed range', async () => {
    const manager = makeManager();

    const bad = await dispatchContextTool(manager, 'summarize_context', { range: 'all' });
    expect(bad.ok).toBe(false);
    expect(bad.message).toContain('`range`');

    const reversed = await dispatchContextTool(manager, 'summarize_context', { range: [5, 1] });
    expect(reversed.ok).toBe(false);
    expect(reversed.message).toContain('must not exceed end');
  });

  it('filters non-string entries out of array arguments', async () => {
    const manager = makeManager();
    const result = await dispatchContextTool(manager, 'get_more_context', {
      files: ['src/auth/session.ts', 42, null],
    });

    expect(result.ok).toBe(true);
    expect(result.addedItemIds).toHaveLength(1);
  });

  it('always returns a budget snapshot, including on failure', async () => {
    const manager = makeManager();
    const result = await dispatchContextTool(manager, 'search_codebase', {});

    expect(result.budget.usable).toBe(18_000);
    expect(result.budget.pressure).toBeDefined();
  });
});
