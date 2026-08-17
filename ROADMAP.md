# Cortex IDE - Product Roadmap

## Vision
Cortex IDE vise à devenir l'IDE de référence pour le développement assisté par IA, en se différenciant par des features avancées, une architecture multi-provider, et une expérience développeur exceptionnelle.

---

## ✅ Phase 1: Core Features (Completed)

### Infrastructure de base
- [x] Architecture Electron moderne (main/renderer/preload)
- [x] System IPC robuste avec validation Zod
- [x] Base de données SQLite optimisée
- [x] Hot reload développement
- [x] Tests E2E avec Playwright
- [x] Pipeline CI/CD

### Éditeur
- [x] Monaco Editor intégré
- [x] Syntax highlighting multi-langages
- [x] IntelliSense de base
- [x] File explorer avec tree view
- [x] Tabs et split views

### Terminal
- [x] Terminal PTY intégré (node-pty)
- [x] xterm.js avec addons complets
- [x] Terminal grid (split horizontal/vertical)
- [x] Multiple terminal tabs

### Git
- [x] Status et diff visualization
- [x] Commit, push, pull
- [x] Branch management
- [x] File staging/unstaging

### AI Core
- [x] Multi-provider support (OpenAI, Anthropic, Grok, etc.)
- [x] Streaming responses
- [x] Context management
- [x] Session persistence
- [x] Usage tracking et coûts

---

## ✅ Phase 2: Advanced Differentiators (Completed - Current Release)

### Multi-Workspace Support — ⚠️ BACKEND COMPLET, UI NON MONTÉE
- [x] **WorkspaceManager**: service réel, 5 canaux IPC enregistrés
      (`workspace:list/switch/add/remove/open-dialog`), tous dans l'allowlist
- [x] **Relais d'événement**: `workspace-handlers.ts` retransmet
      `workspace-switched` vers toutes les fenêtres sous
      `event:workspace-switched`
- [x] **Persistence**: sauvegarde/restauration via la table `workspaces`
- [ ] **WorkspaceSwitcher UI** — ❌ le composant existe mais n'est monté nulle part
- [ ] **Contexte isolé par workspace** (sessions, fichiers, terminaux séparés) —
      ❓ non vérifié
- [ ] **Workspace settings** (configuration par projet) — ❓ non vérifié

**Vérifié le 17/08/2026.** `WorkspaceSwitcher.tsx` est le **seul** abonné à
`event:workspace-switched` dans tout le renderer — et il n'a aucun importateur.
Aucun chunk `WorkspaceSwitcher-*.js` dans le bundle. Conséquence : le relais
d'événement côté main fonctionne mais n'a aucun destinataire à l'exécution, et
l'utilisateur n'a pas de moyen de changer de workspace depuis l'interface.

Les deux dernières cases sont passées à `❓` : elles n'ont pas été vérifiées par
cet audit, et sans point d'entrée UI elles ne sont pas observables.

### Terminal Advanced — ❌ retiré du périmètre (n'a jamais été livré)

Ces 5 items étaient cochés `[x]`. **Aucun ne fonctionnait.** Le
`TerminalHistoryService` existait comme classe mais n'avait aucun appelant :
aucun canal IPC, aucune UI, aucun code n'appelant `addCommand()`. L'historique
était donc vide en permanence, ce qui rend la recherche, l'export et la
déduplication inopérants par construction. Service supprimé en août 2026.

- ~~Terminal History Service: historique persistant par workspace~~
- ~~Command history search~~
- ~~Export history~~
- ~~Smart deduplication~~
- ~~Context-aware: historique avec CWD et exit codes~~

**Pourquoi ce n'est pas juste « à rebrancher »** : `TerminalService` est un flux
PTY brut, sans notion de commande (pas d'intégration shell, pas d'OSC 133). Un
historique fiable exige cette intégration, plus le traitement d'un vrai problème
de sécurité : une ligne de commande contient des clés d'API et des mots de passe,
et le service les persistait en clair sur disque pendant 30 jours.

**Ce qui a réellement été livré côté terminal** : `terminal:list` avec
rattachement des sessions au remontage de vue (corrige une fuite mesurée d'un
PTY par terminal), et le branchement de `event:terminal-exit`.

**Impact réel**: aucun. Le rappel de commandes reste assuré par le shell
(`Ctrl+R`).

### Advanced Search 🎯
- [x] **AdvancedSearchService**: Recherche multi-fichiers avec regex
- [x] **Global replace**: Replace across all files
- [x] **File patterns**: Include/exclude avec glob patterns
- [x] **Context lines**: Voir le contexte autour des matches
- [x] **Search history**: Historique des recherches
- [x] **Preview mode**: Voir les changements avant replace
- [x] **Smart filters**: Exclut automatiquement node_modules, .git, etc.

**Impact**: Recherche plus puissante que VSCode natif, avec preview de replace et regex avancé.

### Git Stash Management — ⚠️ ÉCRIT MAIS NON MONTÉ DANS L'APPLICATION
- [x] **GitStashService**: service main-process réel
- [x] 7 canaux IPC `git:stash-*` enregistrés et présents dans l'allowlist preload
- [x] **GitStashPanel UI**: le composant existe et appelle bien ces canaux
- [ ] **Atteignable par l'utilisateur** — ❌ non

**Vérifié le 17/08/2026.** `GitStashPanel.tsx` n'est **importé par aucun fichier**
du renderer : `grep -rn GitStashPanel packages/renderer/src` ne renvoie que le
composant lui-même et ses tests. Il n'est ni monté dans `Workbench.tsx`, ni chargé
en `lazy()`, ni réexporté par un barrel. Confirmation par le build : le bundle de
production ne contient aucun chunk `GitStashPanel-*.js`, alors qu'il contient bien
`AdvancedSearchPanel-DncFTtdc.js` pour la recherche, elle montée.

Toute la chaîne existe (service → IPC → allowlist → composant) **sauf le dernier
maillon** : personne ne rend le composant. Ces cases `[x]` décrivaient donc du code
qu'aucun utilisateur ne peut atteindre.

### Chat Export — ⚠️ ÉCRIT MAIS NON MONTÉ DANS L'APPLICATION
- [x] **ChatExportService**: service main-process réel
- [x] Canal `chat:export` enregistré et présent dans l'allowlist preload
- [x] **ChatExportButton UI**: le composant existe et appelle ce canal
- [ ] **Atteignable par l'utilisateur** — ❌ non

Même constat que pour Git Stash : `ChatExportButton.tsx` n'a aucun importateur, et
aucun chunk correspondant n'apparaît dans le bundle.

Les formats et options listés auparavant (Markdown/HTML/JSON/Text, batch export,
HTML stylé, métadonnées) n'ont pas été revérifiés un par un — sans point d'entrée
UI, la question de savoir lesquels fonctionnent est prématurée.

---

## 🚀 Phase 3: Collaboration & Team Features (Q2 2026)

### Share Session URL
- [ ] **Session sharing**: Générer un lien partageable
- [ ] **Read-only mode**: Partager une session en lecture seule
- [ ] **Replay mode**: Rejouer une conversation
- [ ] **Team templates**: Templates de prompts partagés
- [ ] **Collaborative editing**: Édition temps réel (style Google Docs)

**Objectif**: Permettre le pair programming assisté par IA.

### Team Workspaces
- [ ] **Shared workspaces**: Workspaces d'équipe synchronisés
- [ ] **Permission system**: Contrôle d'accès granulaire
- [ ] **Activity feed**: Voir ce que font les collègues
- [ ] **Code review intégré**: Review avec AI assistance
- [ ] **Shared AI context**: Contexte d'équipe partagé

**Objectif**: Transformer Cortex IDE en plateforme collaborative.

---

## 🔬 Phase 4: Advanced Git Features (Q2-Q3 2026)

### Cherry-Pick Support
- [ ] **Cherry-pick UI**: Interface visuelle pour cherry-pick
- [ ] **Conflict resolution**: Résolution de conflits assistée par AI
- [ ] **Multi-commit cherry-pick**: Sélection multiple
- [ ] **Preview changes**: Voir l'impact avant d'appliquer

### Interactive Rebase
- [ ] **Visual rebase timeline**: Timeline interactive
- [ ] **Reorder commits**: Drag & drop des commits
- [ ] **Squash assistant**: AI suggère les commits à squash
- [ ] **Reword commits**: Édition de messages avec AI
- [ ] **Safe mode**: Backup automatique avant rebase

### Conflict Resolution UI
- [ ] **3-way merge view**: Ours | Base | Theirs
- [ ] **AI conflict resolver**: Suggestions automatiques
- [ ] **Conflict patterns**: Détection de patterns communs
- [ ] **One-click resolution**: Résolution intelligente
- [ ] **Conflict history**: Historique des conflits résolus

**Objectif**: Rendre Git accessible aux développeurs de tous niveaux.

---

## 🧠 Phase 5: AI-Enhanced Development (Q3 2026)

### Code Intelligence
- [ ] **AI code completion**: Au-delà de l'IntelliSense classique
- [ ] **Semantic search**: Recherche par intention, pas par texte
- [ ] **Code explanation**: Explication contextuelle du code
- [ ] **Performance hints**: Suggestions d'optimisation
- [ ] **Security scanning**: Détection de vulnérabilités

### Autonomous Coding
- [ ] **Task decomposition**: L'AI décompose les tâches complexes
- [ ] **Multi-file refactoring**: Refactoring intelligent multi-fichiers
- [ ] **Test generation**: Génération automatique de tests
- [ ] **Documentation generation**: Docs auto-générées
- [ ] **Migration assistant**: Migration de frameworks/versions

### Context-Aware AI
- [ ] **Project understanding**: L'AI comprend l'architecture
- [ ] **Smart context selection**: Sélection automatique du contexte pertinent
- [ ] **Cross-file awareness**: Comprendre les dépendances
- [ ] **Historical context**: Utiliser l'historique Git comme contexte
- [ ] **Team knowledge base**: Base de connaissance d'équipe

**Objectif**: L'IA devient un véritable pair programmer.

---

## 🎨 Phase 6: Developer Experience (Q4 2026)

### Custom Shells
- [ ] **Shell profiles**: Profils de shell personnalisables
- [ ] **Custom prompts**: Prompts personnalisés
- [ ] **Shell scripts library**: Bibliothèque de scripts
- [ ] **Environment switcher**: Switch rapide d'environnements
- [ ] **Remote shells**: Connexion à des shells distants

### Advanced Terminal Features
- [ ] **Terminal recording**: Enregistrer des sessions
- [ ] **Command palette**: Palette de commandes terminal
- [ ] **Auto-suggestions**: Suggestions basées sur l'historique
- [ ] **Terminal sharing**: Partager un terminal en temps réel
- [ ] **Output parsing**: Parser la sortie pour actions automatiques

### Workspace Features
- [ ] **Workspace templates**: Templates de projet
- [ ] **Quick setup**: Setup automatique d'environnements
- [ ] **Dependency management**: Gestion intelligente des dépendances
- [ ] **Docker integration**: Support Docker natif
- [ ] **Cloud workspaces**: Workspaces dans le cloud

**Objectif**: Expérience développeur de classe mondiale.

---

## 🔌 Phase 7: Extensions & Ecosystem (2027)

### Extension System
- [ ] **Extension API**: API riche pour extensions
- [ ] **Extension marketplace**: Marketplace d'extensions
- [ ] **Extension CLI**: CLI pour créer des extensions
- [ ] **Hot reload extensions**: Développement d'extensions live
- [ ] **Extension security**: Sandbox et permissions

### Language Servers
- [ ] **LSP support**: Support complet du Language Server Protocol
- [ ] **Custom LSP**: Créer des LSP custom
- [ ] **Multi-LSP**: Plusieurs LSP par fichier
- [ ] **LSP marketplace**: Marketplace de LSP

### Integrations
- [ ] **Jira/Linear**: Intégration issue trackers
- [ ] **Figma**: Import de designs Figma
- [ ] **Notion**: Sync avec Notion
- [ ] **Slack**: Notifications Slack
- [ ] **CI/CD**: Intégration GitHub Actions, GitLab CI, etc.

**Objectif**: Écosystème extensible et ouvert.

---

## 🌐 Phase 8: Cloud & Mobile (2027)

### Cloud IDE
- [ ] **Browser version**: Version web complète
- [ ] **Cloud sync**: Synchronisation cloud
- [ ] **Remote development**: Développement sur serveurs distants
- [ ] **Cloud workspaces**: Workspaces hébergés

### Mobile Companion
- [ ] **Mobile app**: App mobile pour review/edit léger
- [ ] **Code review mobile**: Review de PRs sur mobile
- [ ] **AI chat mobile**: Chat AI sur mobile
- [ ] **Notifications**: Notifications push

**Objectif**: Développer partout, sur tout device.

---

## 📊 Success Metrics

### Adoption
- **Target Q2 2026**: 10,000 active users
- **Target Q4 2026**: 50,000 active users
- **Target 2027**: 200,000+ active users

### Engagement
- **Daily active sessions**: 2+ par utilisateur
- **AI interactions**: 20+ par jour par utilisateur actif
- **Workspace switching**: Preuve d'utilisation multi-projet

### Differentiation
- **Feature parity with VSCode**: Q3 2026
- **AI features beyond Cursor**: Q4 2026
- **Team collaboration leader**: 2027

---

## 🎯 Strategic Priorities

### Court terme (Q2 2026)
1. **Stabilité**: Tester et stabiliser les features Phase 2
2. **Performance**: Optimiser la vitesse de l'IDE
3. **Documentation**: Docs complètes pour utilisateurs
4. **Community**: Construire la communauté early adopters

### Moyen terme (Q3-Q4 2026)
1. **Collaboration**: Features team pour adoption entreprise
2. **Git avancé**: Différenciation sur les workflows Git
3. **AI Enhancement**: Pousser l'AI au-delà de l'assistance

### Long terme (2027)
1. **Ecosystem**: Extension marketplace mature
2. **Cloud**: Version cloud production-ready
3. **Enterprise**: Features enterprise (SSO, audit, etc.)
4. **Global**: Internationalisation et croissance mondiale

---

## 💡 Innovation Areas

### Unique Selling Points
1. **Multi-workspace natif**: Seul IDE avec vrai support multi-workspace
2. ~~**Terminal history intelligent**~~ — retiré : la feature n'existe pas, voir
   « Terminal Advanced » ci-dessus. Ne pas remettre cette affirmation.
3. **AI multi-provider**: Flexibilité totale sur les modèles
4. **Git stash UI**: Meilleure UX pour stashes Git
5. **Export everything**: Export de conversations et sessions (pas
   d'historiques : l'export d'historique de terminal n'a jamais existé)

### Future Innovations
- **AI-powered migrations**: Migration automatique de codebases
- **Natural language Git**: Git en langage naturel
- **Predictive development**: L'AI anticipe les besoins
- **Zero-config setup**: Setup automatique de n'importe quel projet
- **Collaborative AI**: AI qui apprend de toute l'équipe

---

## 🤝 Contributing

Les features de cette roadmap sont ouvertes à contribution. Priorités actuelles:
1. Cherry-pick UI (Phase 4)
2. Terminal recording (Phase 6)
3. Code intelligence (Phase 5)

---

## 📝 Notes

### Design Principles
- **Speed**: L'IDE doit être rapide, toujours
- **Simplicity**: Features puissantes mais UI simple
- **Intelligence**: L'AI doit être invisible mais omniprésente
- **Reliability**: Zéro perte de données, toujours

### Technical Debt
- Refactoring du database layer (Q2 2026)
- Migration vers Vite 6 (Q2 2026)
- Amélioration test coverage (ongoing)
- Documentation technique (Q2 2026)

---

**Last Updated**: 2026-08-16  
**Version**: 2.0  
**Status**: Phase 2 Complete ✅
