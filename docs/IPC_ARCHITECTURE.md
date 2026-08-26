# IPC Foundation - Architecture

## Vue d'ensemble

L'architecture IPC de Cortex IDE suit un pattern **type-safe** avec validation Zod et gestion d'erreurs unifiée.

```
┌─────────────────────────────────────────────────────────────┐
│                      Renderer Process                        │
│  ┌────────────────────────────────────────────────────┐     │
│  │  packages/app/src/state/host.ts                      │     │
│  │  - Typed host façade over window.cortex           │     │
│  │  - Error unwrapping                                │     │
│  │  - Type-safe helpers                               │     │
│  └────────────────────┬───────────────────────────────┘     │
│                       │                                      │
│                       │ window.cortex.* calls                │
│                       │                                      │
└───────────────────────┼──────────────────────────────────────┘
                        │
┌───────────────────────┼──────────────────────────────────────┐
│                       │   Context Bridge                     │
│  ┌────────────────────▼───────────────────────────────┐     │
│  │  packages/preload/src/index.ts                     │     │
│  │  - Exposes cortex API via contextBridge            │     │
│  │  - Type-safe IPC wrappers                          │     │
│  │  - Event listeners                                 │     │
│  └────────────────────┬───────────────────────────────┘     │
│                       │                                      │
│                       │ ipcRenderer.invoke()                 │
│                       │                                      │
└───────────────────────┼──────────────────────────────────────┘
                        │
┌───────────────────────┼──────────────────────────────────────┐
│                       │   Main Process                       │
│  ┌────────────────────▼───────────────────────────────┐     │
│  │  packages/main/src/ipc/handlers.ts                 │     │
│  │  - Central IPC handlers                            │     │
│  │  - Zod schema validation                           │     │
│  │  - Unified error handling                          │     │
│  │  - createHandler() wrapper                         │     │
│  └────────────────────┬───────────────────────────────┘     │
│                       │                                      │
│                       │ calls services                       │
│                       │                                      │
│  ┌────────────────────▼───────────────────────────────┐     │
│  │  Services Layer (to be implemented)                │     │
│  │  - Filesystem operations                           │     │
│  │  - Git integration (simple-git)                    │     │
│  │  - AI engine                                       │     │
│  │  - Terminal (node-pty)                             │     │
│  │  - Database (better-sqlite3)                       │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              Shared Types & Schemas                          │
│  packages/shared/                                            │
│  ├── types/ipc.ts       - TypeScript types                   │
│  └── schemas/           - Zod validation schemas             │
│      ├── filesystem.ts                                       │
│      ├── editor.ts                                           │
│      ├── git.ts                                              │
│      ├── ai.ts                                               │
│      ├── terminal.ts                                         │
│      ├── database.ts                                         │
│      └── workspace.ts                                        │
└─────────────────────────────────────────────────────────────┘
```

## Channels implémentés

### Filesystem
- `fs:read-file` - Lire un fichier
- `fs:write-file` - Écrire un fichier
- `fs:read-dir` - Lire un répertoire
- `fs:watch` - Surveiller les changements
- `fs:unwatch` - Arrêter la surveillance

### Editor
- `editor:open-file` - Ouvrir un fichier dans l'éditeur
- `editor:save-file` - Sauvegarder un fichier
- `editor:format` - Formater un document

### Git (stubs)
- `git:status` - Statut du repo
- `git:commit` - Créer un commit
- `git:push` - Pousser vers remote
- `git:diff` - Obtenir les diffs

### AI (stubs)
- `ai:create-session` - Créer une session IA
- `ai:send-message` - Envoyer un message
- `ai:stream-response` - Streaming de réponse
- `ai:stop-stream` - Arrêter le streaming

### Terminal (stubs)
- `terminal:create` - Créer un terminal
- `terminal:input` - Envoyer input
- `terminal:resize` - Redimensionner
- `terminal:kill` - Tuer le terminal

### Database (stubs)
- `db:query` - Exécuter une requête SELECT
- `db:execute` - Exécuter INSERT/UPDATE/DELETE

## Pattern de validation

Tous les handlers utilisent le pattern `createHandler()` :

```typescript
const handler = createHandler<RequestType, ResponseType>(
  ZodSchema,
  async (request, event) => {
    // Logic here
    return response;
  }
);
```

Avantages :
- ✅ Validation automatique avec Zod
- ✅ Gestion d'erreurs unifiée
- ✅ Type-safety garantie
- ✅ Code DRY

## Error codes

```typescript
enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_PATH = 'INVALID_PATH',
  GIT_ERROR = 'GIT_ERROR',
  AI_ERROR = 'AI_ERROR',
  TERMINAL_ERROR = 'TERMINAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}
```

## Response format

Toutes les réponses suivent le format :

```typescript
type IPCResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } };
```

## Usage dans le renderer

```typescript
import { ipc } from './lib/api';

// Automatic error handling
const result = await ipc.filesystem.readFile('/path/to/file');
console.log(result.content);

// Error is thrown as IPCError with code and message
try {
  await ipc.editor.saveFile('/protected/file', 'content');
} catch (error) {
  if (error instanceof IPCError) {
    console.error(error.code, error.message);
  }
}
```

## Prochaines étapes

Les handlers marqués "stub" doivent être implémentés avec les services appropriés :

1. **Git** : Intégrer `simple-git`
2. **AI** : Connecter `packages/ai-engine`
3. **Terminal** : Intégrer `node-pty` + `xterm.js`
4. **Database** : Connecter la couche database existante
5. **File watching** : Implémenter avec `chokidar`
6. **Streaming AI** : WebSocket ou autre mécanisme temps réel
