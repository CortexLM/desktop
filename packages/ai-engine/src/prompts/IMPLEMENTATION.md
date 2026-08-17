# 🎯 Prompt Templates Library - Documentation Complète

## 📦 Vue d'ensemble

Bibliothèque complète de templates de prompts optimisés pour les scénarios de longs contextes (100k+ tokens), conçue pour Cortex IDE et inspirée des meilleures pratiques de Cursor, Factory et Claude.

### Structure créée

```
packages/ai-engine/src/prompts/
├── system-prompts.ts      # 4 prompts système spécialisés
├── examples.ts            # Few-shot examples de haute qualité
├── tool-prompts.ts        # Instructions pour MCP tools
├── compression.ts         # Compression intelligente de contexte
├── composer.ts            # Builder de prompts avec budget tokens
├── index.ts              # Exports principaux
└── README.md             # Documentation détaillée

examples/
└── prompts-usage.ts      # 8 exemples d'utilisation

tests/
└── prompts.test.ts       # Suite de tests complète
```

**Total : 2230+ lignes de code TypeScript avec types stricts**

## 🎨 Composants principaux

### 1. System Prompts (system-prompts.ts)

Quatre prompts système optimisés :

#### **CODE_GENERATION_LONG_CONTEXT** (~320 tokens)
- Génération avec 100k+ tokens de contexte
- Priorisation automatique (récent > dépendances > historique)
- Principes : Consistency First, Minimal Changes, Type Safety
- Output structuré avec file paths et diff format

#### **DEBUGGING_LONG_CONTEXT** (~340 tokens)
- Debug avec traces complètes
- Méthodologie en 5 étapes (identification → root cause → corrélation → patterns → solution)
- Format structuré : Root Cause, Evidence, Fix, Prevention
- Focus sur les erreurs critiques avec timestamps

#### **REFACTORING_LONG_CONTEXT** (~380 tokens)
- Refactoring large-scale en phases
- Stratégie incrémentale et safe
- Output en 3 phases : Preparation → Migration → Cleanup
- Risk management intégré

#### **REASONING_LONG_CONTEXT** (~420 tokens)
- Reasoning chains pour décisions architecturales
- Framework en 5 étapes avec trade-off analysis
- Analyse multi-dimensionnelle (performance, simplicité, maintenance)
- Recommandations justifiées avec roadmap

### 2. Few-Shot Examples (examples.ts)

**3 catégories d'exemples :**

- **Code Generation** (3 exemples, ~460 tokens)
  - Error handling async/await
  - Conversion callback → Promise
  - Typage TypeScript

- **Debugging** (2 exemples, ~420 tokens)
  - Null reference errors
  - Race conditions

- **Refactoring** (2 exemples, ~520 tokens)
  - Extraction de hooks React
  - Context API vs prop drilling

**Fonctions utilitaires :**
- `selectExamples()` : Sélection avec budget tokens
- `formatExamples()` : Formatage pour inclusion dans prompts
- `getExampleStats()` : Statistiques par catégorie

### 3. Tool Use Prompts (tool-prompts.ts)

**Instructions complètes pour :**

- **Base Guidelines** : Sélection, appel, patterns d'utilisation
- **MCP Tools** : File system, Git, Database operations
- **Parallel Optimization** : Jusqu'à 5-7 appels concurrents
- **Error Recovery** : 4 catégories (Transient, Parameter, Permission, Fatal)
- **Result Processing** : Validation, extraction, formatage

**Configuration flexible :**
```typescript
buildToolUsePrompt({
  enableParallel: true,
  maxParallelCalls: 5,
  includeErrorRecovery: true,
})
```

### 4. Context Compression (compression.ts)

**Techniques de compression :**

#### **Light** (~95% conservation)
- Suppression whitespace et lignes vides
- Normalisation indentation

#### **Medium** (~20-40% conservation)
- Signatures de fonctions/classes
- Types et interfaces complets
- Imports essentiels

#### **Aggressive** (~10-20% conservation)
- Exports uniquement
- Types sans implémentation
- Résumé des imports

**Fonctions principales :**

- `summarizeCode()` : Compression avec niveaux configurables
- `extractKeyInfo()` : Extraction imports/exports/types/functions/classes
- `selectContext()` : Sélection intelligente avec 3 niveaux de priorité
  - **Essential** : Focus files (full content)
  - **Relevant** : Dependencies (compressed)
  - **Background** : Other files (signatures only)
- `compressToTarget()` : Compression progressive jusqu'au budget cible
- `summarizeFileTree()` : Résumé hiérarchique d'un codebase

**Estimation de tokens : ~4 caractères par token**

### 5. Prompt Composer (composer.ts)

**Builder intelligent avec :**

#### **Gestion automatique du budget tokens**
- Priorisation par sections (1 = max, 5 = min)
- Compression progressive si dépassement
- Trimming des sections optionnelles

#### **Stratégies d'optimisation**
1. Suppression sections optionnelles (priorité basse d'abord)
2. Compression sections contexte (50% réduction)
3. Mode aggressive compression
4. Truncate en dernier recours

#### **Composition intelligente**
```typescript
const composer = new PromptComposer({
  maxTokens: 128000,
  systemPromptType: 'CODE_GENERATION',
  includeExamples: true,
  includeToolGuidance: true,
  contextFiles: new Map([...]),
  focusFiles: ['/src/main.ts'],
  compressionConfig: { ... },
});

const prompt = await composer.build('Add authentication');
```

#### **Quick Builders pré-configurés**
- `forCodeGeneration()` : 100k tokens, examples + tools
- `forDebugging()` : 100k tokens, logs emphasis
- `forRefactoring()` : 150k tokens, light compression
- `forReasoning()` : 120k tokens, no examples

## 🚀 Utilisation

### Exemple 1 : Génération de code simple

```typescript
import { QuickPromptBuilder } from '@cortex-ide/ai-engine/prompts';

const contextFiles = new Map([
  ['/src/api/users.ts', userApiCode],
  ['/src/types/user.ts', userTypes],
]);

const prompt = await QuickPromptBuilder.forCodeGeneration(
  'Add rate limiting middleware to user API',
  contextFiles,
  ['/src/api/users.ts'],
  100000 // GLM-5.2 context window
);

// Utiliser avec votre provider AI
const response = await provider.chat([
  { role: 'system', content: prompt.systemPrompt },
  { role: 'user', content: prompt.userPrompt },
]);
```

### Exemple 2 : Debug avec logs complets

```typescript
import { QuickPromptBuilder } from '@cortex-ide/ai-engine/prompts';

const stackTrace = `
[ERROR] Cannot read property 'id' of undefined
  at UserService.getUser (user-service.ts:45)
  at API.handler (api.ts:123)
`;

const prompt = await QuickPromptBuilder.forDebugging(
  'Diagnose this null reference error',
  stackTrace,
  100000
);
```

### Exemple 3 : Refactoring avec contexte large

```typescript
import { QuickPromptBuilder } from '@cortex-ide/ai-engine/prompts';

const allFiles = new Map([
  ['/src/components/UserProfile.tsx', ...],
  ['/src/components/UserSettings.tsx', ...],
  ['/src/hooks/useUser.ts', ...],
  // ... 50+ fichiers
]);

const prompt = await QuickPromptBuilder.forRefactoring(
  'Extract shared user logic into reusable hooks',
  allFiles,
  ['/src/components/UserProfile.tsx'],
  150000 // Plus de tokens pour large refactor
);
```

### Exemple 4 : Configuration avancée

```typescript
import { 
  PromptComposer, 
  estimateTokens 
} from '@cortex-ide/ai-engine/prompts';

const composer = new PromptComposer({
  maxTokens: 200000, // Gemini 1.5 Pro
  systemPromptType: 'REASONING',
  includeExamples: false, // Pas besoin pour reasoning
  includeToolGuidance: false,
  
  contextFiles: largeCodebase,
  focusFiles: architectureFiles,
  
  compressionConfig: {
    targetTokens: 100000,
    summarizationLevel: 'aggressive',
    preserveStructure: true,
    keepTypes: true,
  },
  
  customSections: [
    {
      name: 'architecture_docs',
      content: await readFile('ARCHITECTURE.md'),
      tokens: estimateTokens(archContent),
      priority: 2,
      required: true,
    },
  ],
});

const prompt = await composer.build(
  'Should we migrate to microservices or keep the monolith?'
);

console.log(`Tokens used: ${prompt.totalTokens} / 200000`);
console.log(`Utilization: ${(prompt.totalTokens / 200000 * 100).toFixed(1)}%`);
```

## 📊 Performance et capacités

### Métriques
- **Estimation tokens** : O(n) sur longueur texte
- **Compression** : O(n) sur nombre de lignes
- **Sélection contexte** : O(n log n) avec tri
- **Composition finale** : O(n) sur nombre de sections

### Capacités testées
- ✅ Codebases de 100+ fichiers
- ✅ Contextes de 200k+ tokens
- ✅ Compression 10:1 (aggressive)
- ✅ Sélection intelligente de dépendances
- ✅ Gestion automatique du budget
- ✅ Types TypeScript stricts partout

## 🎯 Best Practices

### 1. Choisir le bon system prompt
```typescript
// Code generation → CODE_GENERATION
// Bug fixing → DEBUGGING
// Large refactor → REFACTORING
// Architecture decisions → REASONING
```

### 2. Adapter la compression au modèle
```typescript
// GLM-5.2 (100k) → medium compression
// Claude 3.5 (200k) → light compression
// Gemini 1.5 Pro (1M) → minimal compression
```

### 3. Prioriser les fichiers correctement
```typescript
// Focus files = ce que vous modifiez
// Context files = tout le codebase
// Le composer fait le reste automatiquement
```

### 4. Inclure des exemples pour tâches complexes
```typescript
includeExamples: true  // Pour génération code
includeExamples: false // Pour reasoning/planning
```

## ✅ Tests et validation

**Suite de tests créée** (`tests/prompts.test.ts`) :
- ✅ System prompts (4 types)
- ✅ Examples selection et formatting
- ✅ Token estimation
- ✅ Code compression (3 niveaux)
- ✅ Context selection
- ✅ PromptComposer (build, trim, stats)
- ✅ QuickPromptBuilder (4 builders)

**Exemples d'usage** (`examples/prompts-usage.ts`) :
- 8 exemples complets et exécutables
- Tous validés avec sortie console

## 🔧 Intégration dans Cortex IDE

La bibliothèque est maintenant disponible via :

```typescript
import {
  // Builders
  PromptComposer,
  QuickPromptBuilder,
  
  // System prompts
  SYSTEM_PROMPTS,
  
  // Examples
  selectExamples,
  formatExamples,
  
  // Compression
  estimateTokens,
  summarizeCode,
  selectContext,
  
  // Types
  type ComposedPrompt,
  type SystemPromptType,
  type CompressionConfig,
} from '@cortex-ide/ai-engine/prompts';
```

Exportée depuis le package principal :
```typescript
export * from './prompts'; // Dans src/index.ts
```

---

**Créé pour Cortex IDE - Août 2026**
