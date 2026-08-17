# FAQ

Questions fréquemment posées sur Cortex IDE.

## Général

### Qu'est-ce que Cortex IDE?

Cortex IDE est un orchestrateur d'agents IA pour missions complexes de coding. Il se spécialise dans:
- Mission orchestration multi-étapes
- Benchmarking de providers IA
- Context optimization pour grandes codebases

### Est-ce que Cortex remplace VSCode/Cursor?

Non. Cortex **complète** votre IDE actuel avec des capacités d'orchestration que les IDE traditionnels n'offrent pas. Utilisez VSCode/Cursor pour l'édition, Cortex pour l'orchestration.

### Quels providers IA sont supportés?

- OpenAI (GPT-4.5-turbo, o1, o3-mini)
- Anthropic (Claude Opus 4.8, Sonnet 4.8)
- Grok (xAI 2.5-fast)
- Ollama (local, gratuit)

### Cortex est-il open source?

Oui, Cortex est publié sous licence MIT.

## Installation & Setup

### Quels sont les prérequis?

- Node.js 18+ ou Bun 1.0+
- Git
- Clé API pour au moins un provider IA

### Comment installer Cortex?

```bash
git clone https://github.com/cortex-ide/cortex-ide.git
cd cortex-ide
bun install
bun run build
bun run start
```

Voir le [guide d'installation complet](/guide/installation).

### Où stocker mes clés API?

Créez un fichier `.env` à la racine:
```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

## Utilisation

### Comment créer une mission?

1. Cliquez sur **New Mission**
2. Ajoutez des features
3. Définissez les dépendances
4. Cliquez **Start**

Voir le [guide Mission Orchestration](/guide/features/mission-orchestration).

### Puis-je utiliser Ollama (local)?

Oui! Configurez Ollama:
```bash
# Installer Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull un modèle
ollama pull llama3.1

# Dans Cortex, sélectionnez preset "Cheapest"
```

### Comment benchmarker les providers?

1. Ouvrez **Benchmarks**
2. Créez un nouveau benchmark
3. Configurez les providers à comparer
4. Lancez le benchmark

Résultats disponibles en JSON/Markdown/HTML.

## Problèmes Courants

### "Provider API key missing"

Ajoutez votre clé API dans Settings ou `.env`.

### L'application ne démarre pas

```bash
# Nettoyer et rebuild
bun run clean
bun run build
bun run start
```

### Tests E2E échouent

```bash
# Réinstaller Playwright
bunx playwright install chromium

# Relancer les tests
bun run test:e2e
```

### Performance lente

- Activez le **Smart Chunking** dans Settings
- Réduisez le budget de tokens
- Utilisez un provider plus rapide (GPT-4.5-turbo)

## Développement

### Comment contribuer?

Consultez le [Contributing Guide](/developer/contributing).

### Où sont les tests?

- Tests unitaires: `packages/*/src/**/__tests__/`
- Tests E2E: `tests/e2e/specs/`

### Comment lancer les tests?

```bash
# Tests unitaires
bun test

# Tests E2E
bun run test:e2e
```

## Support

### Où obtenir de l'aide?

- 📖 [Documentation](/)
- 💬 [GitHub Discussions](https://github.com/cortex-ide/cortex-ide/discussions)
- 🐛 [Signaler un bug](https://github.com/cortex-ide/cortex-ide/issues)

### Cortex est-il maintenu activement?

Oui, le projet est activement maintenu. Consultez le [GitHub repository](https://github.com/cortex-ide/cortex-ide) pour l'activité récente.
