/**
 * Demonstrates two-tier routing on a simulated workload and prints the measured
 * cost report.
 *
 * Run with: npx tsx src/examples/routing-demo.ts
 */

import { ModelRouter } from '../routing';
import type { ModelChoice } from '../routing';

/** Read-heavy task mix, matching the 60-80% code-reading finding. */
const WORKLOAD: Array<{ prompt: string; tokens: number; needs: 'cheap' | 'mid' | 'expensive' }> = [
  ...Array.from({ length: 60 }, () => ({
    prompt: 'read the file src/providers/base.ts and summarise its exports',
    tokens: 25_000,
    needs: 'cheap' as const,
  })),
  ...Array.from({ length: 10 }, () => ({
    prompt: 'format this file with prettier',
    tokens: 8_000,
    needs: 'cheap' as const,
  })),
  ...Array.from({ length: 20 }, () => ({
    prompt: 'fix the bug where the stream never closes on abort',
    tokens: 30_000,
    needs: 'mid' as const,
  })),
  ...Array.from({ length: 10 }, () => ({
    prompt: 'redesign the architecture of the provider registry',
    tokens: 60_000,
    needs: 'expensive' as const,
  })),
];

const TIER_RANK = { cheap: 0, mid: 1, expensive: 2 };

/** Simulates a model attempt: succeeds once the lane is capable enough. */
async function simulate(
  choice: ModelChoice,
  needs: 'cheap' | 'mid' | 'expensive',
  inputTokens: number
): Promise<{ success: boolean; usage: { inputTokens: number; outputTokens: number } }> {
  const capable = TIER_RANK[choice.tier] >= TIER_RANK[needs];
  return {
    success: capable,
    usage: { inputTokens, outputTokens: capable ? 1_500 : 400 },
  };
}

async function main(): Promise<void> {
  const router = new ModelRouter();

  for (const [i, item] of WORKLOAD.entries()) {
    await router.execute({ id: `task-${i}`, prompt: item.prompt, estimatedTokens: item.tokens }, (choice) =>
      simulate(choice, item.needs, item.tokens)
    );
  }

  const summary = router.getCostSummary();

  console.log(router.formatCostReport());
  console.log('');
  console.log(`Target: -70% on simple tasks`);
  console.log(`Actual: -${(summary.savingsRatio * 100).toFixed(1)}% overall`);

  const simple = router.getCostReport().byComplexity['simple'];
  if (simple) {
    console.log(`        -${(simple.savingsRatio * 100).toFixed(1)}% on simple tasks`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
});
