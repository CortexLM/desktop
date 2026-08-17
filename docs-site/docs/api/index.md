# API Reference

Documentation complète de l'API Cortex IDE.

## Vue d'ensemble

Cortex expose plusieurs APIs:

1. **AI Engine API** - Interaction avec les agents IA
2. **IPC Channels** - Communication Electron main ↔ renderer
3. **Database Schema** - Structure SQLite
4. **Preload API** - Bridge sécurisé vers Node.js

## AI Engine API

### Provider Registry

```typescript
import { ProviderRegistry } from '@cortex/ai-engine'

// Initialize registry
const registry = new ProviderRegistry()

// Register providers
registry.register('openai', {
  apiKey: process.env.OPENAI_API_KEY,
  models: ['gpt-4.5-turbo', 'o1', 'o3-mini']
})

registry.register('anthropic', {
  apiKey: process.env.ANTHROPIC_API_KEY,
  models: ['claude-opus-4.8', 'claude-sonnet-4.8']
})

// Get provider
const provider = registry.get('openai')
```

### Agent Manager

```typescript
import { SimpleAgentManager } from '@cortex/ai-engine'

const manager = new SimpleAgentManager()

// Enqueue task
const taskId = await manager.enqueue({
  provider: 'anthropic',
  model: 'claude-opus-4.8',
  messages: [
    { role: 'user', content: 'Analyze this codebase' }
  ],
  tools: ['read_file', 'search_code']
})

// Listen to events
manager.on('task_started', (event) => {
  console.log(`Task ${event.taskId} started`)
})

manager.on('task_completed', (event) => {
  console.log(`Task ${event.taskId} completed`)
  console.log('Result:', event.result)
})

// Cancel task
await manager.cancel(taskId)
```

### Semantic Chunker

::: warning Corrigé le 17/08/2026
Cette section documentait une classe `SmartChunker` avec une méthode
`selectRelevantChunks(chunks, budget, query)`. **Ni la classe ni la méthode
n'existent** dans `packages/ai-engine`. Le seul chunker exporté est
`SemanticChunker`, et sa surface publique est un unique `chunk()`. Le nom de
package était également faux (`@cortex/ai-engine` → `@cortex-ide/ai-engine`) et
le sous-chemin `/context` n'est pas un export déclaré.
:::

```typescript
import { SemanticChunker } from '@cortex-ide/ai-engine'

const chunker = new SemanticChunker({ maxChunkSize: 500 })

// Découpe un fichier en chunks respectant les frontières syntaxiques
const chunks = await chunker.chunk(content, filePath, 'typescript')

console.log(`${chunks.length} chunks`)
```

Il n'y a **pas** de sélection par pertinence : aucun scoring TF-IDF ni sélection
greedy n'existe dans le code, malgré ce que plusieurs documents décrivent en
pseudo-code. `chunk()` découpe, il ne classe pas.

La qualité du découpage est mesurée par
`packages/ai-engine/src/context/__tests__/boundary-integrity.test.ts`, qui
compare `SemanticChunker` à un découpage naïf par lignes sur le code source du
package lui-même. Ce test verrouille un plancher de +30 % relatif ; il ne mesure
**pas** la qualité des réponses du modèle.

### Model Presets

```typescript
import { MODEL_PRESETS, getModelForPreset } from '@cortex-ide/ai-engine'

// Un preset n'est pas un couple { provider, model } : c'est un nom, une
// description, et un modèle PAR provider.
MODEL_PRESETS.fastest
// {
//   name: 'Fastest',
//   description: 'Réponses ultra-rapides avec bonne qualité',
//   models: {
//     openai: 'o3-mini',
//     anthropic: 'claude-sonnet-4.5',
//     openrouter: 'anthropic/claude-opus-4.8-fast',
//     grok: 'claude-opus-5:stable'
//   }
// }

// Résoudre un preset pour un provider donné
getModelForPreset('smartest', 'anthropic') // 'claude-opus-4.8'
getModelForPreset('cheapest', 'openai')    // 'gpt-4o-2024-11-20'
```

Presets disponibles : `fastest`, `smartest`, `cheapest`, `reasoning`. Les quatre
providers couverts sont `openai`, `anthropic`, `openrouter`, `grok` — **il n'y a
pas d'entrée `ollama`** dans les presets, contrairement à ce que la version
précédente de cette page indiquait pour `cheapest`. Source :
`packages/ai-engine/src/model-presets.ts`.

## IPC Channels

::: danger Réécrit le 17/08/2026 — la version précédente ne fonctionnait pas
Tous les exemples de cette section appelaient `window.electronAPI`. **Cet objet
n'existe pas** : `grep -rn electronAPI packages/*/src` ne renvoie rien. Le
preload expose trois globales — `window.cortex` (façade typée),
`window.ipc` (pont par canal) et `window.electron`.

Les canaux cités étaient également faux : `fs:read`, `fs:write`, `fs:list`,
`fs:change`, `ai:send`, `ai:stream`, `ai:cancel`, `ai:list-tasks`,
`workspace:open`, `workspace:info`, `workspace:close`, `db:sessions`,
`db:usage` — **aucun n'est enregistré côté main**. Les exemples ci-dessous sont
repris des signatures réelles de `packages/preload/src/index.ts`.
:::

Les appels `window.cortex.*` renvoient une enveloppe
`IPCResponse<T>` = `{ success: true, data: T }` ou
`{ success: false, error: string }`. Vérifiez `success` avant de lire `data`.

### File System

```typescript
// Lire un fichier
const res = await window.cortex.fs.readFile({ path: '/path/to/file.ts' })
if (res.success) console.log(res.data)

// Écrire un fichier
await window.cortex.fs.writeFile({ path: '/path/to/file.ts', content: 'content' })

// Lister un répertoire
const dir = await window.cortex.fs.readDir({ path: '/path/to/dir' })
```

`window.cortex.fs.watch()` / `.unwatch()` / `.onFileChange()` existent dans le
preload mais **`fs:watch`, `fs:unwatch` et `event:file-change` n'ont aucun
handler ni émetteur côté main** (vérifié le 17/08/2026). L'abonnement ne reçoit
jamais rien.

### AI Operations

```typescript
// Créer une session
const session = await window.cortex.ai.createSession({ provider: 'anthropic', model: 'claude-opus-4.8' })

// Envoyer un message
const reply = await window.cortex.ai.sendMessage({ sessionId, content: 'Hello' })

// Streamer une réponse : le callback reçoit chaque chunk
await window.cortex.ai.streamResponse({ sessionId, content: 'Hello' }, (chunk) => {
  console.log('Chunk:', chunk)
})

// Interrompre le stream en cours
await window.cortex.ai.stopStream(sessionId)
```

Il n'y a **pas** de file de tâches exposée : les anciens `ai:cancel` et
`ai:list-tasks` n'ont jamais existé. `stopStream` est le seul mécanisme
d'annulation.

### Workspace

```typescript
const list = await window.ipc.invoke('workspace:list')
await window.ipc.invoke('workspace:switch', { workspaceId })
await window.ipc.invoke('workspace:add', { path: '/path/to/project' })
await window.ipc.invoke('workspace:remove', { workspaceId })
const picked = await window.ipc.invoke('workspace:open-dialog')

// Changement de workspace actif (relayé par workspace-handlers.ts)
window.ipc.on('event:workspace-switched', ({ workspaceId }) => { /* ... */ })
```

Il n'existe pas de `workspace:info` ni de `workspace:close`.

### Database

```typescript
// Lecture — la clé est `query`, pas `sql`
const res = await window.cortex.db.query<{ id: string; model: string }>({
  query: 'SELECT id, model FROM sessions ORDER BY created_at DESC LIMIT ?',
  params: [10]
})
if (res.success) console.log(res.data.rows)

// Écriture — `execute` prend un tableau `statements` (transaction)
await window.cortex.db.execute({
  statements: [{ query: 'DELETE FROM sessions WHERE id = ?', params: [id] }]
})
```

Schémas de validation : `packages/shared/src/schemas/database.ts`
(`DBQueryRequestSchema`, `DBExecuteRequestSchema`).

Il n'y a que deux canaux base de données : `db:query` et `db:execute`. Les
agrégats `db:sessions` et `db:usage` documentés auparavant n'existent pas — une
statistique d'usage se calcule en SQL via `db:query`.

## Database Schema

### Tables

#### `sessions`

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  provider TEXT,
  model TEXT,
  created_at INTEGER,
  updated_at INTEGER
);
```

#### `messages`

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  role TEXT, -- 'user' | 'assistant' | 'system'
  content TEXT,
  tokens INTEGER,
  created_at INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

#### `usage_logs`

```sql
CREATE TABLE usage_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  provider TEXT,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd REAL,
  latency_ms INTEGER,
  created_at INTEGER
);
```

#### `workspaces`

```sql
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  path TEXT UNIQUE,
  name TEXT,
  created_at INTEGER
);
```

## Preload API

Le preload expose une API sécurisée au renderer:

```typescript
// Type definitions
interface ElectronAPI {
  // IPC
  invoke: (channel: string, ...args: any[]) => Promise<any>
  on: (channel: string, callback: Function) => void
  
  // Platform
  platform: 'darwin' | 'win32' | 'linux'
  
  // File operations
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
  listDir: (path: string) => Promise<string[]>
  
  // AI operations
  sendMessage: (config: MessageConfig) => Promise<Response>
  cancelTask: (taskId: string) => Promise<void>
  
  // Workspace
  openWorkspace: (path: string) => Promise<void>
  getWorkspaceInfo: () => Promise<WorkspaceInfo>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
```

## Types

### Chunk

```typescript
interface Chunk {
  id: string
  path: string
  tokens: number
  content: string
  imports?: string[]
  exports?: string[]
}
```

### AgentTask

```typescript
interface AgentTask {
  id: string
  provider: string
  model: string
  messages: Message[]
  tools?: string[]
  maxTokens?: number
  temperature?: number
  state: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
}
```

### Message

```typescript
interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls?: ToolCall[]
}
```

### ToolCall

```typescript
interface ToolCall {
  id: string
  name: string
  arguments: Record<string, any>
  result?: any
}
```

## Error Handling

Toutes les méthodes API peuvent lever des erreurs typées:

```typescript
import { CortexError } from '@cortex/shared'

try {
  await window.electronAPI.invoke('ai:send', config)
} catch (error) {
  if (error instanceof CortexError) {
    console.error('Error code:', error.code)
    console.error('Error message:', error.message)
    console.error('Error context:', error.context)
  }
}
```

### Error Codes

```typescript
enum ErrorCode {
  // AI Engine
  PROVIDER_NOT_FOUND = 'PROVIDER_NOT_FOUND',
  MODEL_NOT_SUPPORTED = 'MODEL_NOT_SUPPORTED',
  CONTEXT_TOO_LARGE = 'CONTEXT_TOO_LARGE',
  API_KEY_MISSING = 'API_KEY_MISSING',
  
  // File System
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  
  // Workspace
  WORKSPACE_NOT_OPEN = 'WORKSPACE_NOT_OPEN',
  INVALID_WORKSPACE = 'INVALID_WORKSPACE',
  
  // Generic
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}
```

## Prochaines étapes

- [Architecture →](/architecture/)
- [Contributing Guide →](/developer/contributing)

<!-- Liens retirés le 17/08/2026 : `/developer/advanced/ipc` et
     `/developer/packages/ai-engine` n'existent pas. Ces deux pages sont
     déclarées dans la barre latérale de `.vitepress/config.ts` mais aucun
     fichier ne leur correspond. -->

