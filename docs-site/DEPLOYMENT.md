# Documentation Site Deployment Guide

Ce document explique comment déployer le site de documentation Cortex IDE sur GitHub Pages.

## 🚀 Quick Deploy

Le site se déploie automatiquement sur GitHub Pages à chaque push vers `main` dans le dossier `docs-site/`.

## Configuration DNS (pour docs.cortex-ide.dev)

### 1. Ajouter le fichier CNAME

Créez `docs-site/docs/public/CNAME`:
```
docs.cortex-ide.dev
```

### 2. Configurer les DNS Records

Chez votre registrar DNS, ajoutez:

```
Type  Name                    Value
----  ----                    -----
A     docs.cortex-ide.dev     185.199.108.153
A     docs.cortex-ide.dev     185.199.109.153
A     docs.cortex-ide.dev     185.199.110.153
A     docs.cortex-ide.dev     185.199.111.153
```

Ou avec CNAME:
```
CNAME docs.cortex-ide.dev     cortex-ide.github.io
```

### 3. Activer dans GitHub Settings

1. Allez dans **Settings > Pages**
2. Source: **Deploy from a branch**
3. Branch: **gh-pages** / **root**
4. Custom domain: **docs.cortex-ide.dev**
5. Cochez **Enforce HTTPS**

### 4. Vérification

Attendez 5-10 minutes pour la propagation DNS, puis visitez:
- https://docs.cortex-ide.dev

## 📝 Workflow GitHub Actions

Le workflow `.github/workflows/deploy-docs.yml` gère le déploiement automatique:

```yaml
name: Deploy Documentation

on:
  push:
    branches: [main]
    paths: ['docs-site/**']
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - Checkout
      - Setup Bun
      - Install dependencies
      - Build VitePress
      - Upload artifact
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - Deploy to GitHub Pages
```

## 🔧 Build Local

Pour tester le build en local:

```bash
cd docs-site
bun run build
bun run preview
```

Le site sera accessible sur http://localhost:4173

## 📊 Vérifier le Déploiement

Après un push:

1. Allez dans **Actions** sur GitHub
2. Vérifiez que le workflow **Deploy Documentation** passe
3. Visitez le site pour confirmer les changements

## 🐛 Troubleshooting

### Le workflow échoue

Vérifiez les logs dans **Actions** > dernier workflow.

### Le site n'affiche pas les changements

1. Vider le cache du navigateur
2. Attendre 5-10 minutes pour le déploiement
3. Vérifier que le workflow a bien passé

### Custom domain ne fonctionne pas

1. Vérifiez les DNS records avec `dig docs.cortex-ide.dev`
2. Attendez 24-48h pour propagation DNS complète
3. Vérifiez le fichier `CNAME` dans la branche `gh-pages`

## 📦 Structure Déployée

```
docs.cortex-ide.dev/
├── /                    # Homepage
├── /guide/              # User guide
├── /developer/          # Developer docs
├── /api/                # API reference
└── /architecture/       # Architecture docs
```

## 🔄 Updates

Pour mettre à jour la documentation:

1. Éditez les fichiers dans `docs-site/docs/`
2. Testez localement: `bun run dev`
3. Commitez et pushez vers `main`
4. Le déploiement est automatique

Pas besoin de builder manuellement ou pousser vers `gh-pages` - GitHub Actions s'en charge.
