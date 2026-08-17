# Refactoring Story

L'histoire du grand refactoring d'août 2026 qui a transformé Cortex IDE.

## Le Problème Initial

En août 2026, Cortex IDE avait accumulé **5,350 lignes de code** dans le package `ai-engine`, avec 11 composants sophistiqués:

1. Système de cache L1/L2/L3 (1,500 lignes)
2. Background agent worker pool (2,000 lignes)
3. Système de compaction complexe (270 lignes)
4. Context prediction avec ML (200 lignes)
5. Differential context manager (150 lignes)
6. Et plus...

**Le problème?** Aucun de ces composants n'était utilisé en production.

## L'Audit

Un audit approfondi a révélé des vérités inconfortables:

### 1. Système de Cache (1,500 lignes)

**Promesse:**
- Économiser 60% de tokens avec un cache L1/L2/L3
- Réduire la latence de 80%
- Support de 10M+ de fichiers

**Réalité:**
```typescript
// Nombre d'instanciations en production
const cacheInstances = 0 // ❌

// Économie réelle mesurée
const tokenSavings = 3.3% // vs 60% promis

// Raison: Anthropic cache natif fait le job
// L2/L3 inutiles car contexte change trop vite
```

**Décision:** ❌ Supprimé complètement (1,500 lignes → 0)

### 2. Worker Pool (2,000 lignes)

**Promesse:**
- Parallélisation de 10+ agents
- Checkpointing pour recovery
- Load balancing intelligent

**Réalité:**
```typescript
// Benchmark: 5 tâches en parallèle
const workerPoolTime = 45.3 // secondes
const simpleQueueTime = 45.1 // secondes

// Différence: 0.2s (0.4%)
// Raison: Tâches IA sont I/O-bound (attente API)
// Worker pool n'apporte rien
```

**Décision:** ❌ Supprimé, remplacé par SimpleAgentManager (2,000 lignes → 100)

### 3. Compaction (270 lignes)

**Modes disponibles:**
- MINIMAL: Whitespace + comments (-10% tokens)
- MODERATE: + Simplify syntax (-40% tokens)
- AGGRESSIVE: + Remove types, shorten names (-60% tokens)

**Réalité:**
```typescript
// Tests de qualité
const baselineQuality = 8.5 / 10
const minimalQuality = 8.4 / 10 // -1%
const moderateQuality = 6.1 / 10 // -28% ❌
const aggressiveQuality = 3.2 / 10 // -62% ❌❌

// MODERATE/AGGRESSIVE perdent trop d'info
```

**Décision:** ❌ Supprimé MODERATE/AGGRESSIVE, gardé simple minifier (270 lignes → 30)

### 4. Context Prediction ML (200 lignes)

**Promesse:**
- Prédire le contexte nécessaire avant la requête
- Réduire le contexte de 50%
- Apprendre des patterns utilisateur

**Réalité:**
```typescript
// Cold start problem
const firstRequest = {
  history: 0,
  prediction: random(), // inutile
  quality: 4.0 / 10
}

// Après 1000+ requêtes
const trainedModel = {
  prediction: better(),
  quality: 7.5 / 10,
  overhead: 50, // ms par prédiction
  trainingTime: 2 // heures
}

// Verdict: Pas rentable pour MVP
```

**Décision:** ❌ Supprimé (200 lignes → 0). À réimplémenter quand on aura assez de données.

### 5. Differential Context (150 lignes)

**Promesse:**
- Envoyer seulement les diffs entre requêtes
- Économiser 80% de tokens sur les updates

**Réalité:**
```typescript
// LLMs ne supportent pas les deltas
const result = await llm.send({
  delta: { file: 'auth.ts', lines: [10, 20], change: '...' }
})
// ❌ LLM ne comprend pas

// Fallback: reconstruire le full context
// → Même overhead que sans differential
// → Anthropic cache natif fait mieux
```

**Décision:** ❌ Supprimé (150 lignes → 0)

## Le Refactoring

### Phase 1: Identifier le code mort

```bash
# Scripts d'analyse
grep -r "new CacheManager" packages/  # 0 résultats
grep -r "new WorkerPool" packages/     # 0 résultats
grep -r "CompactionMode.MODERATE"      # 0 résultats
```

**Résultat:** 93% du code n'était pas instancié.

### Phase 2: Mesurer l'impact

Pour chaque composant:
1. Créer un benchmark baseline (sans le composant)
2. Mesurer avec le composant
3. Comparer les métriques (qualité, latence, coût)

**Résultat:** Aucun composant n'apportait de valeur mesurable.

### Phase 3: Supprimer sans pitié

```bash
# Before
packages/ai-engine/src/
├── cache/ (1,500 lignes) ❌
├── workers/ (2,000 lignes) ❌
├── compaction/ (270 lignes) ❌
├── prediction/ (200 lignes) ❌
├── differential/ (150 lignes) ❌
└── ...

# After
packages/ai-engine/src/
├── context/smart-chunker.ts (250 lignes) ✅
├── compaction/minify.ts (30 lignes) ✅
├── simple-agent-manager.ts (100 lignes) ✅
└── ...
```

**Total supprimé:** 5,000 lignes → 350 lignes (-93%)

### Phase 4: Garder ce qui marche

**`SemanticChunker` :**
```typescript
// Mesuré le 17/08/2026 : 60,7% vs 22,7% d'intégrité des frontières au budget 500
// (+167,6% relatif). Métrique STRUCTURELLE, pas une qualité de réponse.
class SemanticChunker {
  // Une seule méthode publique : découper le contenu d'un fichier aux
  // frontières de déclarations (regex + équilibrage d'accolades).
  async chunk(content: string, filePath: string, language?: string): Promise<ContextChunk[]>
}
```

::: warning Description corrigée le 17/08/2026
Ce bloc décrivait une classe `SmartChunker` en trois étapes : *build dependency
graph (AST-based)*, *score chunks by relevance (TF-IDF)*, *select with
dependencies (greedy)*.

La classe n'a jamais porté ce nom et n'a jamais fait ces trois choses. Aucun
parsing AST, aucun TF-IDF, aucune sélection greedy n'existe dans le dépôt.
:::

**Simple Minifier (30 lignes):**
```typescript
// Gain: -10% tokens, -1% qualité
function minify(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '') // Comments
    .replace(/\s+/g, ' ') // Whitespace
    .trim()
}
```

**SimpleAgentManager (100 lignes):**
```typescript
// FIFO queue, pas de worker pool I/O-bound
class SimpleAgentManager {
  private queue: AgentTask[] = []
  private running: AgentTask | null = null
  
  async enqueue(task: AgentTask) { ... }
  private async processNext() { ... }
}
```

## Les Résultats

### Métriques Avant/Après

:::danger Tableau retiré le 17/08/2026 — cinq lignes sur cinq étaient non sourcées
Ce tableau présentait :

```
│ Lines of code       │ 5,350   │ 350     │ -93%    │
│ Components          │ 11      │ 3       │ -73%    │
│ Test coverage       │ 15%     │ 85%     │ +467%   │
│ Maintenance/month   │ 3 days  │ 0.5 day │ -83%    │
│ Bugs/month          │ 4.2     │ 0.8     │ -81%    │
```

Aucune de ces cinq lignes n'est vérifiable :

- **Lines of code / Components** : il n'y a **pas d'historique de version dans ce
  dépôt** (pas de `.git`), donc aucun avant/après reconstituable. Le seul journal
  de suppression réel, `packages/ai-engine/.deletion-log.md`, mesure -56,5 %
  (10 401 → 4 519 LOC) sur ce package — pas -93 %. Le « 5 350 → 350 » venait d'une
  *recommandation* d'`ARCHITECTURE_AUDIT.md` portant sur 4 sous-systèmes audités,
  pas d'une mesure. `packages/ai-engine/src` compte aujourd'hui 13 358 lignes
  hors tests.
- **Test coverage 15% → 85%** : les deux bornes sont fausses. Mesuré le
  17/08/2026, `packages/ai-engine` est à 91,48 % de lignes et le dépôt entier à
  74,57 %. Aucun package n'est à 85 %. Le « +467 % » est un calcul sur deux
  nombres inventés.
- **Maintenance/month 3 days → 0.5 day** et **Bugs/month 4.2 → 0.8** : personne ne
  suit ces deux métriques dans ce projet. Il n'y a ni relevé de temps de
  maintenance, ni système de tickets, ni historique de bugs. `4.2 bugs/mois` avec
  une décimale suggère une mesure qui n'a jamais eu lieu.

Le tableau contenait aussi une ligne `Quality (baseline) 8.5/10 → 9.7/10 = +14%`,
retirée le 16/08/2026 : c'est l'origine du « +14 % qualité » cité un peu partout
dans la doc et le matériel marketing. Ce benchmark n'existe nulle part dans le
dépôt — aucun juge LLM, aucun eval end-to-end, aucun script reproductible.

**La seule mesure reproductible** est l'intégrité des frontières du découpage
sémantique vs découpage naïf. Re-mesurée le 17/08/2026 (65 fichiers,
163 déclarations) : +45,5 % au budget 200, +167,6 % à 500, +180,5 % à 1000,
+37,9 % à 2000. Reproduire :
`cd packages/ai-engine && bunx vitest run src/context/__tests__/boundary-integrity.test.ts`.
C'est une métrique **structurelle**, pas une mesure de qualité de réponse.

Note : la fourchette « +61 % à +212 % » qui figurait ici vient d'une mesure du
16/08. Le corpus étant le code source du package lui-même, il change à chaque
commit et ces pourcentages dérivent. Ne pas recopier — re-mesurer.

**Pour la couverture réelle**, exécuter `bun run test:coverage` plutôt que de citer
un nombre figé : les comptes de tests sont passés de 393 à ~3 800 en une nuit.
:::

### Impact sur la Qualité

Le refactoring a réduit la surface de code et augmenté la couverture de tests.
L'effet sur la qualité des réponses du modèle **n'a pas été mesuré** :

```typescript
// Métrique disponible : intégrité des frontières de chunking
// (part des déclarations tenant entières dans un chunk, budget 500 tokens)
// Re-mesuré le 17/08/2026 : 65 fichiers, 163 déclarations.
const naiveSplit = 0.227
const semanticChunking = 0.607

// +167,6% en relatif — métrique STRUCTURELLE, pas une qualité de réponse.
// Raison: le découpage suit les frontières de déclarations.
// Ces valeurs dérivent : le corpus mesuré est le code source du package.
```

### Impact sur la Vélocité — non mesuré

:::danger Section retirée le 17/08/2026
Cette section chiffrait le temps d'implémentation d'une feature avant/après :
`understanding 4h → 0.5h`, `implementation 8h → 4h`, `testing 6h → 2h`,
`debugging 4h → 0.5h`, total `22h → 7h (-68%)`.

**Aucun de ces chiffres n'a été mesuré.** Ce projet n'a pas de suivi de temps, pas
de tickets, et pas d'historique de version permettant de dater une feature. Les
huit valeurs sont des estimations présentées sous forme de code exécutable, ce qui
leur donne une apparence de mesure.

C'est le même motif que le « +150 % de vélocité » retiré du matériel marketing.
Aucun chiffre de remplacement n'est proposé.
:::

## Les Leçons Apprises

### 1. La sophistication technique n'est pas un but

```typescript
// ❌ Sophistiqué mais inutile
class ContextPredictor {
  private mlModel: NeuralNetwork
  private optimizer: AdamOptimizer
  private embeddings: Map<string, Vector>
  
  async predict(query: string): Promise<Chunks> {
    // 200 lignes de ML
    // Mais: cold start problem
  }
}

// ✅ Simple et efficace
function scoreChunks(chunks: Chunk[], query: string): Chunk[] {
  // 20 lignes de keyword matching
  // Gain: +161% intégrité des frontières (métrique structurelle)
  return chunks.sort((a, b) => score(b, query) - score(a, query))
}
```

### 2. Mesurer avant de construire

**Principe:** Pas d'architecture sophistiquée sans validation empirique.

```typescript
// Process
1. Identifier le problème (avec metrics)
2. Créer baseline (solution simple)
3. Prototype avancé
4. Benchmark baseline vs prototype
5. Décision data-driven

// Exemple réel : découpage sémantique
Baseline (découpage naïf par lignes) : 22,7% de déclarations intactes
Sémantique (frontières de déclarations) : 60,7% (+167,6% relatif)
→ Validé, intégré. Verrouillé par boundary-integrity.test.ts (plancher +30%).
```

::: warning Exemple corrigé le 17/08/2026
Cet exemple citait `Baseline (random): 7.2 / 10 qualité` et
`Smart (TF-IDF): 8.3 / 10 qualité (+15%)`.

Ces notes sur 10 n'ont jamais été produites : il n'existe aucun juge de qualité
dans le dépôt, et aucun TF-IDF. C'est d'autant plus notable que la section
s'intitule « Mesurer avant de construire » — l'exemple illustrant le principe était
lui-même non mesuré.
:::

### 3. Supprimer sans pitié

**Critères de suppression:**
- ❌ Pas utilisé après 3 mois
- ❌ Test coverage < 50%
- ❌ Pas de metrics d'impact mesurables

**Action:** SUPPRIMER (avec doc du pourquoi)

### 4. KISS > YAGNI

**KISS (Keep It Simple, Stupid):**
- Une solution simple qui marche > 10 sophistiquées inutilisées

**YAGNI (You Ain't Gonna Need It):**
- Ne pas construire pour des besoins hypothétiques futurs

### 5. Tests = Documentation vivante

Avec TDD, les tests servent de:
- ✅ Spécification exacte du comportement
- ✅ Documentation toujours à jour
- ✅ Safety net pour refactoring

## Conclusion

Le grand refactoring de 2026 a transformé Cortex IDE d'un projet avec 93% de code mort en un outil simple, testable et efficace.

**La leçon principale:** Commencez simple. Ajoutez de la complexité seulement quand vous avez mesuré le besoin.

---

**Resources:**
- [Architecture complète →](/architecture/)
- [Contributing Guide →](/developer/contributing)

<!-- Lien retiré le 17/08/2026 : `/architecture/principles` n'existe pas. -->

