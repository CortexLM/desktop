# Documentation Index - Cortex IDE

**Dernière mise à jour:** 16 août 2026  
**Status:** ✅ Post-Refactoring Phase 1

---

## 📚 Documentation Principale

### Pour Utilisateurs

- **[README.md](./README.md)** - Vue d'ensemble, quick start, philosophie
- **[WHY_SIMPLE.md](./WHY_SIMPLE.md)** - Histoire du refactoring (-93% code)
- **[DIFFERENTIATION.md](./DIFFERENTIATION.md)** - Forces uniques vs Cursor/VSCode

### Pour Contributeurs

- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Guidelines avec TDD, standards, PR process
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Architecture complète post-refactoring
- **[ANTI_PATTERNS.md](./ANTI_PATTERNS.md)** - Anti-patterns à éviter (lessons learned)
- **[TESTING.md](./TESTING.md)** - Tests E2E avec Playwright

### Audit & Décisions

- **[ARCHITECTURE_AUDIT.md](./ARCHITECTURE_AUDIT.md)** - Audit complet (août 2026)
- **[PERFORMANCE.md](./PERFORMANCE.md)** - Performance benchmarks

---

## 🔧 Documentation Technique

### AI Engine

- **[packages/ai-engine/README.md](./packages/ai-engine/README.md)** - Moteur IA simplifié
- **[packages/ai-engine/AI_MODELS_2026.md](./packages/ai-engine/AI_MODELS_2026.md)** - Modèles 2026
- **[packages/ai-engine/CHANGELOG.md](./packages/ai-engine/CHANGELOG.md)** - Historique changements

### Context & Chunking

- **[packages/ai-engine/src/context/README.md](./packages/ai-engine/src/context/README.md)** - Smart chunking
- **[packages/ai-engine/src/context/SIMPLIFICATION.md](./packages/ai-engine/src/context/SIMPLIFICATION.md)** - Simplification du contexte

### Compaction

- **[packages/ai-engine/src/compaction/README.md](./packages/ai-engine/src/compaction/README.md)** - Minification
- **[packages/ai-engine/src/compaction/MIGRATION.md](./packages/ai-engine/src/compaction/MIGRATION.md)** - Migration

### Agent Management

- **[packages/ai-engine/src/simple-agent-manager.md](./packages/ai-engine/src/simple-agent-manager.md)** - Queue simple

---

## 🏗️ Guides d'Implémentation

### Main Process

- **[packages/main/README.md](./packages/main/README.md)** - Main process
- **[packages/main/src/database/README.md](./packages/main/src/database/README.md)** - SQLite database

### IPC & Communication

- **[docs/IPC_ARCHITECTURE.md](./docs/IPC_ARCHITECTURE.md)** - Architecture IPC
- **[docs/IPC_FILES.md](./docs/IPC_FILES.md)** - Fichiers IPC

### Debug System

- **[DEBUG.md](./DEBUG.md)** - Debug complet
- **[DEBUG_QUICKSTART.md](./DEBUG_QUICKSTART.md)** - Quick start debug
- **[DEBUG_SUMMARY.md](./DEBUG_SUMMARY.md)** - Résumé visuel

---

## 🎨 UI & Components

### Design System

- **[packages/renderer/DESIGN_SYSTEM.md](./packages/renderer/DESIGN_SYSTEM.md)** - Design system

### Component Documentation

- **[packages/renderer/src/components/ai/README.md](./packages/renderer/src/components/ai/README.md)** - Composants IA
- **[packages/renderer/src/views/editor/README.md](./packages/renderer/src/views/editor/README.md)** - Vue éditeur
- **[packages/renderer/src/views/account/README.md](./packages/renderer/src/views/account/README.md)** - Vue compte
- **[packages/renderer/src/views/debug/README.md](./packages/renderer/src/views/debug/README.md)** - Vue debug

---

## 🧪 Tests & Benchmarks

### Tests E2E

- **[TESTING.md](./TESTING.md)** - Guide complet Playwright
- **[tests/e2e/README.md](./tests/e2e/README.md)** - Tests E2E détails
- **[tests/e2e/QUICK_REFERENCE.md](./tests/e2e/QUICK_REFERENCE.md)** - Référence rapide
- **[tests/e2e/CI_EXAMPLES.md](./tests/e2e/CI_EXAMPLES.md)** - Exemples CI/CD

### Benchmarks

- **[packages/test-harness/README.md](./packages/test-harness/README.md)** - Test harness
- **[packages/test-harness/benchmarks/provider-benchmark/README.md](./packages/test-harness/benchmarks/provider-benchmark/README.md)** - Benchmark providers

---

## 🗑️ Documentation Obsolète (Supprimée)

Ces documents ont été supprimés après le refactoring d'août 2026:

❌ **CACHE_IMPLEMENTATION.md** - Cache L1/L2/L3 (supprimé, redondant)  
❌ **CACHE_SUMMARY.md** - Résumé cache (supprimé)  
❌ **BACKGROUND_AGENTS.md** - Worker pool (supprimé, over-engineering)  
❌ **packages/ai-engine/CONTEXT_STRATEGIES.md** - Strategies complexes (simplifié)  
❌ **packages/ai-engine/MISSION_ORCHESTRATOR_AUDIT.md** - Audit missions (obsolète)

Voir [ARCHITECTURE_AUDIT.md](./ARCHITECTURE_AUDIT.md) pour les raisons.

---

## 📖 Navigation Rapide

### Je veux...

**...comprendre Cortex rapidement**
→ [README.md](./README.md) + [WHY_SIMPLE.md](./WHY_SIMPLE.md)

**...contribuer du code**
→ [CONTRIBUTING.md](./CONTRIBUTING.md) + [ARCHITECTURE.md](./ARCHITECTURE.md)

**...comprendre l'architecture**
→ [ARCHITECTURE.md](./ARCHITECTURE.md) + [packages/ai-engine/README.md](./packages/ai-engine/README.md)

**...écrire des tests**
→ [TESTING.md](./TESTING.md) + [CONTRIBUTING.md](./CONTRIBUTING.md)

**...éviter les erreurs**
→ [ANTI_PATTERNS.md](./ANTI_PATTERNS.md) + [WHY_SIMPLE.md](./WHY_SIMPLE.md)

**...comprendre pourquoi c'est simple**
→ [WHY_SIMPLE.md](./WHY_SIMPLE.md) + [ARCHITECTURE_AUDIT.md](./ARCHITECTURE_AUDIT.md)

---

## 📝 Standards Documentation

### Conventions

- ✅ **Markdown** pour toute documentation
- ✅ **README.md** à la racine de chaque package
- ✅ **Français** pour docs internes (équipe FR)
- ✅ **Mise à jour au fil de l'eau** (pas de doc obsolète)

### Template README

```markdown
# [Package Name]

**Description courte**

## Installation
[...]

## Quick Start
[...]

## API
[...]

## Tests
[...]

## Contributing
Voir [CONTRIBUTING.md](./CONTRIBUTING.md)
```

---

## 🔄 Maintenance

### Revue mensuelle

Chaque mois, vérifier:
1. Documentation à jour?
2. Liens cassés?
3. Exemples fonctionnent?
4. Docs obsolètes à supprimer?

### Suppression

**Règle:** Doc obsolète = confusion. Supprimer sans pitié.

---

**Prochaine mise à jour:** Après Phase 3 (Mission Orchestrator UI)
