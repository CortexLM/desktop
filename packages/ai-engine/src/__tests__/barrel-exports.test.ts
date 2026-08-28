import { describe, expect, it } from 'vitest';

import * as root from '../index';
import * as agent from '../agent';
import * as context from '../context';
import * as contextTools from '../context-tools';
import * as orchestration from '../orchestration';

describe('package barrels', () => {
  it('re-exports the public surface', () => {
    expect(root.AIProviderRegistry).toBeTypeOf('function');
    expect(root.runAgentTurn).toBeTypeOf('function');
    expect(root.WorkspaceToolExecutor).toBeTypeOf('function');
    expect(root.UnifiedModelSelector).toBeTypeOf('function');
    expect(agent.InMemoryPermissionGate).toBeTypeOf('function');
    expect(agent.MissionOrchestrator).toBeTypeOf('function');
    expect(context.SimpleMinifier).toBeTypeOf('function');
    expect(contextTools.ContextBudgetManager).toBeTypeOf('function');
    expect(orchestration.AdaptiveRouter).toBeTypeOf('function');
  });
});
