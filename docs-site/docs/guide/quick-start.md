# Quick Start

Ce tutoriel de 10 minutes vous guidera à travers les fonctionnalités principales de Cortex IDE.

## 1. Ouvrir un workspace (1 min)

Au lancement de Cortex, ouvrez un workspace existant:

1. **File > Open Workspace** (⌘+O sur Mac)
2. Sélectionnez un dossier de projet
3. Cortex analyse automatiquement la structure du projet

::: tip
Cortex fonctionne mieux avec des projets Git. Il détecte automatiquement la structure, les dépendances et l'historique.
:::

## 2. Configurer un provider IA (2 min)

### Méthode rapide: Presets

Cliquez sur **New Chat** et choisissez un preset:

- **Fastest**: GPT-4.5-turbo (OpenAI) - Réponses rapides
- **Smartest**: Claude Opus 4.8 (Anthropic) - Raisonnement complexe
- **Cheapest**: Llama 3.1 (Ollama) - Gratuit, local
- **Reasoning**: o3-mini (OpenAI) - Problèmes complexes

### Méthode manuelle

Pour un contrôle total:

1. Ouvrez **Settings** (⌘+,)
2. Naviguez vers **AI Providers**
3. Configurez votre provider préféré:

```typescript
{
  "provider": "anthropic",
  "model": "claude-opus-4.8",
  "maxTokens": 150000,
  "temperature": 0.7
}
```

## 3. Premier chat avec un agent (2 min)

Testez l'agent avec une requête simple:

```
Analyse la structure de ce projet et liste les fichiers principaux
```

L'agent va:
1. ✅ Scanner votre workspace
2. ✅ Identifier les fichiers importants
3. ✅ Générer un rapport structuré

**Exemple de réponse:**

```markdown
## Structure du projet

### Core Files
- `packages/main/index.ts` - Electron main process entry point
- `packages/renderer/src/App.tsx` - React app root
- `packages/ai-engine/src/registry.ts` - AI provider registry

### Configuration
- `package.json` - Monorepo root
- `electron-builder.yml` - Build configuration
- `tsconfig.json` - TypeScript configuration

### Tests
- `tests/e2e/` - Playwright E2E tests
- `packages/*/src/**/__tests__/` - Unit tests
```

## 4. Mission multi-étapes (3 min)

Créez une mission complexe avec plusieurs features:

```
Mission: Optimiser les performances du chargement

Features:
1. Analyser les bottlenecks actuels
2. Implémenter le lazy loading pour les composants lourds
3. Optimiser les requêtes SQLite
4. Ajouter des tests de performance
```

Cortex va:

1. **Planifier** la mission (dependency analysis)
2. **Exécuter** chaque feature séquentiellement
3. **Tracker** le progress en temps réel
4. **Générer** un rapport final

### Suivi du progress

Le panel **Mission Progress** affiche:

```
Mission: Optimiser les performances du chargement
├─ [✓] Feature 1: Analyser bottlenecks (2m 34s)
├─ [▶] Feature 2: Lazy loading (en cours...)
├─ [ ] Feature 3: Optimiser SQLite
└─ [ ] Feature 4: Tests de performance

Progress: 1/4 features (25%)
Estimated time remaining: ~8 minutes
```

## 5. Benchmarking providers (2 min)

Comparez les performances de différents providers:

1. Ouvrez **Benchmarks** dans la sidebar
2. Cliquez sur **New Benchmark**
3. Configurez:

```typescript
{
  "task": "Generate a React component from description",
  "providers": [
    { "provider": "openai", "model": "gpt-4.5-turbo" },
    { "provider": "anthropic", "model": "claude-sonnet-4.8" },
    { "provider": "anthropic", "model": "claude-opus-4.8" }
  ],
  "runs": 3
}
```

4. Cliquez **Run Benchmark**

### Résultats

```
┌──────────────────┬──────────┬─────────┬────────┬─────────┐
│ Provider         │ Latency  │ Tokens  │ Cost   │ Quality │
├──────────────────┼──────────┼─────────┼────────┼─────────┤
│ GPT-4.5-turbo    │ 1.2s     │ 847     │ $0.021 │ 8.5/10  │
│ Claude Sonnet    │ 2.1s     │ 923     │ $0.015 │ 9.0/10  │
│ Claude Opus      │ 3.8s     │ 1,104   │ $0.045 │ 9.5/10  │
└──────────────────┴──────────┴─────────┴────────┴─────────┘

Recommendation: Claude Sonnet 4.8
Rationale: Best balance of quality (9.0/10) and cost ($0.015)
```

## 6. Context optimization (1 min)

Pour les grandes codebases, activez le smart chunking:

1. **Settings > Context**
2. Activez **Smart Chunking**
3. Configurez le budget:

::: danger Corrigé le 17/08/2026
Cette section montrait une configuration
(`chunkingStrategy: "smart"`, `includeDependencies`, `scoreByRelevance`) et
annonçait que le chunker « analyse les dépendances (AST-based) », « score les
chunks par relevance (TF-IDF) » et « sélectionne le contexte optimal dans le
budget ».

**Aucun de ces trois points n'existe**, et aucune de ces clés de configuration
n'est lue par le code. Voir
[Context Optimization](/guide/features/context-optimization) pour ce qui est
réellement implémenté.
:::

Le découpage réel se configure dans le code, à la construction :

```typescript
import { SemanticChunker } from '@cortex-ide/ai-engine'

const chunks = await new SemanticChunker({ maxChunkSize: 500 })
  .chunk(content, filePath, 'typescript')
```

`SemanticChunker` coupe un fichier aux frontières de déclarations. Il ne classe
rien et ne choisit pas quels fichiers envoyer au modèle.

**Impact mesuré** (17/08/2026, budget 500 tokens, 65 fichiers) : 60,7 % des
déclarations arrivent intactes dans un seul chunk, contre 22,7 % pour un découpage
naïf par lignes. Métrique **structurelle**, pas une qualité de réponse.
Reproduire :
`cd packages/ai-engine && bunx vitest run src/context/__tests__/boundary-integrity.test.ts`.

## Prochaines étapes

Maintenant que vous maîtrisez les bases:

<div class="next-steps">

**[Mission Orchestration →](/guide/features/mission-orchestration)**
Workflows complexes avec state machine

**[Benchmarking →](/guide/features/benchmarking)**
Comparer providers et optimiser coûts

**[Context Optimization →](/guide/features/context-optimization)**
Gérer les codebases 300k+ tokens

</div>

## Tips & Tricks

### Raccourcis clavier

- `⌘+N` - Nouveau chat
- `⌘+O` - Ouvrir workspace
- `⌘+,` - Settings
- `⌘+K` - Quick actions
- `⌘+P` - File search

### Prompts efficaces

**❌ Mauvais:**
```
fix bug
```

**✅ Bon:**
```
Le bouton "Save" dans EditorView.tsx ne déclenche pas la sauvegarde.
Steps to reproduce:
1. Ouvrir un fichier
2. Modifier le contenu
3. Cliquer "Save"
Expected: Fichier sauvegardé
Actual: Rien ne se passe

Peux-tu debugger et fixer?
```

### Utiliser les tools

Cortex fournit des tools aux agents:

- `read_file(path)` - Lire un fichier
- `write_file(path, content)` - Écrire un fichier
- `run_command(cmd)` - Exécuter une commande
- `search_code(query)` - Chercher dans le code
- `git_status()` - Status Git

Les agents utilisent automatiquement ces tools selon le contexte.

<style>
.next-steps {
  display: grid;
  gap: 1rem;
  margin: 2rem 0;
}

.next-steps a {
  display: block;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  text-decoration: none;
  transition: border-color 0.2s;
}

.next-steps a:hover {
  border-color: var(--vp-c-brand);
}
</style>
