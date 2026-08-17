# Anti-Patterns à Éviter dans Cortex IDE

**Date:** 16 août 2026  
**Objectif:** Documenter les erreurs passées pour ne pas les répéter

---

## 🚨 Introduction

Ce document liste les anti-patterns identifiés pendant l'audit d'architecture d'août 2026. Ces patterns ont mené à 5,000 lignes de code inutilisé et 93% de complexité superflue.

**Règle d'or:** Si vous vous reconnaissez dans un de ces patterns, **STOP** et repensez votre approche.

---

## 1. 🎭 Architecture Astronaut

### ❌ Anti-Pattern

Construire une architecture "sophisticated" inspirée d'articles/talks sans validation empirique.

```typescript
// ❌ BAD - Over-engineered
class BackgroundAgentManager {
  private workerPool: WorkerPool;           // Multi-threading pour I/O-bound (inutile)
  private priorityQueue: PriorityQueue;     // 3 priorités jamais utilisées
  private checkpointManager: CheckpointManager;  // Sauvegarde toutes les 5min (tâches <2min)
  private sharedContextStore: SharedStore;  // Redis-like in-memory (overkill)
  private eventBus: EventEmitter;          // Pub/sub jamais utilisé
  private resourceMonitor: ResourceMonitor; // CPU/memory tracking (nice-to-have)
  private agentLogger: StructuredLogger;   // Structured logging (nice-to-have)
  
  // 2,000 lignes de complexité
  // 0 instanciation en production
  // 0 bénéfice mesuré
}
```

```typescript
// ✅ GOOD - Simple et efficace
class SimpleAgentQueue {
  private queue: AgentTask[] = [];
  private running: AgentTask | null = null;

  async enqueue(task: AgentTask): Promise<void> {
    this.queue.push(task);
    if (!this.running) await this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.queue.length === 0) return;
    this.running = this.queue.shift()!;
    try {
      await this.running.execute();
    } finally {
      this.running = null;
      await this.processNext();
    }
  }
  
  // 100 lignes
  // Fait 95% du job
  // Simple à tester
}
```

**Signes d'alerte:**
- "Inspiré de [système complexe X]" sans justification
- Diagrammes avec >5 niveaux d'abstraction
- Phrases comme "scalable", "enterprise-grade", "production-ready" sans metrics

**Remède:**
1. Commencer par la solution la plus simple
2. Mesurer le problème réel (pas théorique)
3. Ajouter complexité SEULEMENT si metrics le justifient

---

## 2. 🔮 Optimisation Prématurée

### ❌ Anti-Pattern

Optimiser pour des problèmes qui n'existent pas encore.

```typescript
// ❌ BAD - Cache "optimisé" jamais utilisé
class PromptCacheManager {
  private l1Cache: LRUCache;  // System prompts (24h TTL)
  private l2Cache: LRUCache;  // Project context (4h TTL)
  private l3Cache: LRUCache;  // File context (30min TTL)
  
  async getCached(prompt: string, level: CacheLevel): Promise<CachedPrompt | null> {
    // Logic pour choisir le bon niveau
    // Persistence à disque
    // Provider-specific optimizations
    // ...
    
    // Problème: Pas appelé en production
    // Économie mesurée: 3.3% (vs 60% espéré)
  }
}
```

```typescript
// ✅ GOOD - Utiliser cache natif du provider
const messages = [
  { 
    role: 'system', 
    content: systemPrompt,
    cache_control: { type: 'ephemeral' }  // Anthropic gère le cache
  },
  { role: 'user', content: userMessage }
];

// 0 ligne de code custom
// Fonctionne out-of-the-box
// Maintenu par Anthropic
```

**Signes d'alerte:**
- "Au cas où on en aurait besoin plus tard"
- Benchmarks sans contexte réel d'utilisation
- Optimisation basée sur hypothèses (pas mesures)

**Remède:**
1. Mesurer AVANT d'optimiser
2. Identifier le bottleneck réel (profiling)
3. Optimiser ce qui a le plus d'impact mesuré

**Citation:**
> "Premature optimization is the root of all evil" - Donald Knuth

---

## 3. 🎪 Feature Factory

### ❌ Anti-Pattern

Ajouter des features "cool" sans besoin utilisateur validé.

```typescript
// ❌ BAD - Context prediction ML sans historique
class ContextPredictor {
  private mlModel: NeuralNetwork;
  private history: Array<{ query: string; selected: string[] }> = [];
  
  async predict(query: string): Promise<string[]> {
    // 200 lignes de ML
    
    // Problèmes:
    // - Cold start: 0 historique = 0 valeur
    // - Nécessite 1000+ requêtes pour être utile
    // - Overhead: 50ms par prédiction
    // - Confiance faible (<40%) sans historique
  }
}
```

```typescript
// ✅ GOOD - Simple keyword matching qui marche
function scoreChunks(chunks: Chunk[], query: string): Chunk[] {
  const keywords = query.toLowerCase().split(' ');
  
  return chunks
    .map(chunk => ({
      chunk,
      score: keywords.filter(kw => 
        chunk.content.toLowerCase().includes(kw)
      ).length
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ chunk }) => chunk);
  
  // 20 lignes
  // intégrité des frontières nettement meilleure que le split naïf (métrique structurelle ; chiffre à re-mesurer, voir packages/ai-engine/src/context/README.md)
  // 0ms overhead
  // Fonctionne immédiatement (pas de cold start)
}
```

**Signes d'alerte:**
- "Ce serait cool si..."
- Features copiées de la compétition sans comprendre le pourquoi
- Pas de user story ou use case concret

**Remède:**
1. Valider le besoin utilisateur (interviews, metrics)
2. MVP minimum pour tester l'hypothèse
3. Mesurer l'adoption avant d'investir plus

---

## 4. 🏗️ Gold Plating

### ❌ Anti-Pattern

Ajouter des niveaux d'abstraction "pour la flexibilité future".

```typescript
// ❌ BAD - Abstraction pour abstraction
interface IContextStrategy {
  select(chunks: Chunk[], budget: number): Promise<Chunk[]>;
}

class SlidingWindowStrategy implements IContextStrategy { /* ... */ }
class SemanticChunkingStrategy implements IContextStrategy { /* ... */ }
class IncrementalContextStrategy implements IContextStrategy { /* ... */ }

class ContextManager {
  private strategies: Map<string, IContextStrategy>;
  private predictor: ContextPredictor;  // Choisit la strategy
  
  async selectOptimal(chunks: Chunk[], budget: number): Promise<Chunk[]> {
    // Auto-sélection basée sur heuristiques
    const strategy = await this.predictor.predictBestStrategy();
    return strategy.select(chunks, budget);
    
    // Overhead cumulé de tous les checks
    // Utilisateur ne peut pas choisir manuellement
    // Complexité: 1,200 lignes
  }
}
```

```typescript
// ✅ GOOD - Une stratégie qui marche
class SmartChunker {
  selectRelevantChunks(chunks: Chunk[], budget: number, query?: string): Chunk[] {
    const graph = this.buildDependencyGraph(chunks);
    const scored = this.scoreChunks(chunks, query);
    return this.selectWithDependencies(scored, graph, budget);
    
    // Pas d'abstraction inutile
    // Fait le job efficacement
    // 250 lignes
  }
}
```

**Signes d'alerte:**
- Interfaces avec un seul implémentation
- Patterns GoF appliqués "par principe"
- "On pourrait avoir besoin de X dans le futur"

**Remède:**
1. YAGNI (You Aren't Gonna Need It)
2. Ajouter abstraction QUAND il y a >2 implémentations réelles
3. Refactorer vers abstraction au besoin (pas upfront)

---

## 5. 🤹 Swiss Army Knife

### ❌ Anti-Pattern

Un module qui fait tout (violation Single Responsibility Principle).

```typescript
// ❌ BAD - God Object
class ContextManager {
  // Trop de responsabilités:
  selectChunks() {}           // Sélection
  predictContext() {}         // Prédiction ML
  calculateDiff() {}          // Differential context
  compress() {}               // Compression
  cache() {}                  // Cache management
  autoSelect() {}             // Auto-strategy selection
  
  // 1,200 lignes
  // Impossible à tester unitairement
  // Couplage fort entre toutes les fonctions
}
```

```typescript
// ✅ GOOD - Single Responsibility
class SmartChunker {
  // Une seule responsabilité: sélectionner chunks pertinents
  selectRelevantChunks(chunks: Chunk[], budget: number, query?: string): Chunk[] {
    // ...
  }
}

function minifyCode(code: string): string {
  // Responsabilité: minifier code
  // Séparé du chunker
}
```

**Signes d'alerte:**
- Classe avec >10 méthodes publiques
- Fichier >500 lignes
- Nom vague ("Manager", "Service", "Handler", "Util")

**Remède:**
1. Décomposer en modules avec une seule responsabilité
2. Chaque classe/fonction fait UNE chose bien
3. Nom descriptif de la responsabilité

---

## 6. 🎨 Resume-Driven Development

### ❌ Anti-Pattern

Utiliser une techno "cool" pour le CV, pas pour résoudre un problème.

```typescript
// ❌ BAD - ML parce que c'est cool
class ContextPredictor {
  private neuralNetwork: TensorFlow;
  private reinforcementLearning: RLAgent;
  private transformerModel: BERT;
  
  async predict(query: string): Promise<Prediction> {
    // 500 lignes de ML complexe
    // Résultat: worse que simple keyword matching
    // Maintenance: impossible sans ML expert
  }
}
```

```typescript
// ✅ GOOD - Solution appropriée au problème
function scoreChunks(chunks: Chunk[], query: string): ScoredChunk[] {
  // TF-IDF: simple, efficace, compréhensible
  // intégrité des frontières nettement meilleure que le split naïf (métrique structurelle ; chiffre à re-mesurer, voir packages/ai-engine/src/context/README.md)
  // Maintenable par toute l'équipe
}
```

**Signes d'alerte:**
- "On pourrait utiliser [techno hype]"
- Buzzwords: blockchain, ML, microservices sans justification
- Solution plus complexe qu'elle ne devrait l'être

**Remède:**
1. Choisir la techno la plus simple qui résout le problème
2. Justifier les choix techniques avec metrics
3. Préférer boring technology qui marche

---

## 7. 🏃 Copy-Paste Architecture

### ❌ Anti-Pattern

Copier une architecture d'un autre projet sans comprendre le contexte.

```typescript
// ❌ BAD - "Inspiré de opencode-missions" sans contexte
class MissionOrchestrator {
  // Features filesystem-first (comme opencode)
  // State machine complexe
  // Handoff protocol
  // Validation contracts
  
  // Mais:
  // - Cortex use cases ≠ opencode use cases
  // - Pas de missions réelles pour tester
  // - Over-engineering pour nos besoins actuels
}
```

```typescript
// ✅ GOOD - Architecture adaptée à nos besoins réels
class SimpleAgentQueue {
  // Commence simple
  // Complexifie SEULEMENT quand besoin réel validé
}
```

**Signes d'alerte:**
- "C'est comme ça que [projet X] le fait"
- Architecture copiée sans adaptation au contexte
- Fonctionnalités jamais utilisées

**Remède:**
1. Comprendre POURQUOI l'autre projet a fait ce choix
2. Évaluer si le contexte s'applique à notre cas
3. Adapter (ne pas copier aveuglément)

---

## 8. 🎯 Analysis Paralysis

### ❌ Anti-Pattern

Passer des semaines à designer au lieu de coder et mesurer.

```markdown
❌ BAD Process:
Week 1: Brainstorm architecture (10 options)
Week 2: Write 50-page design doc
Week 3: Review with team (bikeshedding)
Week 4: Start implementation
Month 2: Realize design doesn't work in reality
Month 3: Rewrite everything

Total: 3 mois pour code inutilisé
```

```markdown
✅ GOOD Process:
Day 1: Simple design (1 option, ~1 page)
Day 2: Prototype MVP (100 lignes)
Day 3: Test with real data
Day 4: Measure impact (A/B test)
Day 5: Decide: continue, pivot, ou abandon

Total: 1 semaine pour validation empirique
```

**Signes d'alerte:**
- Design doc >10 pages avant tout code
- Discussions qui tournent en rond
- Perfection upfront au lieu d'itération

**Remède:**
1. Design doc court (~1 page)
2. Prototype rapide pour valider hypothèses
3. Mesurer avec vraies données
4. Itérer basé sur feedback réel

---

## 9. 🧪 Test-After Development

### ❌ Anti-Pattern

Écrire les tests après le code (ou pas du tout).

```typescript
// ❌ BAD - Code sans tests
class ComplexFeature {
  // 500 lignes de logique complexe
  // Aucun test
  
  // Résultat:
  // - Personne ne sait si ça marche
  // - Personne n'ose modifier (peur de casser)
  // - Bugs découverts en production
}

// Coverage: 15% (tests basiques seulement)
```

```typescript
// ✅ GOOD - TDD strict
describe('SmartChunker', () => {
  it('should select relevant chunks within budget', () => {
    // Test AVANT le code
  });
  
  it('should include dependencies automatically', () => {
    // Test qui définit le comportement
  });
});

class SmartChunker {
  // Code écrit pour passer les tests
}

// Coverage: 85%+
```

**Signes d'alerte:**
- "J'écrirai les tests plus tard"
- Coverage <50%
- Tests ignorés en CI (commented out)

**Remède:**
1. TDD strict: tests AVANT code
2. Pas de merge sans tests
3. Coverage >70% obligatoire

---

## 10. 🔥 Ship and Forget

### ❌ Anti-Pattern

Ship du code et ne jamais vérifier s'il est utilisé.

```typescript
// ❌ BAD - Feature shipped sans monitoring
class AdvancedFeature {
  // Shipped 6 mois plus tôt
  // Aucune metric d'usage
  // Aucune idée si utilisé
  
  // Audit:
  // - 0 instanciation en production
  // - 0 utilisateur
  // - Maintenance continue quand même
}
```

```typescript
// ✅ GOOD - Monitoring et review régulier
class FeatureWithMetrics {
  // Logs d'usage
  // Metrics d'adoption
  // Monthly review
  
  // Si 0 usage après 3 mois → SUPPRIMER
}
```

**Signes d'alerte:**
- Features sans metrics d'usage
- Code jamais revu après le merge
- "Legacy code" après 6 mois

**Remède:**
1. Ajouter logging pour toute nouvelle feature
2. Monthly review: usage, value, maintenance cost
3. Supprimer ce qui n'est pas utilisé

---

## ✅ Principes pour éviter ces anti-patterns

### 1. KISS (Keep It Simple, Stupid)

**Règle:** Toujours commencer par la solution la plus simple.

```
Question à se poser:
1. Peut-on faire plus simple?
2. Quelle est la solution en <100 lignes?
3. L'abstraction est-elle justifiée?
```

### 2. YAGNI (You Aren't Gonna Need It)

**Règle:** Ne construire que ce dont on a besoin MAINTENANT.

```
Ne PAS construire:
- Features "au cas où"
- Abstractions "pour la flexibilité future"
- Optimisations "si on scale à 1M users"
```

### 3. Measure Before Build

**Règle:** Validation empirique obligatoire.

```
Workflow obligatoire:
1. Identifier problème avec metrics
2. Baseline measurement
3. Simple solution (MVP)
4. A/B test avec vraies données
5. Décision data-driven
```

### 4. TDD (Test-Driven Development)

**Règle:** Tests AVANT code, toujours.

```
Cycle TDD:
1. 🔴 Write failing test
2. 🟢 Write minimal code to pass
3. 🔵 Refactor while keeping green
```

### 5. Single Responsibility

**Règle:** Une classe/fonction = une responsabilité.

```
Bon signe:
- Nom descriptif
- <200 lignes par fichier
- <10 méthodes publiques par classe
```

---

## 🚦 Checklist avant d'ajouter du code

Avant de commencer à coder, répondre à ces questions:

### Besoin

- [ ] Quel problème réel cela résout-il?
- [ ] Y a-t-il des metrics qui montrent le problème?
- [ ] Des utilisateurs ont-ils demandé cette feature?

### Simplicité

- [ ] Quelle est la solution la plus simple?
- [ ] Peut-on résoudre en <100 lignes?
- [ ] Avons-nous considéré des alternatives plus simples?

### Validation

- [ ] Comment va-t-on mesurer le succès?
- [ ] A-t-on un plan pour A/B test?
- [ ] Quelles sont les metrics de succès?

### Tests

- [ ] Les tests sont-ils écrits AVANT le code?
- [ ] Coverage >70%?
- [ ] Tests documentent-ils l'usage?

### Maintenance

- [ ] Le code est-il simple à comprendre?
- [ ] Peut-on le maintenir dans 6 mois?
- [ ] Y a-t-il de la documentation?

**Si 3+ réponses sont "Non" → STOP et repenser l'approche.**

---

## 📚 Ressources

- [WHY_SIMPLE.md](./WHY_SIMPLE.md) - Histoire du refactoring
- [ARCHITECTURE_AUDIT.md](./ARCHITECTURE_AUDIT.md) - Audit complet
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Guidelines avec TDD
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture simplifiée

---

**Dernière mise à jour:** 16 août 2026  
**Message final:** Learn from our mistakes. Keep it simple. Measure everything. 🎯
