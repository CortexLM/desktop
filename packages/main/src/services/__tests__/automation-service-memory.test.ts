/**
 * Tests de fuite mémoire - AutomationService
 *
 * Vérifie que les ressources créées pendant l'exécution d'une automation
 * (sessions AI, logs, watchers, schedulers, listeners) sont bien libérées.
 *
 * Régression couverte : `executeAITaskAction` créait une session AI par
 * exécution sans jamais la supprimer => la Map de sessions du AIService
 * grossissait indéfiniment (avec tout l'historique de messages).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AIService } from '../ai-service';

// ============================================================================
// Stub registry / provider : évite tout appel réseau
// ============================================================================

const RESPONSE_SIZE_BYTES = 32 * 1024;

/**
 * Génère une réponse volumineuse et *unique* à chaque appel, comme un vrai LLM.
 * Important pour le test mémoire : une constante partagée serait référencée par
 * toutes les sessions et ne produirait aucune croissance de heap mesurable.
 */
let responseCounter = 0;
function nextStubResponse(): string {
  responseCounter += 1;
  return `${responseCounter}:`.padEnd(RESPONSE_SIZE_BYTES, 'x');
}

function createStubRegistry() {
  const provider = {
    id: 'anthropic',
    name: 'Anthropic (stub)',
    isAvailable: () => Promise.resolve(true),
    chat: () =>
      Promise.resolve({
        content: nextStubResponse(),
        model: 'stub-model',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      }),
    stream: async function* () {
      yield { content: nextStubResponse(), done: true };
    },
  };

  return {
    getProviderIds: () => ['anthropic'],
    getProvider: (id: string) => (id === 'anthropic' ? provider : undefined),
  };
}

// Le AutomationService récupère le AIService via getAIService() : on branche
// une vraie instance AIService (avec registry stub) pour tester le vrai
// chemin de suppression de session.
let aiService: AIService;

// Only `getAIService` is redirected: spreading `importOriginal()` keeps the
// genuine `AIService` class (which this file imports) and every other export
// intact. A factory returning just `getAIService` would drop the rest and break
// this module's own `import { AIService }` at link time.
//
// `getAIService` reads the mutable `aiService` binding at call time, so the
// per-test instance assigned in `beforeEach` is the one the service under test
// receives — even though this factory runs once, before any test body.
vi.mock('../ai-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../ai-service')>()),
  getAIService: () => aiService,
}));

// Import après le mock pour que automation-service résolve le module mocké
const { AutomationService, MAX_LOGS_PER_AUTOMATION } = await import('../automation-service');
type AutomationServiceType = InstanceType<typeof AutomationService>;

const AI_TASK_AUTOMATION = {
  workspaceId: 'ws-leak',
  name: 'AI task automation',
  enabled: true,
  trigger: { type: 'manual' as const },
  actions: [
    {
      type: 'ai_task' as const,
      prompt: 'Analyse ce changement',
      model: 'stub-model',
      provider: 'anthropic' as const,
    },
  ],
};

describe('AutomationService - fuites mémoire', () => {
  let service: AutomationServiceType;

  beforeEach(() => {
    aiService = new AIService(createStubRegistry() as never);
    service = new AutomationService();
  });

  afterEach(async () => {
    await service.dispose();
    aiService.cleanup();
  });

  describe('sessions AI', () => {
    it('supprime la session AI après une exécution réussie', async () => {
      const automation = await service.createAutomation(AI_TASK_AUTOMATION);

      const log = await service.runAutomation(automation.id);

      expect(log.status).toBe('success');
      expect(aiService.getAllSessions()).toHaveLength(0);
      expect(service.getActiveAISessionCount()).toBe(0);
    });

    it('supprime la session AI même si le provider échoue', async () => {
      const failing = new AIService({
        getProviderIds: () => ['anthropic'],
        getProvider: () => ({
          id: 'anthropic',
          name: 'failing',
          isAvailable: () => Promise.resolve(true),
          chat: () => Promise.reject(new Error('provider exploded')),
          stream: async function* () {
            throw new Error('provider exploded');
          },
        }),
      } as never);
      aiService = failing;

      const automation = await service.createAutomation(AI_TASK_AUTOMATION);
      const log = await service.runAutomation(automation.id);

      // L'action échoue...
      expect(log.status).toBe('error');
      // ...mais la session est quand même nettoyée (bloc finally)
      expect(failing.getAllSessions()).toHaveLength(0);
      expect(service.getActiveAISessionCount()).toBe(0);

      failing.cleanup();
    });

    it('ne laisse aucune session après 1000 exécutions', async () => {
      const automation = await service.createAutomation(AI_TASK_AUTOMATION);

      const ITERATIONS = 1000;
      for (let i = 0; i < ITERATIONS; i++) {
        const log = await service.runAutomation(automation.id);
        expect(log.status).toBe('success');
      }

      // Le cœur du bug : avant le fix, 1000 sessions restaient en mémoire
      expect(aiService.getAllSessions()).toHaveLength(0);
      expect(service.getActiveAISessionCount()).toBe(0);
    }, 60_000);

    it('ne retient aucun octet de contenu AI après 1000 exécutions', async () => {
      const automation = await service.createAutomation(AI_TASK_AUTOMATION);

      const ITERATIONS = 1000;
      for (let i = 0; i < ITERATIONS; i++) {
        await service.runAutomation(automation.id);
      }

      // Mesure déterministe de l'empreinte mémoire : somme du contenu des
      // messages encore retenus par le AIService. `heapUsed` est trop bruité
      // (GC non déterministe) pour être assertable de façon fiable.
      const retainedBytes = aiService
        .getAllSessions()
        .reduce(
          (total, session) =>
            total + session.messages.reduce((sum, msg) => sum + msg.content.length, 0),
          0
        );

      // Sans le fix : ~1000 sessions × (prompt + réponse 32 Ko) ≈ 32 Mo retenus
      expect(retainedBytes).toBe(0);
      expect(aiService.getAllSessions()).toHaveLength(0);
    }, 60_000);

    it('supprime les sessions restantes lors du cleanup', async () => {
      // Simule une session orpheline (run interrompu par un arrêt de l'app)
      const orphan = await aiService.createSession('anthropic', 'stub-model');
      // @ts-expect-error accès au champ privé pour reproduire l'état
      service.activeAISessions.add(orphan.id);

      expect(aiService.getAllSessions()).toHaveLength(1);

      await service.cleanup();

      expect(aiService.getAllSessions()).toHaveLength(0);
      expect(service.getActiveAISessionCount()).toBe(0);
    });
  });

  describe('logs', () => {
    it('borne le nombre de logs conservés par automation', async () => {
      const automation = await service.createAutomation({
        ...AI_TASK_AUTOMATION,
        actions: [
          { type: 'notification', title: 'hi', message: 'msg', level: 'info' },
        ],
      });

      const runs = MAX_LOGS_PER_AUTOMATION + 50;
      for (let i = 0; i < runs; i++) {
        await service.runAutomation(automation.id);
      }

      const logs = service.getAutomationLogs(automation.id, 10_000);
      expect(logs).toHaveLength(MAX_LOGS_PER_AUTOMATION);
    }, 30_000);

    it('conserve les logs les plus récents', async () => {
      const automation = await service.createAutomation({
        ...AI_TASK_AUTOMATION,
        actions: [
          { type: 'notification', title: 'hi', message: 'msg', level: 'info' },
        ],
      });

      const firstLog = await service.runAutomation(automation.id);

      for (let i = 0; i < MAX_LOGS_PER_AUTOMATION + 10; i++) {
        await service.runAutomation(automation.id);
      }

      const logs = service.getAutomationLogs(automation.id, 10_000);
      expect(logs.some((log) => log.id === firstLog.id)).toBe(false);
    }, 30_000);

    it('supprime les logs quand l\'automation est supprimée', async () => {
      const automation = await service.createAutomation({
        ...AI_TASK_AUTOMATION,
        actions: [
          { type: 'notification', title: 'hi', message: 'msg', level: 'info' },
        ],
      });

      await service.runAutomation(automation.id);
      expect(service.getAutomationLogs(automation.id)).toHaveLength(1);

      await service.deleteAutomation(automation.id);

      expect(service.getAutomationLogs(automation.id)).toHaveLength(0);
    });
  });

  describe('dispose', () => {
    it('retire les listeners et vide les collections', async () => {
      const automation = await service.createAutomation(AI_TASK_AUTOMATION);
      service.on('automation:started', () => {});
      expect(service.listenerCount('automation:started')).toBe(1);

      await service.dispose();

      expect(service.listenerCount('automation:started')).toBe(0);
      expect(service.listAutomations()).toHaveLength(0);
      expect(service.getAutomation(automation.id)).toBeUndefined();
    });

    it('est idempotent', async () => {
      await service.createAutomation(AI_TASK_AUTOMATION);

      await service.dispose();
      await service.dispose();

      expect(service.listAutomations()).toHaveLength(0);
    });
  });
});
