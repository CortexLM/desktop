# Audit visuel et fonctionnel — Cortex IDE, 17 août 2026

**Portée :** toutes les vues atteignables, deux thèmes, plus les panneaux debug,
les dialogues et les états vides/erreur. 64 captures dans
`screenshots/audit/`, chacune accompagnée d'une sonde JSON.

---

## 0. Avertissement méthodologique — lisez ceci d'abord

**Je n'ai pas pu voir mes captures.** Vérifié, pas supposé :

1. J'ai généré une image de contrôle contenant un code à 4 chiffres tiré au
   hasard (`1545`), sans l'afficher dans mon terminal.
2. Je l'ai lue avec mon outil de lecture d'images. **Aucun contenu visuel n'est
   remonté** — ni chiffres, ni couleurs.
3. J'ai cherché la route MCP de secours documentée dans la compétence
   `vision-opus` (`analyze_image` / `openrouter-multimodal`). **Elle n'existe pas
   dans cet environnement** (`GetMcpTools` ne renvoie aucune correspondance).

**Conséquence, appliquée sans exception dans ce rapport :** aucun jugement ici ne
repose sur le fait de regarder une image. Les 64 PNG sont des livrables pour un
relecteur humain. Mes constats viennent d'assertions programmatiques exécutées
dans l'Electron réel : styles calculés, géométrie, texte visible, inventaire des
contrôles, présence de la frontière d'erreur, erreurs console et `pageerror`.

Quand j'écris « pas de crash », cela signifie : le texte « This view failed to
load » de `ErrorState` était absent **et** aucun `pageerror` n'a été émis. Pas
« la capture avait l'air correcte ».

---

## 1. Vos chiffres, corrigés

Vous m'avez demandé de ne pas vous croire. Trois corrections :

| Votre affirmation | Mesure réelle | Source |
|---|---|---|
| « activity bar de **11 vues** » | **12 vues** : 6 primaires + 6 secondaires | `layout/views.ts`, tableau `VIEWS` |
| « panneaux debug (**6** sous-panneaux) » | **5 onglets** | `DebugPanel.tsx` : Console, IPC Inspector, Performance, Memory, Settings |
| « 3058 → 3807 tests » | **3807** au départ, **3801** maintenant | `bun run test` |

Les 6 tests disparus ne sont pas de mon fait : l'agent qui a terminé
`views/account/` a supprimé les données inventées et les tests qui les
affirmaient. Les 12 vues se décomposent ainsi : explorer, search, git, terminal,
ai-chat, extensions (primaires) ; notes, plans, browser, automations, account,
settings (secondaires).

**Ma propre référence, mesurée :**

- Unitaires : **3801 réussis / 131 fichiers**, 0 échec
- E2E : **130 réussis, 5 échecs, 16 ignorés** — les 5 échecs sont tous dans
  `account.spec.ts` et attendent `profile-name`, `team-members`, l'édition de
  profil : des testids que l'autre agent vient de retirer. Fichier que je n'ai
  pas touché. Avant mes ajouts la suite comptait 114 tests ; mes specs en
  ajoutent 12, d'où 130 + 5.
- `bun run verify:native-abi` : ✓ Node abi=137, ✓ Electron abi=128
- `bun run verify:renderer` : **47/47** réussis
- Bundle CSS : **50 830 octets** — cohérent avec votre « 50 kB ». Tailwind
  compile bien : `globals.css` contient les trois directives `@tailwind` et
  importe `tokens.css`.

---

## 2. Les bugs de votre liste — état vérifié

| Bug | État | Preuve |
|---|---|---|
| `MCPMarketplace` / `process.cwd()` | **Corrigé** | Vue Extensions rendue, onglet Marketplace peuplé (904 caractères, serveurs listés). Le seul `process.cwd()` restant est dans un commentaire l'expliquant. |
| `PlansView` / `rows` undefined | **Corrigé** | `result?.rows ?? []` en place. Ajout d'une tâche → « 1 total », ligne persistée. |
| `SettingsView` / clé `providers` absente | **Corrigé** | `normalizeProviders()` présent. Les 4 onglets s'ouvrent. |
| `BranchSelector` / prop `trigger` | **Partiellement** | Le nom « main » s'affiche ✓, le popover est bien fermé au repos ✓ et s'ouvre au clic ✓. **Mais le contenu est faux** — voir §4.1. |
| `UsageTracking` / `SUM(cost)` NULL | **Corrigé dans le code, vue morte** | Les garde-fous existent, mais la vue n'a aucun appelant. Voir §5. |
| `SessionList` « Invalid Date » | **Corrigé** | `UNKNOWN_DATE_GROUP` exporté ; aucune date invalide dans l'état vide capturé. |
| `AgentDetail` durée de 53 ans | **Corrigé dans le code, vue morte** | `toFiniteNumber`/`deriveDuration` présents. Vue inatteignable. |
| `ChatView` fond des blocs de code | **Corrigé** | `syntax-theme.css` remplace `prism-tomorrow`, piloté par les tokens, avec un bloc `.dark`. Le commentaire nomme la régression. |
| Panneaux debug vides | **Corrigé pour 2 sur 4** | Console : 3 vraies entrées de log. IPC Inspector : 2 messages `fs:read-dir` + statistiques de canal. Performance et Memory : toujours vides. Voir §4.2. |

**Aucun crash, aucune exception non rattrapée, aucun spinner bloqué** sur les 39
sondes de la première passe. `errorBoundaryVisible: false` partout.

**Parité des thèmes : correcte.** Sombre `rgb(13,13,14)` / texte
`rgb(245,245,245)` ; clair `rgb(252,252,252)` / texte `rgb(38,38,38)`. Les 13
vues capturées dans les deux thèmes diffèrent bien sur les deux valeurs — la
régression du mode clair ne se reproduit pas.

---

## 3. Tableau vue par vue

Verdict : **F** fonctionnelle · **D** coquille de démo · **C** cassée

| # | Vue | Verdict | Données | État vide s'explique ? |
|---|---|---|---|---|
| 00 | Shell (header/rail/status) | **F** | Réelles (chemin du workspace) | — |
| 01 | Explorer | **F** | Réelles (`fs:read-dir`) | s/o (peuplé) |
| 02 | Search | **F** | Réelles — 8 correspondances dans 8 fichiers | ✓ « Enter a search query to begin » |
| 03 | Source Control | **F** sauf branches | Réelles (`git.status`) | s/o (2 changements) |
| 04 | Terminal | **F** | Réelles — PTY vivant, `root@…#` | ✓ « Press Ctrl+` to open a terminal » |
| 05 | AI Chat | **C** en pratique | Aucune : provider absent | ✓ mais §4.3 |
| 06 | Extensions | **F** | Réelles (catalogue MCP) | ✓ « No MCP extensions installed » + action |
| 07 | Notes | **F** partiel | Réelles (persistées) | ✗ « No content » sec ; bouton Open désactivé en dur |
| 08 | Plans | **F** | Réelles (SQLite) | ✓ compteurs par état |
| 09 | Browser | **F** | Réelles (`<webview>` Electron) | ✗ **`about:blank` nu** |
| 10 | Automations | **F** | Réelles | ✓ « No automations yet » + action |
| 11 | Account | **D, honnête** | Aucune, et le dit | ✓ excellent (voir §3.1) |
| 12 | Settings | **F** sauf providers | Réelles (localStorage) | s/o |

### 3.1 Account — le modèle à suivre

Les trois onglets affichent un bandeau `DemoNotice` : « Not functional — Cortex
has no accounts or sign-in. This screen is an unfinished interface… ». Chaque
section vide explique sa propre cause (`identity-empty`,
`payment-methods-empty`, `invoices-empty`). **C'est exactement le correctif du
défaut que vous décrivez** : un panneau vide dont la source n'est pas alimentée
est désormais distinguable d'un panneau qui n'a rien à montrer.

Un défaut subsiste : `BillingView` renvoie l'utilisateur vers « the Usage view
under Agents ». **Cette vue n'existe pas comme destination** — `UsageTracking`
est du code mort (§5). Le texte pointe vers une fonctionnalité inatteignable.

---

## 4. Bugs que j'ai trouvés

### 4.1 — HAUTE — Le bouton Bug n'ouvre pas le panneau debug

`AppShell` câble le bouton Bug sur `toggleDebugMode`, qui n'écrit que
`settings.enabled` et **ne touche jamais `showDebugPanel`**. Or `Workbench` ne
rend le panneau que sous `showDebugPanel &&`.

Mesuré : après un clic, `aria-label` passe à « Disable debug mode » (le mode a
bien basculé) tandis que `[data-testid="debug-panel"]` reste **absent du DOM**
(`panelCountAfterBugButton: 0`). Le même appui sur `Cmd+Shift+D` donne
`panelCountAfterCmdShiftD: 1`.

L'affordance visible ne fait rien de visible ; le panneau n'est accessible que
par un raccourci non découvrable ou la palette. Fichiers :
`contexts/DebugContext.tsx:49`, `components/layout/AppShell.tsx:269`.

### 4.2 — HAUTE — Performance et Memory : vides sans explication

- **Performance** : « Category: No categories » + « No performance data ». Le
  correctif de la catégorie `'timing'` codée en dur est bien là (commentaire
  détaillé, `selectedCategory` initialisé à `null`), mais **aucun producteur
  n'émet de métrique** : `recordMetric()` n'est appelé qu'avec `'ipc'`, et rien
  ne l'a appelé pendant la session.
- **Memory** : « No memory data », alors que le bloc System Info juste en dessous
  affiche de vraies valeurs (linux, x64, Electron 32.3.3, Chrome 128, Node
  20.18.1). Le canal fonctionne ; aucun échantillonneur mémoire ne tourne.

C'est le défaut exact que vous nommez : ces deux panneaux sont indistinguables
d'« il n'y a rien à montrer ». Console et IPC Inspector, eux, sont alimentés —
donc le problème est le producteur, pas le transport.

### 4.3 — HAUTE — Les réglages de provider n'atteignent jamais le service AI

**Le motif « non câblé », en pire : il y a un champ de saisie qui ne mène nulle
part.**

`SettingsView` persiste `providers[].apiKey` dans
`localStorage['cortex:settings']` (renderer). `AIService` construit son registre
via `AIProviderRegistry.fromEnv()` — **les variables d'environnement du process
main**. Il n'existe **aucun canal `settings:*`** dans `packages/main` ni dans
l'allowlist du preload (seuls `debug:get-settings` / `debug:update-settings`
existent, sans lien).

Prouvé de bout en bout : j'ai écrit exactement ce que la UI écrit au Save
(`anthropic` activé, `apiKey: 'sk-ant-audit-probe-key'`), rechargé, puis demandé
au main process. Résultat :

```
createSession → success: false, "Provider \"anthropic\" not found"
UI            → toast « Could not start chat — Provider "anthropic" not found »
```

**L'utilisateur peut activer un provider, saisir sa clé, enregistrer — et
l'onglet AI Chat reste inutilisable, sans qu'aucun message ne relie les deux.**
Le message d'erreur ne dit pas d'aller dans les réglages, et les réglages ne
disent pas que la clé n'y sert à rien. Seul `ANTHROPIC_API_KEY` dans
l'environnement au lancement fonctionne.

Aggravant : `Workbench.tsx:383` code en dur `DEFAULT_PROVIDER = 'anthropic'`. Sur
une machine où seul Ollama est configuré, le bouton « New chat session » échoue
quand même.

À la décharge du code : l'échec est **correctement remonté** — toast explicite,
bouton Retry, aucun plantage. C'est la bonne gestion d'erreur d'un chemin
impossible à réussir depuis la UI.

### 4.4 — HAUTE — `git status` renvoie `untracked.txt` deux fois

Après « Stage All », le main process renvoie :

```json
{ "path": "untracked.txt", "status": "modified", "staged": true }
{ "path": "untracked.txt", "status": "added",    "staged": true }
```

Le panneau affiche donc « Staged Changes (3) » pour 2 fichiers réels.
C'est dans les **données**, pas le rendu.

Cause : `git-service.ts:68` `addStagedFiles()` itère `status.staged` **et**
`status.created` en poussant sans déduplication. `simple-git` place un fichier
nouvellement indexé dans les deux listes. Un `git add` d'un fichier non suivi
produit systématiquement le doublon, avec en plus un statut faux (`modified` pour
un fichier ajouté).

### 4.5 — MOYENNE — Contenu focusable dans une sidebar `aria-hidden`

`AppShell` réduit la sidebar à `w-0` sans la démonter (choix assumé : conserve le
scroll). Mais le sous-arbre n'est que `aria-hidden="true"`, **sans `inert`**.

Mesuré, sidebar réduite : **13 éléments focusables** à l'intérieur, `asideWidth:
0`, `asideInert: false`. Un parcours de 30 `Tab` depuis le header **entre deux
fois** dans le conteneur caché. Et l'interaction aboutit : focus sur `file1.ts`,
`Enter` → la barre de statut passe à « 1 file open ». **Un utilisateur clavier
ouvre un fichier depuis un panneau qu'il ne voit pas.**

`aria-hidden` sur un ancêtre d'élément focusable est une violation WCAG 4.1.2 :
le lecteur d'écran reçoit le focus sur un nœud qu'on lui a dit d'ignorer.

### 4.6 — MOYENNE — L'onglet Settings du panneau debug n'a pas de nom accessible

`DebugPanel.tsx:78` : le 5ᵉ `TabsTrigger` ne contient qu'une icône
`<FiSettings />`, sans `aria-label`. Mesuré : `tabNames: ["Console", "IPC
Inspector", "Performance", "Memory", ""]`. Invisible pour un lecteur d'écran et
inadressable par nom en test. Les autres boutons icône-seule de l'app portent
bien un `aria-label` — c'est une incohérence locale, pas une convention absente.

### 4.7 — BASSE — Violation CSP à chaque ouverture de l'Explorer

77 occurrences sur 39 sondes :

```
Refused to load the image 'data:image/gif;base64,R0lGOD…'
because it violates … "default-src 'self'"
```

Tracé : `react-dnd` (embarqué par `react-arborist`, utilisé par `FileExplorer`)
crée un GIF 1×1 en data-URI comme image de glisser-déposer. La CSP de
`src/index.html` déclare `default-src 'self'` sans `img-src`, donc les data-URI
sont refusées. Sans effet fonctionnel — mais le bruit noie les vraies erreurs
dans la console, y compris dans l'onglet Console du panneau debug.
Correctif : ajouter `img-src 'self' data:;`.

### 4.8 — BASSE — Incohérences visuelles mesurées

- **Débordement horizontal des lignes de l'arbre** : les lignes font 310 px de
  large dans un panneau de 320 px, mais 3 descendants dépassent le conteneur
  (`overflow=3` sur `01-explorer`, dans les deux thèmes). Idem `03-git`
  (`overflow=1`), et 17 dans la palette en mode commandes.
- **`treeitem` imbriqué dans `treeitem`** : chaque ligne de `FileExplorer` a un
  parent `role="treeitem"` (`parentRole: "treeitem"`). L'ARIA impose un `group`
  entre deux `treeitem`.
- **Doublons dans la palette de fichiers** : chaque entrée affiche nom puis
  chemin, ce qui donne « README.md README.md » à la racine et
  « index.ts src/index.ts » ailleurs. Incohérent selon la profondeur.
- **Doublon dans la liste des branches** : `["main", "main", "develop",
  "feature/test"]` — `loadBranches()` ajoute la branche courante *puis* `main`
  en dur.
- **Bouton « Open » de Notes désactivé en dur** : `NotesView.tsx:142`,
  `disabled` littéral avec `onClick={() => handleLoad('')}`.
- **Onglets d'éditeur sans `role="tab"`** : le bandeau d'onglets n'expose aucun
  rôle ARIA de tablist (mesuré : `tabStrip: []`).

---

## 5. Inventaire de l'incomplet

### 5.1 Non implémenté (le bouton existe, l'action est un stub)

| Élément | Détail |
|---|---|
| `BranchSelector` — changement de branche | **Coquille de démo.** `loadBranches()` renvoie `['<courante>', 'main', 'develop', 'feature/test']` en dur avec le commentaire « Pour l'instant, mock data ». `handleCheckout()` et `handleCreateBranch()` ne font qu'un `console.log`. Vérifié à l'exécution : clic sur « develop » → le libellé reste « main ». 3 TODO nommant les IPC manquants (`git.branches`, `git.checkout`, `git.createBranch`). La prop `repoPath` est reçue et ignorée (`_repoPath`). |
| Bouton « Open » de Notes | `disabled` en dur, handler appelé avec une chaîne vide. |
| Producteur de métriques Performance | `recordMetric()` n'est appelé qu'avec `'ipc'` ; le panneau prévoit 7 catégories. |
| Échantillonneur mémoire | Le canal et l'UI existent ; rien n'échantillonne. |

### 5.2 Non câblé (backend et frontend existent, rien ne les relie)

**Le motif s'est produit cinq fois selon vous. J'en trouve cinq — dont quatre ne sont pas dans votre liste.**

| # | Frontend | Backend | Chaînon manquant |
|---|---|---|---|
| 1 | `GitStashPanel.tsx` | `git-stash-handlers.ts` (main, complet) | **Zéro import.** Aucune vue ne le rend. |
| 2 | `ChatExportButton.tsx` | `chat-handlers.ts` (main, complet) | **Zéro import.** |
| 3 | `WorkspaceSwitcher.tsx` | `workspace-handlers.ts` + `workspace-ipc.ts` (schéma partagé) | **Zéro import.** |
| 4 | `SettingsView` providers | `AIService` / `AIProviderRegistry` | **Aucun canal `settings:*`.** §4.3. |
| 5 | `UsageTracking.tsx` | Requêtes SQLite fonctionnelles, garde-fous NULL corrigés | Exporté par le barrel `agents/index.ts`, **aucun consommateur** — et `BillingView` y renvoie l'utilisateur. |

Les trois premiers suivent le même schéma : le handler main est écrit et
testé, le composant renderer est écrit et testé, **et personne ne les présente à
l'utilisateur.** Trois fonctionnalités payées deux fois, livrées zéro fois.

### 5.3 Code mort (aucun appelant, aucun chemin utilisateur)

Confirmé par recherche sur tout le dépôt, hors tests, hors `coverage/`, hors
barrels :

| Fichier | Exports |
|---|---|
| `components/accessibility/accessibility-fixes.tsx` | `SkipNavLink`, `AccessibleCodeBlock`, `AccessibleFormField`, `StreamingAnnouncement`, `AppLayout`, `FileTreeNode` — **6 composants, dont ceux qui corrigeraient §4.5** |
| `components/git/GitStashPanel.tsx` | `GitStashPanel` |
| `components/chat/ChatExportButton.tsx` | `ChatExportButton` |
| `components/workspace/WorkspaceSwitcher.tsx` | `WorkspaceSwitcher` |
| `components/ui/collapsible.tsx` | `Collapsible*` (3) |
| `views/agents/AgentDetail.tsx` | `AgentDetail` + 6 utilitaires |
| `views/agents/UsageTracking.tsx` | `UsageTracking`, `getTimeRangeMs`, `generateCSV` |
| `views/editor/AutocompleteWidget.tsx` | `AutocompleteWidget` |
| `views/workspace/DocumentationViewer.tsx` | `DocumentationViewer` |
| `components/ui/avatar.tsx`, `ui/skeleton.tsx` | Primitives non consommées |

**Note sur `packages/renderer/src/views/agents/background/` :** ce répertoire
**n'existe pas**. Le second agent travaille peut-être sur un chemin renommé
depuis, ou sur une cible déjà supprimée.

**Correction d'une de mes propres erreurs :** ma première analyse classait
`WelcomeScreen`, `InteractiveTutorial`, `EditorView` et `AdvancedSearchPanel`
comme morts. C'était faux — mon détecteur ignorait les imports via barrel et les
`import()` dynamiques de `lazyNamed`. Après correction, ces quatre sont bien
vivants. Les entrées ci-dessus ont chacune été revérifiées individuellement.

---

## 6. Reste à faire, par ordre de priorité

Critère : ce qui empêche un utilisateur de travailler passe avant l'espacement.

### P0 — Bloque un utilisateur

**1. Relier les réglages de provider au service AI** — *~1 j*
Ce que c'est : ajouter des canaux `settings:get`/`settings:update`, faire lire la
config persistée par `AIProviderRegistry` en plus de l'environnement, et
réinitialiser le registre au Save. Pourquoi ça manque : le service a été écrit
autour de `fromEnv()` (correct pour un lancement CLI) et l'écran de réglages a
été construit ensuite, contre localStorage, sans que personne ne ferme la
boucle. Sans ça, **le chat AI — la raison d'être du produit — est inutilisable
sans variables d'environnement**, alors que la UI prétend le contraire.

**2. Choisir le provider par défaut d'après ce qui est disponible** — *~2 h*
Remplacer le `DEFAULT_PROVIDER = 'anthropic'` en dur par le premier provider
réellement enregistré, et exposer `ai.getProviders` sur le bridge (le service a
déjà `getAvailableProviders()`, le preload n'expose que 4 méthodes AI).
Pourquoi ça manque : valeur de développement figée. Sans ça, une installation
Ollama-only échoue avec un message qui accuse Anthropic.

**3. Dédupliquer `parseStatusFiles`** — *~1 h*
Fusionner par chemin dans `git-service.ts:58`, en gardant le statut le plus
spécifique (`added` > `modified`). Pourquoi ça manque : `status.staged` et
`status.created` de `simple-git` se recouvrent, ce que le code suppose faux.
Sans ça, le compteur de changements est faux dès qu'on indexe un fichier neuf.

**4. Faire ouvrir le panneau debug par le bouton Bug** — *~30 min*
Soit `toggleDebugMode` appelle aussi `setShowDebugPanel(true)`, soit le bouton
appelle les deux. Pourquoi ça manque : deux notions distinctes (le mode, le
panneau) partagent une seule affordance. Sans ça, le seul point d'entrée visible
du debug ne produit aucun effet visible.

### P1 — Fonctionnalité annoncée, absente

**5. Implémenter les branches Git pour de vrai** — *~1 j*
Trois IPC (`git.branches`, `git.checkout`, `git.createBranch`) plus le câblage de
`repoPath`. Pourquoi ça manque : posé en maquette avec des TODO, jamais reprise.
Sans ça, la vue Source Control **ment** : elle propose « develop » et
« feature/test » qui n'existent pas, et le clic ne fait rien.

**6. Alimenter les panneaux Performance et Memory, ou dire pourquoi ils sont
vides** — *~4 h*
Appeler `recordMetric()` depuis les chemins déjà instrumentés (rendu, base,
démarrage) et lancer un échantillonneur mémoire périodique. À défaut, remplacer
« No performance data » par la raison — le modèle `DemoNotice` d'Account convient
exactement. Pourquoi ça manque : l'UI a précédé les producteurs.

**7. Câbler les trois composants orphelins, ou les supprimer** — *~4 h*
`GitStashPanel` → vue Source Control ; `ChatExportButton` → en-tête de ChatView ;
`WorkspaceSwitcher` → header. Chacun a un handler main **complet et testé**.
Décision explicite requise : brancher ou supprimer. Les laisser tels quels
maintient trois surfaces testées que personne n'atteint.

**8. Rendre `UsageTracking` atteignable** — *~2 h*
`BillingView` renvoie déjà vers elle. Ajouter un onglet Usage à AccountPanel (ou
une entrée AI Chat) supprime la référence cassée et rend visible du travail déjà
fait et déjà corrigé (`SUM(cost)` NULL).

### P2 — Correction, accessibilité, hygiène

**9. Isoler la sidebar réduite du focus** — *~1 h*
Ajouter `inert` (ou `visibility: hidden`) quand `sidebarCollapsed`, en gardant
l'animation de largeur. Sans ça : violation WCAG 4.1.2 et un utilisateur clavier
qui agit dans l'invisible.

**10. Autoriser `data:` pour `img-src` dans la CSP** — *~15 min*
`img-src 'self' data:;` dans `src/index.html`. Élimine 77 erreurs console par
session, qui masquent les vraies.

**11. Corriger les états vides non explicatifs** — *~2 h*
`BrowserView` sur `about:blank` (ajouter un `EmptyState` avec la barre
d'adresse), « No content » de Notes, « No IPC messages » de l'IPC Inspector.
Trois régressions du principe que le reste de l'app applique déjà.

**12. Corriger la sémantique ARIA de l'arbre** — *~2 h*
Insérer un `role="group"` entre `treeitem` imbriqués ; ajouter `aria-label` à
l'onglet Settings du debug ; donner `role="tab"` aux onglets d'éditeur.

**13. Déduplication et débordements** — *~2 h*
Retirer le `main` en dur de `loadBranches`, n'afficher le chemin dans la palette
que s'il diffère du nom, corriger les 3 descendants qui dépassent dans
l'Explorer.

**14. Purger le code mort** — *~2 h*
Après décision sur le point 7 : supprimer `AgentDetail`, `AutocompleteWidget`,
`DocumentationViewer`, `collapsible`, `avatar`, `skeleton`. Cas particulier :
`accessibility-fixes.tsx` contient `SkipNavLink` et `AccessibleFormField`, qui
répondent à des défauts réels constatés ici — à brancher plutôt qu'à supprimer.

**15. Réaligner `account.spec.ts`** — *~1 h*
5 tests E2E attendent les données inventées que l'autre agent a retirées. À faire
par l'auteur de ce changement, pas ici.

---

## 7. Ce que je n'ai pas pu vérifier

À dire explicitement, plutôt que de le laisser passer pour couvert :

- **L'apparence.** Alignements, cohérence des rayons, poids typographiques,
  contrastes perçus, qualité des icônes : j'ai la géométrie et les couleurs
  calculées, pas le rendu. Les 64 PNG attendent un œil humain.
- **Les transitions.** Capturées avec `animations: 'disabled'`. Durées et
  courbes non évaluées.
- **Le streaming d'une réponse AI.** Impossible sans provider configuré (§4.3).
  `ChatView` n'a donc jamais été rendu avec un message : je n'ai pas exercé le
  correctif du fond des blocs de code à l'exécution, seulement lu le CSS.
- **Les dialogues de conflit.** `ConflictResolutionDialog` exige une divergence
  réelle avec le disque, non provoquée ici. Le dialogue de fermeture, lui, est
  vérifié : onglet sali (« ● Modified »), fermeture → 1 `role="dialog"`.
- **Le thème clair au-delà des 13 vues du rail.** Panneaux debug, dialogues et
  états peuplés capturés en sombre uniquement.

---

## 8. Ce que j'ai ajouté

Aucun code produit modifié — `layout/`, `contexts/` et les vues portent tous
l'horodatage 05:35, antérieur à mon démarrage (05:39).

```
tests/e2e/specs/view-audit.spec.ts             12 vues × 2 thèmes + états
tests/e2e/specs/states-audit.spec.ts           debug, dialogues, vues peuplées
tests/e2e/specs/a11y-focus-containment.spec.ts confinement du focus
tests/e2e/specs/branch-git-probe.spec.ts       popover de branche + doublon git
tests/e2e/specs/ai-chat-probe.spec.ts          création de session
tests/e2e/specs/settings-provider-gap.spec.ts  réglages → service AI
tests/e2e/specs/explorer-geometry.spec.ts      géométrie des lignes de l'arbre
scripts/summarize-view-audit.ts                sondes → verdicts
scripts/analyze-view-reachability.ts           atteignabilité + marqueurs de stub
screenshots/audit/                             64 PNG + 24 JSON + README
```

Les specs sont réutilisables : relancer après un correctif régénère les captures
et les sondes. `screenshots/audit/README.md` documente la procédure et les trois
pièges rencontrés (ne pas lancer `bun install` ; cliquer une icône déjà active
replie la sidebar ; les vues Account ont été recapturées après l'autre agent).

### Deux erreurs que j'ai commises et corrigées

1. **J'ai cru à un défaut de mise en page** : Playwright ne pouvait pas cliquer
   une ligne de l'arbre, le point de clic tombant sur `editor-empty-state`. J'ai
   d'abord annoncé un débordement de la sidebar. Faux : ma boucle cliquait
   l'icône Explorer alors qu'Explorer était déjà actif, ce qui **replie** la
   sidebar. Bug de ma spec, pas de l'app. Cela a toutefois mené au vrai bug §4.5.
2. **J'ai cru la palette de commandes cassée** : mon premier résumé la voyait
   vide. Elle fonctionne — 10 fichiers en mode `Cmd+P`, 17 commandes en
   `Cmd+Shift+P`, `command-palette-input` présent. Mon extrait de texte était
   tronqué avant le contenu de la palette.

Je les signale parce que la consigne était de mesurer, pas d'affirmer — et ces
deux-là auraient été deux affirmations non vérifiées de plus.
