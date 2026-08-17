# Installation

Ce guide détaille les différentes méthodes d'installation de Cortex IDE.

## Méthode 1: Depuis les sources (Recommandé)

### Avec Bun (Recommandé)

[Bun](https://bun.sh) est 3-5x plus rapide que npm/pnpm pour l'installation des dépendances.

```bash
# Installer Bun si nécessaire
curl -fsSL https://bun.sh/install | bash

# Clone et build
git clone https://github.com/cortex-ide/cortex-ide.git
cd cortex-ide
bun install
bunx playwright install chromium
bun run build
```

### Avec npm/yarn/pnpm

```bash
git clone https://github.com/cortex-ide/cortex-ide.git
cd cortex-ide
npm install
npx playwright install chromium
npm run build
```

## Méthode 2: Binaires pré-compilés

::: warning
Les binaires sont en développement. Utilisez la méthode depuis les sources pour l'instant.
:::

Les binaires pour macOS, Windows et Linux seront disponibles prochainement:

- **macOS**: `.dmg` (Intel + Apple Silicon)
- **Windows**: `.exe` installer
- **Linux**: `.AppImage`, `.deb`, `.rpm`

## Configuration de l'environnement

### Variables d'environnement

Créez un fichier `.env` à la racine du projet:

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Grok (xAI)
GROK_API_KEY=xai-...

# Optionnel: Ollama local
OLLAMA_HOST=http://localhost:11434
```

### Configuration avancée

Pour une configuration avancée, éditez `~/.cortex/config.json`:

```json
{
  "workspace": {
    "defaultPath": "~/projects",
    "recentWorkspaces": []
  },
  "ai": {
    "defaultProvider": "anthropic",
    "defaultModel": "claude-opus-4.8",
    "maxTokens": 300000,
    "temperature": 0.7
  },
  "editor": {
    "theme": "dark",
    "fontSize": 14,
    "tabSize": 2
  }
}
```

## Vérification de l'installation

Vérifiez que tout fonctionne correctement:

```bash
# Test TypeScript
bun run typecheck

# Test linting
bun run lint

# Test E2E (optionnel)
bun run test:e2e
```

Si tous les tests passent, vous êtes prêt! 🎉

## Démarrage

### Mode développement

Pour développer Cortex:

```bash
# Terminal 1: Build en watch mode
bun run dev

# Terminal 2: Lancer Electron
bun run start
```

### Mode production

Pour créer un build de production:

```bash
# Build optimisé
bun run build

# Créer les binaires
bun run dist

# Binaires disponibles dans dist/
ls -la dist/
```

## Mise à jour

Pour mettre à jour Cortex vers la dernière version:

```bash
cd cortex-ide
git pull origin main
bun install
bun run build
```

## Désinstallation

Pour désinstaller complètement Cortex:

```bash
# Supprimer le repository
rm -rf cortex-ide

# Supprimer les données utilisateur
rm -rf ~/.cortex

# Supprimer les logs
rm -rf ~/Library/Logs/cortex-ide  # macOS
rm -rf ~/.config/cortex-ide        # Linux
```

## Dépannage

### Erreur: "Cannot find module electron"

```bash
# Réinstaller les dépendances
rm -rf node_modules
bun install
```

### Erreur: "Playwright browser not found"

```bash
# Installer les browsers Playwright
bunx playwright install chromium
```

### Erreur: Build TypeScript

```bash
# Nettoyer et rebuild
bun run clean
bun run build
```

### L'application ne démarre pas

1. Vérifiez que le build est complet: `ls -la packages/*/dist`
2. Vérifiez les logs: `~/.cortex/logs/main.log`
3. Essayez en mode dev: `bun run dev` puis `bun run start`

## Support

Besoin d'aide avec l'installation?

- 📖 [FAQ](/guide/faq)
- 💬 [GitHub Discussions](https://github.com/cortex-ide/cortex-ide/discussions)
- 🐛 [Issues](https://github.com/cortex-ide/cortex-ide/issues)
