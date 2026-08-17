# Prompt Templates Library

Bibliothèque de templates de prompts optimisés pour les scénarios de longs contextes (100k+ tokens), inspirée des meilleures pratiques de Cursor, Factory et Claude.

## 📁 Structure

```
prompts/
├── system-prompts.ts    # Prompts système pour différentes tâches
├── examples.ts          # Exemples few-shot de haute qualité
├── tool-prompts.ts      # Instructions pour l'utilisation des outils MCP
├── compression.ts       # Utilitaires de compression de contexte
├── composer.ts          # Builder intelligent de prompts
└── index.ts            # Point d'entrée principal
```

## 🎯 System Prompts

Quatre prompts système optimisés pour différents cas d'usage :

### `CODE_GENERATION_LONG_CONTEXT`
- Génération de code avec 100k+ tokens de contexte
- Priorisation automatique du contexte (fichiers récents > dépendances > historique)
- Respect des patterns existants du codebase
- Output complet et exécutable

### `DEBUGGING_LONG_CONTEXT`
- Debug avec traces d'exécution complètes
- Analyse de root cause méthodique
- Corrélation d'événements multi-services
- Recommandations de fix actionnables

### `REFACTORING_LONG_CONTEXT`
- Refactoring de larges codebases
- Approche incrémentale et sûre
- Préservation de la compatibilité
- Plan de migration en phases

### `REASONING_LONG_CONTEXT`
- Reasoning chains pour décisions architecturales
- Analyse de trade-offs systématique
- Raisonnement multi-étapes explicite
- Recommandations justifiées

## 📚 Few-Shot Examples

Exemples de haute qualité pour chaque type de tâche :

```typescript
import { selectExamples, formatExamples } from './prompts';

// Sélectionner jusqu'à 500 tokens d'exemples
const examples = selectExamples('code_generation', 500);

// Formater pour inclusion dans un prompt
const formatted = formatExamples(examples);
```

Catégories disponibles :
- `code_generation`: Ajout d'error handling, conversion callback→Promise, typage TypeScript
- `debugging`: Identification d'erreurs, diagnostic de race conditions
- `refactoring`: Extraction de hooks, remplacement de prop drilling

## 🛠️ Tool Use Prompts

Instructions optimisées pour l'utilisation des outils MCP :

```typescript
import { buildToolUsePrompt } from './prompts';

const toolPrompt = buildToolUsePrompt({
  enableParallel: true,
  maxParallelCalls: 5,
  includeErrorRecovery: true,
});
```

**Fonctionnalités :**
- Pattern d'invocation parallèle pour outils indépendants
- Stratégies de recovery après erreur
- Guidance MCP (file system, git, database)
- Optimisation des résultats

## 🗜️ Context Compression

Utilitaires pour gérer de larges codebases :

```typescript
import { summarizeCode, selectContext, compressToTarget } from './prompts';

// Résumer du code avec différents niveaux
const result = summarizeCode(code, {
  targetTokens: 1000,
  summarizationLevel: 'medium', // 'light' | 'medium' | 'aggressive'
  preserveStructure: true,
  keepTypes: true,
});

// Sélectionner le contexte intelligent
const context = selectContext(
  allFiles,           // Map<string, string>
  focusFiles,         // string[]
  tokenBudget,        // number
  compressionConfig
);

// Contexte organisé en 3 niveaux :
// - essential: fichiers focus (priorité max)
// - relevant: dépendances (priorité haute)
// - background: autres fichiers (priorité basse)
```

**Techniques de compression :**
- **Light** : Suppression whitespace et lignes vides
- **Medium** : Conservation signatures + types, suppression implémentations
- **Aggressive** : Exports et types seulement

## 🎼 Prompt Composer

Builder intelligent qui compose des prompts optimaux :

```typescript
import { PromptComposer, QuickPromptBuilder } from './prompts';

// Utilisation avancée
const composer = new PromptComposer({
  maxTokens: 100000,
  systemPromptType: 'CODE_GENERATION',
  includeExamples: true,
  includeToolGuidance: true,
  contextFiles: new Map([
    ['/src/user.ts', userCode],
    ['/src/auth.ts', authCode],
  ]),
  focusFiles: ['/src/user.ts'],
});

const prompt = await composer.build('Add authentication to user service');

console.log(`Tokens: ${prompt.totalTokens}`);
console.log(`Sections: ${prompt.sections.map(s => s.name).join(', ')}`);
console.log(`Trimmed: ${prompt.trimmed.join(', ')}`);
```

### Quick Builders

Builders pré-configurés pour cas d'usage courants :

```typescript
// Code generation
const prompt = await QuickPromptBuilder.forCodeGeneration(
  'Add error handling',
  contextFiles,
  focusFiles,
  100000
);

// Debugging
const prompt = await QuickPromptBuilder.forDebugging(
  'Why is this crashing?',
  logsContent,
  100000
);

// Refactoring
const prompt = await QuickPromptBuilder.forRefactoring(
  'Extract reusable utilities',
  contextFiles,
  focusFiles,
  150000
);

// Reasoning/Planning
const prompt = await QuickPromptBuilder.forReasoning(
  'Should we use Redis or in-memory cache?',
  contextFiles,
  120000
);
```

## 🧠 Stratégies d'optimisation

Le Prompt Composer applique automatiquement ces stratégies :

### 1. **Priorisation par sections**
- Priorité 1 (requis) : System prompt, User instruction
- Priorité 2-3 : Tool guidance, Examples, Context essentiel
- Priorité 4-5 : Context relevant, Context background

### 2. **Budget de tokens**
- System prompt + tools : ~20-30%
- Context essentiel : ~30-40%
- Context relevant : ~20-30%
- Context background : ~10-20%

### 3. **Compression progressive**
- Si dépassement budget :
  1. Supprimer sections optionnelles (priorité basse d'abord)
  2. Compresser sections de contexte (50% de réduction)
  3. Passer en mode aggressive compression
  4. Truncate en dernier recours

### 4. **Token counting en temps réel**
- Estimation : ~4 caractères par token
- Tracking par section
- Statistiques d'utilisation disponibles

## 📊 Exemple complet

```typescript
import { 
  PromptComposer, 
  SYSTEM_PROMPTS,
  estimateTokens 
} from '@cortex-ide/ai-engine/prompts';

// Lire fichiers du projet
const contextFiles = new Map([
  ['/src/api/users.ts', await readFile('src/api/users.ts')],
  ['/src/api/auth.ts', await readFile('src/api/auth.ts')],
  ['/src/types/user.ts', await readFile('src/types/user.ts')],
]);

// Composer le prompt
const composer = new PromptComposer({
  maxTokens: 128000, // Claude 3.5 Sonnet
  systemPromptType: 'CODE_GENERATION',
  includeExamples: true,
  includeToolGuidance: true,
  contextFiles,
  focusFiles: ['/src/api/users.ts'],
  compressionConfig: {
    targetTokens: 50000,
    preserveStructure: true,
    keepTypes: true,
    summarizationLevel: 'medium',
  },
});

const prompt = await composer.build(
  'Add rate limiting to the user API endpoints'
);

// Utiliser avec le provider AI
const response = await anthropicProvider.chat([
  { role: 'system', content: prompt.systemPrompt },
  { role: 'user', content: prompt.userPrompt },
], {
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 8192,
});

// Stats
console.log('Composition stats:');
console.log(`- Total input tokens: ${prompt.totalTokens}`);
console.log(`- Sections included: ${prompt.sections.length}`);
console.log(`- Sections trimmed: ${prompt.trimmed.join(', ') || 'none'}`);
console.log(`- Utilization: ${(prompt.totalTokens / 128000 * 100).toFixed(1)}%`);
```

## 🎯 Best Practices

### Pour la génération de code
```typescript
const prompt = await QuickPromptBuilder.forCodeGeneration(
  instruction,
  contextFiles,
  focusFiles,
  100000 // GLM-5.2 context window
);
```

### Pour le debugging
```typescript
// Inclure les logs complets
const prompt = await QuickPromptBuilder.forDebugging(
  'Diagnose this crash',
  fullStackTrace,
  100000
);
```

### Pour le refactoring
```typescript
// Utiliser moins de compression pour voir plus de code
const prompt = await QuickPromptBuilder.forRefactoring(
  instruction,
  contextFiles,
  focusFiles,
  150000 // Plus de tokens pour voir le contexte complet
);
```

### Pour les décisions architecturales
```typescript
// Pas besoin d'exemples de code
const prompt = await QuickPromptBuilder.forReasoning(
  'Choose between microservices and monolith',
  contextFiles,
  120000
);
```

## 🔧 Configuration avancée

```typescript
const composer = new PromptComposer({
  maxTokens: 200000, // Gemini 1.5 Pro
  systemPromptType: 'REFACTORING',
  
  // Contrôle fin des exemples
  includeExamples: true,
  
  // Guidance pour MCP tools
  includeToolGuidance: true,
  toolPromptConfig: {
    enableParallel: true,
    maxParallelCalls: 7,
    includeErrorRecovery: true,
  },
  
  // Compression agressive pour large codebase
  compressionConfig: {
    targetTokens: 80000,
    preserveStructure: true,
    keepTypes: true,
    summarizationLevel: 'aggressive',
  },
  
  // Sections custom
  customSections: [
    {
      name: 'project_conventions',
      content: await readFile('.cursorrules'),
      tokens: estimateTokens(conventionsContent),
      priority: 2,
      required: true,
    },
  ],
});
```

## 🚀 Performance

- **Estimation de tokens** : O(n) sur la longueur du texte
- **Compression de code** : O(n) sur le nombre de lignes
- **Sélection de contexte** : O(n log n) avec tri par pertinence
- **Composition finale** : O(n) sur le nombre de sections

Optimisé pour gérer des codebases de 100+ fichiers avec des contextes de 200k+ tokens.
