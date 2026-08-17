# 🔍 Cortex IDE - Opportunités d'amélioration

**Date d'analyse:** 16 août 2026  
**Portée:** Analyse complète du codebase (286 fichiers TypeScript, ~24,500 lignes)  
**Niveau de criticité:** 🔴 Critique | 🟡 Important | 🟢 Amélioration

---

## 📊 Executive Summary

### Métriques de qualité
- **Duplication de code:** 2.92% (715 lignes dupliquées / 40 clones détectés)
- **Couverture des tests:** ~22 fichiers de tests pour 286 fichiers source (~7.7%)
- **TODOs trouvés:** 5 TODOs critiques dans le code de production
- **Fichiers les plus longs:** 860 lignes (handlers.ts), 678 lignes (api.ts), 644 lignes (mcp-service.ts)

### Priorités immédiates
1. 🔴 **Éliminer la duplication massive dans les providers AI** (199+ tokens dupliqués)
2. 🔴 **Refactoriser les fichiers >500 lignes** (violation des principes SOLID)
3. 🟡 **Améliorer la couverture de tests** (actuellement ~8%)
4. 🟡 **Résoudre les TODOs dans le code de production**
5. 🟢 **Optimiser les performances** (async/await patterns, memory leaks)

---

## 🔴 CRITIQUES - À corriger immédiatement

### 1. Duplication massive dans les AI Providers

**Impact:** Maintenabilité critique, bugs potentiels, violation DRY

#### 1.1 GrokProvider vs OpenRouterProvider (176+ tokens dupliqués)
**Fichiers:** 
- `packages/ai-engine/src/providers/grok-provider.ts`
- `packages/ai-engine/src/providers/openrouter-provider.ts`

**Duplication identifiée:**
```typescript
// DUPLICATION: Stream parsing logic (L141-L175)
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') {
        yield { content: '', done: true };
        return;
      }
      // ... parsing logic
    }
  }
}
```

**Solution recommandée:**
```typescript
// Créer une classe abstraite commune
abstract class OpenAICompatibleProvider extends AIProvider {
  protected async *streamSSE(response: Response): AsyncIterableIterator<StreamChunk> {
    if (!response.body) throw new Error('Response body is null');
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      yield* this.parseSSEBuffer(buffer);
    }
  }

  protected abstract parseChunk(data: any): StreamChunk;
}

// GrokProvider et OpenRouterProvider héritent
class GrokProvider extends OpenAICompatibleProvider {
  protected parseChunk(data: GrokStreamChunk): StreamChunk {
    const delta = data.choices[0]?.delta;
    return {
      content: delta?.content || '',
      done: data.choices[0]?.finish_reason !== null
    };
  }
}
```

**Gains:**
- 🎯 Réduction de ~150 lignes de code dupliqué
- 🐛 Bugs fixes centralisés (un seul endroit à corriger)
- ✅ Tests partagés

#### 1.2 Anthropic vs OpenAI Provider (518 tokens dupliqués)
**Localisation:** `test-harness/src/providers/anthropic.ts` vs `openai.ts`

**Duplication:** Toute la structure chat/stream/calculateCost

**Solution:**
```typescript
// Créer un BaseTestProvider
abstract class BaseTestProvider {
  protected withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), this.timeout)
      )
    ]);
  }

  protected async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError;
    for (let i = 0; i < this.maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        await this.delay(this.retryDelay * Math.pow(2, i));
      }
    }
    throw lastError;
  }
}
```

#### 1.3 Semantic Chunker - Triple duplication (61+ tokens × 3)
**Fichier:** `packages/ai-engine/src/context/chunking/semantic-chunker.ts`

**Problème:** Les méthodes `chunkTypeScript`, `chunkJavaScript`, et `chunkPython` partagent 90% du code

**Solution:**
```typescript
class SemanticChunker {
  private chunkByLanguage(
    content: string,
    filePath: string,
    patterns: LanguagePatterns
  ): ContextChunk[] {
    const chunks: ContextChunk[] = [];
    const lines = content.split('\n');
    let currentChunk: string[] = [];
    let currentStartLine = 0;
    let inBlock = false;
    let blockInfo = this.detectBlock(lines, patterns);
    
    // Logique de chunking unifiée
    // ...
  }

  chunkTypeScript(content: string, filePath: string) {
    return this.chunkByLanguage(content, filePath, TYPESCRIPT_PATTERNS);
  }

  chunkJavaScript(content: string, filePath: string) {
    return this.chunkByLanguage(content, filePath, JAVASCRIPT_PATTERNS);
  }
}
```

**Gains:** Réduction de ~300 lignes

---

### 2. Fichiers monolithiques (Violation du Single Responsibility Principle)

#### 2.1 handlers.ts (860 lignes) - God Object Anti-Pattern

**Problème:** Un seul fichier gère 15+ domaines différents:
- File system operations
- Git operations
- AI sessions
- Terminal management
- Database queries
- MCP operations
- Workspace management
- Automations

**Complexité cyclomatique estimée:** >50 (seuil recommandé: 10)

**Solution - Architecture en modules:**
```
packages/main/src/ipc/handlers/
├── index.ts                    # Orchestrateur central
├── filesystem-handlers.ts      # readFile, writeFile, readDir
├── git-handlers.ts             # gitStatus, gitCommit, gitPush, gitPull
├── ai-handlers.ts              # createSession, sendMessage, streamMessage
├── terminal-handlers.ts        # createTerminal, terminalInput, terminalResize
├── database-handlers.ts        # dbQuery, dbExecute
├── mcp-handlers.ts             # listMCPServers, invokeMCPTool, etc.
├── workspace-handlers.ts       # workspace CRUD
└── automation-handlers.ts      # automation CRUD, runAutomation
```

**Exemple de refactoring:**
```typescript
// filesystem-handlers.ts
export function registerFilesystemHandlers() {
  ipcMain.handle(IPC_CHANNELS.READ_FILE, handleReadFile);
  ipcMain.handle(IPC_CHANNELS.WRITE_FILE, handleWriteFile);
  ipcMain.handle(IPC_CHANNELS.READ_DIR, handleReadDir);
}

async function handleReadFile(
  event: IpcMainInvokeEvent, 
  request: ReadFileRequest
): Promise<IPCResponse<ReadFileResponse>> {
  try {
    const validated = ReadFileRequestSchema.parse(request);
    const content = await fs.readFile(validated.path, 'utf-8');
    return success({ content });
  } catch (error) {
    return failure('READ_FILE_ERROR', getErrorMessage(error));
  }
}

// index.ts
import { registerFilesystemHandlers } from './filesystem-handlers';
import { registerGitHandlers } from './git-handlers';
// ...

export function registerAllHandlers() {
  registerFilesystemHandlers();
  registerGitHandlers();
  // ...
}
```

**Gains:**
- ✅ Chaque module <150 lignes
- 🧪 Tests unitaires isolés par domaine
- 🔧 Maintenance simplifiée
- 📦 Tree-shaking possible

#### 2.2 api.ts (678 lignes) - Mirror du problème précédent

**Même problème côté renderer:** Un seul fichier API client pour tous les domaines

**Solution:** Appliquer le même découpage
```typescript
// renderer/src/lib/api/
├── index.ts
├── filesystem.ts
├── git.ts
├── ai.ts
├── terminal.ts
├── database.ts
├── mcp.ts
├── workspace.ts
└── automation.ts

// Usage
import { filesystemAPI } from '@/lib/api/filesystem';
import { gitAPI } from '@/lib/api/git';

const content = await filesystemAPI.readFile({ path: '/foo/bar' });
const status = await gitAPI.getStatus({ repoPath: '/repo' });
```

#### 2.3 mcp-service.ts (644 lignes)

**Problème:** Gère trop de responsabilités:
- Server lifecycle management
- Tool discovery & invocation
- Permission system
- Error handling
- Event emission

**Solution - Découpage en services:**
```typescript
packages/main/src/services/mcp/
├── mcp-service.ts              # Orchestrateur principal (100 lignes)
├── server-manager.ts           # install, start, stop, restart
├── tool-manager.ts             # discoverTools, invokeTool
├── permission-manager.ts       # grant, revoke, check
└── mcp-types.ts                # Types partagés
```

---

### 3. TODOs critiques non résolus

#### 3.1 handlers.ts - Fonctionnalités manquantes
```typescript
// Line 395
// TODO: Implémenter le formatage avec prettier ou autre
async function handleFormatDocument() {
  // Actuellement vide - CRITIQUE pour un IDE
}

// Lines 504, 512
// TODO: Implémenter avec better-sqlite3
async function handleDBQuery() {
  // Pas d'implémentation réelle
}
```

**Impact:** Fonctionnalités annoncées mais non fonctionnelles

**Solution:**
```typescript
// Formatter implementation
import { format } from 'prettier';

async function handleFormatDocument(
  event: IpcMainInvokeEvent,
  request: FormatDocumentRequest
): Promise<IPCResponse<FormatDocumentResponse>> {
  try {
    const validated = FormatDocumentRequestSchema.parse(request);
    
    // Detect language from file extension
    const parser = getParserFromExtension(validated.path);
    
    const formatted = await format(validated.content, {
      parser,
      singleQuote: true,
      trailingComma: 'es5',
      tabWidth: 2,
    });
    
    return success({ formatted });
  } catch (error) {
    return failure('FORMAT_ERROR', getErrorMessage(error));
  }
}
```

#### 3.2 automation-service.ts - Memory leak
```typescript
// Line 510
// TODO: Implémenter cleanup session
private async executeAITaskAction(action: AITaskAction) {
  const session = await aiService.createSession(action.provider, action.model);
  
  try {
    const response = await aiService.sendMessage(session.id, fullPrompt);
    return response.content;
  } finally {
    // TODO: Implémenter cleanup session
    // ⚠️ SESSION JAMAIS SUPPRIMÉE = MEMORY LEAK
  }
}
```

**Solution:**
```typescript
try {
  // ...
} finally {
  aiService.deleteSession(session.id);
}
```

---

### 4. Architecture - Responsabilités mal définies

#### 4.1 DatabaseManager - Classe Dieu (622 lignes)

**Problème:** Une seule classe pour 6 entités différentes:
- Workspaces
- Sessions
- Messages
- Missions
- Usage logs
- Automations

**Solution - Repository Pattern:**
```typescript
packages/main/src/database/
├── index.ts                    # DatabaseManager (orchestrateur)
├── repositories/
│   ├── workspace-repository.ts
│   ├── session-repository.ts
│   ├── message-repository.ts
│   ├── mission-repository.ts
│   ├── usage-repository.ts
│   └── automation-repository.ts
└── migrations/
    └── ...

// Exemple
class WorkspaceRepository {
  constructor(private db: DatabaseAdapter) {}

  create(data: Omit<Workspace, 'id' | 'created_at' | 'updated_at'>): Workspace {
    const now = Date.now();
    const workspace: Workspace = {
      id: randomUUID(),
      ...data,
      created_at: now,
      updated_at: now,
    };

    this.db.prepare(`
      INSERT INTO workspaces (id, name, path, created_at, updated_at, settings)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      workspace.id,
      workspace.name,
      workspace.path,
      workspace.created_at,
      workspace.updated_at,
      JSON.stringify(workspace.settings)
    );

    return workspace;
  }

  findById(id: string): Workspace | undefined { /* ... */ }
  update(id: string, data: Partial<Workspace>): void { /* ... */ }
  delete(id: string): void { /* ... */ }
  list(): Workspace[] { /* ... */ }
}

// DatabaseManager devient
class DatabaseManager {
  workspaces: WorkspaceRepository;
  sessions: SessionRepository;
  messages: MessageRepository;
  // ...

  constructor(db: DatabaseAdapter) {
    this.workspaces = new WorkspaceRepository(db);
    this.sessions = new SessionRepository(db);
    // ...
  }
}

// Usage
const db = await DatabaseManager.create(dbPath);
const workspace = db.workspaces.create({ name: 'My Project', path: '/path' });
```

---

## 🟡 IMPORTANTS - À planifier

### 5. Tests - Coverage insuffisant

**Situation actuelle:**
- 22 fichiers de tests pour 286 fichiers source = **7.7% de coverage**
- Fichiers critiques sans tests:
  - ❌ `automation-service.ts` (591 lignes) - 0 tests
  - ❌ `mcp-service.ts` (644 lignes) - 0 tests
  - ❌ `database/index.ts` (622 lignes) - 0 tests
  - ❌ `ipc/handlers.ts` (860 lignes) - 0 tests

**Objectif:** Atteindre 60% de coverage minimum

#### 5.1 Tests manquants prioritaires

**AutomationService:**
```typescript
// automation-service.test.ts
describe('AutomationService', () => {
  let service: AutomationService;
  
  beforeEach(() => {
    service = new AutomationService();
  });

  describe('File Watcher Trigger', () => {
    it('should trigger automation on file change', async () => {
      const automation = await service.createAutomation({
        workspaceId: 'ws1',
        name: 'Auto format',
        enabled: true,
        trigger: {
          type: 'file_watch',
          patterns: ['**/*.ts'],
          events: ['change'],
          workspacePath: '/test/workspace'
        },
        actions: [/* ... */]
      });

      // Mock file change
      const spy = jest.spyOn(service, 'executeAutomation');
      // Trigger file change event
      // ...
      
      expect(spy).toHaveBeenCalled();
    });

    it('should not trigger when automation is disabled', async () => {
      // ...
    });
  });

  describe('Schedule Trigger', () => {
    it('should execute automation at scheduled time', async () => {
      // Mock cron
      jest.useFakeTimers();
      // ...
    });
  });

  describe('Error Handling', () => {
    it('should log error and continue on action failure', async () => {
      // ...
    });

    it('should prevent concurrent executions', async () => {
      // ...
    });
  });
});
```

**MCPService:**
```typescript
describe('MCPService', () => {
  describe('Server Lifecycle', () => {
    it('should start server successfully', async () => {});
    it('should handle server crash and restart', async () => {});
    it('should cleanup on service shutdown', async () => {});
  });

  describe('Tool Invocation', () => {
    it('should invoke tool with correct arguments', async () => {});
    it('should handle permission denied', async () => {});
    it('should timeout on long-running tools', async () => {});
  });
});
```

#### 5.2 Tests E2E manquants

**Fichier actuel:** `tests/e2e/specs/ai-chat.spec.ts` - seulement 148 lignes

**Tests manquants critiques:**
- ❌ Automations E2E
- ❌ MCP tools integration
- ❌ Multi-provider switching
- ❌ Context window management
- ❌ Session persistence

**Exemple à ajouter:**
```typescript
// tests/e2e/specs/automation.spec.ts
test.describe('Automation E2E', () => {
  test('should create and execute file watch automation', async ({ page }) => {
    // 1. Create automation
    await page.click('[data-testid="automations-tab"]');
    await page.click('[data-testid="new-automation"]');
    
    // 2. Configure trigger
    await page.selectOption('[data-testid="trigger-type"]', 'file_watch');
    await page.fill('[data-testid="pattern"]', '**/*.ts');
    
    // 3. Add action
    await page.selectOption('[data-testid="action-type"]', 'run_script');
    await page.fill('[data-testid="script"]', 'echo "File changed"');
    
    // 4. Save
    await page.click('[data-testid="save-automation"]');
    
    // 5. Trigger by changing file
    await page.click('[data-testid="editor-tab"]');
    await page.fill('[data-testid="editor"]', 'const x = 1;');
    await page.click('[data-testid="save-file"]');
    
    // 6. Verify execution
    await page.waitForSelector('[data-testid="automation-log"]');
    const log = await page.textContent('[data-testid="automation-log"]');
    expect(log).toContain('File changed');
  });
});
```

---

### 6. Performance - Opportunités d'optimisation

#### 6.1 AI Service - Streaming inefficient

**Problème:** `ai-service.ts` accumule toute la réponse avant de l'ajouter
```typescript
// Line 370-390
let fullResponse = '';

for await (const chunk of provider.stream(session.messages, options)) {
  fullResponse += chunk.content;  // ⚠️ String concatenation in loop
  
  this.emit('stream:chunk', { sessionId, chunk });
  yield chunk;
}

// Ajoute toute la réponse à la fin
session.messages.push({
  role: 'assistant',
  content: fullResponse,
});
```

**Problème:** String concatenation dans une boucle = O(n²)

**Solution:**
```typescript
const chunks: string[] = [];

for await (const chunk of provider.stream(session.messages, options)) {
  chunks.push(chunk.content);  // ✅ Array push = O(1)
  
  this.emit('stream:chunk', { sessionId, chunk });
  yield chunk;
}

session.messages.push({
  role: 'assistant',
  content: chunks.join(''),  // ✅ Join à la fin = O(n)
});
```

#### 6.2 Database - N+1 queries

**Problème:** `database/index.ts` charge les relations une par une
```typescript
// Line ~200
listSessions(workspaceId?: string): Session[] {
  const sessions = /* SELECT * FROM sessions */;
  
  // ⚠️ N+1 query problem
  return sessions.map(session => ({
    ...session,
    messages: this.getSessionMessages(session.id),  // Query par session
    mission: session.missionId ? this.getMission(session.missionId) : undefined
  }));
}
```

**Solution:**
```typescript
listSessions(workspaceId?: string): Session[] {
  // Single query with JOIN
  const rows = this.db.prepare(`
    SELECT 
      s.*,
      m.id as message_id,
      m.role as message_role,
      m.content as message_content,
      mission.id as mission_id,
      mission.title as mission_title
    FROM sessions s
    LEFT JOIN messages m ON m.session_id = s.id
    LEFT JOIN missions mission ON mission.id = s.mission_id
    WHERE ${workspaceId ? 's.workspace_id = ?' : '1=1'}
    ORDER BY s.created_at DESC, m.created_at ASC
  `).all(workspaceId ? [workspaceId] : []);

  // Group results
  return this.groupSessionsWithMessages(rows);
}
```

#### 6.3 File Watcher - Pas de debouncing

**Problème:** `automation-service.ts` L305-318
```typescript
trigger.events.forEach(event => {
  watcher.on(event, async (path: string) => {
    console.log(`[Automation] File ${event}: ${path}`);
    
    // ⚠️ Execute immediately on every change
    await this.executeAutomation(automation, { event, path });
  });
});
```

**Problème:** Sur un `git checkout`, des centaines de fichiers changent → des centaines d'exécutions

**Solution:**
```typescript
import debounce from 'lodash.debounce';

const debouncedExecute = debounce(
  async (event: string, path: string) => {
    await this.executeAutomation(automation, { event, path });
  },
  1000,  // Wait 1s after last change
  { leading: false, trailing: true }
);

trigger.events.forEach(event => {
  watcher.on(event, (path: string) => {
    debouncedExecute(event, path);
  });
});
```

---

### 7. Error Handling - Inconsistances

#### 7.1 Providers - Erreurs avalées silencieusement

**Problème:** Tous les providers AI ont ce pattern:
```typescript
// grok-provider.ts L114-116
async chat(...): Promise<ChatResponse> {
  try {
    // ...
  } catch (error) {
    this.handleError(error, 'chat failed');
    // ⚠️ Ne throw pas, ne retourne rien
    // TypeScript devrait détecter ça mais ne le fait pas à cause du type
  }
}
```

**Solution:**
```typescript
async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
  try {
    const response = await this.fetchWithRetry(/* ... */);
    // ...
    return result;
  } catch (error) {
    this.handleError(error, 'chat failed');
    throw error;  // ✅ Re-throw after logging
  }
}

// Ou mieux, utiliser un decorator
class GrokProvider extends AIProvider {
  @withErrorHandling('chat')
  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    // Logique métier sans try/catch
    // Le decorator gère logging + re-throw
  }
}
```

#### 7.2 IPC Handlers - Validation inconsistante

**Problème:** Certains handlers valident, d'autres non
```typescript
// handlers.ts

// ✅ Avec validation Zod
async function handleReadFile(event, request) {
  const validated = ReadFileRequestSchema.parse(request);
  // ...
}

// ❌ Sans validation
async function handleFormatDocument(event, request) {
  // Utilise directement request.path sans validation
  const content = await format(request.content);
}
```

**Solution:** Wrapper générique
```typescript
function createHandler<TRequest, TResponse>(
  schema: z.ZodSchema<TRequest>,
  handler: (validated: TRequest) => Promise<TResponse>
): IpcHandler<TRequest, TResponse> {
  return async (event, request) => {
    try {
      const validated = schema.parse(request);
      const result = await handler(validated);
      return success(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return failure('VALIDATION_ERROR', error.message, error.issues);
      }
      return failure('HANDLER_ERROR', getErrorMessage(error));
    }
  };
}

// Usage
ipcMain.handle(
  IPC_CHANNELS.READ_FILE,
  createHandler(ReadFileRequestSchema, async (validated) => {
    const content = await fs.readFile(validated.path, 'utf-8');
    return { content };
  })
);
```

---

### 8. Type Safety - Any types et assertions

**Recherche dans le code:** >100 occurrences de `any`

**Exemples problématiques:**

```typescript
// ai-service.ts L89
private mcpService: any;  // ⚠️ Should be MCPService

// automation-service.ts L358
const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
// ⚠️ substr deprecated, use substring

// handlers.ts - Multiple
const error: any = await response.json().catch(() => ({ error: response.statusText }));
```

**Solution:**
```typescript
// ai-service.ts
import type { MCPService } from './mcp-service';

export class AIService extends EventEmitter {
  private mcpService?: MCPService;

  setMCPService(mcpService: MCPService): void {
    this.mcpService = mcpService;
  }
}

// Créer un type d'erreur structuré
interface APIError {
  error?: {
    message: string;
    type?: string;
    code?: string;
  };
}

const error = await response.json().catch(
  (): APIError => ({ error: { message: response.statusText } })
);
```

---

## 🟢 AMÉLIORATIONS - Nice to have

### 9. Documentation

#### 9.1 Exemples d'utilisation manquants

**Fichiers sans JSDoc:**
- `automation-service.ts` - API publique non documentée
- `mcp-service.ts` - Pas d'exemples d'utilisation
- Provider classes - Manque exemples concrets

**Recommandation:**
```typescript
/**
 * Service d'automatisation pour Cortex IDE
 * 
 * Permet de créer des automatisations déclenchées par:
 * - Changements de fichiers (file watcher)
 * - Événements Git (hooks)
 * - Planification (cron)
 * - Exécution manuelle
 * 
 * @example
 * ```typescript
 * const service = new AutomationService();
 * 
 * // Créer une automation de formatting automatique
 * const automation = await service.createAutomation({
 *   workspaceId: 'ws-123',
 *   name: 'Auto-format TypeScript',
 *   enabled: true,
 *   trigger: {
 *     type: 'file_watch',
 *     patterns: ['**\/*.ts'],
 *     events: ['change'],
 *     workspacePath: '/path/to/project'
 *   },
 *   actions: [{
 *     type: 'run_script',
 *     script: 'prettier --write ${file}'
 *   }]
 * });
 * 
 * // Exécuter manuellement
 * const log = await service.runAutomation(automation.id);
 * console.log('Status:', log.status);
 * ```
 */
export class AutomationService extends EventEmitter {
  // ...
}
```

#### 9.2 README manquants

**Packages sans README:**
- `packages/ai-engine/` - Pas de guide d'utilisation
- `packages/shared/` - Types non documentés
- `packages/preload/` - API Cortex non expliquée

**À créer:**
```markdown
# @cortex-ide/ai-engine

Moteur d'orchestration multi-providers pour les LLMs.

## Installation

\`\`\`bash
npm install @cortex-ide/ai-engine
\`\`\`

## Quick Start

\`\`\`typescript
import { AIProviderRegistry } from '@cortex-ide/ai-engine';

const registry = new AIProviderRegistry();
const provider = registry.getProvider('anthropic');

const response = await provider.chat([
  { role: 'user', content: 'Hello!' }
]);
\`\`\`

## Providers disponibles

- ✅ Anthropic (Claude)
- ✅ OpenAI (GPT)
- ✅ OpenRouter (multi-models)
- ✅ Grok (xAI)
- ✅ Ollama (local)

## Configuration

...
```

---

### 10. Architecture moderne - Opportunités

#### 10.1 Dependency Injection

**Problème actuel:** Singletons et couplage fort
```typescript
// ai-service.ts
import { getAIService } from './ai-service';  // Singleton global

const aiService = getAIService();  // ⚠️ Hard to mock in tests
```

**Solution moderne:**
```typescript
// Use Dependency Injection
import { inject, injectable } from 'tsyringe';

@injectable()
class AutomationService {
  constructor(
    @inject('AIService') private aiService: AIService,
    @inject('GitService') private gitService: GitService
  ) {}
}

// Setup (main.ts)
container.registerSingleton('AIService', AIService);
container.registerSingleton('GitService', GitService);
container.registerSingleton('AutomationService', AutomationService);

// Usage
const automation = container.resolve(AutomationService);

// Tests
const mockAI = new MockAIService();
container.registerInstance('AIService', mockAI);
```

#### 10.2 Event-Driven Architecture

**Opportunité:** Découpler les services via events

**Exemple actuel (couplé):**
```typescript
// automation-service.ts
class AutomationService {
  private async executeAITaskAction(action: AITaskAction) {
    const aiService = getAIService();  // ⚠️ Couplage direct
    const session = await aiService.createSession();
    // ...
  }
}
```

**Solution event-driven:**
```typescript
// Définir les events
interface AutomationEvents {
  'automation:triggered': { automationId: string; trigger: Trigger };
  'automation:completed': { automationId: string; result: any };
}

// Automation Service émet
class AutomationService extends TypedEventEmitter<AutomationEvents> {
  private async executeAutomation(automation: Automation) {
    this.emit('automation:triggered', { 
      automationId: automation.id, 
      trigger: automation.trigger 
    });
    
    const result = await this.runActions(automation.actions);
    
    this.emit('automation:completed', { 
      automationId: automation.id, 
      result 
    });
  }
}

// AI Service écoute
aiService.on('automation:triggered', async ({ automationId }) => {
  // React to automation
});
```

#### 10.3 Plugin Architecture pour Providers

**Vision:** Providers chargés dynamiquement

```typescript
interface ProviderPlugin {
  id: string;
  name: string;
  load(): Promise<AIProvider>;
  unload(): Promise<void>;
}

class PluginRegistry {
  private plugins = new Map<string, ProviderPlugin>();

  async registerPlugin(plugin: ProviderPlugin) {
    this.plugins.set(plugin.id, plugin);
  }

  async loadProvider(id: string): Promise<AIProvider> {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new Error(`Plugin ${id} not found`);
    return await plugin.load();
  }
}

// Usage
const registry = new PluginRegistry();

// Builtin plugins
await registry.registerPlugin(new AnthropicPlugin());
await registry.registerPlugin(new OpenAIPlugin());

// User-installed plugins
await registry.registerPlugin(
  await import('@cortex-ide/plugin-custom-llm')
);
```

---

### 11. Bundle size & Performance

#### 11.1 Code splitting opportunités

**Analyse actuelle:** Tout est bundlé ensemble

**Recommandations:**
```typescript
// Dynamic imports pour les gros modules
class AIService {
  async enableMCPForSession(sessionId: string) {
    if (!this.mcpService) {
      // ✅ Lazy load MCP only when needed
      const { MCPService } = await import('./mcp-service');
      this.mcpService = new MCPService();
    }
    // ...
  }
}

// Renderer - code splitting par route
const routes = [
  {
    path: '/editor',
    component: () => import('./views/editor/EditorView')
  },
  {
    path: '/automations',
    component: () => import('./views/automations/AutomationsView')
  }
];
```

#### 11.2 Memoization manquante

**Opportunité:** Calculs répétés
```typescript
// tokens/token-counter.ts
class TokenCounter {
  // ⚠️ Re-calcule à chaque fois
  count(text: string, model: string): number {
    const encoding = this.getEncoding(model);  // Expensive
    return encoding.encode(text).length;
  }
}

// ✅ Avec cache
import memoize from 'lodash.memoize';

class TokenCounter {
  private getEncoding = memoize((model: string) => {
    // Compute once per model
    return encodingForModel(model);
  });

  count(text: string, model: string): number {
    const encoding = this.getEncoding(model);
    return encoding.encode(text).length;
  }
}
```

---

## 📋 Plan d'action priorisé

### Sprint 1 (1 semaine) - Quick Wins
1. ✅ Corriger memory leak dans `automation-service.ts` (2h)
2. ✅ Implémenter formatDocument handler (4h)
3. ✅ Refactorer stream parsing en classe commune (8h)
4. ✅ Ajouter tests pour AutomationService (8h)

### Sprint 2 (2 semaines) - Refactoring majeur
1. ✅ Découper handlers.ts en modules (16h)
2. ✅ Découper api.ts en modules (12h)
3. ✅ Refactorer DatabaseManager en repositories (12h)
4. ✅ Éliminer duplication dans semantic-chunker (8h)

### Sprint 3 (2 semaines) - Tests & Documentation
1. ✅ Atteindre 40% coverage (24h)
2. ✅ Ajouter JSDoc à toutes les API publiques (8h)
3. ✅ Créer README pour chaque package (8h)
4. ✅ Tests E2E pour automations (8h)

### Sprint 4 (1 semaine) - Performance
1. ✅ Optimiser DatabaseManager queries (8h)
2. ✅ Implémenter debouncing file watcher (4h)
3. ✅ Code splitting renderer (8h)
4. ✅ Memoization token counter (4h)

### Backlog - Architecture moderne
- Implémenter Dependency Injection
- Event-driven architecture
- Plugin system
- Advanced monitoring & tracing

---

## 🎯 Métriques de succès

### Objectifs mesurables

| Métrique | Actuel | Objectif Sprint 2 | Objectif Sprint 4 |
|----------|--------|-------------------|-------------------|
| Duplication code | 2.92% | <1.5% | <1% |
| Coverage tests | ~8% | 40% | 60% |
| Fichiers >500 lignes | 6 | 2 | 0 |
| TODOs production | 5 | 0 | 0 |
| Type safety (any) | >100 | <50 | <20 |
| Build time | ? | -20% | -40% |
| Bundle size | ? | -15% | -30% |

### KPIs de qualité
- ✅ Zero erreurs ESLint critiques
- ✅ Tous les handlers IPC avec validation Zod
- ✅ Tous les services avec tests unitaires
- ✅ Documentation complète API publique
- ✅ Performance: <50ms latence IPC moyenne

---

## 🔧 Outils recommandés

### Analyse continue
```bash
# Duplication
npx jscpd packages --format typescript --min-tokens 30

# Complexité
npx eslint packages --plugin complexity --rule "complexity: [error, 10]"

# Coverage
npx vitest --coverage

# Type coverage
npx type-coverage --at-least 95

# Bundle analysis
npx vite-bundle-visualizer
```

### Pre-commit hooks
```yaml
# .husky/pre-commit
#!/bin/sh
npm run lint
npm run typecheck
npm run test:changed
npm run quality:check
```

---

## 📚 Ressources & Références

### Patterns recommandés
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)

### Best practices TypeScript
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [Effective TypeScript](https://effectivetypescript.com/)

### Testing
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

---

**Rapport généré par:** Analyse automatisée Cortex IDE  
**Contributeurs à solliciter:** Architecture team, QA team, DevOps team  
**Prochaine revue:** Après Sprint 2 (dans 3 semaines)
