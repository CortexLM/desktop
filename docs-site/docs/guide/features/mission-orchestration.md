# Mission Orchestration

Le Mission Orchestrator est le cœur de Cortex IDE. Il permet de gérer des workflows complexes avec plusieurs features interdépendantes.

## Concept

Une **mission** est composée de plusieurs **features** qui ont des **dépendances** entre elles.

```typescript
interface Mission {
  id: string
  title: string
  features: Feature[]
  state: 'planning' | 'running' | 'paused' | 'completed' | 'failed'
  createdAt: Date
  updatedAt: Date
}

interface Feature {
  id: string
  title: string
  dependencies: string[] // IDs des features dont celle-ci dépend
  state: 'pending' | 'running' | 'completed' | 'failed'
  agent?: AgentConfig
}
```

## Créer une mission

### Interface graphique

1. Cliquez sur **New Mission** dans la sidebar
2. Donnez un titre à la mission
3. Ajoutez des features avec le bouton **Add Feature**
4. Définissez les dépendances en glissant-déposant

### Depuis un fichier

Créez un fichier `mission.json`:

```json
{
  "title": "Refactor authentication system",
  "features": [
    {
      "id": "feat-1",
      "title": "Implement JWT utilities",
      "dependencies": [],
      "description": "Create JWT generation, validation, and refresh logic"
    },
    {
      "id": "feat-2",
      "title": "Update auth middleware",
      "dependencies": ["feat-1"],
      "description": "Replace session-based auth with JWT in middleware"
    },
    {
      "id": "feat-3",
      "title": "Migrate database schema",
      "dependencies": ["feat-1"],
      "description": "Add refresh_tokens table and migrate users"
    },
    {
      "id": "feat-4",
      "title": "Update API endpoints",
      "dependencies": ["feat-2", "feat-3"],
      "description": "Update all /api/auth/* endpoints to use JWT"
    },
    {
      "id": "feat-5",
      "title": "Add tests",
      "dependencies": ["feat-4"],
      "description": "E2E tests for auth flows"
    }
  ]
}
```

Importez avec: **File > Import Mission**

## State Machine

Chaque mission suit un state machine strict:

```
┌──────────┐
│ planning │  Initial state
└────┬─────┘
     │ start()
     ▼
┌──────────┐
│ running  │  Executing features
└────┬─────┘
     │
     ├──────► pause()  ──►  ┌────────┐
     │                      │ paused │
     │                      └───┬────┘
     │                          │ resume()
     │ ◄────────────────────────┘
     │
     ├──────► complete()  ──►  ┌───────────┐
     │                          │ completed │
     │                          └───────────┘
     │
     └──────► fail()  ──────►  ┌────────┐
                                │ failed │
                                └────────┘
```

## Exécution

### Ordre d'exécution

L'orchestrateur analyse le graphe de dépendances et exécute les features dans l'ordre optimal:

```typescript
// Mission graph
Mission: Refactor auth
├─ feat-1: JWT utils (no deps)
├─ feat-2: Middleware (depends: feat-1)
├─ feat-3: Database (depends: feat-1)
├─ feat-4: API endpoints (depends: feat-2, feat-3)
└─ feat-5: Tests (depends: feat-4)

// Execution order (topological sort)
1. feat-1 (parallel capable: yes)
2. feat-2, feat-3 (parallel capable: yes)
3. feat-4 (parallel capable: no)
4. feat-5 (parallel capable: no)
```

::: tip Parallélisation
Les features sans dépendances communes peuvent s'exécuter en parallèle.
:::

### Progress Tracking

Le progress est tracké en temps réel avec un log JSONL:

```jsonl
{"type":"mission_started","missionId":"m-123","timestamp":"2026-08-16T20:00:00Z"}
{"type":"feature_started","featureId":"feat-1","timestamp":"2026-08-16T20:00:05Z"}
{"type":"feature_completed","featureId":"feat-1","duration":120000,"timestamp":"2026-08-16T20:02:05Z"}
{"type":"feature_started","featureId":"feat-2","timestamp":"2026-08-16T20:02:06Z"}
{"type":"feature_started","featureId":"feat-3","timestamp":"2026-08-16T20:02:06Z"}
{"type":"feature_completed","featureId":"feat-2","duration":95000,"timestamp":"2026-08-16T20:03:41Z"}
{"type":"feature_completed","featureId":"feat-3","duration":187000,"timestamp":"2026-08-16T20:05:13Z"}
{"type":"feature_started","featureId":"feat-4","timestamp":"2026-08-16T20:05:14Z"}
```

## Pause & Resume

Les missions peuvent être pausées et reprises:

```typescript
// Pause une mission
mission.pause()
// State: running → paused
// Current feature: complété ou annulé
// Queue: sauvegardée

// Resume une mission
mission.resume()
// State: paused → running
// Queue: rechargée
// Execution: continue à partir de la feature suivante
```

::: warning
Les features en cours lors du pause sont annulées. Elles seront ré-exécutées au resume.
:::

## Handoff Protocol

Quand une feature est complétée, elle peut passer des résultats à la suivante:

```typescript
interface FeatureResult {
  featureId: string
  status: 'success' | 'failure'
  output: {
    filesModified: string[]
    filesCreated: string[]
    testsAdded: string[]
    notes: string
  }
  artifacts?: {
    [key: string]: any // Données custom pour features suivantes
  }
}

// Feature 1: JWT utils
{
  "featureId": "feat-1",
  "status": "success",
  "output": {
    "filesCreated": [
      "src/auth/jwt.ts",
      "src/auth/__tests__/jwt.test.ts"
    ]
  },
  "artifacts": {
    "jwtFunctions": ["generateToken", "verifyToken", "refreshToken"]
  }
}

// Feature 2 peut accéder aux artifacts de Feature 1
const jwtFunctions = getArtifact('feat-1', 'jwtFunctions')
```

## Rollback

Si une feature échoue, vous pouvez rollback:

```typescript
// Rollback une feature
mission.rollback('feat-4')

// Actions:
// 1. Revert files modified by feat-4
// 2. Mark feat-4 as 'pending'
// 3. Mark dependent features (feat-5) as 'pending'
// 4. State: completed → running
```

## Monitoring

### Panel Mission Progress

Le panel affiche en temps réel:

```
Mission: Refactor authentication system
State: running
Progress: 3/5 features (60%)

├─ [✓] feat-1: JWT utils (2m 5s) 
├─ [✓] feat-2: Middleware (1m 35s)
├─ [✓] feat-3: Database (3m 7s)
├─ [▶] feat-4: API endpoints (en cours, 1m 23s)
└─ [ ] feat-5: Tests

Estimated time remaining: ~4 minutes
Total cost so far: $0.43
```

### Logs détaillés

Accédez aux logs complets:

```bash
# Logs JSONL
~/.cortex/missions/m-123/progress.jsonl

# Logs de chaque feature
~/.cortex/missions/m-123/features/feat-1.log
~/.cortex/missions/m-123/features/feat-2.log
```

## Best Practices

### 1. Features atomiques

Chaque feature doit être indépendante et testable:

❌ **Mauvais:**
```json
{
  "title": "Implement auth and update frontend and add tests"
}
```

✅ **Bon:**
```json
[
  { "id": "1", "title": "Implement JWT auth backend" },
  { "id": "2", "title": "Update frontend to use JWT", "dependencies": ["1"] },
  { "id": "3", "title": "Add E2E auth tests", "dependencies": ["2"] }
]
```

### 2. Définir les dépendances explicitement

Ne vous fiez pas à l'ordre implicite:

❌ **Mauvais:**
```json
[
  { "id": "1", "title": "Create API" },
  { "id": "2", "title": "Create client" }
  // Implicite: 2 dépend de 1?
]
```

✅ **Bon:**
```json
[
  { "id": "1", "title": "Create API", "dependencies": [] },
  { "id": "2", "title": "Create client", "dependencies": ["1"] }
]
```

### 3. Utiliser les artifacts pour partager

Partagez des données entre features:

```typescript
// Feature 1: Analyse
{
  "artifacts": {
    "bottlenecks": ["db queries", "large components"]
  }
}

// Feature 2: Optimisation
// Peut accéder à artifacts.bottlenecks
```

## API

### Créer une mission programmatiquement

```typescript
import { MissionOrchestrator } from '@cortex/ai-engine'

const orchestrator = new MissionOrchestrator()

const mission = await orchestrator.createMission({
  title: 'My mission',
  features: [
    {
      id: 'feat-1',
      title: 'Feature 1',
      dependencies: [],
      description: 'First feature'
    },
    {
      id: 'feat-2',
      title: 'Feature 2',
      dependencies: ['feat-1'],
      description: 'Second feature'
    }
  ]
})

// Démarrer
await orchestrator.start(mission.id)

// Écouter les événements
orchestrator.on('feature_completed', (event) => {
  console.log(`Feature ${event.featureId} completed`)
})

// Pause
await orchestrator.pause(mission.id)

// Resume
await orchestrator.resume(mission.id)
```

## Prochaines étapes

- [Benchmarking →](/guide/features/benchmarking)
- [Context Optimization →](/guide/features/context-optimization)
- [API Reference →](/api/)
