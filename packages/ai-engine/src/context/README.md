# Context Management System

Découpage de code aux frontières sémantiques (fonctions, classes, structs)
plutôt qu'à un nombre de lignes arbitraire, plus un minificateur simple.

> ⚠️ Ce README décrivait jusqu'au 2026-08-16 une architecture à 7 stratégies
> (sliding window, prédiction ML, cache, contexte différentiel, `ContextManager`)
> qui **n'existe plus** : tout a été supprimé lors de la simplification, et les
> chiffres d'économies associés n'ont jamais été mesurés. Le contenu ci-dessous
> reflète le code réellement présent sur disque.

## Structure

```
context/
├── types.ts                  # ContextChunk, ChunkMetadata, SemanticChunkingConfig
├── index.ts                  # Exports publics
├── simple-minifier.ts        # Suppression commentaires + whitespace
├── chunking/
│   └── semantic-chunker.ts   # Découpe sémantique (TS/JS, Python, Rust, Go, Java, C++)
└── __tests__/
    ├── semantic-chunker.test.ts    # Comportement par langage
    ├── boundary-integrity.test.ts  # Mesure A/B vs split naïf (corpus réel)
    ├── ab-comparison.test.ts       # Comparaisons sur extrait témoin
    └── simple-minifier.test.ts
```

## Utilisation Rapide

```typescript
import { SemanticChunker, SimpleMinifier } from 'ai-engine';

const chunker = new SemanticChunker({ maxChunkSize: 500 });

// Le langage est déduit de l'extension si non fourni
const chunks = await chunker.chunk(sourceCode, 'src/app.ts', 'typescript');

for (const chunk of chunks) {
  console.log(chunk.metadata.functionName ?? chunk.metadata.className, chunk.tokens);
}

// Dépendances directes entre chunks (par référence de symbole)
const graph = chunker.buildDependencyGraph(chunks);

// Étendre une sélection avec ses dépendances transitives
const selection = chunker.expandWithDependencies([chunks[0].id], graph);
```

## API

### `SemanticChunker`

```typescript
new SemanticChunker(config?: Partial<SemanticChunkingConfig>)

// Défauts : maxChunkSize 500, minChunkSize 50, preserveBoundaries true,
//           includeDependencies true, maxDependencyDepth 2

chunk(content: string, filePath: string, language?: string): Promise<ContextChunk[]>
buildDependencyGraph(chunks: ContextChunk[]): Map<string, Set<string>>
expandWithDependencies(ids: string[], graph: Map<string, Set<string>>): Set<string>
```

Langages reconnus : TypeScript, JavaScript, Python, Rust, Go, Java, C/C++.
Les langages à accolades sont découpés par équilibrage d'accolades (une classe
reste groupée avec ses méthodes) ; Python par indentation.

Un chunk qui dépasse `maxChunkSize` est redécoupé, en conservant le nom de la
déclaration sur chaque part. Les commentaires et imports qui précèdent une
déclaration lui sont rattachés.

### `SimpleMinifier`

```typescript
minify(content: string): string        // retire commentaires + lignes vides
estimateSavings(content: string): number  // % de réduction
```

## Gain mesuré

Métrique : part des déclarations qui tiennent entières dans un seul chunk
(accolades équilibrées) — **structurel, pas de la qualité de réponse LLM**.

Re-mesuré le **17/08/2026**. Corpus : 65 fichiers TypeScript du package,
163 déclarations top-level.

| Budget (tokens) | Semantic | Split naïf | Gain relatif |
|-----------------|----------|------------|--------------|
| 200             | 39.3%    | 27.0%      | +45.5%       |
| 500             | 60.7%    | 22.7%      | +167.6%      |
| 1000            | 70.6%    | 25.2%      | +180.5%      |
| 2000            | 87.1%    | 63.2%      | +37.9%       |

Mesure précédente (16/08/2026, 58 fichiers / 144 déclarations) : +61 %, +161 %,
+212 %, +59 %.

⚠️ **CES CHIFFRES DÉRIVENT, ET C'EST STRUCTUREL.** Le corpus mesuré est le code
source de ce package : il change à chaque modification, donc les pourcentages
changent aussi — sans qu'aucune régression n'ait eu lieu. Le `+161 %` de la mesure
du 16/08 a été recopié dans au moins six autres documents
(`ARCHITECTURE.md`, `ANTI_PATTERNS.md`, `CONTRIBUTING.md`,
`ai-engine/README.md`, et deux pages du site) où il est maintenant faux de
6,6 points. **Ne recopiez pas ce tableau ailleurs** : citez la commande.

Reproductible via
`bunx vitest run src/context/__tests__/boundary-integrity.test.ts`. Le test ne
verrouille qu'un plancher conservateur de +30 % relatif au budget 500 — il ne
vérifie aucune des valeurs de ce tableau, précisément parce qu'elles bougent.

⚠️ Il n'existe **aucune** mesure de qualité de réponse (juge LLM, eval
end-to-end) dans ce repo. Le chiffre « +14% qualité » qui a circulé dans la
documentation n'est sourcé par aucune mesure — ne pas le réutiliser.

## Tests

```bash
bunx vitest run src/context/
```

## License

MIT
