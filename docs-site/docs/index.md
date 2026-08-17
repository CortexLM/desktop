---
layout: home

hero:
  name: Cortex IDE
  text: Orchestrateur d'agents IA
  tagline: Gérez vos missions complexes de coding avec intelligence et performance
  image:
    src: /hero.svg
    alt: Cortex IDE
  actions:
    - theme: brand
      text: Commencer
      link: /guide/getting-started
    - theme: alt
      text: GitHub
      link: https://github.com/cortex-ide/cortex-ide

features:
  - icon: 🎯
    title: Mission Orchestration
    details: Workflows multi-étapes avec state machine, gestion de dépendances et progress tracking pour des missions complexes.
  
  - icon: 📊
    title: Benchmarking Intégré
    details: Comparez automatiquement les providers IA (GPT, Claude, Grok, Ollama) sur l'accuracy, la latence et les coûts.
  
  - icon: 🧠
    title: Context Optimization
    details: Smart chunking avec analyse de dépendances pour gérer efficacement les codebases 300k+ tokens.
  
  - icon: 🚀
    title: Multi-Provider
    details: Support natif d'OpenAI, Anthropic, Grok et Ollama avec presets intelligents (fastest, smartest, cheapest).
  
  - icon: 🔌
    title: MCP Extensions
    details: Marketplace intégré pour découvrir et installer des extensions Model Context Protocol.
  
  - icon: 🎨
    title: Interface Moderne
    details: UI React avec TanStack Query, Zustand et Radix UI pour une expérience utilisateur fluide.
---

## Quick Start

::: code-group

```bash [bun]
# Clone le repository
git clone https://github.com/cortex-ide/cortex-ide.git
cd cortex-ide

# Installer les dépendances
bun install

# Build
bun run build

# Démarrer en dev
bun run dev

# Dans un autre terminal
bun run start
```

```bash [npm]
# Clone le repository
git clone https://github.com/cortex-ide/cortex-ide.git
cd cortex-ide

# Installer les dépendances
npm install

# Build
npm run build

# Démarrer en dev
npm run dev

# Dans un autre terminal
npm run start
```

:::

## Pourquoi Cortex est différent

Cortex n'est **pas** un concurrent de Cursor ou VSCode. C'est l'orchestrateur d'agents que vous utilisez **avec** votre IDE préféré pour gérer des missions complexes.

### ✅ Ce que Cortex fait bien

- Orchestrer plusieurs agents en parallèle pour des tâches indépendantes
- Gérer des missions longues avec pause/resume et progress tracking
- Benchmarker automatiquement différents providers
- Optimiser le contexte pour les très grandes codebases
- Intégrer des extensions MCP pour étendre les capacités

### ❌ Ce que Cortex ne fait pas

- Autocomplete inline (utilisez Cursor/Copilot)
- Git UI complète (utilisez votre git client)
- Terminal complet (utilisez votre terminal)
- Remplacer votre IDE actuel

## Philosophie: Keep It Simple

Après un refactoring majeur en août 2026, Cortex suit le principe **KISS**:

- **Une solution simple qui marche** > 10 solutions sophistiquées inutilisées
- **Mesurer l'impact réel** avant de construire
- **Supprimer la complexité inutile** sans pitié
- **Tester avec TDD** pour garantir la qualité

Nous avons supprimé **93% du code complexe** (5,000 lignes) pour nous concentrer sur ce qui apporte vraiment de la valeur.

## Stack Technologique

<div class="tech-stack">

**Frontend**
- React 18 + TypeScript
- TanStack Query
- Zustand
- Radix UI + Tailwind CSS

**Backend**
- Electron 32+
- Better-SQLite3
- Node-pty
- Simple-git

**AI & Agents**
- Multi-provider (OpenAI, Anthropic, Grok, Ollama)
- Smart chunking avec dépendances
- Simple agent queue

</div>

## Community

Rejoignez notre communauté pour obtenir de l'aide et contribuer au projet:

- [GitHub Discussions](https://github.com/cortex-ide/cortex-ide/discussions)
- [Discord](https://discord.gg/cortex-ide) (à venir)
- [Twitter](https://twitter.com/cortexide)

<style>
.tech-stack {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin: 2rem 0;
}
</style>
