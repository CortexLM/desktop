# Cortex IDE - Advanced Features Implementation

## Overview
This document details the advanced differentiating features implemented in Phase 2.

---

## 🎯 Features Implemented

### 1. Multi-Workspace Support

**Location**: `packages/main/src/services/workspace-manager.ts`

#### Architecture
```typescript
class WorkspaceManager extends EventEmitter {
  - workspaces: Map<string, WorkspaceContext>
  - activeWorkspaceId: string | null
  
  + addWorkspace(path, name): Promise<Workspace>
  + removeWorkspace(workspaceId): Promise<void>
  + switchWorkspace(workspaceId): Promise<void>
  + getActiveWorkspace(): Workspace | null
}

interface WorkspaceContext {
  workspace: Workspace
  activeSessions: Set<string>
  openFiles: Set<string>
  terminalIds: Set<string>
  gitRepoPath?: string
}
```

#### Key Features
- **Multiple projects simultaneously**: Open and manage multiple projects without closing the IDE
- **Isolated contexts**: Each workspace has its own sessions, files, and terminals
- **Persistence**: Workspaces are saved and restored automatically
- **Smart switching**: Switch between workspaces with keyboard shortcuts
- **Event-driven**: Emits events for workspace changes, allowing reactive UI updates

#### UI Component
**Location**: `packages/renderer/src/components/workspace/WorkspaceSwitcher.tsx`

- Dropdown selector in sidebar
- Shows active workspace name and path
- Quick add/remove workspaces
- Visual indication of active workspace
- Keyboard navigation support

#### Usage
```typescript
// Add a workspace
await window.ipc.invoke('workspace:add', { path: '/path/to/project' })

// Switch workspace
await window.ipc.invoke('workspace:switch', { workspaceId: 'ws_123' })

// List all workspaces
const { workspaces, active } = await window.ipc.invoke('workspace:list')
```

---

### 2. ~~Terminal History Service~~ — ❌ SUPPRIMÉ (jamais fonctionnel)

**Status**: **cette feature n'existe pas.** Le service
`packages/main/src/services/terminal-history.ts` a été supprimé en août 2026.

#### Pourquoi

Le service existait (210 lignes) mais **n'a jamais eu un seul appelant** : aucun
canal IPC, aucune entrée dans l'allowlist du preload, aucun composant renderer,
aucune UI d'historique ou de recherche. `addCommand()` n'était appelé par rien,
donc l'historique était vide en permanence, et `getHistory()` /
`searchHistory()` / `exportHistory()` ne pouvaient retourner que `[]`.

Ce n'était pas une feature « à rebrancher » : **il n'existait aucun producteur
possible**. `TerminalService` est un flux d'octets PTY brut — il expose
`onData(data: string)`, pas des commandes. Il n'a aucune notion de « commande » :
pas d'intégration shell, pas de marqueurs OSC 133, pas de capture de code de
sortie par commande. Alimenter `addCommand(command, cwd, exitCode)` demanderait
une intégration shell complète (hooks `precmd`/`preexec` par shell, séquences
d'échappement, suivi du CWD), soit une feature à part entière — pas un câblage.

Deviner les commandes en parsant le flux d'entrée était l'alternative, et elle a
été rejetée : le flux contient les flèches de rappel d'historique, la complétion
par tabulation, les éditeurs plein écran et les invites de mot de passe. Le
résultat aurait été un historique faux, et un historique faux est pire
qu'absent.

#### Le point de sécurité, qui compte plus que la feature

Une ligne de commande contient régulièrement des secrets
(`export API_KEY=sk-live-...`, `curl -H "Authorization: Bearer ..."`,
`psql "postgres://user:password@..."`). Le service persistait ces lignes en
**clair**, dans un JSON non chiffré sous `~/.cortex-ide/terminal-history/`, avec
une rétention par défaut de 30 jours et 1,000 entrées par workspace. Le fichier
était écrit avec les permissions par défaut du processus (pas de `mode: 0o600`).

Toute réintroduction d'un historique de terminal doit donc traiter d'abord :
filtrage des secrets à l'écriture, permissions restrictives du fichier,
consentement explicite de l'utilisateur, et une borne vérifiée par un test.

#### Ce qui existe réellement pour les terminaux

- `terminal:create` / `terminal:input` / `terminal:resize` / `terminal:kill`
- `terminal:list` — inventaire des PTY vivants, permet à `TerminalGrid` de se
  rattacher après un démontage de vue (a corrigé une fuite mesurée d'un shell
  par terminal)
- `event:terminal-data`, `event:terminal-exit`

Le rappel d'historique de commandes reste assuré par le shell lui-même (`Ctrl+R`,
`~/.bash_history`, `~/.zsh_history`), qui le fait correctement.

---

### 3. Advanced Search Service

**Location**: `packages/main/src/services/advanced-search-service.ts`

#### Architecture
```typescript
class AdvancedSearchService {
  + search(rootPath, options): Promise<SearchResult[]>
  + replace(rootPath, options): Promise<ReplaceResult[]>
  + getSearchHistory(): string[]
}

interface SearchOptions {
  query: string
  useRegex?: boolean
  caseSensitive?: boolean
  wholeWord?: boolean
  includePatterns?: string[]
  excludePatterns?: string[]
  maxResults?: number
  contextLines?: number
}
```

#### Key Features
- **Regex support**: Full regex pattern matching
- **Glob patterns**: Include/exclude files with glob patterns
- **Context lines**: Show lines before/after matches
- **Global replace**: Replace across all files
- **Dry run mode**: Preview changes before applying
- **Search history**: Tracks recent searches
- **Smart filtering**: Auto-excludes node_modules, .git, dist, etc.
- **Binary detection**: Skips binary files automatically

#### UI Component
**Location**: `packages/renderer/src/components/search/AdvancedSearchPanel.tsx`

- Regex, case-sensitive, whole-word toggles
- Include/exclude file patterns
- Search history dropdown
- Replace mode with preview
- File tree results with expand/collapse
- Click to open file at specific line
- Shows match count per file

#### Usage
```typescript
// Search
const results = await window.ipc.invoke('search:find', {
  rootPath: '/project',
  query: 'function.*\\(',
  useRegex: true,
  includePatterns: ['**/*.js', '**/*.ts'],
  excludePatterns: ['node_modules', 'dist'],
  contextLines: 2
})

// Replace with preview
const preview = await window.ipc.invoke('search:replace', {
  rootPath: '/project',
  query: 'oldFunction',
  replacement: 'newFunction',
  dryRun: true
})
```

---

### 4. Git Stash Management

**Location**: `packages/main/src/services/git-stash-service.ts`

#### Architecture
```typescript
class GitStashService {
  + list(repoPath): Promise<StashEntry[]>
  + save(repoPath, message?, options?): Promise<void>
  + apply(repoPath, stashIndex): Promise<void>
  + pop(repoPath, stashIndex): Promise<void>
  + drop(repoPath, stashIndex): Promise<void>
  + branch(repoPath, branchName, stashIndex): Promise<void>
  + show(repoPath, stashIndex): Promise<StashDiff>
}

interface StashEntry {
  index: number
  message: string
  hash: string
  branch: string
  timestamp: number
}
```

#### Key Features
- **Visual stash list**: See all stashes with messages and branches
- **Stash diff viewer**: View changes in a stash before applying
- **Create stash**: Save current changes with custom message
- **Apply/Pop**: Apply or pop stashes with one click
- **Create branch**: Create a new branch from a stash
- **Stash search**: Find stashes by message or branch
- **Statistics**: See files changed, additions, deletions per stash
- **Include untracked**: Option to include untracked files
- **Keep index**: Option to keep staged changes

#### UI Component
**Location**: `packages/renderer/src/components/git/GitStashPanel.tsx`

- Two-pane layout: list + details
- Create stash dialog with options
- Apply, Pop, Delete actions
- Create branch from stash
- Diff viewer showing changed files
- Timestamps with relative formatting
- Confirmation dialogs for destructive actions

#### Usage
```typescript
// List stashes
const stashes = await window.ipc.invoke('git:stash-list', { repoPath })

// Create stash
await window.ipc.invoke('git:stash-save', {
  repoPath,
  message: 'WIP: feature X',
  includeUntracked: true
})

// View stash diff
const diff = await window.ipc.invoke('git:stash-show', {
  repoPath,
  stashIndex: 0
})

// Apply stash
await window.ipc.invoke('git:stash-apply', { repoPath, stashIndex: 0 })
```

---

### 5. Chat Export

**Location**: `packages/main/src/services/chat-export-service.ts`

#### Architecture
```typescript
class ChatExportService {
  + exportSession(session, messages, options): Promise<ExportResult>
  + exportMultipleSessions(sessions, options): Promise<ExportResult>
  + saveToFile(exportResult, outputPath): Promise<string>
}

interface ExportOptions {
  format: 'markdown' | 'json' | 'html' | 'text'
  includeMetadata?: boolean
  includeTimestamps?: boolean
  prettify?: boolean
}
```

#### Key Features
- **Multiple formats**: Markdown, HTML, JSON, Plain Text
- **Styled HTML**: Beautiful HTML export with embedded CSS
- **Metadata**: Optional inclusion of model, timestamps, etc.
- **Batch export**: Export multiple conversations at once
- **Pretty printing**: Formatted output for readability
- **Auto-naming**: Intelligent filename generation

#### UI Component
**Location**: `packages/renderer/src/components/chat/ChatExportButton.tsx`

- Format selector with icons and descriptions
- One-click export with download
- Shows session title
- Visual feedback during export
- Format-specific options

#### Export Formats

**Markdown**:
```markdown
# Chat Title

**Model:** gpt-4
**Created:** 2026-08-16T12:00:00Z

---

## 👤 User (2026-08-16 12:00:00)

User message here...

---

## 🤖 Assistant (2026-08-16 12:00:05)

Assistant response here...
```

**HTML**: Styled dark theme page with syntax highlighting

**JSON**: Machine-readable format for programmatic access

**Text**: Simple plain text for sharing

#### Usage
```typescript
// Export single session
const result = await window.ipc.invoke('chat:export', {
  sessionId: 'session_123',
  format: 'markdown',
  includeMetadata: true,
  includeTimestamps: true
})

// Download is triggered automatically in UI
```

---

## 🔧 Technical Implementation Details

### IPC Channels
New IPC channels added:

```typescript
// Workspace management
'workspace:add' -> { path, name? }
'workspace:remove' -> { workspaceId }
'workspace:switch' -> { workspaceId }
'workspace:list' -> { workspaces, active }

// Terminal history: AUCUN de ces canaux n'a jamais existé.
// 'terminal:history:add' / ':get' / ':search' / ':export' n'ont jamais été
// enregistrés dans packages/main/src/ipc/handlers/, ni listés dans l'allowlist
// du preload — un canal non listé est rejeté. Feature supprimée (voir §2).
//
// Canaux terminal réellement enregistrés:
'terminal:create' -> { cwd?, env?, shell? }
'terminal:input'  -> { terminalId, data }
'terminal:resize' -> { terminalId, cols, rows }
'terminal:kill'   -> terminalId
'terminal:list'   -> { terminals: [{ id, pid, cwd, shell }] }

// Advanced search
'search:find' -> { rootPath, query, options }
'search:replace' -> { rootPath, query, replacement, options }
'search:get-history' -> { history }

// Git stash
'git:stash-list' -> { repoPath }
'git:stash-save' -> { repoPath, message?, options? }
'git:stash-apply' -> { repoPath, stashIndex }
'git:stash-pop' -> { repoPath, stashIndex }
'git:stash-drop' -> { repoPath, stashIndex }
'git:stash-branch' -> { repoPath, branchName, stashIndex }
'git:stash-show' -> { repoPath, stashIndex }

// Chat export
'chat:export' -> { sessionId, format, options }
```

### Event System
Events emitted for reactive UI:

```typescript
// Workspace events
'event:workspace-added' -> { workspace }
'event:workspace-removed' -> { workspaceId }
'event:workspace-switched' -> { workspaceId, previousId }
'event:workspace-updated' -> { workspaceId }

// Terminal history events: n'ont jamais été émis vers le renderer.
// 'command-added' / 'history-cleared' / 'history-cleaned' étaient émis sur
// l'EventEmitter interne du service supprimé, sans aucun forwarding IPC ni
// aucun abonné. Supprimés avec la feature (voir §2).

// Événements terminal réellement envoyés au renderer:
'event:terminal-data' -> { type, terminalId, data }
'event:terminal-exit' -> { type, terminalId, exitCode }
```

### Data Persistence
Storage locations:

```
~/.cortex-ide/
  ├── workspaces.json          # Workspace list
  └── database.sqlite          # Main database

# `terminal-history/` n'est plus créé: le service qui l'écrivait est supprimé.
# Il ne contenait de toute façon jamais rien, `addCommand()` n'ayant aucun
# appelant.
```

### Performance Considerations
- **Workspace switching**: < 100ms
<!-- Terminal history search: chiffre retiré. Le service est supprimé, et cette
     mesure n'avait jamais été prise: l'historique étant toujours vide, aucune
     recherche sur 1000 entrées n'a jamais pu être exécutée. -->
- **Advanced search**: Parallel file processing, ~1000 files/sec
- **Git stash operations**: Delegated to git CLI, async
- **Chat export**: Streaming for large conversations

---

## 🎨 UI/UX Highlights

### Design Principles
1. **Minimal clicks**: Most actions in 1-2 clicks
2. **Visual feedback**: Clear loading states and confirmations
3. **Keyboard friendly**: Shortcuts for power users
4. **Dark theme first**: Optimized for dark mode
5. **Responsive**: Adapts to different screen sizes

### Color Palette
- Primary: Blue (#3b82f6) - Actions, links
- Success: Green (#22c55e) - Confirmations
- Warning: Orange (#f97316) - Previews
- Danger: Red (#ef4444) - Destructive actions
- Neutral: Grays (#0a0a0a to #fafafa) - UI chrome

### Animations
- Smooth transitions (200ms)
- Subtle hover effects
- Loading spinners for async operations
- Expand/collapse animations for trees

---

## 📚 Usage Examples

### Multi-Workspace Workflow
```typescript
// Developer working on multiple projects
1. Add main project: workspace:add -> ~/projects/main-app
2. Add microservice: workspace:add -> ~/projects/auth-service
3. Add library: workspace:add -> ~/projects/shared-lib

// Switch between them with Ctrl+Shift+W or UI dropdown
// Each workspace maintains independent:
// - Terminal sessions
// - Open files
// - Git state
// - AI chat sessions
```

<!-- Section « Terminal History Power User » retirée: ce scénario (rechercher
     "docker" dans l'historique, exporter l'historique, retrouver les codes de
     sortie) n'a jamais été réalisable. Aucune UI n'exposait la recherche ou
     l'export, et aucun code ne capturait les commandes. Voir §2. -->

### Advanced Search & Replace
```typescript
// Refactoring across codebase
1. Search: "getUserById" (finds all usages)
2. Review matches in all files
3. Replace: "getUserByIdAsync" with preview
4. Confirm and apply to 47 files
5. Repeat for other functions

// Search with regex: "function (get|set)User.*\("
// Exclude patterns: "*.test.ts, *.spec.ts"
```

### Git Stash Management
```typescript
// Developer juggling multiple features
1. Working on feature A
2. Urgent bug comes in
3. Stash changes: "WIP: feature A progress"
4. Fix bug and commit
5. View stashes, select "WIP: feature A progress"
6. Check diff to see what was stashed
7. Pop stash to continue work

// Or create branch from stash if feature needs more work
```

### Chat Export
```typescript
// Sharing AI-assisted solutions
1. Have productive AI conversation solving issue
2. Click export button
3. Select Markdown format
4. Share .md file with team
5. Or export HTML for pretty documentation
6. Or JSON for programmatic processing
```

---

## 🧪 Testing

> ⚠️ Cette section listait des tests qui n'existaient pas. Vérifié en août 2026 :
> aucun fichier `terminal-history*.test.ts` n'a jamais existé dans le dépôt, et
> aucun test d'intégration ni de performance ne portait sur l'historique de
> terminal. Les lignes correspondantes ont été retirées plutôt que corrigées.

### Unit Tests
- WorkspaceManager: Add, remove, switch operations
- AdvancedSearchService: Regex matching, file filtering
- GitStashService: All stash operations
- ChatExportService: All export formats

### Integration Tests
- End-to-end workspace workflows
- Search across large codebases
- Git stash UI interactions
- Export and re-import conversations

### Performance Tests
- 10,000 files search: < 10 seconds
- 20 workspace switch: < 100ms each
- 100 stash list: < 1 second

---

## 🐛 Known Issues & Future Improvements

### Current Limitations
- Search: Binary file detection not perfect
- Stash: No conflict preview before apply
- Export: Large conversations (>10k messages) slow

### Planned Improvements
- Search: Semantic search with embeddings
- Stash: AI-powered conflict resolution
- Export: Streaming export for large conversations
- Workspace: Cloud workspace support

---

## 📖 Documentation

> ⚠️ Cette section listait 9 guides. **Aucun des 9 fichiers n'existe** — vérifié
> en août 2026, le répertoire `docs/guides/` lui-même est absent du dépôt. Les
> liens ont été retirés plutôt que laissés en place : un lien mort promet une
> documentation qui n'a jamais été écrite.
>
> Documentation réellement disponible à la racine : `ARCHITECTURE.md`,
> `ARCHITECTURE_AUDIT.md`, `ANTI_PATTERNS.md`, `ROADMAP.md`,
> `DOCUMENTATION_INDEX.md`, plus le site `docs-site/`.

---

**Last Updated**: 2026-08-17  
**Version**: 2.1  
**Status**: ⚠️ Ce document a décrit comme livrées des features qui ne l'étaient
pas (Terminal History Service, ses 4 canaux IPC, ses 3 événements, ses tests et
ses chiffres de performance). Corrigé le 2026-08-17. Le badge
« Production Ready ✅ » a été retiré : il n'était pas adossé à une vérification.
