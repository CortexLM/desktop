/**
 * Profiling mémoire manuel - AutomationService
 *
 * Exécute N automations avec action AI et compare le heap avant/après GC.
 * Sert de vérification out-of-band des tests unitaires (qui mesurent les
 * octets retenus de façon déterministe plutôt que le heap, trop bruité).
 *
 * Usage:
 *   bun scripts/profile-automation-memory.ts [iterations]
 *
 * Deliberately NOT a test file and deliberately still on bun: it is the only
 * remaining `bun:test` consumer in the repo. Vitest is the single *test* runner
 * (see the root vitest.config.ts and `bun run test:discovery`); this is a manual
 * out-of-band profiler invoked by hand, matches no test glob, and runs in no CI
 * job. It uses `mock.module` for its heap comparison, which vitest's `vi.mock`
 * cannot replicate outside a test worker. If it ever needs to run in CI, it has
 * to be rewritten as a vitest test rather than added to a pipeline as-is.
 */

import { AIService } from '../src/services/ai-service';

const ITERATIONS = Number(process.argv[2] ?? 1000);
const RESPONSE_SIZE = 32 * 1024;

let counter = 0;
function nextResponse(): string {
  counter += 1;
  return `${counter}:`.padEnd(RESPONSE_SIZE, 'x');
}

const registry = {
  getProviderIds: () => ['anthropic'],
  getProvider: () => ({
    id: 'anthropic',
    name: 'stub',
    isAvailable: () => Promise.resolve(true),
    chat: () =>
      Promise.resolve({
        content: nextResponse(),
        model: 'stub',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      }),
    stream: async function* () {
      yield { content: nextResponse(), done: true };
    },
  }),
};

const aiService = new AIService(registry as never);

// Les exports ESM sont en lecture seule : on intercepte le module pour que
// `getAIService()` renvoie notre instance stub.
const { mock } = await import('bun:test');
mock.module('../src/services/ai-service', () => ({
  getAIService: () => aiService,
  AIService,
}));

const { AutomationService } = await import('../src/services/automation-service');

const service = new AutomationService();

const automation = await service.createAutomation({
  workspaceId: 'ws-profile',
  name: 'profile',
  enabled: true,
  trigger: { type: 'manual' },
  actions: [
    { type: 'ai_task', prompt: 'go', model: 'stub', provider: 'anthropic' },
  ],
});

function gc() {
  if (typeof Bun !== 'undefined' && typeof Bun.gc === 'function') Bun.gc(true);
  else if (typeof globalThis.gc === 'function') globalThis.gc();
}

function mb(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(2);
}

function retainedContentBytes(): number {
  return aiService
    .getAllSessions()
    .reduce(
      (total, s) => total + s.messages.reduce((sum, m) => sum + m.content.length, 0),
      0
    );
}

// Warmup
for (let i = 0; i < 50; i++) await service.runAutomation(automation.id);
gc();

const heapBefore = process.memoryUsage().heapUsed;
const sessionsBefore = aiService.getAllSessions().length;

const start = Date.now();
for (let i = 0; i < ITERATIONS; i++) {
  await service.runAutomation(automation.id);
}
const elapsed = Date.now() - start;

gc();
const heapAfter = process.memoryUsage().heapUsed;

console.log('='.repeat(64));
console.log(`Profiling mémoire AutomationService — ${ITERATIONS} exécutions`);
console.log('='.repeat(64));
console.log(`Durée                     : ${elapsed} ms (${(elapsed / ITERATIONS).toFixed(2)} ms/run)`);
console.log(`Heap avant                : ${mb(heapBefore)} MB`);
console.log(`Heap après                : ${mb(heapAfter)} MB`);
console.log(`Delta heap                : ${mb(heapAfter - heapBefore)} MB`);
console.log(`Sessions AI avant         : ${sessionsBefore}`);
console.log(`Sessions AI après         : ${aiService.getAllSessions().length}`);
console.log(`Sessions suivies (service): ${service.getActiveAISessionCount()}`);
console.log(`Contenu AI retenu         : ${mb(retainedContentBytes())} MB`);
console.log(`Logs conservés            : ${service.getAutomationLogs(automation.id, 1e6).length}`);

// Verdict mesuré AVANT dispose() : dispose() nettoie de toute façon, il
// masquerait donc une fuite pendant l'exécution normale.
const leaked = aiService.getAllSessions().length;
const leakedBytes = retainedContentBytes();

await service.dispose();
aiService.cleanup();

console.log('='.repeat(64));
console.log(
  leaked === 0
    ? '✅ Aucune session fuitée pendant l\'exécution'
    : `❌ ${leaked} sessions fuitées (${mb(leakedBytes)} MB retenus)`
);
process.exit(leaked === 0 ? 0 : 1);
