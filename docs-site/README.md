# Cortex IDE Documentation

Site de documentation officiel pour Cortex IDE, construit avec VitePress.

## 🚀 Quick Start

```bash
# Install dependencies
bun install

# Dev server with hot reload
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview
```

## 📁 Structure

```
docs-site/
├── docs/
│   ├── .vitepress/
│   │   └── config.ts        # VitePress configuration
│   ├── index.md             # Homepage
│   ├── guide/               # User guide
│   │   ├── getting-started.md
│   │   ├── installation.md
│   │   ├── quick-start.md
│   │   ├── why-cortex.md
│   │   └── features/
│   │       ├── mission-orchestration.md
│   │       ├── benchmarking.md
│   │       ├── context-optimization.md
│   │       ├── multi-provider.md
│   │       └── mcp-extensions.md
│   ├── developer/           # Developer guide
│   │   ├── contributing.md
│   │   ├── architecture.md
│   │   ├── testing.md
│   │   └── packages/
│   ├── api/                 # API reference
│   │   ├── index.md
│   │   ├── ai-engine.md
│   │   ├── ipc-channels.md
│   │   └── database.md
│   └── architecture/        # Architecture docs
│       ├── index.md
│       ├── principles.md
│       ├── decisions.md
│       └── refactoring.md
└── package.json
```

## 🎨 Customization

### Configuration

Éditez `.vitepress/config.ts` pour modifier:
- Navigation
- Sidebar
- Theme
- Search
- Footer

### Styles

Les styles personnalisés peuvent être ajoutés dans `.vitepress/theme/custom.css`.

## 📝 Writing Documentation

### Markdown Features

VitePress supporte des fonctionnalités Markdown avancées:

#### Containers

```markdown
::: tip
Ceci est un tip
:::

::: warning
Ceci est un warning
:::

::: danger
Ceci est un danger
:::
```

#### Code Groups

```markdown
::: code-group

```bash [bun]
bun install
```

```bash [npm]
npm install
```

:::
```

#### Custom Containers

```markdown
::: details Click to see more
Contenu caché
:::
```

### Frontmatter

Chaque page peut avoir du frontmatter YAML:

```yaml
---
title: Page Title
description: Page description
---
```

## 🚢 Deployment

### Méthode 1: GitHub Pages (Automatique)

Le workflow GitHub Actions déploie automatiquement sur chaque push vers `main`:

1. Push vers `main`
2. GitHub Actions build le site
3. Déploiement automatique sur GitHub Pages
4. Accessible à `https://cortex-ide.github.io/cortex-ide/`

### Méthode 2: Manuel avec gh-pages

```bash
# Build et deploy
bun run deploy
```

### Méthode 3: Custom domain

1. Ajoutez un fichier `docs/public/CNAME`:
   ```
   docs.cortex-ide.dev
   ```

2. Configurez les DNS records:
   ```
   A     185.199.108.153
   A     185.199.109.153
   A     185.199.110.153
   A     185.199.111.153
   CNAME docs.cortex-ide.dev -> cortex-ide.github.io
   ```

3. Dans GitHub Settings > Pages:
   - Source: Deploy from a branch
   - Branch: gh-pages / root
   - Custom domain: docs.cortex-ide.dev

## 🔍 Search

La recherche locale est activée par défaut. Pour utiliser Algolia DocSearch:

```typescript
// .vitepress/config.ts
export default defineConfig({
  themeConfig: {
    search: {
      provider: 'algolia',
      options: {
        appId: 'YOUR_APP_ID',
        apiKey: 'YOUR_API_KEY',
        indexName: 'cortex-ide'
      }
    }
  }
})
```

## 🌐 Internationalization

Pour ajouter des traductions:

```typescript
// .vitepress/config.ts
export default defineConfig({
  locales: {
    root: {
      label: 'Français',
      lang: 'fr-FR'
    },
    en: {
      label: 'English',
      lang: 'en-US',
      themeConfig: {
        // English nav/sidebar
      }
    }
  }
})
```

## 📊 Analytics

### Google Analytics

```typescript
// .vitepress/config.ts
export default defineConfig({
  head: [
    [
      'script',
      { async: '', src: 'https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID' }
    ],
    [
      'script',
      {},
      `window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'GA_MEASUREMENT_ID');`
    ]
  ]
})
```

## 🤝 Contributing

Pour contribuer à la documentation:

1. Fork le repository
2. Créez une branche: `git checkout -b docs/my-improvement`
3. Éditez les fichiers dans `docs-site/docs/`
4. Testez localement: `bun run dev`
5. Commitez: `git commit -m "docs: improve installation guide"`
6. Push: `git push origin docs/my-improvement`
7. Ouvrez une Pull Request

## 📝 TODO

- [ ] Ajouter plus de screenshots/GIFs
- [ ] Créer des tutoriels interactifs
- [ ] Ajouter des exemples de code complets
- [ ] Traduire en anglais
- [ ] Ajouter Algolia DocSearch
- [ ] Créer un changelog
- [ ] Ajouter une section FAQ

## 🔗 Links

- [VitePress Documentation](https://vitepress.dev/)
- [Cortex IDE Repository](https://github.com/cortex-ide/cortex-ide)
- [GitHub Discussions](https://github.com/cortex-ide/cortex-ide/discussions)
