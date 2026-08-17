# Visual Testing Documentation

## Overview

Ce système de test visuel capture automatiquement des screenshots de tous les composants et vues de Cortex IDE pour validation visuelle et détection de régressions.

## Structure

```
screenshots/
├── index.html                    # Rapport HTML interactif
├── components/                   # Screenshots de composants isolés
├── storybook/                    # Documentation style Storybook
├── views/                        # Screenshots des vues principales
└── comparison/                   # Comparaisons avant/après
```

## Commandes

### Capture complète
```bash
# Capture tous les screenshots (dark + light, tous viewports)
bun run screenshots:capture

# Ou via Playwright directement
bun playwright test tests/visual/
```

### Tests spécifiques
```bash
# Seulement les vues principales
bun playwright test tests/visual/visual-regression.spec.ts

# Seulement les composants isolés
bun playwright test tests/visual/component-isolation.spec.ts

# Seulement la documentation Storybook
bun playwright test tests/visual/storybook-screenshots.spec.ts
```

### Options avancées
```bash
# Mode headed (voir l'exécution)
bun playwright test tests/visual/ --headed

# Mode debug
bun playwright test tests/visual/ --debug

# Mode UI interactif
bun playwright test tests/visual/ --ui

# Tests parallèles désactivés (plus stable)
bun playwright test tests/visual/ --workers=1
```

## Catégories de Screenshots

### 1. Application Shell
- Layout principal (dark/light)
- Barre de titre et contrôles
- Navigation principale

### 2. Vues Principales

#### Git Panel
- État par défaut
- Avec changements
- Dialog de commit
- Historique
- Branches
- Diff viewer

#### Editor
- Vue par défaut
- Avec fichier ouvert
- Autocomplete active
- Multi-fichiers
- File explorer

#### Terminal
- Vue simple
- Sortie avec couleurs
- Grille divisée (split)
- Multiple tabs

#### AI Chat
- État vide
- Avec messages
- État de chargement
- État d'erreur
- Model selector ouvert

<!-- Section « Background Agents » retirée (août 2026) : les 4 composants
     (liste, détail, resource monitor, queue viewer) ont été supprimés du dépôt
     avec le backend qu'ils affichaient. Voir DIFFERENTIATION.md §2. -->

#### Automations
- Liste (vide/remplie)
- Éditeur (nouveau/édition)
- Logs viewer
- Trigger config
- Action config

#### Extensions & MCP
- MCP Marketplace
- Extensions installées
- Configuration MCP
- Tools viewer

#### Account & Settings
- Billing view
- Team view
- Usage tracking

### 3. Debug Panel
- Console
- Memory monitor
- Performance metrics
- IPC inspector
- Settings

### 4. Composants UI

Tous les composants de base dans tous leurs états:
- Buttons (primary, secondary, ghost, danger, disabled, loading)
- Inputs (empty, filled, focused, error, disabled)
- Dialogs/Modals (open, closed, small, large)
- Selects/Dropdowns (closed, open, disabled)
- Tabs (active, inactive, disabled)
- Progress bars (0%, 25%, 50%, 75%, 100%)
- Spinners (small, medium, large)
- Tooltips (visible, hidden)
- Badges (all variants)
- Avatars (all sizes)
- Accordions (open, closed)
- Checkboxes (unchecked, checked, disabled)

### 5. États Spéciaux

#### Error States
- Error boundary
- Network errors
- Permission errors
- Generic errors

#### Loading States
- Initial app loading
- Panel loading
- Skeleton screens

#### Notifications
- Update notification
- Success toast
- Error toast
- Info toast
- Warning toast

### 6. Responsive
Screenshots à différentes résolutions:
- Desktop (1400x900)
- Laptop (1280x720)
- Wide (1920x1080)

## Convention de Nommage

Format: `{component}__{theme}__{state}__{viewport}.png`

Exemples:
- `git-panel__dark__default__desktop.png`
- `ai-chat__light__loading__laptop.png`
- `button__dark__hover__desktop.png`

## Rapport HTML

Le rapport HTML généré (`screenshots/index.html`) offre:

### Features
- **Vue d'ensemble**: Stats totales des screenshots
- **Organisation par catégorie**: Views, Components, Storybook
- **Filtres interactifs**: 
  - Par thème (dark/light)
  - Par viewport (desktop/laptop/wide)
  - Voir tout
- **Modal fullscreen**: Clic sur image pour agrandir
- **Métadonnées**: Theme, état, viewport pour chaque screenshot

### Navigation
- Cliquer sur une image pour l'agrandir
- `ESC` pour fermer le modal
- Boutons de filtre pour filtrer par critère

## Comparaison avec Paper Designs

### Process de Validation

1. **Capture des screenshots**
```bash
bun run screenshots:capture
```

2. **Ouvrir le rapport**
```bash
open screenshots/index.html
```

3. **Comparer avec Paper**
- Ouvrir les designs Paper Cortex V3
- Comparer visuellement chaque composant
- Noter les différences dans `comparison/differences.md`

4. **Identifier les incohérences**
- Spacing/padding différent
- Couleurs non conformes
- Typography incorrecte
- Missing states
- Alignment issues

### Checklist de Validation

#### Design Tokens
- [ ] Couleurs correspondent au design system
- [ ] Typography (font-family, sizes, weights)
- [ ] Spacing system (margins, paddings)
- [ ] Border radius values
- [ ] Shadow values

#### Components
- [ ] Tous les états sont présents (hover, active, disabled, etc.)
- [ ] Interactions visuelles correctes
- [ ] Animations/transitions
- [ ] Icons corrects
- [ ] Responsive behavior

#### Layout
- [ ] Alignement correct
- [ ] Proportions respectées
- [ ] Grid/flex layout correct
- [ ] Overflow handling

#### Accessibility
- [ ] Contrast ratios suffisants
- [ ] Focus states visibles
- [ ] Sizes des touch targets (mobile)

## Test de Non-Régression

### Première Baseline
```bash
# Créer la baseline de référence
bun run screenshots:capture
mv screenshots screenshots-baseline
```

### Comparaisons Futures
```bash
# Après modifications
bun run screenshots:capture

# Comparer avec baseline (nécessite imageMagick)
./scripts/compare-screenshots.sh
```

### Workflow CI/CD
```yaml
# .github/workflows/visual-regression.yml
name: Visual Regression Tests

on: [pull_request]

jobs:
  visual-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run build
      - run: bun run screenshots:capture
      - uses: actions/upload-artifact@v3
        with:
          name: screenshots
          path: screenshots/
```

## Troubleshooting

### L'app ne se lance pas
```bash
# Vérifier que l'app est buildée
bun run build

# Tester le lancement manuel
bun run dev
```

### Screenshots vides ou noirs
```bash
# Augmenter les délais d'attente
# Dans les specs, modifier waitForTimeout(2000) -> waitForTimeout(5000)
```

### Composants non trouvés
```bash
# Vérifier les sélecteurs CSS
# Ajouter data-testid aux composants
```

### Thème ne change pas
```bash
# Vérifier que data-theme est bien appliqué
# Ajouter plus de délai après setTheme()
```

## Roadmap

### Phase 1 ✅
- [x] Setup Playwright pour Electron
- [x] Tests de regression visuels
- [x] Tests composants isolés
- [x] Documentation Storybook
- [x] Rapport HTML interactif

### Phase 2 (À venir)
- [ ] Comparaison automatique (pixel diff)
- [ ] Integration avec Paper MCP
- [ ] Screenshot annotations
- [ ] Export vers Figma
- [ ] A/B testing visuel
- [ ] Performance metrics (paint time, etc.)

### Phase 3 (À venir)
- [ ] AI-powered visual testing
- [ ] Auto-detect regressions
- [ ] Suggest design improvements
- [ ] Generate design tokens from screenshots

## Scripts Utiles

```bash
# Package.json scripts
{
  "scripts": {
    "screenshots:capture": "bun scripts/capture-screenshots.ts",
    "screenshots:view": "open screenshots/index.html",
    "screenshots:clean": "rm -rf screenshots/*",
    "screenshots:baseline": "mv screenshots screenshots-baseline",
    "screenshots:compare": "./scripts/compare-screenshots.sh"
  }
}
```

## Intégration Continue

Le système peut être intégré dans le pipeline CI/CD pour:
1. Détecter automatiquement les régressions visuelles
2. Bloquer les PRs avec changements visuels non approuvés
3. Générer des rapports de comparaison avant/après
4. Archiver les screenshots de chaque release

## Contact & Support

Pour questions ou issues:
- Voir les logs de Playwright: `test-results/`
- Consulter les traces: `bun playwright show-trace`
- Debug mode: `bun playwright test --debug`
