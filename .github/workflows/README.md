# GitHub Actions Workflows - Monitoring System

Ce dossier contient un système de monitoring automatique 24/7 pour Cortex IDE.

## 📋 Workflows Disponibles

### 1. **Continuous Monitoring** (`continuous-monitoring.yml`)
- **Fréquence:** Toutes les 15 minutes
- **Objectif:** Surveillance continue de la santé du projet
- **Checks:**
  - ✅ Build compilation
  - ✅ TypeScript type checking
  - ⚠️ Linting
  - 📊 Métriques de code (LOC, fichiers, tailles)
- **Outputs:** `MONITORING_LOG.md`
- **Alertes:** Crée une issue GitHub si le build ou TypeCheck échoue

### 2. **E2E Monitoring** (`e2e-monitoring.yml`)
- **Fréquence:** Toutes les heures
- **Objectif:** Tests end-to-end automatisés avec Playwright
- **Checks:**
  - 🧪 Suite complète de tests E2E
  - 📸 Screenshots et traces
  - ♿ Tests d'accessibilité (axe-core)
- **Outputs:** `E2E_MONITORING_LOG.md`
- **Artifacts:** Rapports HTML, screenshots, traces
- **Alertes:** Issue + commentaire PR si échec

### 3. **Security Audit** (`security-audit.yml`)
- **Fréquence:** Quotidien (2h UTC)
- **Objectif:** Audit de sécurité complet
- **Checks:**
  - 🔒 Audit des dépendances (vulnérabilités)
  - 🔑 Détection de secrets hardcodés
  - 🛡️ Vérification des best practices
  - 📦 Analyse des dépendances obsolètes
- **Outputs:** `SECURITY_LOG.md` + rapport détaillé
- **Alertes:** Issue critique si secrets détectés ou +10 vulnérabilités

### 4. **Performance Benchmarks** (`performance-benchmarks.yml`)
- **Fréquence:** Quotidien (3h UTC)
- **Objectif:** Métriques de performance
- **Checks:**
  - ⏱️ Temps de build
  - 📦 Taille des bundles (main, renderer, preload)
  - 📊 Complexité du code
  - 🚀 Estimation du temps de démarrage
  - 📝 Performance TypeScript
- **Outputs:** `PERFORMANCE_LOG.md` + rapport détaillé
- **Alertes:** Issue si régression détectée (build >120s, bundle >10MB)

## 🎯 Logs de Monitoring

Tous les logs sont automatiquement mis à jour dans le repo :

- `MONITORING_LOG.md` - Santé globale (15min)
- `E2E_MONITORING_LOG.md` - Tests E2E (1h)
- `SECURITY_LOG.md` - Sécurité (quotidien)
- `PERFORMANCE_LOG.md` - Performance (quotidien)

## 🚨 Système d'Alertes

Le système crée automatiquement des issues GitHub pour :

- ❌ **Build ou TypeCheck échoué** (label: `monitoring-alert`)
- 🧪 **Tests E2E échoués** (label: `e2e-failure`)
- 🚨 **Alertes de sécurité critiques** (label: `security-alert`)
- ⚠️ **Régressions de performance** (label: `performance-regression`)

Les issues existantes ne sont pas dupliquées - une seule issue ouverte par type.

## 🔄 Déclenchement Manuel

Tous les workflows peuvent être déclenchés manuellement via :
```bash
# Via l'interface GitHub Actions → "Run workflow"
# Ou via GitHub CLI :
gh workflow run continuous-monitoring.yml
gh workflow run e2e-monitoring.yml
gh workflow run security-audit.yml
gh workflow run performance-benchmarks.yml
```

## 📊 Métriques Suivies

### Monitoring Continu (15min)
- Build status
- TypeScript errors
- Lint warnings
- Lines of Code (LOC)

### E2E Tests (1h)
- Test pass/fail rate
- Screenshots
- Accessibility violations
- Performance traces

### Security (quotidien)
- Dependency vulnerabilities
- Hardcoded secrets
- Security best practices
- Outdated packages

### Performance (quotidien)
- Build time (threshold: 60s)
- Bundle sizes (renderer < 5MB)
- TypeScript compilation time
- Code complexity metrics

## 🛠️ Configuration

### Secrets Requis (optionnels)
Aucun secret requis pour le monitoring de base. Les workflows fonctionnent immédiatement.

### Personnalisation

Modifiez les seuils dans les workflows :
```yaml
# continuous-monitoring.yml
- cron: '*/15 * * * *'  # Fréquence

# performance-benchmarks.yml
BUILD_TIME_THRESHOLD: 60  # secondes
BUNDLE_SIZE_THRESHOLD: 5120  # KB

# security-audit.yml
VULN_THRESHOLD: 10  # nombre de vulnérabilités
```

## 📈 Rapports

Les rapports détaillés sont disponibles :
- **Artifacts GitHub Actions** (7-90 jours de rétention)
- **Issues GitHub** (alertes persistantes)
- **Logs markdown** (historique complet dans le repo)

## 🎭 CI/CD Integration

Ces workflows s'intègrent avec :
- ✅ Push sur `main`/`master`
- ✅ Pull Requests
- ✅ Déclenchement manuel
- ✅ Cron schedules

Les commits de logs incluent `[skip ci]` pour éviter les boucles infinies.

## 📝 Notes

- Les workflows utilisent `continue-on-error: true` pour capturer les métriques même en cas d'échec
- Les logs sont commit automatiquement (requiert permissions `contents: write`)
- Les issues utilisent des labels pour éviter les doublons
- Cache Bun activé pour accélérer les builds
