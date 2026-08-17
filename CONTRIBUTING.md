# Contributing to Cortex IDE

Merci de votre intérêt pour contribuer à Cortex IDE! Ce guide vous aidera à comprendre notre workflow de développement, nos standards de qualité, et comment soumettre vos contributions.

## 📋 Table des matières

1. [Code of Conduct](#code-of-conduct)
2. [Comment contribuer](#comment-contribuer)
3. [Développement avec TDD](#développement-avec-tdd)
4. [Standards de code](#standards-de-code)
5. [Process de Pull Request](#process-de-pull-request)
6. [Architecture decisions](#architecture-decisions)

---

## Code of Conduct

### Nos principes

1. **Respect** - Soyez respectueux envers tous les contributeurs
2. **Collaboration** - Travaillez ensemble, partagez vos connaissances
3. **Simplicité** - Privilégiez les solutions simples aux solutions sophistiquées
4. **Honnêteté** - Admettez vos erreurs, apprenez-en

### Comportements inacceptables

- ❌ Harcèlement ou discrimination sous toute forme
- ❌ Trolling, insultes, ou commentaires dégradants
- ❌ Publication d'informations privées sans consentement
- ❌ Tout comportement non professionnel

---

## Comment contribuer

### Types de contributions

Nous acceptons plusieurs types de contributions:

- 🐛 **Bug fixes** - Corrections de bugs
- ✨ **Features** - Nouvelles fonctionnalités
- 📚 **Documentation** - Améliorations de la doc
- 🧪 **Tests** - Ajout ou amélioration de tests
- ♻️ **Refactoring** - Amélioration du code existant
- 🎨 **UI/UX** - Améliorations de l'interface

### Avant de commencer

1. **Vérifiez les issues existantes** - Peut-être que quelqu'un travaille déjà dessus
2. **Créez une issue** - Discutez de votre idée avant de coder
3. **Attendez validation** - Pour les features importantes, attendez l'approbation d'un maintainer

### Setup de développement

```bash
# 1. Fork le repository
git clone https://github.com/YOUR_USERNAME/cortex-ide.git
cd cortex-ide

# 2. Installer les dépendances
bun install

# 3. Installer Playwright (pour les tests)
bunx playwright install chromium

# 4. Build initial
bun run build

# 5. Lancer en dev
bun run dev

# Dans un autre terminal
bun run start
```

### Créer une branche

```bash
# Format: type/description-courte
git checkout -b fix/auth-null-pointer
git checkout -b feat/benchmark-ui
git checkout -b docs/update-readme
```

**Types de branches:**
- `feat/` - Nouvelle fonctionnalité
- `fix/` - Bug fix
- `docs/` - Documentation
- `test/` - Tests
- `refactor/` - Refactoring

---

## Développement avec TDD

### Pourquoi TDD?

Cortex IDE suit une approche **Test-Driven Development** stricte depuis le refactoring d'août 2026. Les raisons:

1. ✅ **Qualité** - Moins de bugs en production
2. ✅ **Design** - Force à penser l'API avant l'implémentation
3. ✅ **Documentation** - Les tests servent de documentation vivante
4. ✅ **Confiance** - Refactoring sans peur de casser

### Cycle TDD (Red-Green-Refactor)

```
1. 🔴 RED    - Écrire un test qui échoue
2. 🟢 GREEN  - Écrire le code minimal pour passer le test
3. 🔵 REFACTOR - Améliorer le code en gardant les tests verts
```

### Exemple concret

**Feature:** Ajouter un smart chunker pour sélectionner le contexte pertinent.

#### 1. 🔴 RED - Écrire les tests d'abord

```typescript
// packages/ai-engine/src/context/__tests__/smart-chunker.test.ts

import { describe, it, expect } from 'vitest';
import { SmartChunker } from '../smart-chunker';

describe('SmartChunker', () => {
  it('should select relevant chunks within budget', () => {
    const chunker = new SmartChunker();
    const chunks = [
      { id: 'auth.ts', tokens: 5000, content: '...' },
      { id: 'user.ts', tokens: 3000, content: '...' },
      { id: 'config.ts', tokens: 2000, content: '...' },
    ];

    const selected = chunker.selectRelevantChunks(chunks, 8000, 'fix auth bug');

    expect(selected).toHaveLength(2);
    expect(selected[0].id).toBe('auth.ts');
    expect(selected[1].id).toBe('user.ts');
    expect(selected.reduce((sum, c) => sum + c.tokens, 0)).toBeLessThanOrEqual(8000);
  });

  it('should include dependencies automatically', () => {
    const chunker = new SmartChunker();
    const chunks = [
      { id: 'auth.ts', tokens: 3000, imports: ['./user.ts'] },
      { id: 'user.ts', tokens: 2000, imports: ['./db.ts'] },
      { id: 'db.ts', tokens: 1500, imports: [] },
    ];

    const selected = chunker.selectRelevantChunks(chunks, 10000, 'fix auth');

    // auth.ts sélectionné → doit inclure user.ts (dépendance)
    expect(selected.map(c => c.id)).toContain('user.ts');
  });

  it('should score chunks by relevance', () => {
    const chunker = new SmartChunker();
    const chunks = [
      { id: 'auth.ts', tokens: 2000, content: 'authentication login' },
      { id: 'utils.ts', tokens: 1000, content: 'helpers utility' },
    ];

    const selected = chunker.selectRelevantChunks(chunks, 5000, 'fix authentication');

    // auth.ts plus relevant car contient "authentication"
    expect(selected[0].id).toBe('auth.ts');
  });
});
```

**À ce stade:** Les tests échouent (🔴 RED) car `SmartChunker` n'existe pas encore.

#### 2. 🟢 GREEN - Code minimal

```typescript
// packages/ai-engine/src/context/smart-chunker.ts

export interface Chunk {
  id: string;
  tokens: number;
  content?: string;
  imports?: string[];
}

export class SmartChunker {
  selectRelevantChunks(
    chunks: Chunk[],
    budget: number,
    query?: string
  ): Chunk[] {
    // 1. Score par relevance
    const scored = this.scoreChunks(chunks, query);
    
    // 2. Build dependency graph
    const graph = this.buildDependencyGraph(chunks);
    
    // 3. Select avec dépendances
    return this.selectWithDependencies(scored, graph, budget);
  }

  private scoreChunks(chunks: Chunk[], query?: string): Array<Chunk & { score: number }> {
    return chunks.map(chunk => {
      let score = 0;
      
      // Keyword matching
      if (query && chunk.content) {
        const keywords = query.toLowerCase().split(' ');
        const content = chunk.content.toLowerCase();
        score = keywords.filter(kw => content.includes(kw)).length;
      }
      
      return { ...chunk, score };
    }).sort((a, b) => b.score - a.score);
  }

  private buildDependencyGraph(chunks: Chunk[]): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();
    
    chunks.forEach(chunk => {
      const deps = new Set<string>();
      chunk.imports?.forEach(imp => {
        // Trouver le chunk correspondant à l'import
        const resolved = chunks.find(c => 
          imp.includes(c.id.replace('.ts', ''))
        );
        if (resolved) deps.add(resolved.id);
      });
      graph.set(chunk.id, deps);
    });
    
    return graph;
  }

  private selectWithDependencies(
    scored: Array<Chunk & { score: number }>,
    graph: Map<string, Set<string>>,
    budget: number
  ): Chunk[] {
    const selected = new Set<string>();
    let totalTokens = 0;

    for (const chunk of scored) {
      const needed = new Set([chunk.id]);
      
      // Ajouter dépendances
      const deps = graph.get(chunk.id) || new Set();
      deps.forEach(d => needed.add(d));
      
      // Calculer tokens nécessaires
      const neededTokens = Array.from(needed)
        .map(id => scored.find(c => c.id === id)?.tokens || 0)
        .reduce((sum, t) => sum + t, 0);
      
      if (totalTokens + neededTokens <= budget) {
        needed.forEach(id => selected.add(id));
        totalTokens += neededTokens;
      }
    }

    return scored.filter(c => selected.has(c.id));
  }
}
```

**À ce stade:** Les tests passent (🟢 GREEN).

#### 3. 🔵 REFACTOR - Améliorer

```typescript
// Améliorer le scoring avec TF-IDF
private scoreChunks(chunks: Chunk[], query?: string): Array<Chunk & { score: number }> {
  if (!query) return chunks.map(c => ({ ...c, score: 1 }));
  
  const keywords = this.extractKeywords(query);
  const idf = this.computeIDF(keywords, chunks);
  
  return chunks.map(chunk => {
    const tf = this.computeTF(keywords, chunk.content || '');
    const score = keywords.reduce((sum, kw) => {
      return sum + (tf.get(kw) || 0) * (idf.get(kw) || 0);
    }, 0);
    
    return { ...chunk, score };
  }).sort((a, b) => b.score - a.score);
}
```

**Vérifier:** Les tests passent toujours (🟢 GREEN).

### Guidelines TDD

#### ✅ DO

- **Écrire les tests avant le code** - Toujours
- **Tests unitaires petits** - Un concept par test
- **Tests descriptifs** - Le nom du test explique ce qui est testé
- **Tests isolés** - Pas de dépendances entre tests
- **Mocks minimaux** - Seulement pour I/O externes (API, DB)

#### ❌ DON'T

- **Pas de tests après coup** - TDD strict = tests first
- **Pas de tests trop larges** - Difficiles à débugger
- **Pas de tests flaky** - Si ça fail parfois, c'est un mauvais test
- **Pas de tests inutiles** - Tester la valeur ajoutée, pas les getters/setters triviaux

### Types de tests

#### 1. Tests unitaires (packages/*/src/**/__tests__/*.test.ts)

```typescript
// Vitest is the only unit-test runner in this repo. Do not import from
// `bun:test`: the two runners' module-mocking models are incompatible, and a
// mixed suite is how this repo previously ended up with files that no runner
// loaded. `bun run test:discovery` fails the build on that.
import { describe, it, expect } from 'vitest';

describe('SmartChunker', () => {
  it('should do something', () => {
    // Arrange
    const input = ...;
    
    // Act
    const result = fn(input);
    
    // Assert
    expect(result).toBe(expected);
  });
});
```

#### 2. Tests E2E (tests/e2e/specs/*.spec.ts)

```typescript
// Playwright
import { test, expect } from '../fixtures/electron';
import { EditorPage } from '../page-objects';

test.describe('Editor', () => {
  test('should open and edit a file', async ({ page }) => {
    const editor = new EditorPage(page);
    
    await editor.openFile('test.ts');
    await editor.setContent('console.log("hello")');
    await editor.save();
    
    await expect(page.locator('.save-indicator')).toContainText('Saved');
  });
});
```

#### 3. Tests d'intégration (À venir)

Tests pour valider l'intégration entre modules (AI engine + IPC + DB).

---

## Standards de code

### TypeScript

**Configuration:** `strict: true` dans tous les `tsconfig.json`

```typescript
// ✅ GOOD - Types explicites
export function processChunk(chunk: Chunk): ProcessedChunk {
  return { id: chunk.id, processed: true };
}

// ❌ BAD - any
export function processChunk(chunk: any): any {
  return chunk;
}
```

### Naming Conventions

```typescript
// Classes - PascalCase
class SmartChunker {}

// Functions/variables - camelCase
function selectChunks() {}
const maxTokens = 1000;

// Constants - SCREAMING_SNAKE_CASE
const MAX_RETRIES = 3;

// Types/Interfaces - PascalCase
interface ChunkMetadata {}
type ProcessResult = ...;

// Files - kebab-case
smart-chunker.ts
chunk-selector.test.ts
```

### Code Style

**Utilisez Prettier** (configuré automatiquement):

```bash
# Format tout le code
bun run format

# Vérifier sans modifier
bun run format:check
```

**ESLint** pour les erreurs logiques:

```bash
bun run lint
```

### Comments

```typescript
/**
 * JSDoc pour les APIs publiques
 * 
 * @param chunks - Les chunks disponibles
 * @param budget - Budget en tokens
 * @returns Les chunks sélectionnés
 */
export function selectChunks(chunks: Chunk[], budget: number): Chunk[] {
  // Comments inline pour la logique complexe
  // Expliquer le POURQUOI, pas le QUOI
  
  // Pourquoi on trie par score descendant:
  // Pour sélectionner les chunks les plus pertinents en premier
  return chunks.sort((a, b) => b.score - a.score);
}
```

### Error Handling

```typescript
// ✅ GOOD - Errors typées
class ChunkSelectionError extends Error {
  constructor(
    message: string,
    public readonly chunks: Chunk[],
    public readonly budget: number
  ) {
    super(message);
    this.name = 'ChunkSelectionError';
  }
}

export function selectChunks(chunks: Chunk[], budget: number): Chunk[] {
  if (budget <= 0) {
    throw new ChunkSelectionError('Budget must be positive', chunks, budget);
  }
  // ...
}

// ❌ BAD - Generic errors
export function selectChunks(chunks: any, budget: any) {
  if (budget <= 0) throw new Error('bad budget');
}
```

---

## Process de Pull Request

### 1. Avant de soumettre

**Checklist:**

- [ ] Les tests passent (`bun run test:e2e`)
- [ ] TypeScript compile sans erreurs (`bun run typecheck`)
- [ ] Code formaté (`bun run format`)
- [ ] Pas d'erreurs ESLint (`bun run lint`)
- [ ] Documentation mise à jour (si nécessaire)
- [ ] Commits clairs et atomiques

### 2. Créer la Pull Request

**Titre:** Format `type: description courte`

```
feat: add smart chunking with dependency analysis
fix: resolve null pointer in auth handler
docs: update contributing guide with TDD section
```

**Description:** Template

```markdown
## Description
[Décrivez ce que fait cette PR]

## Type de changement
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation

## Comment tester
1. [Étapes pour tester]
2. [...]

## Checklist
- [ ] Tests ajoutés/mis à jour
- [ ] Documentation mise à jour
- [ ] Pas de breaking changes (ou documentés)
- [ ] Self-review effectué
```

### 3. Review process

1. **Auto-checks** - CI runs tests, linting, typecheck
2. **Code review** - Un maintainer review le code
3. **Feedback** - Adresser les commentaires
4. **Approval** - Minimum 1 approval requis
5. **Merge** - Squash and merge

### 4. Après le merge

- La branche est automatiquement supprimée
- L'issue liée est automatiquement fermée (si référencée avec `Fixes #123`)

---

## Architecture Decisions

### Quand proposer une Architecture Decision Record (ADR)?

Créez un ADR pour:

- ✅ Choix de technologie majeure (framework, library)
- ✅ Changement d'architecture importante
- ✅ Trade-offs avec impact long-terme
- ✅ Décisions controversées nécessitant consensus

**Format ADR:**

```markdown
# ADR-XXX: [Title]

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Rejected | Superseded

## Context
[Quel est le problème?]

## Decision
[Quelle solution avons-nous choisie?]

## Consequences
### Positives
- ...

### Negatives
- ...

## Alternatives Considered
1. Option A - rejected because...
2. Option B - rejected because...
```

### Principe KISS

**Toujours commencer par la solution la plus simple:**

```
Question à se poser:
1. Est-ce que j'ai vraiment besoin de ça?
2. Est-ce que ça résout un problème réel (pas théorique)?
3. Est-ce que j'ai mesuré l'impact?
4. Est-ce que je peux faire plus simple?
```

**Exemple:**

```typescript
// ❌ BAD - Over-engineering
class ContextPredictor {
  private mlModel: NeuralNetwork;
  private history: Array<...>;
  
  async predict(query: string): Promise<Prediction> {
    // 200 lignes de ML complexe
    // Mais 0% de valeur si pas d'historique (cold start)
  }
}

// ✅ GOOD - Simple et efficace
function scoreChunks(chunks: Chunk[], query: string): Chunk[] {
  // 20 lignes de keyword matching
  // intégrité des frontières nettement meilleure que le split naïf (métrique structurelle ; chiffre à re-mesurer, voir packages/ai-engine/src/context/README.md)
  return chunks.sort((a, b) => 
    score(b, query) - score(a, query)
  );
}
```

**Voir:** [WHY_SIMPLE.md](./WHY_SIMPLE.md) et [ANTI_PATTERNS.md](./ANTI_PATTERNS.md)

---

## Questions & Support

### Où poser des questions?

1. **GitHub Discussions** - Questions générales, ideas
2. **GitHub Issues** - Bugs, feature requests
3. **Discord** (à venir) - Chat en temps réel

### Resources

- [README.md](./README.md) - Vue d'ensemble
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture détaillée
- [TESTING.md](./TESTING.md) - Guide des tests
- [WHY_SIMPLE.md](./WHY_SIMPLE.md) - Philosophie de simplification

---

## Remerciements

Merci à tous les contributeurs qui font de Cortex IDE un meilleur outil! 🎉

Chaque contribution, petite ou grande, est appréciée et fait avancer le projet.

---

**Dernière mise à jour:** 16 août 2026
