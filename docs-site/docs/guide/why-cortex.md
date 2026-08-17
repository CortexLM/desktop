# Pourquoi Cortex?

Cortex IDE n'est **pas** un énième IDE avec autocomplete. C'est un orchestrateur d'agents IA qui répond à des besoins spécifiques que les IDE traditionnels ne couvrent pas.

## Le problème

### Les IDE actuels sont excellents pour l'édition

VSCode, Cursor, et d'autres IDE modernes offrent:
- ✅ Autocomplete intelligent (Copilot, Tabnine)
- ✅ Navigation de code rapide
- ✅ Git intégré
- ✅ Extensions riches

**Mais ils ne sont pas conçus pour orchestrer des missions complexes.**

### Les agents IA actuels sont limités

ChatGPT, Claude, et autres:
- ✅ Conversations interactives
- ✅ Génération de code
- ❌ Pas d'accès direct au codebase
- ❌ Pas de gestion de missions multi-étapes
- ❌ Pas de benchmarking intégré

## La solution Cortex

Cortex comble le gap entre **édition de code** et **orchestration d'agents**.

### 1. Mission Orchestration

Gérez des missions complexes qui nécessitent plusieurs étapes interdépendantes:

```typescript
Mission: Refactor auth system to use JWT
├─ Feature 1: Implement JWT generation/validation
│  └─ Depends on: None
├─ Feature 2: Update auth middleware
│  └─ Depends on: Feature 1
├─ Feature 3: Migrate database schema
│  └─ Depends on: Feature 1
└─ Feature 4: Update API endpoints
   └─ Depends on: Feature 2, Feature 3

State machine: planning → running → paused → completed
Progress tracking: JSONL event log
```

**Pourquoi c'est unique:**
- Aucun IDE ne gère nativement les dépendances entre features
- Cortex orchestre automatiquement l'ordre d'exécution
- Pause/resume pour les missions longues (heures/jours)

### 2. Benchmarking Intégré

Comparez objectivement les providers IA:

Le harnais mesure, par provider et par tâche : latence, tokens entrée/sortie et
coût calculé depuis la grille tarifaire du provider. La sortie existe en JSON,
Markdown et HTML.

::: warning Tableau d'exemple retiré (17/08/2026)
Un tableau de résultats figurait ici — GPT-4.5-turbo `1.2s / 847 tokens /
$0.021 / 8.5/10`, Claude Sonnet `2.1s / 923 / $0.015 / 9.0/10`, Claude Opus
`3.8s / 1,104 / $0.045 / 9.5/10`, concluant « Recommendation: Claude Sonnet
4.8 ».

Ce run n'a jamais été exécuté, et la colonne **Quality** ne peut pas exister :
le harnais n'embarque aucun juge de qualité. Les seules notes de qualité
présentes dans le dépôt sont dans
`packages/test-harness/benchmarks/context-bench/mock-results.json`, un fichier de
données factices dont chaque entrée porte la mention `"Mock data"`.

Pour obtenir des chiffres réels, il faut exécuter le harnais sur vos propres
tâches avec vos propres clés d'API — c'est précisément ce qu'il sert à faire.
:::

**Pourquoi c'est utile :**
- Comparer les providers sur *vos* tâches plutôt que sur des benchmarks publics
- Rapports JSON/Markdown/HTML pour analyse
- Latence, tokens et coût sont mesurés ; la qualité reste à votre appréciation

### 3. Context Optimization

Découpage de gros fichiers aux frontières syntaxiques :

```typescript
import { SemanticChunker } from '@cortex-ide/ai-engine'

const chunks = await new SemanticChunker({ maxChunkSize: 500 })
  .chunk(content, filePath, 'typescript')
```

Mesuré le 17/08/2026 sur 65 fichiers / 163 déclarations : 60,7 % des
déclarations arrivent intactes dans un seul chunk au budget 500, contre 22,7 %
pour un découpage naïf par lignes (+167,6 % en relatif). Reproduire via
`boundary-integrity.test.ts`. C'est une métrique **structurelle** : aucun LLM
n'est interrogé, ce n'est pas une mesure de qualité de réponse.

::: warning Description précédente inexacte
Cette section décrivait un pipeline *dependency graph (AST-based) → scoring
TF-IDF → sélection greedy* produisant « 342 fichiers sélectionnés sur 5 000 ».
Aucun de ces trois éléments n'existe dans le code (0 résultat pour `tfidf`,
`greedy`, ou tout parsing AST), et le chunker ne sélectionne rien : il découpe le
contenu d'un fichier qu'on lui passe. Voir
[Context Optimization](/guide/features/context-optimization).
:::

## Comparaison

### Cortex vs Cursor

| Feature                | Cursor          | Cortex          |
|------------------------|-----------------|-----------------|
| Autocomplete inline    | ✅ Excellent    | ❌ Non supporté |
| Éditeur de code        | ✅ Full VSCode  | ❌ Basique      |
| Git UI                 | ✅ Complet      | ❌ Basique      |
| **Mission orchestration** | ❌ Non       | ✅ **Avancé**   |
| **Benchmarking**       | ❌ Non          | ✅ **Intégré**  |
| **Context optimization** | ❌ Non        | ✅ **Smart chunking** |
| Multi-provider         | ❌ OpenAI only  | ✅ 4 providers  |

**Verdict:** Utilisez Cursor pour éditer, Cortex pour orchestrer.

### Cortex vs ChatGPT/Claude

| Feature                | ChatGPT/Claude  | Cortex          |
|------------------------|-----------------|-----------------|
| Conversations          | ✅ Excellent    | ✅ Bon          |
| Accès codebase         | ❌ Via copier-coller | ✅ Direct |
| **Mission multi-étapes** | ❌ Manuel     | ✅ **Automatisé** |
| **Benchmarking**       | ❌ Non          | ✅ **Intégré**  |
| **Context 300k+**      | ❌ Limite 200k  | ✅ **Smart chunking** |
| Tools natifs           | ❌ Limités      | ✅ File system, Git, etc. |

**Verdict:** Utilisez ChatGPT pour chat, Cortex pour coding.

## Use Cases Idéaux

### ✅ Quand utiliser Cortex

1. **Missions complexes multi-features**
   - Refactoring d'architecture
   - Migration de frameworks
   - Implémentation de features avec dépendances

2. **Optimisation coûts/qualité**
   - Choisir le bon provider pour chaque tâche
   - Benchmarker avant de scaler
   - Monitorer les coûts en temps réel

3. **Grandes codebases**
   - Projets 1000+ fichiers
   - Contexte 300k+ tokens nécessaire
   - Analyse de dépendances critique

### ❌ Quand ne pas utiliser Cortex

1. **Édition de code simple**
   - Utilisez VSCode/Cursor avec Copilot

2. **Prototypage rapide**
   - Utilisez ChatGPT/Claude directement

3. **Git workflows complexes**
   - Utilisez votre git client préféré

## Philosophie: Compléter, pas remplacer

Cortex est conçu pour **compléter** votre workflow existant:

```
┌─────────────────────────────────────────────────┐
│              Votre Workflow Idéal               │
├─────────────────────────────────────────────────┤
│                                                  │
│  VSCode/Cursor           →  Édition de code     │
│       +                                          │
│  Copilot/TabNine         →  Autocomplete        │
│       +                                          │
│  Cortex IDE              →  Mission orchestration│
│       +                                          │
│  Git Client              →  Version control     │
│       +                                          │
│  Terminal                →  Commands            │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Principe:** Utilisez le meilleur outil pour chaque tâche.

## Roadmap

Cortex continue d'évoluer:

- [x] Phase 1: Architecture simplifiée (KISS)
- [x] Phase 2: Smart chunking avec dépendances
- [ ] Phase 3: Mission orchestrator UI
- [ ] Phase 4: Benchmarking UI avancé
- [ ] Phase 5: MCP marketplace
- [ ] Phase 6: Terminal-Bench 3.0 integration

## Contribuer

Cortex est open source (MIT):

- 🌟 [Star sur GitHub](https://github.com/cortex-ide/cortex-ide)
- 🐛 [Signaler un bug](https://github.com/cortex-ide/cortex-ide/issues)
- 💬 [Discussions](https://github.com/cortex-ide/cortex-ide/discussions)
- 🤝 [Contributing guide](/developer/contributing)

---

**En résumé:** Cortex ne remplace pas votre IDE. Il le complète avec des capacités d'orchestration d'agents que personne d'autre n'offre.
