# Benchmarking

Comparez objectivement les providers IA sur vos tâches réelles.

::: danger Corrigé le 17/08/2026 — il n'y a pas d'interface graphique
Cette page décrivait un parcours « Ouvrez **Benchmarks** dans la sidebar →
**New Benchmark** → **Run Benchmark** ». **Cette vue n'existe pas.** La barre
latérale (`packages/renderer/src/components/layout/views.ts`) compte 12 entrées :
Explorer, Search, Source Control, Terminal, AI Chat, Extensions, Notes, Plans,
Browser, Automations, Account, Settings. Aucune n'est Benchmarks, et il n'y a pas
de `views/benchmarks/`.

Le benchmarking existe **uniquement** comme harnais en ligne de commande, dans
le package `packages/test-harness`. L'écran d'accueil (`WelcomeScreen.tsx`) et le
tutoriel interactif le présentent pourtant comme une fonctionnalité de
l'application : c'est trompeur et cela reste à corriger côté produit.
:::

## Concept

Le harnais mesure et compare, par provider :
- **Latency** - Temps de réponse (`latency` dans `src/types.ts`)
- **Cost** - Coût par requête, calculé depuis la grille tarifaire
- **Token usage** - Tokens consommés

**Il ne mesure pas la qualité.** Il n'y a aucun champ `quality` ni `score` dans
`packages/test-harness/src/types.ts`, et aucun juge automatique n'est embarqué.

## Créer un benchmark

### Ligne de commande

Le harnais s'utilise depuis `packages/test-harness` (voir son `README.md` et
`QUICKSTART.md`). Il requiert vos propres clés d'API : les appels sont réels et
facturés par le provider.

### Configuration

```typescript
{
  "name": "React Component Generation",
  "description": "Generate a React component from description",
  "task": {
    "type": "generation",
    "prompt": "Create a React component for a user profile card with avatar, name, and bio",
    "expectedOutput": {
      "files": 1,
      "minLines": 20,
      "includesTests": false
    }
  },
  "providers": [
    {
      "provider": "openai",
      "model": "gpt-4.5-turbo"
    },
    {
      "provider": "anthropic",
      "model": "claude-sonnet-4.8"
    },
    {
      "provider": "anthropic",
      "model": "claude-opus-4.8"
    }
  ],
  "runs": 3, // Répétitions pour moyenne
  "timeout": 30000 // ms
}
```

## Résultats

### Format table

::: warning Tableau d'exemple retiré (17/08/2026)
Un tableau de résultats figurait ici (GPT-4.5-turbo `1.2s / 847 / $0.021 /
8.5/10`, Claude Sonnet `2.1s / 923 / $0.015 / 9.0/10`, Claude Opus `3.8s / 1,104
/ $0.045 / 9.5/10`) avec la conclusion « Recommendation: Claude Sonnet 4.8 ».

Ce run n'a pas été exécuté, et la colonne **Quality** n'est pas produite par le
harnais. Le même tableau, aux mêmes valeurs, apparaissait aussi dans
`why-cortex.md` — signe qu'il a été recopié, pas mesuré.

Le harnais n'émet pas de recommandation : il produit des mesures.
:::

### Export

`ReportGenerator` (`src/utils/report-generator.ts`) écrit trois formats :

- **JSON** — `benchmark-<id>.json`, pour analyse programmatique
- **Markdown** — `benchmark-<id>.md`, pour documentation
- **HTML** — `benchmark-<id>.html`, pour reporting

Il n'y a **pas** d'export CSV : `grep -rni csv packages/test-harness/src` ne
renvoie rien.

## Métriques

### Latency

Temps total de la requête (ms):
```typescript
latency = responseTime - requestTime
```

### Quality Score — n'existe pas

::: danger Section retirée (17/08/2026)
Cette section décrivait une « évaluation automatique » notant de 0 à 10 sur cinq
critères (syntaxe correcte, imports complets, types TypeScript, bonnes pratiques,
complétion de la tâche).

**Aucun scoring de qualité n'est implémenté.** `packages/test-harness/src/types.ts`
n'a ni champ `quality` ni champ `score` ; aucun code n'analyse la syntaxe ou les
imports d'une réponse. Les seules notes de qualité du dépôt sont dans
`benchmarks/context-bench/mock-results.json`, explicitement marqué `"Mock data"`.

C'est cette section qui donnait leur crédibilité apparente aux colonnes
« Quality » des tableaux d'exemple, ici et dans `why-cortex.md`.
:::

### Cost

Calcul du coût en USD:
```typescript
cost = (inputTokens * inputPrice) + (outputTokens * outputPrice)

// Prix exemple (2026)
const pricing = {
  'gpt-4.5-turbo': { input: 0.01, output: 0.03 }, // per 1k tokens
  'claude-opus-4.8': { input: 0.015, output: 0.075 },
  'claude-sonnet-4.8': { input: 0.003, output: 0.015 }
}
```

## Use Cases

::: warning Exemples chiffrés retirés (17/08/2026)
Les trois cas d'usage ci-dessous portaient des résultats précis présentés comme
des mesures : `$0.018/call, 8.2/10` vs `$0.012/call, 8.9/10` avec une économie de
`$60/month` ; `320ms` vs `1,200ms` ; `8.1/10` vs `9.7/10`.

Aucun de ces runs n'a été exécuté, et deux des trois reposaient sur des notes de
qualité que le harnais ne produit pas. Les cas d'usage sont conservés comme
méthode ; les chiffres sont retirés et non remplacés par des estimations.
:::

### 1. Choisir le bon provider

Lancez la même tâche représentative sur plusieurs providers, avec assez de
répétitions pour que la latence moyenne soit stable, puis comparez coût et
latence. Le harnais vous donne ces deux axes ; l'évaluation de la qualité des
réponses reste manuelle.

### 2. Optimiser pour la latence

Pour une fonctionnalité interactive (complétion, par exemple), la latence est
souvent le critère décisif. Fixez un `timeout` correspondant à votre budget réel
et éliminez les modèles qui le dépassent.

### 3. Optimiser pour la qualité

Le harnais ne peut pas classer les réponses pour vous. La démarche praticable est
de faire tourner la même tâche sur plusieurs modèles, d'exporter les réponses
(rapport JSON) et de les relire.

## Best Practices

### 1. Tâches représentatives

Benchmarker sur vos tâches réelles:

❌ **Mauvais:**
```typescript
task: "Write hello world"
// Trop simple, pas représentatif
```

✅ **Bon:**
```typescript
task: "Refactor this authentication module to use JWT tokens"
// Tâche réelle de votre workflow
```

### 2. Répétitions suffisantes

```typescript
runs: 3 // Minimum pour moyenne stable
runs: 5 // Recommandé
runs: 10 // Pour décisions critiques
```

### 3. Comparer le bon niveau

Ne comparez que des modèles comparables:

❌ **Mauvais:**
```typescript
providers: [
  { model: "gpt-4.5-turbo" }, // $$$
  { model: "llama3.1" }        // Free
]
// Comparaison injuste
```

✅ **Bon:**
```typescript
// Tier 1: Premium
providers: [
  { model: "gpt-4.5-turbo" },
  { model: "claude-opus-4.8" }
]

// Tier 2: Mid-range
providers: [
  { model: "gpt-3.5-turbo" },
  { model: "claude-sonnet-4.8" }
]
```

## API

### Créer un benchmark programmatiquement

::: warning Signature corrigée le 17/08/2026
L'exemple précédent importait `BenchmarkRunner` depuis `@cortex/ai-engine`
(paquet inexistant ; et la classe n'est pas dans `ai-engine`), appelait une
méthode `run({ ... })` qui n'existe pas, et lisait `result.recommendation`,
`result.exportJSON()`, `result.exportMarkdown()` — trois membres absents du type
`BenchmarkResult`.
:::

`BenchmarkRunner` vit dans `@cortex-ide/test-harness`. Sa méthode est
`runBenchmark(name, description, testCases, options)` — quatre arguments
positionnels, pas un objet unique :

```typescript
import { BenchmarkRunner, ReportGenerator } from '@cortex-ide/test-harness'

const runner = new BenchmarkRunner()

const result = await runner.runBenchmark(
  'My Benchmark',
  'Generate a React component from a spec',
  testCases,                       // TestCase[]
  {
    providers: [
      // `apiKey` est obligatoire (ProviderConfigSchema) : les appels sont
      // réels et facturés par le provider.
      { type: 'openai', model: 'gpt-4.5-turbo', apiKey: process.env.OPENAI_API_KEY! },
      { type: 'anthropic', model: 'claude-opus-4.8', apiKey: process.env.ANTHROPIC_API_KEY! }
    ],
    parallelism: 3                 // défaut : 3
  }
)

console.log(result.summary)        // { totalTests, successfulTests, totalCost, ... }

// L'export est assuré par ReportGenerator, pas par le résultat lui-même.
const reports = new ReportGenerator()
await reports.generateJSON(result, outputDir)
await reports.generateMarkdown(result, outputDir)
```

Le résultat ne contient **pas** de `recommendation` : le harnais ne désigne pas
de gagnant.

## Limitations

### Ce que le benchmarking NE FAIT PAS

- ❌ Évaluer la créativité subjective
- ❌ Tester sur des cas edge rares
- ❌ Garantir les performances futures

### Recommandations

- Benchmarker régulièrement (les modèles évoluent)
- Combiner avec des tests manuels pour validation
- Ne pas sur-optimiser pour le benchmark

## Prochaines étapes

- [Context Optimization →](/guide/features/context-optimization)
- [Mission Orchestration →](/guide/features/mission-orchestration)
- [API Reference →](/api/)

<!-- Lien retiré le 17/08/2026 : `/guide/features/multi-provider` n'existe pas. -->

