# Contributing to Cortex IDE

Merci de votre intérêt pour contribuer à Cortex IDE! Ce guide vous aidera à comprendre notre workflow.

::: tip
Ce document est une version condensée. Pour la version complète, consultez [CONTRIBUTING.md](https://github.com/cortex-ide/cortex-ide/blob/main/CONTRIBUTING.md) sur GitHub.
:::

## Quick Start

```bash
# Fork et clone
git clone https://github.com/YOUR_USERNAME/cortex-ide.git
cd cortex-ide

# Install
bun install
bunx playwright install chromium

# Build
bun run build

# Dev
bun run dev

# Dans un autre terminal
bun run start
```

## Workflow TDD

Cortex suit une approche **Test-Driven Development** stricte:

### Cycle Red-Green-Refactor

```
1. 🔴 RED    - Écrire un test qui échoue
2. 🟢 GREEN  - Écrire le code minimal pour passer
3. 🔵 REFACTOR - Améliorer en gardant les tests verts
```

### Exemple

```typescript
// 1. 🔴 RED - Test first
describe('SmartChunker', () => {
  it('should select relevant chunks within budget', () => {
    const chunker = new SmartChunker()
    const chunks = [
      { id: 'auth.ts', tokens: 5000, content: 'auth code' },
      { id: 'user.ts', tokens: 3000, content: 'user code' }
    ]
    
    const selected = chunker.selectRelevantChunks(chunks, 8000, 'fix auth')
    
    expect(selected).toHaveLength(2)
    expect(selected[0].id).toBe('auth.ts')
  })
})

// 2. 🟢 GREEN - Implementation
class SmartChunker {
  selectRelevantChunks(chunks: Chunk[], budget: number, query: string) {
    // Minimal implementation
    return chunks.slice(0, 2)
  }
}

// 3. 🔵 REFACTOR - Improve
class SmartChunker {
  selectRelevantChunks(chunks: Chunk[], budget: number, query: string) {
    // Better scoring algorithm
    const scored = this.scoreChunks(chunks, query)
    return this.selectWithBudget(scored, budget)
  }
}
```

## Standards de code

### TypeScript

- ✅ `strict: true` obligatoire
- ✅ Types explicites pour les APIs publiques
- ✅ JSDoc pour les fonctions exportées
- ❌ `any` interdit (sauf cas exceptionnels)

### Naming

```typescript
// Classes - PascalCase
class SmartChunker {}

// Functions/variables - camelCase
function selectChunks() {}
const maxTokens = 1000

// Constants - SCREAMING_SNAKE_CASE
const MAX_RETRIES = 3

// Files - kebab-case
smart-chunker.ts
chunk-selector.test.ts
```

### Formatting

```bash
# Auto-format avec Prettier
bun run format

# Check sans modifier
bun run format:check

# Lint
bun run lint
```

## Tests

### Types de tests

#### 1. Tests unitaires

```typescript
// packages/ai-engine/src/__tests__/smart-chunker.test.ts
import { describe, it, expect } from 'bun:test'
import { SmartChunker } from '../smart-chunker'

describe('SmartChunker', () => {
  it('should do something', () => {
    // Arrange
    const input = ...
    
    // Act
    const result = fn(input)
    
    // Assert
    expect(result).toBe(expected)
  })
})
```

#### 2. Tests E2E

```typescript
// tests/e2e/specs/editor.spec.ts
import { test, expect } from '../fixtures/electron'

test('should open and edit file', async ({ page }) => {
  await page.click('[data-testid="open-file"]')
  await page.fill('[data-testid="editor"]', 'new content')
  await page.click('[data-testid="save"]')
  
  await expect(page.locator('.save-indicator')).toContainText('Saved')
})
```

### Lancer les tests

```bash
# Tests unitaires (Bun)
bun test

# Tests E2E (Playwright)
bun run test:e2e

# Tests E2E en mode UI
bun run test:e2e:ui

# Coverage
bun test --coverage
```

## Pull Requests

### Avant de soumettre

**Checklist:**
- [ ] Tests passent (`bun run test:e2e`)
- [ ] TypeScript compile (`bun run typecheck`)
- [ ] Code formaté (`bun run format`)
- [ ] Pas d'erreurs ESLint (`bun run lint`)
- [ ] Documentation mise à jour
- [ ] Commits clairs et atomiques

### Format du titre

```
type: description courte

Types:
- feat: Nouvelle fonctionnalité
- fix: Bug fix
- docs: Documentation
- test: Tests
- refactor: Refactoring
- perf: Performance

Exemples:
feat: add smart chunking with dependency analysis
fix: resolve null pointer in auth handler
docs: update contributing guide with TDD section
```

### Template de description

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

## Architecture Decisions

### Quand créer un ADR?

Créez un Architecture Decision Record pour:
- ✅ Choix de technologie majeure
- ✅ Changement d'architecture
- ✅ Trade-offs avec impact long-terme

### Format ADR

```markdown
# ADR-XXX: [Title]

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Rejected

## Context
[Quel est le problème?]

## Decision
[Quelle solution choisie?]

## Consequences
### Positives
- ...

### Negatives
- ...

## Alternatives Considered
1. Option A - rejected because...
2. Option B - rejected because...
```

## Principe KISS

**Toujours commencer par la solution la plus simple:**

Questions à se poser:
1. Est-ce que j'ai vraiment besoin de ça?
2. Est-ce que ça résout un problème réel?
3. Est-ce que j'ai mesuré l'impact?
4. Est-ce que je peux faire plus simple?

### Exemple

❌ **Mauvais - Over-engineering:**
```typescript
class ContextPredictor {
  private mlModel: NeuralNetwork
  private history: Array<...>
  
  async predict(query: string): Promise<Prediction> {
    // 200 lignes de ML complexe
  }
}
```

✅ **Bon - Simple et efficace:**
```typescript
function scoreChunks(chunks: Chunk[], query: string): Chunk[] {
  // 20 lignes de keyword matching
  return chunks.sort((a, b) => score(b, query) - score(a, query))
}
```

## Resources

- [Architecture](/architecture/)
- [API Reference](/api/)

<!-- Liens corrigés/retirés le 17/08/2026 : `/developer/architecture` n'existe
     pas (la page réelle est `/architecture/`), et `/developer/testing` n'existe
     pas du tout. -->

- [WHY_SIMPLE.md](https://github.com/cortex-ide/cortex-ide/blob/main/WHY_SIMPLE.md)

## Questions?

- 📖 [GitHub Discussions](https://github.com/cortex-ide/cortex-ide/discussions)
- 🐛 [Issues](https://github.com/cortex-ide/cortex-ide/issues)
- 💬 Discord (à venir)
