# 📚 Documentation Index - AI Engine 2.0

Guide de navigation pour toute la documentation de la mise à jour AI Providers 2026.

## 🚀 Démarrage Rapide

**Nouveau dans le projet ?** Commencez par ces fichiers dans cet ordre :

1. **[QUICK_OVERVIEW.md](QUICK_OVERVIEW.md)** 📊  
   Vue d'ensemble visuelle en 5 minutes

2. **[DEVELOPER_BRIEFING.md](DEVELOPER_BRIEFING.md)** 👨‍💻  
   Briefing pour développeurs avec use cases

3. **[AI_MODELS_2026.md](AI_MODELS_2026.md)** 📖  
   Guide complet des modèles et utilisation

---

## 📖 Documentation Complète

### Pour les Développeurs

| Fichier | Description | Quand l'utiliser |
|---------|-------------|------------------|
| **[README.md](README.md)** | Documentation du package | Installation, API reference |
| **[AI_MODELS_2026.md](AI_MODELS_2026.md)** | Guide des modèles 2026 | Choisir un modèle, comprendre les presets |
| **[DEVELOPER_BRIEFING.md](DEVELOPER_BRIEFING.md)** | Briefing développeur | Intégration, troubleshooting |
| **[examples/usage-2026.ts](examples/usage-2026.ts)** | 8 exemples pratiques | Apprendre par l'exemple |

### Pour le Management/Review

| Fichier | Description | Audience |
|---------|-------------|----------|
| **[QUICK_OVERVIEW.md](QUICK_OVERVIEW.md)** | Vue d'ensemble visuelle | Managers, Tech Leads |
| **[CHANGELOG.md](CHANGELOG.md)** | Historique des versions | Release Managers |

### Pour les Mainteneurs

| Fichier | Description | Usage |
|---------|-------------|-------|
| **[tests/model-presets.test.ts](tests/model-presets.test.ts)** | Suite de tests | Validation, CI/CD |

> **Liens retirés le 17/08/2026** : `UPDATE_SUMMARY.md`, `FILES_CHANGED.md` et
> `CHECKLIST.md` étaient référencés ici (et plus bas dans ce fichier) mais
> n'existent pas dans le dépôt. Ils n'ont pas été supprimés : rien n'indique
> qu'ils aient jamais été écrits.

---

## 🎯 Par Cas d'Usage

### Je veux comprendre rapidement les changements
→ [QUICK_OVERVIEW.md](QUICK_OVERVIEW.md) (5 min)

### Je veux migrer mon code
→ [DEVELOPER_BRIEFING.md](DEVELOPER_BRIEFING.md) + [scripts/migrate-to-2026.js](scripts/migrate-to-2026.js)

### Je veux choisir le bon modèle
→ [AI_MODELS_2026.md](AI_MODELS_2026.md) section "Model Presets"

### Je veux voir des exemples de code
→ [examples/usage-2026.ts](examples/usage-2026.ts)

### Je veux intégrer l'UI
→ [renderer/src/components/ai/README.md](../renderer/src/components/ai/README.md)

### Je veux valider les changements
→ [tests/model-presets.test.ts](tests/model-presets.test.ts), et
`cd packages/ai-engine && bunx vitest run` pour la suite complète.

### Je veux faire un code review
→ Il n'y a pas d'historique de version dans ce dépôt (pas de git), donc pas de
liste de fichiers modifiés à jour. Lisez `src/` directement.

---

## 📁 Structure de la Documentation

```
packages/ai-engine/
├── 📊 QUICK_OVERVIEW.md          Vue d'ensemble visuelle
├── 📖 README.md                  Documentation du package
├── 📝 CHANGELOG.md               Historique des versions
├── 📚 AI_MODELS_2026.md          Guide complet des modèles
├── 👨‍💻 DEVELOPER_BRIEFING.md      Briefing développeur
├── 🗂️ INDEX.md                   Ce fichier
│
├── src/
│   ├── model-presets.ts          ⭐ Nouveau - Catalogue de modèles
│   ├── providers/
│   │   ├── openai-provider.ts    ✏️ Modifié - gpt-4.5-turbo
│   │   ├── anthropic-provider.ts ✏️ Modifié - claude-opus-4.8
│   │   └── openrouter-provider.ts✏️ Modifié - nouveaux modèles
│   ├── registry.ts               ✏️ Modifié - presets support
│   └── index.ts                  ✏️ Modifié - exports
│
├── tests/
│   └── model-presets.test.ts     ⭐ Nouveau - Suite de tests
│
├── examples/
│   └── usage-2026.ts             ⭐ Nouveau - 8 exemples
│
└── scripts/
    └── migrate-to-2026.js        ⭐ Nouveau - Migration auto

packages/renderer/src/components/ai/
├── ModelSelector.tsx             ⭐ Nouveau - UI component
└── README.md                     ⭐ Nouveau - Doc component
```

---

## 🔍 Documentation par Rôle

### Développeur Frontend
1. [ModelSelector README](../renderer/src/components/ai/README.md)
2. [examples/usage-2026.ts](examples/usage-2026.ts) - Exemples 6-8
3. [AI_MODELS_2026.md](AI_MODELS_2026.md) - Section "Via UI"

### Développeur Backend
1. [DEVELOPER_BRIEFING.md](DEVELOPER_BRIEFING.md)
2. [AI_MODELS_2026.md](AI_MODELS_2026.md) - Section "Via Registry"
3. [examples/usage-2026.ts](examples/usage-2026.ts) - Exemples 1-5

### DevOps / SRE
1. [CHANGELOG.md](CHANGELOG.md) - Breaking changes
2. [DEVELOPER_BRIEFING.md](DEVELOPER_BRIEFING.md) - Migration
3. [scripts/migrate-to-2026.js](scripts/migrate-to-2026.js)

### QA / Testeur
1. [tests/model-presets.test.ts](tests/model-presets.test.ts)
2. [DEVELOPER_BRIEFING.md](DEVELOPER_BRIEFING.md) - Troubleshooting

### Product Manager
1. [QUICK_OVERVIEW.md](QUICK_OVERVIEW.md)
2. [CHANGELOG.md](CHANGELOG.md)

### Tech Lead / Architect
1. [DEVELOPER_BRIEFING.md](DEVELOPER_BRIEFING.md)
2. [README.md](README.md) - API reference

---

## 📊 Métriques

Vérifié le 17/08/2026 :

| Métrique | Valeur | Vérification |
|----------|--------|--------------|
| Presets créés | 4 | `fastest`, `smartest`, `cheapest`, `reasoning` dans `src/model-presets.ts` |
| Modèles catalogués | 10 | `grep -c "id: '" src/model-presets.ts` |
| Exemples fournis | 8 | `examples/usage-2026.ts` |
| Tests (ce fichier) | 178 lignes | `wc -l tests/model-presets.test.ts` |

> **Chiffres retirés le 17/08/2026** : « Total fichiers 15 (6 modifiés + 9
> nouveaux) », « ~2300 lignes de documentation », « ~900 lignes de code » et
> « Providers mis à jour 4/4 (100%) ». Les trois premiers décrivent un diff, et
> il n'y a pas d'historique de version dans ce dépôt pour le reconstituer.
> « Modèles catalogués » disait 11 pour 10 entrées réelles, et « Tests écrits
> 195 lignes » pour un fichier de 178 lignes.
>
> Pour la couverture réelle du package, exécuter
> `cd packages/ai-engine && bunx vitest run --coverage` plutôt que de citer un
> nombre figé.

---

## 🔗 Liens Externes

### Documentation des Providers

- [OpenAI API Docs](https://platform.openai.com/docs)
- [Anthropic API Docs](https://docs.anthropic.com/)
- [OpenRouter Docs](https://openrouter.ai/docs)

### Modèles

- [GPT-4.5 Turbo](https://platform.openai.com/docs/models/gpt-4-5-turbo)
- [Claude Opus 4.8](https://www.anthropic.com/claude)
- [Gemini 2.5 Pro](https://ai.google.dev/)
- [DeepSeek R1](https://github.com/deepseek-ai/DeepSeek-R1)

---

## ✅ Checklist de Lecture

Pour une compréhension complète, lisez dans cet ordre :

- [ ] [QUICK_OVERVIEW.md](QUICK_OVERVIEW.md) - 5 minutes
- [ ] [DEVELOPER_BRIEFING.md](DEVELOPER_BRIEFING.md) - 10 minutes
- [ ] [AI_MODELS_2026.md](AI_MODELS_2026.md) - 15 minutes
- [ ] [examples/usage-2026.ts](examples/usage-2026.ts) - 20 minutes
- [ ] [README.md](README.md) - API reference

**Temps total** : ~1 heure pour une compréhension complète

---

## 🆘 Besoin d'aide ?

### Par problème

| Problème | Solution |
|----------|----------|
| Modèle introuvable | [DEVELOPER_BRIEFING.md](DEVELOPER_BRIEFING.md) - Troubleshooting |
| Coûts élevés | [AI_MODELS_2026.md](AI_MODELS_2026.md) - Preset "cheapest" |
| Performance lente | [AI_MODELS_2026.md](AI_MODELS_2026.md) - Preset "fastest" |
| Migration | [scripts/migrate-to-2026.js](scripts/migrate-to-2026.js) |
| UI Integration | [renderer/components/ai/README.md](../renderer/src/components/ai/README.md) |
| Tests failing | [tests/model-presets.test.ts](tests/model-presets.test.ts) |

---

**Version**: 2.0.0  
**Dernière mise à jour**: 2026-08-16  
**Status**: ✅ Complet
