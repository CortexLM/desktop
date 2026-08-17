/**
 * Demonstrates the composed decision: user intent, task complexity and
 * infrastructure state applied in order, on the same task.
 *
 * Run with: npx tsx src/examples/composed-selection-demo.ts
 */

import { InfraAwareOrchestrator } from '../orchestration';
import { DEFAULT_PROVIDER_CAPACITIES } from '../orchestration/registry-adapter';
import { createUnifiedModelSelector } from '../model-selection';
import type { SelectionDecision } from '../model-selection';
import type { Task } from '../routing';

function show(label: string, decision: SelectionDecision): void {
  const target = decision.provider ? `${decision.provider}/${decision.model}` : '(nothing callable)';
  console.log(`\n${label}`);
  console.log(`  lane      ${decision.proposedTier} proposed -> ${decision.tier} selected`);
  console.log(`  target    ${target}`);
  console.log(`  deviation ${decision.deviation}`);
  console.log(`  why       ${decision.reason}`);
}

function saturate(orchestrator: InfraAwareOrchestrator, providerId: string): void {
  const capacity = orchestrator.monitor.getCapacity(providerId);
  if (!capacity) return;
  for (let i = 0; i < capacity.maxConcurrency; i += 1) {
    orchestrator.monitor.startRequest(providerId, 100);
  }
}

function main(): void {
  const orchestrator = new InfraAwareOrchestrator();
  for (const id of ['openrouter', 'anthropic', 'openai']) {
    orchestrator.registerProvider(id, DEFAULT_PROVIDER_CAPACITIES[id]!);
  }

  const selector = createUnifiedModelSelector({ orchestrator });
  const trivial: Task = { id: 'demo-1', prompt: 'format this file with prettier' };

  console.log('=== 1. Task complexity alone ===');
  show('trivial task, healthy infrastructure, no preset', selector.select({ task: trivial }));

  console.log('\n=== 2. Adding user intent ===');
  show('same task, preset=reasoning', selector.select({ preset: 'reasoning', task: trivial }));
  show('same task, preset=cheapest', selector.select({ preset: 'cheapest', task: trivial }));

  console.log('\n=== 3. Adding infrastructure state ===');
  saturate(orchestrator, 'openrouter');
  show(
    'cheap lane saturated, no preset -> lane shift',
    selector.select({ task: trivial })
  );
  show(
    'cheap lane saturated, preset=cheapest -> refuses to overspend',
    selector.select({ preset: 'cheapest', task: trivial })
  );

  console.log('\n=== 4. Context size overrides lane economics ===');
  const orchestrator2 = new InfraAwareOrchestrator();
  for (const id of ['openrouter', 'anthropic', 'openai']) {
    orchestrator2.registerProvider(id, DEFAULT_PROVIDER_CAPACITIES[id]!);
  }
  const selector2 = createUnifiedModelSelector({ orchestrator: orchestrator2 });
  show(
    '500k-token task: only the cheap lane has a 1M window',
    selector2.select({ task: { id: 'demo-2', prompt: 'fix the bug', estimatedTokens: 500_000 } })
  );
}

main();
