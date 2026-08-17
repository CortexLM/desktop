# Getting Started

Bienvenue dans Cortex IDE! Ce guide vous aidera à installer et à utiliser l'orchestrateur d'agents IA pour vos missions complexes de coding.

## Qu'est-ce que Cortex IDE?

Cortex IDE est un **orchestrateur d'agents IA** focalisé sur les missions complexes de coding. Contrairement aux IDE traditionnels avec autocomplete, Cortex se spécialise dans:

- 🎯 **Mission Orchestration** - Workflows multi-étapes avec state machine
- 📊 **Benchmarking Intégré** - Comparer providers, optimiser coûts et qualité
- 🧠 **Context Optimization** - Stratégies intelligentes pour large codebase (300k+ tokens)

## Prérequis

Avant de commencer, assurez-vous d'avoir:

- **Node.js** 18+ ou **Bun** 1.0+
- **Git**
- **Un éditeur de code** (VSCode, Cursor, etc.)
- **Clé API** pour au moins un provider IA (OpenAI, Anthropic, Grok, ou Ollama local)

## Installation rapide

::: code-group

```bash [bun]
# Clone le repository
git clone https://github.com/cortex-ide/cortex-ide.git
cd cortex-ide

# Installer les dépendances
bun install

# Installer les browsers Playwright (pour tests)
bunx playwright install chromium

# Build tous les packages
bun run build

# Démarrer en dev
bun run dev
```

```bash [npm]
# Clone le repository
git clone https://github.com/cortex-ide/cortex-ide.git
cd cortex-ide

# Installer les dépendances
npm install

# Installer les browsers Playwright (pour tests)
npx playwright install chromium

# Build tous les packages
npm run build

# Démarrer en dev
npm run dev
```

:::

## Lancer l'application

Dans un nouveau terminal:

```bash
bun run start
```

L'application Electron devrait se lancer avec l'interface principale.

## Configuration des clés API

Au premier lancement, vous devrez configurer vos clés API:

1. Ouvrez **Settings** (⌘+, sur Mac, Ctrl+, sur Windows/Linux)
2. Naviguez vers **AI Providers**
3. Ajoutez vos clés API:

```
OpenAI: sk-...
Anthropic: sk-ant-...
Grok: xai-...
```

::: tip
Vous pouvez aussi utiliser un fichier `.env` à la racine:
```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GROK_API_KEY=xai-...
```
:::

## Premier agent

Créez votre premier agent IA:

1. Ouvrez un workspace (File > Open Workspace)
2. Cliquez sur **New Chat** dans la sidebar
3. Choisissez un preset:
   - **Fastest** (GPT-4.5-turbo)
   - **Smartest** (Claude Opus 4.8)
   - **Cheapest** (Ollama local)
4. Tapez votre première requête:

```
Analyse ce codebase et suggère des améliorations de performance
```

## Prochaines étapes

<div class="next-steps">

**[Installation détaillée →](/guide/installation)**
Configurez Cortex pour votre environnement

**[Quick Start Tutorial →](/guide/quick-start)**
Tutoriel interactif de 10 minutes

**[Fonctionnalités →](/guide/features/mission-orchestration)**
Découvrez toutes les capacités de Cortex

</div>

## Besoin d'aide?

- 📖 [Documentation complète](/)
- 💬 [GitHub Discussions](https://github.com/cortex-ide/cortex-ide/discussions)
- 🐛 [Signaler un bug](https://github.com/cortex-ide/cortex-ide/issues)

<style>
.next-steps {
  display: grid;
  gap: 1rem;
  margin: 2rem 0;
}

.next-steps a {
  display: block;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  text-decoration: none;
  transition: border-color 0.2s;
}

.next-steps a:hover {
  border-color: var(--vp-c-brand);
}
</style>
