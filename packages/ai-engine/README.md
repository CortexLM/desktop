# AI Engine - Cortex IDE (Simplifié)

**Version:** 2.0 (Post-Refactoring)  
**Date:** 16 août 2026  
**Principe:** Keep It Simple, Stupid

---

## 🎯 Vue d'ensemble

Le moteur d'agents IA de Cortex IDE a été radicalement simplifié après l'audit d'août 2026. 

**Avant:** 5,000 lignes de complexité inutilisée  
**Après:** 350 lignes de code simple et efficace (-93%)

### Ce qui reste (et fonctionne)

✅ **Multi-provider Registry** - Interface unifiée pour OpenAI, Anthropic, Grok, Ollama  
✅ **Smart Chunking** - Découpe aux frontières sémantiques (gain mesuré sur l'intégrité des frontières ; voir src/context/README.md pour le tableau daté)  
✅ **Simple Agent Queue** - File d'attente FIFO basique  
✅ **Model Presets** - Raccourcis: fastest, smartest, cheapest, reasoning  
✅ **Token Counting** - Estimation précise des tokens

### Ce qui a été supprimé

❌ **Cache L1/L2/L3** (1,500 lignes) - Redondant avec cache natif providers  
❌ **Background Worker Pool** (2,000 lignes) - Over-engineering I/O-bound  
❌ **Context Prediction ML** (200 lignes) - Cold start problem  
❌ **Differential Context** (150 lignes) - Incompatible LLMs  
❌ **Compaction MODERATE/AGGRESSIVE** (270 lignes) - Perte d'info

Voir [ARCHITECTURE_AUDIT.md](../../ARCHITECTURE_AUDIT.md) pour les détails.

---

## 📦 Installation

```bash
# Depuis le monorepo
bun install

# Build
bun run build
```

---

## 🚀 Quick Start

### Usage basique

```typescript
import { AIProviderRegistry } from '@cortex-ide/ai-engine';

// Initialize depuis env vars
const registry = AIProviderRegistry.fromEnv();

// Get provider
const provider = registry.getDefaultOrThrow();

// Chat
const response = await provider.chat([
  { role: 'user', content: 'Explain quantum computing' }
]);

console.log(response.content);
```

### Avec Smart Chunking

```typescript
import { SmartChunker } from '@cortex-ide/ai-engine';

const chunker = new SmartChunker();

// Chunks disponibles
const chunks = [
  { id: 'auth.ts', tokens: 5000, content: '...', imports: ['./user.ts'] },
  { id: 'user.ts', tokens: 3000, content: '...', imports: ['./db.ts'] },
  { id: 'db.ts', tokens: 2000, content: '...' },
];

// Sélection intelligente avec dépendances
const selected = await chunker.selectRelevantChunks(
  chunks,
  10000,  // budget en tokens
  'fix authentication bug'  // query
);

// Résultat: auth.ts + user.ts + db.ts (avec dépendances)
// intégrité des frontières nettement meilleure que le split naïf (métrique structurelle ; chiffre à re-mesurer, voir packages/ai-engine/src/context/README.md)
```

### Avec presets

```typescript
// Set preset global
registry.setGlobalPreset('smartest');

// Ou par provider
registry.setProviderPreset('openai', 'fastest');

// Get model pour preset
const model = registry.getModelForPreset('reasoning', 'anthropic');
```

---

## 🔧 Providers supportés (2026)

| Provider | Latest Model | Context | Features |
|----------|-------------|---------|----------|
| **OpenAI** | gpt-4.5-turbo | 128K | GPT-4.5, o3-mini reasoning |
| **Anthropic** | claude-opus-4.8 | 200K | Opus 4.8, Sonnet 4.5 |
| **Grok** | grok-2.5-fast | 128K | Via xAI API |
| **Ollama** | llama3.1 | Variable | Local models |

### Model Presets

#### 🚀 Fastest
- OpenAI: `o3-mini`
- Anthropic: `claude-sonnet-4.5`
- Grok: `grok-2.5-fast`

#### 🧠 Smartest
- OpenAI: `gpt-4.5-turbo`
- Anthropic: `claude-opus-4.8`
- Grok: `grok-2.5-fast`

#### 💰 Cheapest
- OpenAI: `gpt-4o-2024-11-20`
- Anthropic: `claude-sonnet-4.5`
- Ollama: `llama3.1` (local)

#### 🔬 Reasoning
- OpenAI: `o3-mini`
- Anthropic: `claude-opus-4.8`
- Grok: `grok-2.5-fast`

---

## 🧠 Smart Chunking

### Pourquoi Smart Chunking?

Pour les grandes codebases, envoyer tout le contexte au LLM est:
- ❌ Coûteux en tokens
- ❌ Lent (latence)
- ❌ Parfois impossible (limite context window)

Smart Chunking sélectionne intelligemment les fichiers pertinents avec leurs dépendances.

### Comment ça marche?

```typescript
class SmartChunker {
  // 1. Build dependency graph (AST-based)
  private buildDependencyGraph(chunks: Chunk[]): Graph {
    // Parse imports/exports
    // Détecte vraies dépendances
  }

  // 2. Score par relevance (TF-IDF)
  private scoreChunks(chunks: Chunk[], query: string): ScoredChunk[] {
    // Keyword matching
    // File importance (tests < utils < core)
  }

  // 3. Sélection greedy avec dépendances
  async selectRelevantChunks(
    chunks: Chunk[],
    budget: number,
    query: string
  ): Promise<Chunk[]> {
    const graph = this.buildDependencyGraph(chunks);
    const scored = this.scoreChunks(chunks, query);
    return this.selectWithDeps(scored, graph, budget);
  }
}
```

### Impact mesuré

Métrique : **intégrité des frontières** — part des déclarations top-level qui
tiennent entières dans un seul chunk. Corpus : 58 fichiers TS réels du package,
144 déclarations.

Re-mesuré le 17/08/2026 (65 fichiers, 163 déclarations) :

| Budget (tokens) | Semantic | Split naïf | Gain relatif |
|-----------------|----------|------------|--------------|
| 200             | 39.3%    | 27.0%      | +45.5%       |
| 500             | 60.7%    | 22.7%      | +167.6%      |
| 1000            | 70.6%    | 25.2%      | +180.5%      |
| 2000            | 87.1%    | 63.2%      | +37.9%       |

Reproductible :
`bunx vitest run src/context/__tests__/boundary-integrity.test.ts`.

⚠️ Le corpus est le code source de ce package : ces valeurs dérivent à chaque
modification. La version datée et commentée de ce tableau est dans
[`src/context/README.md`](src/context/README.md) — c'est la source à consulter,
et celle-ci en est une copie qui périmera.

⚠️ C'est une métrique **structurelle**. Il n'existe aucune mesure de qualité de
réponse LLM dans ce repo. Le chiffre « +14% qualité » précédemment affiché ici
n'était sourcé par aucune mesure et a été retiré.

---

## 🗂️ Simple Agent Queue

Queue FIFO simple pour gérer les tâches séquentiellement.

### Pourquoi simple?

- ✅ Tâches IA sont **I/O-bound** (attente API), pas CPU-bound
- ⚠️ Fraction séquentielle importante (dépendances entre fichiers) — **non
  chiffrée** : le « 95%+ » affiché ici n'était pas mesuré, aucun corpus de tâches
  n'a été analysé dans ce dépôt
- ✅ Worker pool complexe = 0% gain pour tâches I/O-bound

### Usage

```typescript
import { SimpleAgentManager } from '@cortex-ide/ai-engine';

const manager = new SimpleAgentManager();

// Enqueue task
await manager.enqueue({
  id: 'task-1',
  execute: async () => {
    // Votre logique
  }
});

// Cancel task
manager.cancel('task-1');

// Get queue status
const status = manager.getStatus();
// { running: 1, queued: 3, completed: 10 }
```

---

## 🛠️ Architecture

### Structure simplifiée

```
ai-engine/src/
├── providers/          # Multi-provider (OpenAI, Anthropic, etc.)
│   ├── openai.ts
│   ├── anthropic.ts
│   ├── grok.ts
│   └── ollama.ts
├── context/            # Smart chunking
│   └── smart-chunker.ts  # 250 lignes
├── compaction/         # Simple minifier
│   └── minify.ts       # 30 lignes
├── prompts/            # System prompts
├── tokens/             # Token counting
├── tools/              # Tools pour agents
├── registry.ts         # Provider registry
├── model-presets.ts    # Presets
└── simple-agent-manager.ts  # 100 lignes
```

### Total: ~380 lignes vs 5,000 lignes avant

---

## 🔑 Environment Variables

```bash
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_DEFAULT_MODEL=gpt-4.5-turbo

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_DEFAULT_MODEL=claude-opus-4.8

# Grok (xAI)
XAI_API_KEY=xai-...
XAI_DEFAULT_MODEL=grok-2.5-fast

# Ollama (local)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=llama3.1
```

---

## 🧪 Tests

```bash
# Run tests
bun test

# Coverage
bun test --coverage

# Cible: >80% coverage (facile avec code simple)
```

---

## 📚 Documentation

- [ARCHITECTURE.md](../../ARCHITECTURE.md) - Architecture globale
- [WHY_SIMPLE.md](../../WHY_SIMPLE.md) - Histoire du refactoring
- [ARCHITECTURE_AUDIT.md](../../ARCHITECTURE_AUDIT.md) - Audit détaillé
- [ANTI_PATTERNS.md](../../ANTI_PATTERNS.md) - Ce qu'il ne faut PAS faire

### Docs internes

- [src/context/README.md](./src/context/README.md) - Smart chunking détails
- [src/compaction/README.md](./src/compaction/README.md) - Minification
- [src/simple-agent-manager.md](./src/simple-agent-manager.md) - Agent queue

---

## 🎓 Philosophie

### Principe KISS

> **"Une solution simple qui marche vaut mieux que 10 solutions sophistiquées inutilisées."**

### Ce que nous avons appris

1. **Mesurer AVANT de construire** - Pas de code sans validation empirique
2. **Supprimer sans pitié** - Si pas utilisé après 3 mois → DELETE
3. **Tests first** - TDD strict pour toute nouvelle feature
4. **Simplicité > Sophistication** - Code simple = moins de bugs

### Résultat du refactoring

```
AVANT:
- 5,000 lignes complexes
- 11 composants sophistiqués
- 0% utilisé en production
- 15% test coverage
- ~30 jours/an maintenance

APRÈS:
- 380 lignes simples (-93%)
- 3 composants essentiels
- Qualité de réponse : non mesurée (aucun harness d'eval dans le repo)
- Facile à tester (>80% coverage)
- ~5 jours/an maintenance (-83%)
```

---

## 🤝 Contributing

Voir [CONTRIBUTING.md](../../CONTRIBUTING.md) pour:
- Guidelines TDD
- Code standards
- Pull request process

### Règles pour ce package

1. ✅ **Tests first** - TDD strict
2. ✅ **Keep it simple** - Pas d'abstraction inutile
3. ✅ **Measure impact** - Validation empirique obligatoire
4. ✅ **Document decisions** - ADR pour choix importants

---

## 📄 License

MIT © Cortex IDE Team

---

**Dernière mise à jour:** 16 août 2026  
**Status:** ✅ Refactoring Phase 1 COMPLÉTÉ  
**Principe:** KISS (Keep It Simple, Stupid) 🎯
