# Quality Reports Directory

Ce dossier contient les rapports d'analyse de qualité du code pour Cortex IDE.

## Fichiers Générés

- `jscpd-report.json` - Rapport de duplication de code (jscpd)
- `eslint-report.json` - Violations ESLint (complexité, longueur, etc.)
- `file-metrics.json` - Métriques détaillées par fichier
- `summary.json` - Résumé agrégé des métriques

## Regénérer les Rapports

```bash
# Analyse complète
npm run quality:check

# Ou manuellement:
node scripts/analyze-metrics.cjs
npx jscpd packages --format typescript --output quality-reports
npx eslint packages --format json > quality-reports/eslint-report.json
madge --circular --extensions ts,tsx packages/
```

## Métriques Suivies

- **Complexité cyclomatique**: max 10 par fonction
- **Longueur de fonction**: max 50 lignes
- **Longueur de fichier**: max 300 lignes
- **Duplication**: < 5%
- **Densité commentaires**: 15-20%
- **Dépendances circulaires**: 0

## Historique

- 2026-08-16: Analyse initiale + refactoring git-service.ts
