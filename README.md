# Cortex IDE

**L'orchestrateur d'agents IA pour missions complexes avec benchmarking intégré**

Cortex IDE est un outil de développement focalisé sur l'orchestration d'agents IA multi-providers pour des tâches de coding complexes et long-running. Contrairement aux IDE traditionnels avec autocomplete, Cortex se spécialise dans la gestion de missions multi-étapes, l'optimisation de contexte 300k+ tokens, et le benchmarking de providers IA.

## 🎯 Pourquoi Cortex est différent

Cortex n'est **pas** un concurrent de Cursor ou VSCode sur l'édition de code. C'est l'orchestrateur d'agents que vous utilisez **avec** votre IDE préféré pour gérer des missions complexes qui nécessitent:

- 📊 **Benchmarking de providers** - harnais CLI mesurant latence, tokens et coût
- 🧠 **Découpage sémantique** - couper de gros fichiers aux frontières de déclarations
- 🔌 **Extensions MCP** - découvrir, installer et invoquer des serveurs MCP

### Ce que Cortex fait aujourd'hui

Vérifié le 17/08/2026 en lisant le code, pas la documentation :

✅ **Benchmarker des providers** (GPT, Claude, Grok, Ollama, OpenRouter) —
  harnais `packages/test-harness`, en ligne de commande, avec rapports JSON /
  Markdown / HTML. Mesure latence, tokens et coût. **Ne mesure pas la qualité**
  des réponses : aucun juge n'est embarqué.
✅ **Suivre l'usage réel** — tokens et coûts par provider et par modèle, lus
  depuis la base SQLite locale (`views/agents/UsageTracking.tsx`).
✅ **Extensions MCP** — 12 canaux IPC enregistrés, 4 vues (marketplace, liste,
  outils, configuration).
✅ **Multi-workspace** — ajout, retrait, bascule, avec contexte isolé et
  restauration.
✅ **Édition, terminal et Git** — Monaco, PTY réels via node-pty, et un panneau
  Git (status, diff, stage/unstage, commit, push, pull, stash).
✅ **Découpage sémantique** de fichiers (`SemanticChunker`), avec la seule mesure
  reproductible du dépôt.

### Ce que Cortex ne fait pas

❌ **Mission orchestration** — il n'existe aucune classe `MissionOrchestrator`,
  aucun canal IPC `mission:*` et aucune vue Missions. Seule une table `missions`
  et son repository existent, sans appelant. La state machine
  `planning → running → paused → completed`, le handoff protocol et le progress
  log JSONL n'ont pas d'implémentation. Voir `DIFFERENTIATION.md` §1.
❌ **Orchestration parallèle d'agents** — le worker pool a été supprimé
  (0 instanciation, aucun gain mesuré sur des tâches I/O-bound). Les 7 classes
  d'orchestration de `ai-engine/src/orchestration/` existent et sont testées mais
  ne sont instanciées par aucun processus de l'application.
❌ **Missions longues avec pause/resume** — dépend du point ci-dessus.
❌ **UI de benchmarking** — le harnais est en CLI uniquement ; il n'y a pas de vue
  Benchmarks dans l'application, malgré ce qu'annoncent l'écran d'accueil et le
  tutoriel interactif.
❌ **Autocomplete inline** (utilisez Cursor/Copilot pour ça)
❌ **Remplacer votre IDE actuel**

## 🚀 Quick Start

```bash
# Installer les dépendances
bun install

# Build tous les packages
bun run build

# Démarrer en mode développement
bun run dev

# Dans un autre terminal, lancer l'application
bun run start
```

## 📦 Architecture

Application Electron moderne en monorepo avec architecture simplifiée:

```
cortex-ide/
├── packages/
│   ├── main/              # Electron main process
│   ├── renderer/          # React frontend
│   ├── preload/           # Preload scripts
│   ├── shared/            # Types, schemas, constants
│   └── ai-engine/         # Moteur d'agents IA simplifié
├── docs/                  # Documentation technique
├── tests/                 # Tests E2E avec Playwright
└── electron-builder.yml   # Configuration packaging
```

### Principes de conception

Après un refactoring majeur (voir `ARCHITECTURE_AUDIT.md`), Cortex suit maintenant le principe **KISS** (Keep It Simple, Stupid):

- ✅ **Une solution simple qui marche** > 10 solutions sophistiquées inutilisées
- ✅ **Mesurer l'impact réel** avant de construire
- ✅ **Supprimer la complexité inutile** sans pitié
- ✅ **Tester avec TDD** pour garantir la qualité

## 🔧 Stack Technologique

**Frontend**
- React 18 + TypeScript
- TanStack Query (data fetching)
- Zustand (state management)
- Radix UI + Tailwind CSS

**Backend (Main Process)**
- Electron 32+
- Better-SQLite3 (base de données)
- Node-pty (terminaux)
- Simple-git (Git basique)

**AI & Agents**
- Multi-provider: OpenAI, Anthropic, Grok, Ollama, OpenRouter
- Découpage sémantique par frontières de déclarations (`SemanticChunker`) — sans
  gestion de dépendances : l'option existe dans la configuration mais n'est pas
  implémentée
- Registre de providers (`AIProviderRegistry`), streaming par canal dédié
  `ai:stream:<sessionId>`

**Build & Deploy**
- Vite (bundling renderer)
- electron-builder (packaging)
- Bun (runtime et package manager)

## 📚 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Architecture simplifiée post-refactoring
- **[DIFFERENTIATION.md](./DIFFERENTIATION.md)** - Forces uniques vs Cursor/VSCode
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Guidelines avec approche TDD
- **[TESTING.md](./TESTING.md)** - Tests E2E avec Playwright
- **[WHY_SIMPLE.md](./WHY_SIMPLE.md)** - Pourquoi nous avons simplifié l'architecture
- **[ANTI_PATTERNS.md](./ANTI_PATTERNS.md)** - Anti-patterns à éviter

### Guides techniques

- **[docs/IPC_ARCHITECTURE.md](./docs/IPC_ARCHITECTURE.md)** - Communication inter-process
- **[docs/AGENT_OPTIMIZATIONS.md](./docs/AGENT_OPTIMIZATIONS.md)** - Optimisations des agents
- **[packages/ai-engine/README.md](./packages/ai-engine/README.md)** - Moteur d'agents simplifié

## 🏗️ Développement

### Scripts disponibles

```bash
bun run dev          # Mode développement avec watch
bun run build        # Build production
bun run start        # Lancer Electron
bun run typecheck    # Vérification TypeScript
bun run test:e2e     # Tests E2E Playwright
bun run clean        # Nettoyer les builds
bun run dist         # Créer les exécutables
```

### Tests

Cortex utilise une approche **Test-Driven Development** avec Playwright pour les tests E2E:

```bash
# Installer les browsers Playwright
bunx playwright install chromium

# Lancer tous les tests
bun run test:e2e

# Tests en mode UI
bun run test:e2e:ui

# Voir le rapport
bun run test:e2e:report
```

Voir [TESTING.md](./TESTING.md) pour plus de détails.

## 🎓 Philosophie de développement

### Lessons Learned

1. **Ne pas réinventer la roue** - Focus sur ce qui est unique
2. **La complexité tue la vitesse** - Ruthless prioritization des différenciateurs
3. **L'orchestration > L'éditeur** - Notre valeur est dans l'orchestration, pas l'édition
4. **Le benchmarking est une killer feature** - Personne d'autre ne l'offre
5. **Mesurer avant de construire** - Pas d'architecture sophistiquée sans validation empirique

Voir [WHY_SIMPLE.md](./WHY_SIMPLE.md) pour l'histoire complète du refactoring.

## 🌟 Features Uniques

### 1. Provider Benchmark Framework
Framework custom pour comparer les providers sur **latence, tokens et coût**, avec
rapports en JSON / Markdown / HTML (`ReportGenerator`). En ligne de commande, dans
`packages/test-harness`. Requiert vos propres clés d'API : les appels sont réels
et facturés.

**Note 1**: Ce n'est PAS Terminal-Bench 3.0 officiel. C'est notre framework
custom. Terminal-Bench officiel peut être intégré dans le futur via Harbor.

**Note 2**: il ne mesure **pas** l'*accuracy* ni aucune note de qualité — ce mot
figurait ici à tort. `packages/test-harness/src/types.ts` n'a ni champ `quality`
ni champ `score`, et aucun juge automatique n'est embarqué. Les seules notes de
qualité du dépôt sont dans `benchmarks/context-bench/mock-results.json`,
explicitement marqué `"Mock data"`.

### 2. Découpage sémantique
`SemanticChunker` coupe un fichier aux frontières de déclarations plutôt qu'à un
nombre de lignes arbitraire.

Mesuré le 17/08/2026 (65 fichiers, 163 déclarations) : au budget 500 tokens,
60,7 % des déclarations arrivent intactes dans un seul chunk, contre 22,7 % pour un
découpage naïf par lignes. Reproductible :
`cd packages/ai-engine && bunx vitest run src/context/__tests__/boundary-integrity.test.ts`.
C'est une métrique **structurelle**, pas une qualité de réponse.

**Correction** : ce paragraphe annonçait « analyse de dépendances (AST-based) ».
Il n'y a pas de parsing AST (le découpage utilise des expressions régulières et un
comptage d'accolades) et pas d'analyse de dépendances. Le chunker découpe le
contenu d'un fichier ; il ne sélectionne pas quoi envoyer au modèle.

### 3. MCP Extensions
Marketplace intégré pour découvrir et installer des serveurs Model Context
Protocol, plus l'invocation d'outils et un système de permissions. 12 canaux IPC
enregistrés et exposés.

**Réserve** : les 6 événements `event:mcp-*` (server-started/stopped/error,
tool-invoked, permission-granted/revoked) ne sont jamais émis par le processus
main. `MCPExtensionList` s'y abonne pour se rafraîchir, ce rafraîchissement ne se
déclenche donc jamais.

## 🗺️ Roadmap

- [x] Phase 1: Setup monorepo et fondations
- [x] Phase 2: Refactoring architecture — suppression de sous-systèmes spéculatifs
      (cache multi-niveaux, worker pool background, orchestrateur CLI-style,
      stockage de missions)
- [ ] Phase 3: Mission orchestrator (backend **et** UI — rien n'existe côté code
      aujourd'hui, voir « Ce que Cortex ne fait pas »)
- [ ] Phase 4: Benchmarking UI intégré (le harnais est CLI uniquement)
- [ ] Phase 5: Smart chunking avec visualisation
- [ ] Phase 6: Polish & distribution

> **Le « -93% code » a été retiré de la Phase 2.** Ce chiffre venait d'une
> *recommandation* d'`ARCHITECTURE_AUDIT.md` portant sur 4 sous-systèmes audités
> (~5 000 lignes ramenées à ~350), pas sur le dépôt entier. Le seul journal de
> suppression réel (`packages/ai-engine/.deletion-log.md`) mesure **-56,5 %** sur
> ce package (10 401 → 4 519 LOC), et `packages/ai-engine/src` compte aujourd'hui
> 13 358 lignes hors tests. Il n'y a pas d'historique de version dans ce dépôt
> permettant de reconstituer un avant/après fiable.

## 🤝 Contributing

Les contributions sont les bienvenues! Consultez [CONTRIBUTING.md](./CONTRIBUTING.md) pour:

- Guidelines de développement avec TDD
- Conventions de code
- Process de Pull Request
- Architecture decisions

## 📄 License

MIT © Cortex IDE Team

---

**Note**: Cortex IDE a subi un refactoring majeur basé sur un audit
d'architecture : les sous-systèmes spéculatifs (cache multi-niveaux, worker pool
background, prédiction ML de contexte, encodage différentiel) ont été supprimés et
sont absents du code aujourd'hui. Voir
[ARCHITECTURE_AUDIT.md](./ARCHITECTURE_AUDIT.md).

Le chiffre de « 93% du code supprimé » qui figurait ici a été retiré : c'était une
recommandation portant sur les 4 sous-systèmes audités, pas une mesure du dépôt.
Voir la note sous la Roadmap.

**Sur les chiffres de tests et de couverture** : ce README n'en cite aucun
volontairement. Ils bougent vite (393 → ~3 800 tests en une nuit) et toute valeur
figée devient fausse. Pour l'état courant :
`bun run test:coverage` (mesure globale) ou
`cd packages/<nom> && bunx vitest run --coverage` (par package, ce que la CI
applique).
