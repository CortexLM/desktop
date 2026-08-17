# Architecture de Cortex IDE

**Version:** 2.0 (Post-Refactoring)  
**Date:** 16 août 2026  
**Principe:** Keep It Simple, Stupid (KISS)

---

## 📋 Table des matières

1. [Vision et positionnement](#vision-et-positionnement)
2. [Architecture globale](#architecture-globale)
3. [Packages principaux](#packages-principaux)
4. [Système d'agents IA](#système-dagents-ia)
5. [Communication IPC](#communication-ipc)
6. [Base de données](#base-de-données)
7. [Décisions d'architecture](#décisions-darchitecture)
8. [Ce qui a été supprimé et pourquoi](#ce-qui-a-été-supprimé-et-pourquoi)

---

## Vision et positionnement

### Ce que Cortex est

Cortex IDE est un **orchestrateur d'agents IA** focalisé sur les missions complexes de coding. Notre valeur unique:

1. 🎯 **Mission Orchestration** - Workflows multi-étapes avec state machine
2. 📊 **Benchmarking** - Comparer providers IA (cost, latency, quality)
3. 🧠 **Context Optimization** - Smart chunking pour 300k+ tokens

### Ce que Cortex n'est PAS

❌ Un éditeur de code complet (utilisez VSCode/Cursor pour ça)  
❌ Un client Git complet (utilisez votre git client)  
❌ Un terminal full-featured (utilisez votre terminal)  
❌ Un concurrent direct de Cursor sur l'édition

**Principe fondamental:** Nous complémentons les IDE existants, nous ne les remplaçons pas.

---

## Architecture globale

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────┐
│                    Cortex IDE App                        │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────┐         ┌──────────────┐               │
│  │  Renderer   │◄───IPC──►│  Main        │               │
│  │  (React UI) │         │  Process     │               │
│  └─────────────┘         └──────────────┘               │
│         │                        │                       │
│         │                        ▼                       │
│         │                ┌──────────────┐               │
│         │                │  AI Engine   │               │
│         │                │  (Simple)    │               │
│         │                └──────────────┘               │
│         │                        │                       │
│         │                        ▼                       │
│         │                ┌──────────────┐               │
│         └────────────────►  SQLite DB   │               │
│                          └──────────────┘               │
│                                  │                       │
│                                  ▼                       │
│                         ┌─────────────────┐             │
│                         │  Multi-Provider │             │
│                         │  (OpenAI, etc.) │             │
│                         └─────────────────┘             │
└─────────────────────────────────────────────────────────┘
```

### Principes architecturaux

1. **Simplicité avant tout** - Supprimer la complexité inutile
2. **Mesurer avant de construire** - Validation empirique obligatoire
3. **Une responsabilité par module** - Pas de God Objects
4. **Tests first** - TDD pour toute nouvelle feature
5. **Documentation au fil de l'eau** - Pas de code sans doc

---

## Packages principaux

### Structure du monorepo

```
cortex-ide/
├── packages/
│   ├── main/           # Electron main process
│   ├── renderer/       # React frontend
│   ├── preload/        # Preload scripts
│   ├── shared/         # Types & schemas partagés
│   └── ai-engine/      # Moteur d'agents (simplifié)
├── tests/e2e/          # Tests Playwright
├── docs/               # Documentation technique
└── bun.lockb          # Lockfile Bun
```

### Package: main

**Responsabilité:** Gestion de l'application Electron (fenêtres, système de fichiers, IPC).

**Modules clés:**
- `index.ts` - Point d'entrée, création de la fenêtre
- `ipc/` - Handlers IPC pour communication avec renderer
- `database/` - Gestion SQLite (sessions, usage, etc.)
- `services/` - Services système (file watching, Git basique)
- `window-manager.ts` - Gestion des fenêtres Electron

**Principe:** Minimaliste - seulement ce qui DOIT être dans le main process.

### Package: renderer

**Responsabilité:** Interface utilisateur React.

**Structure:**
```
renderer/src/
├── components/        # Composants React réutilisables
│   ├── ai/           # Composants agents IA
│   ├── workspace/    # Navigation, file tree
│   └── ui/           # Composants UI (Radix-based)
├── views/            # Pages/vues principales
├── hooks/            # Custom React hooks
├── contexts/         # React Context providers
└── lib/              # Utilitaires frontend
```

**Stack:**
- React 18 + TypeScript
- TanStack Query (data fetching)
- Zustand (state management)
- Radix UI + Tailwind CSS

**Principe:** Composants petits et testables, pas de logique métier lourde.

### Package: preload

**Responsabilité:** Bridge sécurisé entre renderer et main process.

**API exposée:**
```typescript
window.electronAPI = {
  // IPC communication
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, callback) => ipcRenderer.on(channel, callback),
  
  // Platform info
  platform: process.platform,
  
  // File operations
  readFile: (path) => invoke('fs:read', path),
  writeFile: (path, content) => invoke('fs:write', path, content),
  
  // AI operations
  sendMessage: (message) => invoke('ai:send', message),
  // ...
};
```

**Principe:** API minimale et typée, pas d'exposition de fonctions internes.

### Package: shared

**Responsabilité:** Types, schemas Zod, et constantes partagées.

**Contenu:**
```
shared/src/
├── types/            # Types TypeScript communs
├── schemas/          # Schemas Zod pour validation
└── constants/        # Constantes (API endpoints, etc.)
```

**Principe:** Single source of truth pour les types, pas de duplication.

### Package: ai-engine

**Responsabilité:** Moteur d'agents IA simplifié (post-refactoring -93% code).

**Structure actuelle:**
```
ai-engine/src/
├── providers/        # Multi-provider (OpenAI, Anthropic, etc.)
├── context/          # Smart chunking avec dépendances
│   └── smart-chunker.ts  # ~250 lignes (vs 1,200 avant)
├── compaction/       # Minification simple
│   └── minify.ts     # ~30 lignes (vs 300 avant)
├── prompts/          # System prompts et templates
├── tokens/           # Token counting
├── tools/            # Tools pour agents
├── registry.ts       # Registry de providers
├── model-presets.ts  # Presets (fastest, smartest, etc.)
└── simple-agent-manager.ts  # Queue simple (~100 lignes)
```

**Ce qui a été SUPPRIMÉ (voir audit):**
- ❌ Système de cache L1/L2/L3 (1,500 lignes) - redondant avec cache natif
- ❌ Background agent worker pool (2,000 lignes) - over-engineering I/O-bound
- ❌ Compaction complexe MODERATE/AGGRESSIVE (270 lignes) - perte d'info
- ❌ Context prediction ML (200 lignes) - cold start problem
- ❌ Differential context manager (150 lignes) - incompatible LLMs

**Ce qui reste (350 lignes total):**
- ✅ Smart chunking avec dépendances (semantic, AST-based)
- ✅ Simple minifier (whitespace + comments)
- ✅ Simple agent queue (FIFO, pas de parallélisation excessive)

**Principe:** Une seule fonctionnalité validée empiriquement vaut mieux que 10 sophistiquées inutilisées.

---

## Système d'agents IA

### Architecture simplifiée

```
┌──────────────────────────────────────────────────────┐
│              SimpleAgentManager                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  Queue (FIFO)                                  │  │
│  │  ┌────┐  ┌────┐  ┌────┐                       │  │
│  │  │ T1 │→ │ T2 │→ │ T3 │→ ...                  │  │
│  │  └────┘  └────┘  └────┘                       │  │
│  └────────────────────────────────────────────────┘  │
│                      │                                │
│                      ▼                                │
│  ┌────────────────────────────────────────────────┐  │
│  │  Provider Registry                             │  │
│  │  - OpenAI (GPT-4.5-turbo, o1, o3)            │  │
│  │  - Anthropic (Claude Opus 4.8, Sonnet 4.8)   │  │
│  │  - Grok (2.5-fast)                            │  │
│  │  - Ollama (local)                             │  │
│  └────────────────────────────────────────────────┘  │
│                      │                                │
│                      ▼                                │
│  ┌────────────────────────────────────────────────┐  │
│  │  Smart Chunker                                 │  │
│  │  - Build dependency graph (AST)               │  │
│  │  - Score chunks by relevance                  │  │
│  │  - Select with dependencies                   │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### SimpleAgentManager

Queue simple pour exécuter des tâches séquentiellement (pas de worker pool I/O-bound):

```typescript
class SimpleAgentManager {
  private queue: Array<AgentTask> = [];
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

  cancel(taskId: string): void {
    this.queue = this.queue.filter(t => t.id !== taskId);
    if (this.running?.id === taskId) {
      this.running.abort();
    }
  }
}
```

**Pourquoi simple?**
- Les tâches IA sont I/O-bound (attente API), pas CPU-bound
- La fraction séquentielle du travail réel plafonne ce que le parallélisme peut
  apporter, et sur des tâches de codage elle est importante (dépendances entre
  fichiers). **Non chiffrée** : le « 95%+ » affiché ici n'était pas mesuré — aucun
  corpus de tâches n'a été analysé dans ce dépôt.
- Worker pool complexe = 2,000 lignes pour 0% de gain

### SemanticChunker

> ⚠️ **Corrigé le 17/08/2026.** Cette section montrait une classe `SmartChunker`
> avec `buildDependencyGraph()` (« analyse AST »), `scoreChunks()`
> (« TF-IDF scoring », « file importance ») et `selectRelevantChunks()`
> (« sélection greedy avec dépendances »).
>
> **La classe n'existe pas sous ce nom et ne fait aucune de ces trois choses.**
> Vérifié par recherche : 0 résultat pour `tfidf`/`tf-idf`, 0 pour `greedy`,
> aucun parsing AST (`ts.createSourceFile` absent). Ce pseudo-code a circulé dans
> six autres documents et a fini par se lire comme une description de
> l'implémentation.

Découpage d'un fichier aux frontières de déclarations :

```typescript
// packages/ai-engine/src/context/chunking/semantic-chunker.ts
class SemanticChunker {
  constructor(config: Partial<SemanticChunkingConfig> = {}) { /* ... */ }

  // Seule méthode publique. Détection des déclarations par expressions
  // régulières, découpage par équilibrage d'accolades pour TypeScript,
  // JavaScript, Rust, Go, Java et C/C++. Estimation ~4 caractères par token.
  //
  // Ne construit pas de graphe de dépendances, ne calcule aucun score, et ne
  // choisit pas quels fichiers envoyer au modèle : il découpe le contenu qu'on
  // lui passe.
  async chunk(content: string, filePath: string, language?: string): Promise<ContextChunk[]>
}
```

**Impact mesuré** (17/08/2026, 65 fichiers, 163 déclarations) : 60,7 % des
déclarations arrivent intactes dans un seul chunk au budget 500 tokens, contre
22,7 % pour un découpage naïf par lignes (+167,6 % relatif). Métrique
**structurelle**, pas une mesure de qualité de réponse. Reproductible :
`cd packages/ai-engine && bunx vitest run src/context/__tests__/boundary-integrity.test.ts`.

Le tableau complet par budget, daté, est dans
[`packages/ai-engine/src/context/README.md`](./packages/ai-engine/src/context/README.md).
Ces valeurs dérivent : le corpus mesuré est le code source du package.

### Model Presets

Presets simples pour faciliter le choix:

```typescript
export const MODEL_PRESETS = {
  fastest: { provider: 'openai', model: 'gpt-4.5-turbo' },
  smartest: { provider: 'anthropic', model: 'claude-opus-4.8' },
  cheapest: { provider: 'ollama', model: 'llama3.1' },
  reasoning: { provider: 'openai', model: 'o3-mini' },
};
```

---

## Communication IPC

### Channels disponibles

> **Corrigé le 17/08/2026.** Cette section listait 12 canaux — `fs:read`,
> `fs:write`, `fs:list`, `fs:watch`, `ai:send`, `ai:stream`, `ai:cancel`,
> `ai:list-tasks`, `workspace:open`, `workspace:info`, `db:sessions`,
> `db:usage`. **Aucun des 12 n'était enregistré dans le main.** Les noms réels
> diffèrent (`fs:read-file` et non `fs:read`, `ai:send-message` et non
> `ai:send`) ou le canal n'existe pas du tout (`ai:cancel`, `ai:list-tasks`,
> `workspace:open`, `workspace:info`, `db:sessions`, `db:usage`).
>
> La liste ci-dessous est extraite des appels `ipcMain.handle(...)` de
> `packages/main/src` (76 canaux au 17/08/2026). **Ne pas recopier cette liste
> à la main** : elle périme. La source de vérité est
> `packages/shared/src/types/ipc/channels.ts` plus les fichiers
> `packages/main/src/ipc/handlers/*.ts`.

**File System** (`filesystem-handlers.ts`) :
```typescript
'fs:read-file'     // Lire un fichier
'fs:write-file'    // Écrire un fichier
'fs:read-dir'      // Lister un répertoire
```

**AI Operations** (`ai-handlers.ts`, `ai-stream-handler.ts`) :
```typescript
'ai:create-session'   // Créer une session
'ai:send-message'     // Envoyer un message
'ai:stream-response'  // Démarrer un stream de réponse
'ai:stop-stream'      // Interrompre le stream en cours
```
Les chunks de stream sont poussés vers le renderer sur un canal dynamique
`ai:stream:<sessionId>`, pas sur un canal fixe.

**Workspace** (`workspace-handlers.ts`) :
```typescript
'workspace:list'         // Lister les workspaces
'workspace:switch'       // Changer de workspace actif
'workspace:add'          // Ajouter un workspace
'workspace:remove'       // Retirer un workspace
'workspace:open-dialog'  // Ouvrir le sélecteur de dossier
```

**Database** (`database-handlers.ts`) :
```typescript
'db:query'         // Lecture
'db:execute'       // Écriture
```

**Autres domaines enregistrés** : `git:*` (11 canaux dont 7 `git:stash-*`),
`mcp:*` (12), `debug:*` (12), `automation:*` (8), `terminal:*` (5),
`search:*` (3), `editor:*` (3), `update:*` (3), `chat:export`.

**Événements poussés main → renderer** : `event:terminal-data`,
`event:terminal-exit`, `event:workspace-switched`, `event:notification`,
`event:automation-started`, `event:automation-completed`,
`event:automation-failed`, `event:services-degraded`.

**Canaux déclarés mais non implémentés côté main** (vérifié le 17/08/2026 —
présents dans `channels.ts` et dans le pont preload, mais aucun émetteur ni
handler dans `packages/main/src`) : `fs:watch`, `fs:unwatch`,
`event:file-change`, et les six `event:mcp-*`
(`mcp-server-started`, `mcp-server-stopped`, `mcp-server-error`,
`mcp-tool-invoked`, `mcp-permission-granted`, `mcp-permission-revoked`).
S'y abonner depuis le renderer ne produit rien. `MCPExtensionList` le fait
aujourd'hui, et son rafraîchissement automatique ne se déclenche donc jamais.

### Sécurité IPC

Vérifié le 17/08/2026 :

- ✅ Validation Zod des payloads — `handler-factory.ts` appelle
  `schema.parse(request)` pour tout handler créé par `createHandler`. Les trois
  fichiers qui ne passent pas par la fabrique valident quand même :
  `debug-handlers.ts` (`DebugUpdateSettingsRequestSchema.parse`,
  `OptionalLimitSchema.parse`), `ai-stream-handler.ts`
  (`StreamResponseRequestSchema.parse`), et `update-handlers.ts` dont les trois
  canaux ne prennent aucun payload.
- ✅ Allowlist de canaux — `packages/preload/src/index.ts` : `IPC_ALLOWED_CHANNELS`
  pour `window.ipc.invoke`, plus une allowlist distincte pour
  `window.electron.invoke`. Un canal non listé est rejeté côté preload.
- ✅ `nodeIntegration: false`, `nodeIntegrationInWorker: false`,
  `nodeIntegrationInSubFrames: false` — `packages/main/src/security.ts:238-240`.
- ✅ `contextIsolation: true` et `sandbox: true` — `security.ts:243-244`.

Voir [docs/IPC_ARCHITECTURE.md](./docs/IPC_ARCHITECTURE.md) pour détails.

---

## Base de données

### Schema SQLite

**Tables principales:**

```sql
-- Sessions de conversation
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  provider TEXT,
  model TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

-- Messages dans les sessions
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  role TEXT, -- 'user' | 'assistant' | 'system'
  content TEXT,
  tokens INTEGER,
  created_at INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Usage tracking (coûts)
CREATE TABLE usage_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  provider TEXT,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd REAL,
  latency_ms INTEGER,
  created_at INTEGER
);

-- Workspaces
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  path TEXT UNIQUE,
  name TEXT,
  created_at INTEGER
);
```

**Principe:** Schema minimal, pas de sur-normalisation.

---

## Décisions d'architecture

### 1. Pourquoi Electron?

**Avantages:**
- ✅ Cross-platform (Mac, Windows, Linux)
- ✅ Accès natif au système de fichiers
- ✅ Intégrations natives (Git, terminal)
- ✅ Ecosystem mature (React, TypeScript)

**Inconvénients acceptés:**
- ⚠️ Bundle size (~150MB)
- ⚠️ Memory footprint plus élevé

**Alternative considérée:** Tauri (Rust) - rejeté car ecosystem moins mature.

### 2. Pourquoi Bun?

**Avantages:**
- ✅ Performance (3-5x plus rapide que npm/pnpm)
- ✅ Monorepo natif (pas besoin de Turborepo)
- ✅ Runtime moderne (ESM, TypeScript natif)

**Principe:** Adopter les nouveaux outils qui apportent une vraie valeur.

### 3. Pourquoi SQLite?

**Avantages:**
- ✅ Pas de serveur séparé
- ✅ Portable (un seul fichier)
- ✅ Performance excellente pour usage local
- ✅ Transactions ACID

**Alternative considérée:** IndexedDB - rejeté car moins puissant pour queries complexes.

### 4. Pourquoi TanStack Query?

**Avantages:**
- ✅ Cache intelligent
- ✅ Invalidation automatique
- ✅ Optimistic updates
- ✅ Retry logic built-in

**Alternative considérée:** Redux Toolkit Query - rejeté car plus lourd.

### 5. Pourquoi pas de Mission Orchestrator filesystem-first (pour l'instant)?

**Raison:** Pas encore implémenté - sur la roadmap Phase 3.

**Design futur:**
```
missions/
  mission-abc123/
    features.json       # Liste des features avec dépendances
    progress.jsonl      # Log JSONL des événements
    state.json          # État actuel (planning/running/completed)
    results/            # Résultats de chaque feature
      feature-1.json
      feature-2.json
```

**Principe:** Attendre d'avoir un vrai besoin avant d'implémenter.

---

## Ce qui a été supprimé et pourquoi

### Audit de refactoring (16 août 2026)

Un audit approfondi a révélé que **93% du code (5,000 lignes sur 5,350)** était inutile:

#### ❌ Système de cache L1/L2/L3 (1,500 lignes)

**Problème:**
- Pas utilisé en production (0 instanciation)
- Redondant avec cache natif Anthropic
- L2/L3 inutiles (contexte change trop vite)
- Économie réelle: 3.3% tokens (vs 60% promis)

**Action:** Supprimé complètement. Utiliser cache natif Anthropic directement.

#### ❌ Background Agent Worker Pool (2,000 lignes)

**Problème:**
- Tâches IA sont I/O-bound, pas CPU-bound
- Worker pool n'apporte rien (attente API = bottleneck)
- Fraction séquentielle importante (dépendances entre fichiers) — **non chiffrée**,
  le « 95%+ » précédent n'était pas mesuré
- Checkpointing inutile (tâches <5min)

**Action:** Remplacé par SimpleAgentManager (~100 lignes).

#### ❌ Compaction MODERATE/AGGRESSIVE (270 lignes)

**Problème:**
- MODERATE: perte d'information jugée critique à la relecture
- AGGRESSIVE: inutilisable (suppression des types, noms raccourcis)
- MINIMAL: utile mais gain faible

> Corrigé le 17/08/2026 : « -28 % qualité » et « 1.2x » ont été retirés. Ces
> chiffres viennent de la même ligne de tableau écrite à la main
> qu'`ARCHITECTURE_AUDIT.md` — aucun juge de qualité n'existe dans le dépôt.
> Le verdict qualitatif (MODERATE et AGGRESSIVE dégradent trop le code) reposait
> sur une lecture des sorties, ce qui reste un argument valable ; seule sa
> quantification était inventée.

**Action:** Remplacé par simple minifier (~30 lignes).

#### ❌ Context Prediction ML (200 lignes)

**Problème:**
- Cold start problem (0 historique = 0 valeur)
- Nécessite 1000+ requêtes pour être utile
- Overhead: 50ms par prédiction

**Action:** Supprimé. Attendre un vrai historique avant de réimplémenter.

#### ❌ Differential Context Manager (150 lignes)

**Problème:**
- LLMs ne supportent pas les deltas
- Doit reconstruire full context anyway
- Anthropic cache natif fait mieux

**Action:** Supprimé. Utiliser cache natif.

### Résultat du refactoring

```
AVANT:
- 5,000 lignes de code complexe
- 11 composants sophistiqués
- 0% utilisé en production
- 15% test coverage
- ~3 jours/mois maintenance

APRÈS:
- 350 lignes de code simple (-93%)
- 2 composants (SmartChunker + minifier)
- Qualité de réponse : non mesurée (aucun harness d'eval dans le repo)
- Facile à tester (80%+ coverage)
- ~0.5 jour/mois maintenance (-83%)
```

**Leçon apprise:** La sophistication technique n'est pas un but en soi.

Voir [ARCHITECTURE_AUDIT.md](./ARCHITECTURE_AUDIT.md) pour tous les détails.

---

## Principes pour le futur

### 1. Validation empirique obligatoire

Avant d'ajouter un système complexe:
1. ✅ Mesurer le problème (metrics)
2. ✅ Prototype simple (MVP)
3. ✅ A/B test avec baseline
4. ✅ Décision data-driven

**Exemple:** Smart chunking a été validé sur une métrique d'intégrité des frontières (chiffre daté dans packages/ai-engine/src/context/README.md) avant intégration.

### 2. Supprimer sans pitié

Si un module:
- ❌ N'est pas utilisé en production après 3 mois
- ❌ N'a pas de tests >50% coverage
- ❌ N'a pas de metrics d'impact mesurables

→ **SUPPRIMER** (avec documentation du pourquoi).

### 3. Tests first

Nouvelle feature = tests AVANT code:

```typescript
// 1. Tests d'abord
describe('SmartChunker', () => {
  it('should select relevant chunks with dependencies', () => {
    // Test cases
  });
});

// 2. Code après
class SmartChunker {
  // Implementation
}
```

### 4. Documentation au fil de l'eau

Pas de code sans:
- ✅ Comments JSDoc pour les APIs publiques
- ✅ README dans chaque package
- ✅ Architecture Decision Records (ADR) pour choix importants

---

## Ressources

- [WHY_SIMPLE.md](./WHY_SIMPLE.md) - Histoire du refactoring
- [ANTI_PATTERNS.md](./ANTI_PATTERNS.md) - Ce qu'il ne faut PAS faire
- [ARCHITECTURE_AUDIT.md](./ARCHITECTURE_AUDIT.md) - Audit complet (août 2026)
- [docs/IPC_ARCHITECTURE.md](./docs/IPC_ARCHITECTURE.md) - Détails IPC
- [packages/ai-engine/README.md](./packages/ai-engine/README.md) - Moteur IA

---

**Dernière mise à jour:** 16 août 2026  
**Prochaine révision:** Après Phase 3 (Mission Orchestrator UI)
