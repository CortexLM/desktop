# Context Optimization

Gérez efficacement les grandes codebases avec smart chunking.

## Le Problème

Les LLMs ont des limites de contexte:
- GPT-4.5-turbo: 128k tokens
- Claude Opus 4.8: 200k tokens
- o3-mini: 200k tokens

Mais une codebase moyenne:
```typescript
Project: 1,500 files
Total tokens: ~450,000
Budget: 150,000 (claude-opus)
Challenge: Sélectionner les bons 33% de fichiers
```

## Ce qui existe réellement : le découpage sémantique

::: danger Réécrit le 17/08/2026 — la version précédente décrivait du code inexistant
Cette page annonçait un pipeline en trois étapes : *dependency graph (AST-based)*,
*scoring TF-IDF*, *sélection greedy*, plus un écran **Settings > Context** avec
une case « Enable Smart Chunking ».

Vérifié par recherche dans `packages/*/src` : **aucun de ces éléments n'existe.**
`grep -rni 'tf-idf\|tfidf'` → 0 résultat. `grep -rni 'greedy'` → 0 résultat.
Aucun parsing AST (pas de `ts.createSourceFile`). Aucun réglage
`enableSmartChunking` / `scoreByRelevance` / `minRelevanceScore`. `SettingsView`
n'a que quatre onglets : General, AI Providers, Editor, Keyboard Shortcuts — il
n'y a pas d'onglet Context.

Les scores de pertinence donnés en exemple (`auth.ts: 0.87`, `user.ts: 0.45`…)
étaient inventés : rien dans le code ne produit de score.
:::

Le seul composant livré est `SemanticChunker`
(`packages/ai-engine/src/context/chunking/semantic-chunker.ts`). Il **découpe**,
il ne **sélectionne pas** :

1. Détection des déclarations (fonctions, classes) par expressions régulières,
   langage déduit de l'extension du fichier.
2. Découpage aux frontières de déclarations plutôt qu'à un nombre de lignes
   arbitraire, par équilibrage d'accolades pour TypeScript, JavaScript, Rust,
   Go, Java et C/C++.
3. Estimation de la taille à ~4 caractères par token.

Il n'y a ni graphe de dépendances, ni scoring, ni budget global : ces trois
fonctions n'ont jamais été implémentées.

### API réelle

```typescript
import { SemanticChunker } from '@cortex-ide/ai-engine'

const chunker = new SemanticChunker({ maxChunkSize: 500 })
const chunks = await chunker.chunk(content, filePath, 'typescript')
```

Options par défaut (`DEFAULT_CONFIG` dans le fichier ci-dessus) :
`maxChunkSize: 500`, `minChunkSize: 50`, `preserveBoundaries: true`,
`includeDependencies: true`, `maxDependencyDepth: 2`. Les deux dernières sont
déclarées dans le type de configuration ; le découpage ne résout pas de
dépendances aujourd'hui.

### Ce qui est mesuré

`packages/ai-engine/src/context/__tests__/boundary-integrity.test.ts` compare le
découpage sémantique à un découpage naïf par lignes, sur le code source du
package lui-même. Métrique : part des déclarations de premier niveau arrivant
intactes (accolades équilibrées) dans un seul chunk.

Mesuré le 17/08/2026 (corpus : 65 fichiers, 163 déclarations) :

| Budget | Sémantique | Naïf | Gain relatif |
|---|---|---|---|
| 200 | 39,3 % | 27,0 % | +45,5 % |
| 500 | 60,7 % | 22,7 % | +167,6 % |
| 1000 | 70,6 % | 25,2 % | +180,5 % |
| 2000 | 87,1 % | 63,2 % | +37,9 % |

Reproduire :
`cd packages/ai-engine && bunx vitest run src/context/__tests__/boundary-integrity.test.ts`.

Deux réserves à lire avant de citer ces chiffres :

- **Ce n'est pas une mesure de qualité de réponse.** Aucun LLM n'est interrogé,
  aucun juge n'est exécuté. L'intégrité des frontières ne se convertit pas en
  « +X % de qualité ».
- **Le corpus bouge.** C'est le code source du package, qui change à chaque
  commit. Les pourcentages ci-dessus dérivent donc dans le temps ; le test ne
  verrouille qu'un plancher de +30 % relatif au budget 500. Re-mesurez plutôt
  que de recopier ce tableau.

## Configuration

Il n'y a pas d'écran de configuration pour le découpage : le seul point de
réglage est le paramètre passé au constructeur `SemanticChunker` dans le code.
L'exemple JSON ci-dessous décrit une forme de configuration **qui n'est lue par
aucun code du dépôt** ; il est conservé uniquement comme référence de ce qui
avait été envisagé.

```typescript
{
  "context": {
    "maxTokens": 150000,
    "strategy": "smart", // vs "naive"
    "includeDependencies": true,
    "scoreByRelevance": true,
    "minRelevanceScore": 0.1
  }
}
```

### Stratégies disponibles

#### Naive (par défaut)

Sélection simple sans analyse:
```typescript
// Prend les N premiers fichiers
chunks.slice(0, Math.floor(budget / avgChunkSize))
```

**Avantages:**
- ✅ Rapide (0ms overhead)
- ✅ Prévisible

**Inconvénients:**
- ❌ Ignore la relevance
- ❌ Ignore les dépendances
- ❌ Qualité moyenne

#### Sémantique

Découpage aux frontières de déclarations :
```typescript
await new SemanticChunker({ maxChunkSize: 500 }).chunk(content, filePath, 'typescript')
```

**Avantage mesuré :**
- ✅ +37,9 % à +180,5 % d'intégrité des frontières vs découpage naïf par lignes
  (mesuré le 17/08/2026 ; métrique **structurelle**, pas une qualité de réponse ;
  chiffres dérivant avec le corpus — voir le tableau plus haut)

**Ce qui n'est pas fourni :**
- ❌ Pas de respect des dépendances (option déclarée, non implémentée)
- ❌ Pas de score de pertinence

## Métriques

::: danger Supprimé le 17/08/2026 — benchmark inexistant
Cette section présentait un « Benchmark sur 5 projets réels » avec un tableau
(Express API, 450 fichiers, `Naive 7.8/10` vs `Smart 8.9/10`, overhead 43 ms) et
une table d'overhead par taille de projet (5/25/50/250 ms).

**Aucun de ces chiffres n'a été mesuré.** Il n'existe dans le dépôt ni corpus de
5 projets, ni harnais exécutant ces tâches, ni juge produisant une note sur 10,
ni mesure d'overhead du chunker. Les scores de qualité `7.8/10` et `8.9/10`
n'ont aucune source. Le `+161 %` cité en bas du tableau était une reprise de la
mesure d'intégrité des frontières, présentée comme si elle sortait de ce
benchmark.

La seule mesure disponible est le tableau d'intégrité des frontières plus haut
dans cette page, reproductible via `boundary-integrity.test.ts`.

**Overhead : non mesuré.** Aucun chiffre n'est publié en remplacement.
:::

## API

### Utilisation programmatique

```typescript
import { SemanticChunker } from '@cortex-ide/ai-engine'

const chunker = new SemanticChunker({ maxChunkSize: 500 })

// Une seule méthode publique : découper le contenu d'un fichier.
const chunks = await chunker.chunk(content, filePath, 'typescript')

console.log(`${chunks.length} chunks`)
```

::: warning `prepareChunks` et `selectRelevantChunks` n'existent pas
La version précédente de cette page documentait
`chunker.prepareChunks('/path/to/project')` puis
`chunker.selectRelevantChunks(chunks, budget, query)`, avec un `chunk.score` sur
chaque résultat. Ces deux méthodes et ce champ n'existent pas — la classe
n'expose que `chunk()`, et `ContextChunk` ne porte pas de score.
:::

### Options du constructeur

Ce sont les seules options acceptées (`SemanticChunkingConfig`, valeurs par
défaut dans `semantic-chunker.ts`) :

```typescript
new SemanticChunker({
  maxChunkSize: 500,        // taille cible d'un chunk, en tokens estimés
  minChunkSize: 50,         // en dessous, on ne coupe pas
  preserveBoundaries: true, // couper aux frontières de déclarations
  includeDependencies: true,   // déclaré, sans effet aujourd'hui
  maxDependencyDepth: 2        // déclaré, sans effet aujourd'hui
})
```

::: warning Options retirées de cette page
`fileTypePriority` et `exclude` étaient documentés ici. Ils n'existent pas dans
`SemanticChunkingConfig` — le chunker reçoit le contenu d'un seul fichier et n'a
aucune notion de filtrage de projet.
:::

## Best Practices

### 1. Adapter le budget au modèle

```typescript
const budgets = {
  'gpt-4.5-turbo': 100000, // 128k context
  'claude-opus-4.8': 150000, // 200k context
  'claude-sonnet-4.8': 80000, // 200k context mais moins cher
  'llama3.1': 30000 // 32k context
}
```

### 2. Choisir `maxChunkSize`

C'est le seul réglage effectif. Le tableau d'intégrité plus haut montre que
l'intégrité des frontières croît avec le budget par chunk (39 % à 200 tokens,
87 % à 2000) : des chunks plus gros coupent moins souvent au milieu d'une
déclaration.

```typescript
new SemanticChunker({ maxChunkSize: 2000 })
```

::: warning Sections retirées le 17/08/2026
Trois sections ont été supprimées ici parce qu'elles documentaient des
fonctionnalités absentes du code :

- **« Queries spécifiques »** — conseils de rédaction de `query` pour améliorer
  le scoring. Il n'y a pas de paramètre `query` ni de scoring.
- **« Monitoring »** — un « Dashboard Context » affichant chunks sélectionnés,
  scores min/avg/max et overhead. Ce tableau de bord n'existe pas dans
  l'application, et aucune de ces métriques n'est calculée.
- **« Troubleshooting »** — remèdes reposant sur `maxTokens`,
  `minRelevanceScore` et `includeDependencies`. Les deux premiers ne sont lus par
  aucun code ; le troisième est accepté par le constructeur mais sans effet.
:::

## Limitations

Vérifié le 17/08/2026 :

- ❌ **Pas d'analyse AST.** Le découpage repose sur des expressions régulières de
  détection de déclarations et un comptage d'accolades, pas sur un parseur. Une
  accolade dans une chaîne de caractères ou un commentaire peut donc fausser
  l'équilibrage.
- ❌ **Pas de sélection.** Le chunker découpe un fichier ; il ne choisit pas quels
  fichiers envoyer, et ne connaît pas de budget global.
- ❌ **Pas de graphe de dépendances.**
- ⚠️ **Couverture par langage limitée.** L'équilibrage d'accolades ne s'applique
  qu'à TypeScript, JavaScript, Rust, Go, Java et C/C++. Python est reconnu par
  extension mais n'est pas dans `BRACE_LANGUAGES`.
- ⚠️ **Estimation de tokens approximative** : ~4 caractères par token, pas un
  vrai tokenizer.

## Prochaines étapes

- [Mission Orchestration →](/guide/features/mission-orchestration)
- [Benchmarking →](/guide/features/benchmarking)
- [API Reference →](/api/)
