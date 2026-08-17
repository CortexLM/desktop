# Architecture

Documentation complète de l'architecture de Cortex IDE.

::: tip
Ce document est une version condensée. Pour la version complète, consultez [ARCHITECTURE.md](https://github.com/cortex-ide/cortex-ide/blob/main/ARCHITECTURE.md) sur GitHub.
:::

## Vue d'ensemble

Cortex IDE est une application Electron moderne en monorepo avec architecture simplifiée:

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

## Principes Architecturaux

1. **Simplicité avant tout** - Supprimer la complexité inutile
2. **Mesurer avant de construire** - Validation empirique obligatoire
3. **Une responsabilité par module** - Pas de God Objects
4. **Tests first** - TDD pour toute nouvelle feature
5. **Documentation au fil de l'eau** - Pas de code sans doc

## Structure du Monorepo

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

## Packages Principaux

### Package: main

**Responsabilité:** Gestion de l'application Electron.

**Modules clés:**
- `index.ts` - Point d'entrée, création de la fenêtre
- `ipc/` - Handlers IPC
- `database/` - Gestion SQLite
- `services/` - Services système
- `window-manager.ts` - Gestion fenêtres

### Package: renderer

**Responsabilité:** Interface utilisateur React.

**Stack:**
- React 18 + TypeScript
- TanStack Query (data fetching)
- Zustand (state management)
- Radix UI + Tailwind CSS

### Package: preload

**Responsabilité:** Bridge sécurisé entre renderer et main.

**API exposée:**
```typescript
window.electronAPI = {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, callback) => ipcRenderer.on(channel, callback),
  platform: process.platform,
  // ...
}
```

### Package: shared

**Responsabilité:** Types, schemas Zod, et constantes partagées.

### Package: ai-engine

**Responsabilité:** Moteur d'agents IA simplifié (post-refactoring -93% code).

**Structure:**
```
ai-engine/src/
├── providers/        # Multi-provider
├── context/          # Smart chunking
├── compaction/       # Minification simple
├── prompts/          # System prompts
├── tokens/           # Token counting
├── tools/            # Tools pour agents
└── simple-agent-manager.ts  # Queue simple
```

## Système d'Agents IA

### Architecture Simplifiée

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

Queue simple pour exécuter des tâches séquentiellement:

```typescript
class SimpleAgentManager {
  private queue: Array<AgentTask> = []
  private running: AgentTask | null = null

  async enqueue(task: AgentTask): Promise<void> {
    this.queue.push(task)
    if (!this.running) await this.processNext()
  }

  private async processNext(): Promise<void> {
    if (this.queue.length === 0) return
    this.running = this.queue.shift()!
    
    try {
      await this.running.execute()
    } finally {
      this.running = null
      await this.processNext()
    }
  }
}
```

**Pourquoi simple?**
- Les tâches IA sont I/O-bound, pas CPU-bound
- Fraction séquentielle importante (dépendances entre fichiers) — **non chiffrée** :
  le « 95%+ » affiché ici n'était pas mesuré
- Worker pool complexe = 2,000 lignes pour 0% de gain

## Communication IPC

### Channels Disponibles

::: warning Corrigé le 17/08/2026
Cette section listait 8 canaux (`fs:read`, `fs:write`, `fs:list`, `fs:watch`,
`ai:send`, `ai:stream`, `ai:cancel`, `ai:list-tasks`). **Aucun n'était
enregistré côté main** : les noms réels diffèrent, ou le canal n'existe pas.
Liste ci-dessous extraite des `ipcMain.handle(...)` du dépôt.
:::

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
'ai:stream-response'  // Démarrer un stream
'ai:stop-stream'      // Interrompre le stream
```

76 canaux sont enregistrés au total (`git:*`, `mcp:*`, `debug:*`,
`automation:*`, `terminal:*`, `workspace:*`, `search:*`, `editor:*`, `db:*`,
`update:*`, `chat:export`). La source de vérité est
`packages/shared/src/types/ipc/channels.ts` et les handlers de
`packages/main/src/ipc/handlers/`.

`fs:watch` / `fs:unwatch` et les six `event:mcp-*` sont déclarés mais **non
implémentés** côté main : s'y abonner ne produit rien.

### Sécurité IPC

Vérifié le 17/08/2026 :

- ✅ Validation Zod des payloads — `schema.parse()` dans `handler-factory.ts` ;
  les trois handlers hors fabrique valident aussi (`debug`, `ai-stream`) ou ne
  prennent pas de payload (`update`).
- ✅ Allowlist de canaux dans `packages/preload/src/index.ts` — un canal non
  listé est rejeté.
- ✅ `nodeIntegration: false` — `packages/main/src/security.ts:238`.
- ✅ `contextIsolation: true` et `sandbox: true` — `security.ts:243-244`.

## Base de Données

### Schema SQLite

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

-- Messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  role TEXT,
  content TEXT,
  tokens INTEGER,
  created_at INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Usage tracking
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
```

## Décisions d'Architecture

### Pourquoi Electron?

**Avantages:**
- ✅ Cross-platform
- ✅ Accès natif au système de fichiers
- ✅ Ecosystem mature

**Inconvénients acceptés:**
- ⚠️ Bundle size (~150MB)
- ⚠️ Memory footprint plus élevé

### Pourquoi Bun?

**Avantages:**
- ✅ Performance (3-5x plus rapide que npm)
- ✅ Monorepo natif
- ✅ Runtime moderne

### Pourquoi SQLite?

**Avantages:**
- ✅ Pas de serveur séparé
- ✅ Portable (un seul fichier)
- ✅ Performance excellente
- ✅ Transactions ACID

## Le Refactoring de 2026

En août 2026, un audit approfondi a révélé que **93% du code (5,000 lignes sur 5,350)** était inutile.

### Ce qui a été supprimé

#### ❌ Système de cache L1/L2/L3 (1,500 lignes)

**Problème:**
- Pas utilisé en production
- Redondant avec cache natif Anthropic
- Économie réelle: 3.3% tokens vs 60% promis

#### ❌ Background Agent Worker Pool (2,000 lignes)

**Problème:**
- Tâches IA sont I/O-bound
- Worker pool n'apporte rien
- Fraction séquentielle importante — **non chiffrée**, le « 95%+ » précédent
  n'était pas mesuré

#### ❌ Compaction MODERATE/AGGRESSIVE (270 lignes)

**Problème:**
- Perte d'information jugée critique à la relecture des sorties
  (le « -28 % qualité » affiché auparavant n'était pas mesuré : aucun juge de
  qualité n'existe dans le dépôt)
- MINIMAL suffit

#### ❌ Context Prediction ML (200 lignes)

**Problème:**
- Cold start problem
- Nécessite 1000+ requêtes pour être utile

### Résultat

```
AVANT:
- 5,000 lignes de code complexe
- 11 composants sophistiqués
- 0% utilisé en production
- 15% test coverage

APRÈS:
- 350 lignes de code simple (-93%)
- 2 composants (SmartChunker + minifier)
- Qualité de réponse : non mesurée (aucun harness d'eval dans le repo)
- 80%+ test coverage
```

**Leçon:** La sophistication technique n'est pas un but en soi.

## Principes pour le Futur

### 1. Validation empirique obligatoire

Avant d'ajouter un système complexe:
1. ✅ Mesurer le problème
2. ✅ Prototype simple (MVP)
3. ✅ A/B test avec baseline
4. ✅ Décision data-driven

### 2. Supprimer sans pitié

Si un module:
- ❌ N'est pas utilisé après 3 mois
- ❌ N'a pas de tests >50% coverage
- ❌ N'a pas de metrics d'impact

→ **SUPPRIMER**

### 3. Tests first

Nouvelle feature = tests AVANT code (TDD strict)

## Resources

- [Refactoring Story →](/architecture/refactoring)
- [Contributing →](/developer/contributing)
- [API Reference →](/api/)

<!-- Liens retirés le 17/08/2026 : `/developer/advanced/ipc` et
     `/developer/packages/ai-engine` n'existent pas (entrées de barre latérale
     sans fichier correspondant). -->

