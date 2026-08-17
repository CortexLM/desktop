# Terminal Integration - Phase 2, Tâche 3

## Implémentation complétée

### 1. Backend (Main Process)

#### Service Terminal (`packages/main/src/services/terminal-service.ts`)
- **TerminalService class** : Gestion centralisée des PTY
  - `createTerminal()` : Spawn PTY avec node-pty
  - `writeToTerminal()` : Envoi de données au PTY
  - `resizeTerminal()` : Redimensionnement du terminal
  - `killTerminal()` : Fermeture propre du PTY
  - Events : `data`, `exit`
- **Shell detection automatique** :
  - Windows : PowerShell ou cmd.exe
  - Unix/Linux : bash, zsh selon $SHELL
- **Environnement** : TERM=xterm-256color, COLORTERM=truecolor

#### Handlers IPC (`packages/main/src/ipc/handlers/terminal-handlers.ts`)
- `terminal:create` → Crée un nouveau terminal PTY
- `terminal:input` → Envoie input utilisateur au PTY
- `terminal:resize` → Redimensionne le PTY (cols/rows)
- `terminal:kill` → Tue le processus PTY
- Events vers renderer :
  - `event:terminal-data` → Output du terminal
  - `event:terminal-exit` → Terminal fermé avec exit code

### 2. Frontend (Renderer Process)

#### TerminalTab (`packages/renderer/src/views/workspace/TerminalTab.tsx`)
- **xterm.js intégré** avec addons :
  - FitAddon : Auto-resize
  - WebLinksAddon : URLs cliquables
  - SearchAddon : Recherche dans l'historique
- **Thème Cortex V3** : Dark mode avec couleurs cohérentes
- **Toolbar** :
  - Indicateur CWD
  - Bouton search (Ctrl+F)
  - Bouton copy selection
  - Bouton close
- **Search bar** : Recherche incremental avec navigation (↑/↓)

#### TerminalGrid (`packages/renderer/src/views/workspace/TerminalGrid.tsx`)
- **Multi-terminaux** avec layouts :
  - Single : Un seul terminal plein écran
  - Horizontal : Split horizontal (2 terminaux côte à côte)
  - Vertical : Split vertical (2 terminaux empilés)
  - Grid : 2×2 grid (4 terminaux)
- **Keyboard shortcuts** :
  - `Ctrl+\`` : Ouvrir nouveau terminal
  - `Ctrl+Shift+%` : Split horizontal
  - `Ctrl+Shift+|` : Split vertical
  - `Ctrl+Shift+W` : Fermer terminal actif
- **Gestion des tabs** : Affichage tabs si > 2 terminaux

### 3. IPC Bridge (Preload)

#### API exposée (`packages/preload/src/index.ts`)
- **window.ipc.invoke()** : Appels IPC simplifiés
- **window.ipc.on()** : Écoute d'événements avec cleanup
- **window.cortex.terminal** : API type-safe pour terminaux

### 4. Dépendances installées

**Backend :**
- `node-pty@1.1.0` : PTY natif cross-platform

**Frontend :**
- `@xterm/xterm@6.0.0` : Terminal emulator
- `@xterm/addon-fit@0.11.0` : Auto-resize
- `@xterm/addon-web-links@0.12.0` : Liens cliquables
- `@xterm/addon-search@0.16.0` : Recherche

### 5. Configuration Vite

#### `packages/main/vite.config.ts`
Modules externalisés pour Node.js :
- `child_process`, `tty`, `net`, `worker_threads`
- `simple-git`, `node-pty`
- Tous les modules Node natifs

### 6. Types

#### Global types (`packages/renderer/src/types/global.d.ts`)
- Interface `IPCApi` pour window.ipc
- Déclarations TypeScript pour l'API exposée

## Fonctionnalités implémentées ✓

1. ✅ Backend TerminalService avec node-pty
2. ✅ IPC handlers (create, input, resize, kill)
3. ✅ Frontend TerminalTab avec xterm.js
4. ✅ Frontend TerminalGrid avec multi-layouts
5. ✅ Addons : fit, web-links, search
6. ✅ Keyboard shortcuts (Ctrl+`, split, close)
7. ✅ Shells supportés : bash, zsh, powershell
8. ✅ Design system Cortex V3 appliqué
9. ✅ Build réussi (preload, main, renderer)

## Architecture

```
Terminal Flow:
┌─────────────┐
│   Renderer  │
│             │
│ TerminalGrid│──┐
│ TerminalTab │  │ window.ipc.invoke('terminal:create')
└─────────────┘  │
                 ↓
┌─────────────────────────────────────┐
│            Preload API              │
│  contextBridge.exposeInMainWorld()  │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│          Main Process               │
│  terminal-handlers.ts               │
│         ↓                           │
│  TerminalService                    │
│    - node-pty spawn                 │
│    - PTY events → IPC events        │
└─────────────────────────────────────┘
```

## Prochaines étapes

Phase 2 complète ! Prochaine phase :
- **Phase 3** : AI Providers & Mission Orchestrator
- Intégrer OpenAI, Anthropic, OpenRouter
- Mission orchestrator inspiré opencode-missions

## Notes techniques

- **Sécurité** : Context isolation activée, sandbox enabled
- **Performance** : Virtual scrolling via xterm.js
- **Resize** : ResizeObserver + FitAddon + PTY resize sync
- **Cleanup** : Tous les PTY sont tués au quit de l'app
