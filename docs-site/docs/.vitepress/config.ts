import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Cortex IDE',
  description: 'L\'orchestrateur d\'agents IA pour missions complexes',
  
  lang: 'fr-FR',
  
  themeConfig: {
    logo: '/logo.svg',
    
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/' },
      { text: 'Architecture', link: '/architecture/' },
      { text: 'GitHub', link: 'https://github.com/cortex-ide/cortex-ide' }
    ],

    // BARRE LATÉRALE : n'y mettre que des pages qui existent.
    //
    // Corrigé le 17/08/2026. Cette barre listait 35 entrées dont **24 ne
    // correspondaient à aucun fichier** — tout `/guide/usage/*` (5),
    // `/guide/features/multi-provider`, `/guide/features/mcp-extensions`, tout
    // `/developer/*` sauf `contributing` (11), `/api/*` sauf l'index (4) et
    // `/architecture/principles` + `/architecture/decisions`. Un visiteur
    // cliquant sur l'une de ces entrées obtenait un 404.
    //
    // Le contrôle qui aurait dû l'attraper était désactivé : voir
    // `ignoreDeadLinks` en bas de ce fichier.
    //
    // Les 13 pages réellement présentes sous `docs-site/docs/` :
    //   index.md, guide/{getting-started,installation,quick-start,why-cortex,faq}.md,
    //   guide/features/{mission-orchestration,benchmarking,context-optimization}.md,
    //   developer/contributing.md, api/index.md,
    //   architecture/{index,refactoring}.md
    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'Pourquoi Cortex?', link: '/guide/why-cortex' },
            { text: 'FAQ', link: '/guide/faq' }
          ]
        },
        {
          text: 'Fonctionnalités',
          items: [
            { text: 'Mission Orchestration', link: '/guide/features/mission-orchestration' },
            { text: 'Benchmarking', link: '/guide/features/benchmarking' },
            { text: 'Context Optimization', link: '/guide/features/context-optimization' }
          ]
        }
      ],

      '/developer/': [
        {
          text: 'Guide du Développeur',
          items: [
            { text: 'Contributing', link: '/developer/contributing' }
          ]
        }
      ],

      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Vue d\'ensemble', link: '/api/' }
          ]
        }
      ],

      '/architecture/': [
        {
          text: 'Architecture',
          items: [
            { text: 'Vue d\'ensemble', link: '/architecture/' },
            { text: 'Refactoring Story', link: '/architecture/refactoring' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/cortex-ide/cortex-ide' }
    ],

    search: {
      provider: 'local'
    },

    editLink: {
      pattern: 'https://github.com/cortex-ide/cortex-ide/edit/main/docs-site/docs/:path',
      text: 'Éditer cette page sur GitHub'
    },

    footer: {
      message: 'Publié sous licence MIT',
      copyright: 'Copyright © 2026 Cortex IDE Team'
    },

    lastUpdated: {
      text: 'Dernière mise à jour',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'short'
      }
    }
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    },
    lineNumbers: true
  },

  // `ignoreDeadLinks` était à `true`, ce qui est exactement pourquoi 24 entrées
  // de barre latérale et une dizaine de liens en fin de page ont pu pointer vers
  // des pages inexistantes sans que le build s'en plaigne jamais.
  //
  // Passé à `false` le 17/08/2026 : un lien mort casse désormais
  // `bun run docs:build`. C'est le seul mécanisme qui empêche la
  // réapparition du problème — le vérifier à la main ne tient pas dans le temps.
  ignoreDeadLinks: false
})
