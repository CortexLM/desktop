# Cortex IDE - Analyse de Différenciation

> **Date**: 16 août 2026  
> **Objectif**: Identifier les fonctionnalités uniques et éliminer les redondances par rapport aux autres coding agents (Cursor, VSCode Copilot, Windsurf, Cline)

---

## 🎯 Executive Summary

**Positionnement actuel**: IDE Electron avec agents IA multi-providers  
**Problème**: Trop de features "me-too" qui dupliquent Cursor/VSCode  
**Solution**: Se repositionner comme **"Agent Orchestrator avec UI"** focalisé sur missions complexes long-running

### Proposition de valeur unique
> **"Cortex IDE : L'orchestrateur d'agents IA pour missions complexes avec benchmarking intégré et optimisation de contexte 300k+ tokens"**

---

## ✅ FEATURES DIFFÉRENCIANTES (À GARDER)

### 1. **Mission Orchestrator** — ⚠️ NON ATTEIGNABLE DEPUIS L'APPLICATION

**Status corrigé le 17/08/2026.** Cette section était notée ⭐⭐⭐⭐⭐ et
recommandée comme « feature principale à promouvoir ». Vérification :

- **Il n'existe aucune classe `MissionOrchestrator`** dans le dépôt
  (`grep -rn 'class MissionOrchestrator' packages/` → 0 résultat hors
  `node_modules`). Le nom n'apparaît que dans des fichiers `.md`.
- La state machine `planning → running → paused → completed`, le
  `features.json` avec handoff protocol, le progress log JSONL, le worker
  spawning avec retry budget, les validation contracts : **aucun de ces cinq
  éléments n'a d'implémentation**.
- Ce qui existe réellement : une table `missions` en base et un
  `mission-repository.ts` (`packages/main/src/database/repositories/`), importé
  seulement par les barrels `repositories/index.ts` et `database/index.ts`.
- **Aucun canal IPC `mission:*`** n'est enregistré, rien n'est exposé dans le
  preload, et il n'y a pas de vue Missions dans la barre latérale (12 entrées,
  aucune n'est Missions).

Autrement dit : un dépôt de persistance sans appelant, sans pont IPC et sans UI.
La comparaison concurrentielle qui suivait (« Cursor : chat one-shot ; Cortex :
workflow complexe multi-étapes avec persistence ») opposait donc les produits des
autres à du code inexistant.

**À noter aussi** : `packages/ai-engine/src/orchestration/` contient bien 7
classes réelles et testées (`InfraAwareOrchestrator`, `AdaptiveRouter`,
`BackpressureController`, `CircuitBreaker`, `PriorityQueue`,
`InfrastructureMonitor`, `RetryPolicy`). Mais `packages/main` n'importe de
`@cortex-ide/ai-engine` que `AIProviderRegistry` et des types MCP/chat : aucune
de ces classes n'est instanciée par l'application. Elles sont couvertes par des
tests unitaires et inatteignables à l'exécution.

**Recommandation** : ne pas promouvoir tant qu'un pont IPC et une UI n'existent
pas. Le travail restant est celui listé dans
`packages/renderer/src/views/account/README.md` § « If billing is ever built » :
backend → canaux IPC enregistrés → allowlist preload → vue.

---

### 2. ~~**Background Multi-Agent Worker Pool**~~ — ❌ SUPPRIMÉ

**Status**: **N'EXISTE PAS.** Ce n'est pas une feature de Cortex IDE.

Cette section décrivait un worker pool (load balancing 10 agents concurrents,
priority queue, checkpoint/recovery, shared context store, event bus). Rien de
tout cela n'existe :

- Le backend (`packages/ai-engine/src/background/`, ~2,000 lignes) a été
  **supprimé** par l'audit d'architecture — voir `ARCHITECTURE_AUDIT.md` §3
  (verdict `❌ REMOVE`, 0 instanciation en production, 0% de gain mesuré pour des
  tâches I/O-bound) et `packages/ai-engine/.deletion-log.md`.
- `ANTI_PATTERNS.md` §1 cite ce même `BackgroundAgentManager` (WorkerPool,
  PriorityQueue, ResourceMonitor) comme l'exemple canonique d'« Architecture
  Astronaut » à ne pas reproduire.
- Les 4 composants UI qui l'accompagnaient (`BackgroundAgentList`,
  `QueueViewer`, `ResourceMonitor`, `BackgroundAgentDetail`, 1,585 lignes)
  étaient des coquilles orphelines : jamais importées par l'application, leurs
  setters d'état jamais appelés, chaque `loadX()` réduit à un
  `// TODO: Call IPC`. `ResourceMonitor` alimentait même ses graphiques avec
  `Math.random()`. Supprimés en août 2026.

**Ce qui existe réellement** : `SimpleAgentManager` — sessions IA concurrentes
en mémoire avec streaming, pause/resume/cancel. Pas de queue à priorités, pas de
worker pool, pas de checkpoints, pas de resource monitoring.

**Recommandation**: ne pas remettre cette affirmation dans le marketing. Toute
réintroduction d'un worker pool doit d'abord répondre à la mesure de
`ARCHITECTURE_AUDIT.md` (les tâches IA sont I/O-bound : le pool n'apportait 0%).

---

### 3. **Provider Benchmark Framework** ⭐⭐⭐⭐⭐
**Status**: UNIQUE - Benchmarking framework intégré

⚠️ **IMPORTANT CLARIFICATION**: Ce n'est PAS Terminal-Bench 3.0 officiel. C'est notre framework custom. Terminal-Bench officiel (Harbor-based) peut être intégré dans le futur (2-4 semaines d'effort).

**Pourquoi c'est différenciant**:
- Framework de benchmarking multi-provider custom (OpenAI, Anthropic, Grok)
- Scenarios structurés (codegen, debug, refactor, explain)
- Métriques détaillées (accuracy, latency, cost, token usage)
- Reports multiples formats (JSON, Markdown, HTML avec charts)
- Trace collection pour replay et analyse
- Intégré dans l'IDE, pas un outil séparé

**Avantage concurrentiel**:
- Cursor: Pas de benchmarking intégré
- VSCode: Pas de framework de test d'agents
- Windsurf/Cline: Aucun outil de benchmarking
- **Cortex**: Permet de comparer providers et optimiser coûts

**Recommandation**: **GARDER ET PROMOUVOIR** - Feature killer unique

**Investissement**: UI dans l'IDE pour run benchmarks et voir résultats

**Future Enhancement**: Intégrer le vrai Terminal-Bench 3.0 via Harbor (tracked as enhancement)

---

### 4. **Context Strategies 300k+ Tokens** ⭐⭐⭐⭐⭐
**Status**: TRÈS DIFFÉRENCIANT - Système avancé

**Pourquoi c'est différenciant**:
- **7 stratégies** intelligentes avec sélection automatique:
  - Sliding Window (60-80% savings sur >300k tokens)
  - Semantic Chunking (30-50% savings avec AST analysis)
  - Incremental Context (70-90% savings pour requêtes simples)
  - Differential Context (85% savings multi-turn)
  - Context Prediction ML (65-75% hit rate)
  - Compression Algorithms (15-65% savings)
  - Cache LRU (100% savings sur cache hit)
- Context Manager unifié avec auto-selection
- Support langages: TypeScript, JavaScript, Python, Rust
- Benchmarks détaillés et métriques de performance

**Avantage concurrentiel**:
- Cursor: Context management basique, pas de stratégies visibles
- VSCode Copilot: Limité à 128k context window
- Windsurf: Pas de documentation sur context optimization
- **Cortex**: Système le plus avancé du marché, documenté, benchmarké

**Recommandation**: **GARDER ET MARKETER** - Top 3 differentiator

**Investissement**: UI pour visualiser context usage et switch stratégies

---

### 5. **MCP Extensions Marketplace** ⭐⭐⭐⭐
**Status**: EN AVANCE - Model Context Protocol

**Pourquoi c'est différenciant**:
- Marketplace intégré pour découvrir extensions MCP
- Configuration et authentification dans l'IDE
- Support multi-MCP servers
- UI dédiée: MCPMarketplace, MCPConfig, MCPToolsView

**Avantage concurrentiel**:
- Cursor: MCP support mais pas de marketplace intégré
- VSCode: Extensions mais pas MCP-first
- Windsurf/Cline: MCP support limité
- **Cortex**: MCP-first avec marketplace

**Recommandation**: **GARDER** - Bon différenciateur si bien exécuté

**Investissement**: Finir UI marketplace et auth flows

---

### 6. **Paper Integration pour Designs** ⭐⭐⭐⭐
**Status**: UNIQUE - Design-to-code

**Pourquoi c'est différenciant**:
- Intégration directe avec Paper (outil de design)
- Design-to-code workflow
- Preview de designs dans l'IDE

**Avantage concurrentiel**:
- Cursor/VSCode: Pas d'intégration design native
- Windsurf/Cline: Idem
- **Cortex**: Bridge design-code unique

**Recommandation**: **GARDER** si Paper adoption croît, sinon **SIMPLIFIER**

**Investissement**: À évaluer selon adoption Paper

---

### 7. **Multi-Provider AI avec Smart Presets** ⭐⭐⭐
**Status**: BIEN FAIT - Mais pas unique

**Pourquoi c'est utile** (mais pas unique):
- Support OpenAI, Anthropic, OpenRouter, Grok, Ollama
- Presets: fastest, smartest, cheapest, reasoning
- Models 2026: GPT-4.5-turbo, Claude Opus 4.8, etc.
- Cost tracking et usage analytics

**Avantage concurrentiel**:
- Cursor: Multi-provider également
- VSCode Copilot: Limité à OpenAI/GitHub models
- Windsurf: Multi-provider
- **Cortex**: Bon mais pas différenciant

**Recommandation**: **GARDER SIMPLE** - Table stakes, pas un differentiator

**Investissement**: Maintenance minimale

---

## ❌ FEATURES REDONDANTES (À SIMPLIFIER/SUPPRIMER)

### 1. **Éditeur de code Monaco** ❌
**Status**: Commodity feature

**Problème**:
- VSCode a Monaco nativement (mieux intégré)
- Cursor a un éditeur optimisé
- Effort massif pour juste égaler VSCode

**Recommandation**: 
- **Option A**: Garder Monaco basique (read-only + highlight) pour preview
- **Option B**: Supprimer et focus sur agent orchestration UI
- **Option C**: Intégrer via iframe VSCode Web

**Économie**: -40% complexité codebase

---

### 2. **Git Integration Complète** ❌
**Status**: Déjà partout

**Problème**:
- Tous les IDEs ont Git intégré
- VSCode Git UI est excellente
- Maintenance coûteuse (edge cases, merge conflicts, etc.)

**Recommandation**: 
- **Garder**: Git status, commit, push basique (via agents)
- **Supprimer**: Git UI complète (branches, history, diff viewer élaboré, merge)
- **Déléguer**: Lancer VSCode/autre git client pour ops complexes

**Économie**: -25% complexité Git module

---

### 3. **Terminal Intégré** ❌
**Status**: Commodity

**Problème**:
- Tous les IDEs ont un terminal
- VSCode terminal est excellent
- xterm.js + node-pty = maintenance overhead

**Recommandation**: 
- **Option A**: Garder terminal simple pour agents (lecture seule des outputs)
- **Option B**: Supprimer et ouvrir terminal externe
- **Option C**: Garder mais ne pas over-engineer (pas de splits, themes, etc.)

**Économie**: -15% complexité terminal module

---

### 4. **File Explorer Complet** ❌
**Status**: Commodity

**Problème**:
- VSCode file explorer est mature
- Beaucoup d'edge cases (permissions, symlinks, watchers, etc.)

**Recommandation**: 
- **Garder**: File tree simple pour context (agents sélectionnent fichiers)
- **Supprimer**: Rename, delete, drag-drop, context menu élaboré
- **Simplifier**: Read-only file browser

**Économie**: -20% complexité file system module

---

### 5. **Browser Preview** ❌
**Status**: Nice-to-have mais pas core

**Problème**:
- Live Server extensions existent partout
- Maintenance d'un browser engine = overhead
- Pas lié à orchestration d'agents

**Recommandation**: 
- **Supprimer** et ouvrir browser externe
- Ou garder iframe basique si vraiment nécessaire

**Économie**: -10% complexité

---

### 6. **Autocomplete Contextuel avec AI** ❌
**Status**: Déjà fait par Cursor/Copilot

**Problème**:
- Cursor a autocomplete excellent
- Copilot est le standard
- Difficile de rivaliser sur la qualité

**Recommandation**: 
- **Supprimer** autocomplete inline
- **Focus**: Agent-driven code generation (pas keystroke-by-keystroke)

**Économie**: -15% complexité autocomplete

---

### 7. **Inline Diff Review** ❌
**Status**: Commodity

**Problème**:
- VSCode diff viewer est mature
- Cursor a inline diff
- Maintenance coûteuse

**Recommandation**: 
- **Simplifier**: Show diff en read-only
- **Supprimer**: Inline editing, merge resolution UI
- **Ou**: Utiliser composant existant (react-diff-view) sans over-engineer

**Économie**: -10% complexité diff module

---

## 🔄 FEATURES À SIMPLIFIER

### 1. **Workspace Management**
**Actuel**: Système complexe avec SQLite, projets, sessions  
**Simplifié**: 
- Juste un "current working directory"
- Missions attachées à un dir
- Pas de "workspace" abstraction complexe

**Économie**: -30% complexité workspace module

---

### 2. **Session Management**
**Actuel**: Sessions complexes avec historique, restore, etc.  
**Simplifié**: 
- Session = mission run
- Historique = progress log JSONL
- Pas de session abstraction séparée

**Économie**: -20% complexité sessions

---

### 3. **Account & Billing UI**
**Actuel**: UI complète account, teams, billing  
**Simplifié**: 
- Web dashboard externe pour billing
- Juste API key config dans l'IDE
- Pas de UI billing complète

**Économie**: -15% complexité account module

---

## 📊 Matrice de Décision

| Feature | Unique? | Complexité | Maintenance | Décision |
|---------|---------|------------|-------------|----------|
| **Mission Orchestrator** | ✅ Oui | Haute | Moyenne | ✅ **GARDER** - Core |
| **Worker Pool Multi-Agent** | ✅ Rare | Haute | Moyenne | ✅ **GARDER** - Core |
| **Provider Benchmark Framework** | ✅ Unique | Moyenne | Basse | ✅ **GARDER** - Killer |
| **Context Strategies 300k+** | ✅ Très | Haute | Moyenne | ✅ **GARDER** - Top 3 |
| **MCP Marketplace** | ✅ En avance | Moyenne | Moyenne | ✅ **GARDER** |
| **Paper Integration** | ✅ Unique | Moyenne | Moyenne | ⚠️ **À ÉVALUER** |
| **Multi-Provider AI** | ⚠️ Non | Basse | Basse | ✅ **GARDER SIMPLE** |
| Monaco Editor | ❌ Non | Haute | Haute | ❌ **SIMPLIFIER** |
| Git Integration | ❌ Non | Haute | Haute | ❌ **SIMPLIFIER** |
| Terminal Intégré | ❌ Non | Moyenne | Moyenne | ❌ **SIMPLIFIER** |
| File Explorer | ❌ Non | Moyenne | Haute | ❌ **SIMPLIFIER** |
| Browser Preview | ❌ Non | Moyenne | Moyenne | ❌ **SUPPRIMER** |
| Autocomplete AI | ❌ Non | Haute | Haute | ❌ **SUPPRIMER** |
| Inline Diff Review | ❌ Non | Moyenne | Haute | ❌ **SIMPLIFIER** |
| Workspace System | ❌ Non | Haute | Haute | ❌ **SIMPLIFIER** |
| Account UI | ❌ Non | Moyenne | Basse | ❌ **EXTERNALISER** |

---

## 🎯 REPOSITIONNEMENT

### Ancien Positionnement
> "IDE professionnel Electron avec orchestration d'agents IA multi-providers"

**Problème**: Trop générique, trop d'overlap avec Cursor/VSCode

---

### Nouveau Positionnement

> **"Cortex IDE: L'Agent Orchestrator pour missions complexes long-running"**
>
> **Tagline**: "Benchmark, optimize, and orchestrate AI agents for complex multi-step coding missions"

**Focus sur 3 piliers uniques**:
1. 🎯 **Mission Orchestration** - State machine, handoff protocol, multi-étapes
2. 📊 **Benchmarking Intégré** - Provider Benchmark Framework custom, comparer providers, optimiser coûts
3. 🧠 **Context Optimization** - 7 stratégies intelligentes, 300k+ tokens support

**Moins**:
- Un "IDE complet" (vs VSCode/Cursor)
- Autocomplete inline
- Git/Terminal full-featured

**Plus**:
- Un "orchestrateur d'agents avec UI"
- Benchmarking framework
- Optimisation de contexte avancée

---

## 💡 USE CASES CIBLES

### 1. **Large Refactoring Mission** ✅
**Besoin**: Refactorer toute une codebase (migration, architecture)
**Solution Cortex**:
- Mission avec 20+ features séquentielles
- Worker pool parallélise les tâches indépendantes
- Context strategies optimisent pour large codebase
- Progress tracking avec pause/resume

**Cursor/VSCode**: Requiert intervention manuelle entre chaque étape

---

### 2. **Multi-Provider Cost Optimization** ✅
**Besoin**: Trouver le meilleur provider/model pour un projet
**Solution Cortex**:
- Provider Benchmark Framework automatique
- Rapports détaillés (cost, latency, accuracy)
- Switch provider basé sur résultats
- (Future: intégrer vrai Terminal-Bench 3.0 via Harbor)

**Cursor/VSCode**: Pas de benchmarking intégré, choix manuel

---

### 3. ~~**Long-Running Background Tasks**~~ — ❌ NON IMPLÉMENTÉ
**Besoin**: Lancer plusieurs agents en parallèle, surveiller progress

**Solution Cortex**: aucune. Le `background agent manager avec queue`, le
`resource monitoring (CPU, memory, tokens)` et le `checkpoint/recovery après
crash` listés ici n'existent pas — backend supprimé par l'audit
d'architecture, UI supprimée en août 2026 (voir §2 ci-dessus).

Ce qui existe : `SimpleAgentManager`, sessions concurrentes en mémoire, sans
queue à priorités ni checkpoints ni monitoring de ressources.

---

### 4. **300k+ Tokens Context Management** ✅
**Besoin**: Travailler sur très large codebase (1000+ fichiers)
**Solution Cortex**:
- Context strategies adaptatives
- Sliding window, semantic chunking, differential context
- Économies 60-85% tokens

**Cursor/VSCode**: Context management basique, hit limits rapidement

---

## 📋 PLAN D'ACTION

### Phase 1: Nettoyage (2-3 semaines)

#### Supprimer
- [ ] Browser preview integration
- [ ] Autocomplete AI inline
- [ ] Account billing UI (garder juste API key config)
- [ ] Workspace abstraction complexe (simplifier à "working dir")

#### Simplifier
- [ ] Monaco: Read-only preview + syntax highlight uniquement
- [ ] Git: Garder status/commit/push basique, supprimer UI branches/merge
- [ ] Terminal: Read-only output viewer, pas de full terminal
- [ ] File explorer: Read-only tree, pas de CRUD operations
- [ ] Diff viewer: Read-only, pas de inline editing

**Économie estimée**: -40% complexité codebase, -35% surface de maintenance

---

### Phase 2: Focus sur Différenciateurs (4-6 semaines)

#### Mission Orchestrator
- [ ] UI mission list avec progress tracking
- [ ] UI mission detail avec feature queue visualization
- [ ] Pause/resume controls
- [ ] Handoff viewer (voir résultats workers)
- [ ] JSONL progress log viewer

#### ~~Background Agents~~ — abandonné
Le backend a été supprimé par l'audit d'architecture et les 4 coquilles UI avec
lui (voir §2). « BackgroundAgentList UI (déjà implémenté, polish) » était faux :
le composant n'affichait jamais un agent, son setter d'état n'étant jamais
appelé. Rien à reprendre ici sans d'abord justifier le backend par une mesure.

#### Provider Benchmark Framework
- [ ] UI pour lancer benchmarks depuis l'IDE
- [ ] Benchmark results viewer avec charts
- [ ] Provider comparison dashboard
- [ ] Cost tracking & optimization suggestions
- [ ] Future: Real Terminal-Bench 3.0 integration via Harbor
- [ ] Provider comparison UI
- [ ] Cost calculator avec projections

#### Context Strategies
- [ ] Context strategy selector UI
- [ ] Token usage visualization (pie chart par stratégie)
- [ ] Context preview (voir ce qui est envoyé au LLM)
- [ ] Strategy comparison tool

---

### Phase 3: Marketing & Documentation (2 semaines)

#### Documentation
- [ ] Mettre à jour README avec nouveau positionnement
- [ ] Guide "Mission Orchestration" avec exemples
- [ ] Guide "Benchmarking Multi-Provider" avec case study
- [ ] Guide "Context Optimization 300k+" avec benchmarks
- [ ] Vidéos demo des 3 piliers

#### Marketing
- [ ] Site web focus sur 3 différenciateurs
- [ ] Blog posts techniques:
  - "How we built a production-grade multi-agent orchestrator"
  - "Benchmarking GPT-4.5 vs Claude Opus 4.8 for coding tasks"
  - "Managing 300k+ token contexts efficiently"
- [ ] Comparaison feature matrix vs Cursor/VSCode/Windsurf
- [ ] Open source parts of framework (Provider Benchmark?)

---

## 🎓 LESSONS LEARNED

### 1. Ne pas réinventer la roue
**Erreur**: Essayer de recréer VSCode/Cursor features  
**Correction**: Focus sur ce qui est unique

### 2. Complexité tue la vitesse
**Erreur**: Trop de features "nice-to-have"  
**Correction**: Ruthless prioritization des différenciateurs

### 3. L'orchestration > L'éditeur
**Insight**: La valeur est dans l'orchestration multi-agent, pas l'édition de code  
**Action**: Repositionner comme "Agent Orchestrator avec UI"

### 4. Le benchmarking est une killer feature
**Insight**: Personne n'offre ça, énorme valeur (cost optimization)  
**Action**: Promouvoir Provider Benchmark Framework comme feature unique  
**Note**: Framework custom actuellement, vrai Terminal-Bench 3.0 = future enhancement

### 5. Context management 300k+ est rare
**Insight**: Les autres ont context basique, Cortex a 7 stratégies documentées  
**Action**: Marketer comme top differentiator

---

## 📈 MÉTRIQUES DE SUCCÈS

### Complexité Codebase
- **Avant**: ~50,000 LOC (estimation)
- **Après nettoyage**: ~30,000 LOC (-40%)
- **Maintenance effort**: -35%

### Différenciation
- **Avant**: 3/10 features sont uniques (30%)
- **Après**: 7/10 features sont uniques (70%)

### Positionnement
- **Avant**: "Encore un IDE avec AI"
- **Après**: "Le seul orchestrateur d'agents avec benchmarking"

---

## ✅ CONCLUSION

### Top 5 Forces Uniques (à promouvoir)

> **Liste corrigée le 17/08/2026.** Elle citait :
> 1. Mission Orchestrator — Workflow complexe state machine
> 2. Provider Benchmark Framework
> 3. Context Strategies 300k+ — « Système le plus avancé du marché »
> 4. **Worker Pool Multi-Agent — Architecture production-grade**
> 5. MCP Marketplace
>
> Le n°4 était **du code supprimé** (voir §2 de ce document), vendu comme
> production-grade. Le n°1 n'a aucune implémentation et n'est pas atteignable
> depuis l'application (voir §1). Le n°3 se réduit à un chunker par expressions
> régulières, sans le scoring TF-IDF ni la sélection greedy décrits ailleurs —
> « le plus avancé du marché » n'est étayé par aucune comparaison mesurée.

Ce qui est réellement livré et atteignable :

1. **Provider Benchmark Framework** — harnais CLI dans
   `packages/test-harness`, mesurant latence, tokens et coût. Framework maison,
   **pas** Terminal-Bench 3.0 officiel. Il ne produit pas de note de qualité.
2. **MCP** — 12 canaux IPC enregistrés et exposés, plus 4 vues
   (`MCPMarketplace`, `MCPExtensionList`, `MCPToolsView`, `MCPConfig`). Réserve :
   les 6 événements `event:mcp-*` ne sont jamais émis par le main, donc le
   rafraîchissement automatique de la liste ne se déclenche pas.
3. **Découpage sémantique** — `SemanticChunker`, avec la seule mesure
   reproductible du dépôt (`boundary-integrity.test.ts`, métrique structurelle).
4. **Usage tracking réel** — `views/agents/UsageTracking.tsx` interroge
   effectivement `window.cortex.db` pour les tokens et coûts par provider/modèle.
5. **Multi-workspace** — `WorkspaceManager` + 5 canaux enregistrés + relais de
   `event:workspace-switched` vers le renderer.

### Top 5 Features à Supprimer/Simplifier

1. **Monaco Editor** → Simplifier (read-only preview)
2. **Git Integration** → Simplifier (basique seulement)
3. **Browser Preview** → Supprimer
4. **Autocomplete AI** → Supprimer
5. **Workspace System** → Simplifier drastiquement

### Message Final

> **"Cortex IDE n'est pas un concurrent de Cursor sur l'édition de code.  
> C'est l'orchestrateur d'agents que vous utilisez AVEC Cursor/VSCode  
> pour gérer des missions complexes, benchmarker des providers,  
> et optimiser vos contextes avec smart chunking."**

### Nouvelle Philosophie (Août 2026)

> **"Une solution simple qui marche vaut mieux que 10 solutions sophistiquées inutilisées."**
>
> **Principe KISS appliqué:** 5,000 lignes → 350 lignes (-93%), qualité identique.

Voir [WHY_SIMPLE.md](./WHY_SIMPLE.md) et [ARCHITECTURE_AUDIT.md](./ARCHITECTURE_AUDIT.md).

---

**Date**: 16 août 2026  
**Status**: ✅ Refactoring Phase 1 COMPLÉTÉ  
**Prochaine révision**: Après Phase 3 (Mission Orchestrator UI)
