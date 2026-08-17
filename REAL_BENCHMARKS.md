# Real-World Context Optimization Benchmarks

## Vue d'ensemble

Ce document présente des benchmarks **réels** (pas théoriques) mesurant l'impact des optimisations de contexte sur des tâches concrètes de développement.

**Localisation**: `packages/test-harness/benchmarks/context-bench/`

## Méthodologie

### Scénarios de Test (Tâches Concrètes)

#### Scénario 1: Fix Bug Simple
- **Fichier principal**: 150 lignes (ContextManager.ts)
- **Contexte**: 3 fichiers liés (types, utils, shared types)
- **Tâche**: Corriger une fuite mémoire dans `addContext()` où les listeners ne sont pas nettoyés
- **Tokens estimés**: 8,000
- **Changements attendus**: 5 lignes ajoutées, 2 supprimées

#### Scénario 2: Add Feature Medium  
- **Fichiers à modifier**: 5 fichiers (backend + frontend + types)
- **Contexte à lire**: 20 fichiers (stratégies, composants, hooks, store)
- **Tâche**: Ajouter un système de priorité de contexte permettant d'épingler des fichiers haute priorité
- **Tokens estimés**: 45,000
- **Changements attendus**: 120 lignes ajoutées, 15 supprimées

#### Scénario 3: Large Refactoring
- **Fichiers**: 50+ fichiers (tout le package ai-engine)
- **Contexte**: Full codebase (~300k tokens)
- **Tâche**: Refactorer la gestion du contexte vers une architecture plugin permettant des providers personnalisés
- **Tokens estimés**: 300,000
- **Changements attendus**: 500 lignes ajoutées, 300 supprimées

### Stratégies Testées

#### 1. Baseline (Aucune Optimisation)
Contexte brut sans optimisation. Tous les fichiers concaténés tel quel.

#### 2. Semantic Chunking
Découpe le contexte par frontières sémantiques (fonctions, classes, interfaces).
- Taille de chunk: 2000 tokens
- Chevauchement: 200 tokens

#### 3. Simple Minifier
Supprime les espaces et commentaires en préservant la structure du code.
- Supprime les commentaires single/multi-line
- Supprime les espaces superflus
- Préserve la sémantique du code

#### 4. Anthropic Prompt Caching
Utilise le cache natif Anthropic avec points de rupture.
- Prompt système caché
- Contexte caché séparément
- TTL cache: 5 minutes
- 90% de réduction de coût sur les tokens cachés

### Métriques Mesurées

- **TTFT** (Time To First Token) - Latence jusqu'au premier token de réponse
- **Total Tokens** - Input + Output + Cached tokens
- **Cost** - Coût en USD (tarifs Claude 3.5 Sonnet)
- **Quality Score** - Évaluation automatisée (0-100)
  - Correctness: Est-ce que ça fonctionne?
  - Completeness: Tous les besoins adressés?
  - Relevance: Pertinent et approprié?
- **Total Time** - Temps d'exécution complet
- **Cache Hit Rate** - Pourcentage de tokens servis depuis le cache

---

## Quick Start

```bash
# Navigation
cd packages/test-harness/benchmarks/context-bench

# Installation
npm install

# Configuration API
export ANTHROPIC_API_KEY=your-key-here

# Lancer tous les benchmarks
npm run bench

# Scénarios spécifiques
npm run bench:simple    # Bug fix (8k tokens)
npm run bench:medium    # Feature add (45k tokens)
npm run bench:large     # Refactoring (300k tokens)

# Comparer les résultats
npm run compare benchmark-results.json
```

---

## Résultats Attendus

### Hypothèses (à valider)

#### Scénario 1: Bug Fix Simple (8k tokens)
| Stratégie | TTFT | Tokens | Coût | Qualité | Notes |
|-----------|------|--------|------|---------|-------|
| Baseline | Référence | 8k | $0.03 | 100% | Rapide, contexte petit |
| Semantic Chunking | +5-10% | -5% | -5% | 100% | Légère amélioration |
| Simple Minifier | +2-5% | -25% | -25% | 95-100% | Bonne réduction |
| Anthropic Caching | Identique | 8k | $0.03 → $0.003 | 100% | 2e run: 90% moins cher |

**Insight attendu**: Sur petit contexte, le baseline est déjà performant. Le cache Anthropic brille sur les itérations.

#### Scénario 2: Feature Medium (45k tokens)
| Stratégie | TTFT | Tokens | Coût | Qualité | Notes |
|-----------|------|--------|------|---------|-------|
| Baseline | Référence | 45k | $0.15 | 100% | Coût modéré |
| Semantic Chunking | -10-15% | -12% | -12% | 98-100% | Meilleure pertinence |
| Simple Minifier | +5-8% | -35% | -35% | 85-95% | Trade-off qualité |
| Anthropic Caching | Identique | 45k | $0.15 → $0.015 | 100% | Itérations très rentables |

**Insight attendu**: Le chunking sémantique améliore la pertinence. Le minifier a un impact qualité visible.

#### Scénario 3: Large Refactoring (300k tokens)
| Stratégie | TTFT | Tokens | Coût | Qualité | Notes |
|-----------|------|--------|------|---------|-------|
| Baseline | Référence | 300k* | $0.90* | N/A | *Peut dépasser la limite |
| Semantic Chunking | -20-30% | -25% | -25% | 90-95% | Essentiel pour tenir |
| Simple Minifier | +10-15% | -45% | -45% | 75-85% | Qualité dégradée |
| Anthropic Caching | Identique | 300k | $0.90 → $0.09 | 95-100% | Économies massives |

**Insight attendu**: Sur gros contexte, les optimisations deviennent critiques. Le caching est un game-changer pour les conversations multi-tours.

---

## Outputs

Les résultats sont sauvegardés en deux formats:

### 1. JSON (`benchmark-results.json`)
```json
[
  {
    "scenarioId": "bug-fix-simple",
    "strategyId": "baseline",
    "metrics": {
      "ttft": 1250,
      "totalTokens": { "input": 7842, "output": 453, "cached": 0 },
      "cost": 0.0303,
      "totalTime": 8500,
      "cacheHitRate": 0
    },
    "quality": {
      "score": 87,
      "correctness": 90,
      "completeness": 85,
      "relevance": 86,
      "notes": "Automated scoring"
    },
    "response": "..."
  }
]
```

### 2. Rapport Markdown (`benchmark-results.md`)
- Table récapitulative
- Comparaisons par stratégie (vs baseline)
- Métriques détaillées pour chaque run
- Graphiques et visualisations (émojis 🟢/🔴 pour improvements/regressions)

---

## CLI Usage

```bash
# Tous les scénarios avec toutes les stratégies
npm run bench

# Scénario spécifique
npm run bench -- --scenario bug-fix-simple

# Stratégie spécifique
npm run bench -- --strategy anthropic-caching

# Fichier de sortie personnalisé
npm run bench -- --output my-results.json

# API key via flag
npm run bench -- --api-key sk-ant-...

# Lister les options
npm run list

# Comparer les résultats
npm run compare benchmark-results.json
```

---

## Architecture

```
context-bench/
├── README.md              # Documentation complète
├── package.json           # Scripts npm
├── cli.ts                 # Interface ligne de commande
├── runner.ts              # Moteur de benchmark
├── scenarios.ts           # Définition des scénarios et stratégies
├── benchmark-results.json # Résultats (généré)
└── benchmark-results.md   # Rapport (généré)
```

### Composants Principaux

#### `scenarios.ts`
Définit:
- `BenchmarkScenario[]` - Les 3 scénarios de test
- `OptimizationStrategy[]` - Les 4 stratégies d'optimisation
- Interfaces TypeScript

#### `runner.ts`
Contient:
- `BenchmarkRunner` - Classe principale
- `loadFiles()` - Chargement des fichiers (support glob)
- `applyStrategy()` - Application des optimisations
- `buildPrompt()` - Construction du prompt pour Anthropic
- `runBenchmark()` - Exécution d'un benchmark
- `evaluateQuality()` - Scoring automatique de qualité

#### `cli.ts`
Commandes:
- `run` - Exécuter les benchmarks
- `compare` - Comparer les résultats
- `list` - Lister les options
- Affichage avec `ora` (spinners) et `table` (tableaux)

---

## Extension

### Ajouter un Nouveau Scénario

Dans `scenarios.ts`:

```typescript
{
  id: 'my-scenario',
  name: 'Mon Scénario',
  description: 'Description',
  targetFiles: ['path/to/file.ts'],
  contextFiles: ['path/to/context/**/*.ts'],
  task: 'Description de la tâche',
  expectedChanges: {
    files: ['path/to/file.ts'],
    linesAdded: 10,
    linesRemoved: 5,
  },
  estimatedTokens: 15000,
}
```

### Ajouter une Nouvelle Stratégie

Dans `scenarios.ts`:

```typescript
{
  id: 'my-strategy',
  name: 'Ma Stratégie',
  description: 'Ce que ça fait',
  enabled: true,
  config: { /* config */ },
}
```

Puis implémenter dans `runner.ts` méthode `applyStrategy()`.

---

## Limitations et Considérations

### Qualité Automatisée
Le scoring de qualité est **simplifié** et basé sur:
- Présence des fichiers cibles dans la réponse
- Présence de code blocks
- Longueur de la réponse
- Mots-clés de la tâche

**⚠️ Recommandation**: Review manuel pour production.

### Cache Anthropic
- Nécessite plusieurs runs avec contexte similaire pour voir l'effet
- TTL de 5 minutes
- Les premiers runs ne bénéficient pas du cache

### Rate Limiting
Pause de 2 secondes entre requêtes. Ajuster si nécessaire dans `runner.ts`.

### Token Counting
Les estimations sont approximatives. L'usage réel peut varier selon:
- Le tokenizer Anthropic
- La verbosité des réponses
- La structure du code

---

## Prochaines Étapes

1. **Exécuter les benchmarks réels** avec votre API key
2. **Analyser les résultats** dans `benchmark-results.md`
3. **Valider les hypothèses** ci-dessus
4. **Itérer sur les stratégies** selon les insights
5. **Intégrer la meilleure stratégie** dans Cortex IDE

---

## Résultats (À Remplir Après Exécution)

### Run 1: [Date]

_Les résultats seront ajoutés ici après l'exécution des benchmarks._

**Environnement:**
- Machine: [specs]
- Node version: [version]
- Date: [date]
- Anthropic API: Claude 3.5 Sonnet

**Insights:**
- [À documenter]

**Décisions:**
- [À documenter]
