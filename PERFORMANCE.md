# Performance Optimizations

Cortex IDE a été optimisé pour atteindre des performances de niveau production. Ce document détaille les optimisations implémentées et comment les utiliser.

## Table des matières

1. [Electron Optimizations](#electron-optimizations)
2. [Renderer Optimizations](#renderer-optimizations)
3. [Database Optimizations](#database-optimizations)
4. [IPC Optimizations](#ipc-optimizations)
5. [Bundle Optimizations](#bundle-optimizations)
6. [Performance Profiler](#performance-profiler)
7. [Best Practices](#best-practices)

---

## Electron Optimizations

### V8 Code Caching

Le cache de code V8 améliore le temps de démarrage en cachant le code JavaScript compilé.

```typescript
import { v8Cache } from './performance/v8-cache';

// Initialisation automatique au démarrage
await v8Cache.initialize();

// Obtenir des statistiques
const stats = await v8Cache.getStats();
console.log(`Cache: ${stats.totalFiles} files, ${stats.totalSize} bytes`);

// Nettoyer le cache manuellement
await v8Cache.clearCache();
```

### Memory Management

Le gestionnaire de mémoire nettoie automatiquement les ressources et force le GC quand nécessaire.

```typescript
import { memoryManager } from './performance/memory-manager';

// Démarrer la gestion de mémoire
memoryManager.start();

// Enregistrer une ressource disposable
memoryManager.register('my-resource', () => {
  // Cleanup logic
});

// Disposer une ressource
await memoryManager.dispose('my-resource');

// Forcer le garbage collection
memoryManager.forceGC();

// Obtenir des statistiques
const stats = memoryManager.getStats();
```

### Lazy Module Loading

Les modules lourds (Monaco, Xterm, etc.) sont chargés à la demande.

```typescript
import { loadMonaco, loadXterm, preloadCriticalModules } from './performance/lazy-loader';

// Précharger les modules critiques après le rendu initial
preloadCriticalModules();

// Charger Monaco Editor à la demande
const monaco = await loadMonaco();

// Charger Xterm.js quand l'utilisateur ouvre un terminal
const Terminal = await loadXterm();
```

### Process Sandboxing

Le processus renderer est sandboxé pour une meilleure sécurité et isolation:

```typescript
webPreferences: {
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  v8CacheOptions: 'code',
  backgroundThrottling: false
}
```

---

## Renderer Optimizations

### React.memo

Les composants lourds utilisent `React.memo` pour éviter les re-renders inutiles:

```typescript
export const SessionList = React.memo(({ sessions, onSelect }) => {
  // Component logic
}, (prevProps, nextProps) => {
  // Custom comparison
  return prevProps.sessions.length === nextProps.sessions.length;
});
```

### Virtual Scrolling

Pour les listes longues, utilisez le composant `VirtualList`:

```typescript
import { VirtualList } from '@/hooks/use-performance';

<VirtualList
  items={sessions}
  itemHeight={80}
  containerHeight={600}
  renderItem={(session, index) => <SessionItem session={session} />}
  overscan={5}
/>
```

### Debounce/Throttle

Optimisez les événements fréquents avec debounce et throttle:

```typescript
import { useDebounce, useThrottle } from '@/hooks/use-performance';

// Debounce search query
const debouncedQuery = useDebounce(searchQuery, 300);

// Throttle scroll handler
const throttledScroll = useThrottle(handleScroll, 100);
```

### Web Workers

Déplacez les calculs lourds dans des Web Workers:

```typescript
import { useWebWorker } from '@/hooks/use-performance';

const processData = useWebWorker((data: any[]) => {
  // Heavy computation
  return data.map(item => transform(item));
});

// Usage
const result = await processData(largeDataset);
```

### Code Splitting

Les fonctionnalités sont divisées en chunks optimaux avec React.lazy:

```typescript
const EditorView = React.lazy(() => import('./views/editor/EditorView'));
const TerminalView = React.lazy(() => import('./views/terminal/TerminalView'));

<Suspense fallback={<LoadingSpinner />}>
  <EditorView />
</Suspense>
```

---

## Database Optimizations

### WAL Mode

SQLite utilise le mode WAL (Write-Ahead Logging) pour une meilleure concurrence:

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;  -- 64MB cache
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 30000000000;  -- 30GB memory-mapped I/O
```

### Prepared Statements Cache

Les requêtes préparées sont mises en cache automatiquement:

```typescript
import { dbOptimizer } from './performance/database-optimizer';

// Obtenir un statement préparé (caché automatiquement)
const stmt = dbOptimizer.getPreparedStatement(db, 'SELECT * FROM users WHERE id = ?');
const user = stmt.get(userId);

// Statistiques du cache
const stats = dbOptimizer.getCacheStats();
```

### Batch Operations

Regroupez les insertions/updates pour de meilleures performances:

```typescript
// Démarrer un batch
dbOptimizer.startBatch();

// Ajouter des opérations
dbOptimizer.addToBatch(() => {
  db.prepare('INSERT INTO ...').run(...);
});
dbOptimizer.addToBatch(() => {
  db.prepare('UPDATE ...').run(...);
});

// Exécuter le batch dans une transaction
dbOptimizer.executeBatch(db);
```

### Indexes

Des indexes optimaux sont créés automatiquement:

```typescript
// Créer les indexes recommandés
dbOptimizer.createOptimalIndexes(db);

// Analyser la base pour le query planner
dbOptimizer.analyzeDatabase(db);

// Obtenir des statistiques
const stats = dbOptimizer.getDatabaseStats(db);
```

---

## IPC Optimizations

### Message Batching

Les messages IPC sont regroupés pour réduire l'overhead:

```typescript
import { ipcOptimizer } from './performance/ipc-optimizer';

// Envoyer un message avec batching
ipcOptimizer.sendBatched(window, 'log-update', { message: 'test' });

// Les messages sont flushés automatiquement toutes les 16ms (~60fps)
// ou immédiatement si le batch est plein (100 messages)
```

### Streaming

Pour les gros payloads, utilisez le streaming:

```typescript
// Stream automatique pour les données > 100KB
await ipcOptimizer.sendLargeData(window, 'large-dataset', bigArray);

// Stream manuel avec contrôle du chunk size
ipcOptimizer.startStream(window, 'stream-id', data, 1000);
```

### Configuration

Ajustez les paramètres selon vos besoins:

```typescript
// Délai de batching (défaut: 16ms)
ipcOptimizer.setBatchDelay(32);

// Taille max du batch (défaut: 100)
ipcOptimizer.setMaxBatchSize(200);

// Statistiques
const stats = ipcOptimizer.getStats();
```

---

## Bundle Optimizations

### Tree Shaking

Le code mort est automatiquement éliminé en production.

### Minification

Terser minifie et optimise le code JavaScript:

```javascript
terserOptions: {
  compress: {
    drop_console: true,
    drop_debugger: true,
    pure_funcs: ['console.log'],
    passes: 2
  }
}
```

### Manual Chunks

Les modules sont divisés intelligemment:

- `vendor-react`: React et React DOM
- `vendor-ui`: Composants UI (lucide-react, clsx, etc.)
- `vendor-charts`: Bibliothèques de graphiques
- `feature-*`: Fonctionnalités lazy-loaded

### Asset Optimization

- Compression des assets
- CSS code splitting
- Source maps en mode "hidden" en production
- Target ESNext pour du code moderne

---

## Performance Profiler

### Utilisation de base

```typescript
import { profiler } from './performance/profiler';

// Activer le profiler
profiler.setEnabled(true);

// Mesurer une opération
profiler.start('operation-name', 'category');
// ... do work
profiler.end('operation-name');

// Ou mesurer une fonction
await profiler.measure('fetch-data', 'ipc', async () => {
  return await fetchData();
});
```

### Obtenir des rapports

```typescript
// Rapport complet
const report = profiler.getReport();
console.log('Average IPC latency:', report.summary.avgIpcLatency);

// Métriques par catégorie
const ipcMetrics = profiler.getMetricsByCategory('ipc');

// Métriques lentes (> 100ms)
const slowOps = profiler.getSlowMetrics(100);

// Statistiques pour une métrique
const stats = profiler.getMetricStats('database:query');
console.log('Avg:', stats.avg, 'Max:', stats.max, 'Median:', stats.median);

// Exporter vers un fichier
const path = await profiler.exportReport();
```

### Événements

```typescript
// Écouter les métriques complétées
profiler.on('metric:completed', (metric) => {
  console.log(`${metric.name}: ${metric.duration}ms`);
});

// Écouter les métriques lentes
profiler.on('metric:slow', (metric) => {
  console.warn(`Slow operation: ${metric.name} (${metric.duration}ms)`);
});

// Écouter les snapshots mémoire
profiler.on('memory:snapshot', (snapshot) => {
  console.log('Heap used:', snapshot.heapUsed);
});
```

### API IPC

Le profiler est accessible depuis le renderer:

```typescript
// Obtenir un rapport de performance
const report = await window.cortex.performance.getReport();

// Obtenir des statistiques
const stats = await window.cortex.performance.getStats();

// Exporter un rapport
const path = await window.cortex.performance.exportReport();

// Nettoyer les métriques
await window.cortex.performance.clear();
```

---

## Best Practices

### Startup Performance

1. **Lazy load** les modules lourds
2. **Précharger** les modules critiques en arrière-plan
3. Utiliser le **V8 cache** pour le code compilé
4. Activer le **process sandboxing**

### Runtime Performance

1. **React.memo** sur les composants qui re-render souvent
2. **Virtual scrolling** pour les listes longues (> 100 items)
3. **Debounce** les inputs (300ms)
4. **Throttle** les scroll handlers (100ms)
5. **Web Workers** pour les calculs lourds

### Memory Management

1. **Disposer** les listeners et ressources
2. **Nettoyer** les timers et intervals
3. **Limiter** les caches (LRU)
4. **Monitorer** l'utilisation mémoire
5. **Force GC** périodiquement si nécessaire

### Database Performance

1. Utiliser des **prepared statements**
2. **Batcher** les insertions/updates
3. Créer des **indexes** sur les colonnes filtrées/triées
4. **Analyser** la base périodiquement
5. **Vacuum** occasionnellement (pas fréquemment)

### IPC Performance

1. **Batcher** les messages fréquents
2. **Streamer** les gros payloads (> 100KB)
3. Éviter les **synchronous IPC**
4. **Limiter** la fréquence des messages

### Bundle Performance

1. **Code splitting** par fonctionnalité
2. **Tree shaking** activé
3. **Minification** en production
4. **Lazy load** les routes et features
5. **Optimiser** les images et assets

---

## Monitoring en Production

### Métriques à surveiller

- **Temps de démarrage** (< 2s)
- **Memory usage** (< 500MB idle)
- **IPC latency** (< 10ms p95)
- **Database queries** (< 50ms p95)
- **Render time** (< 16ms pour 60fps)

### Outils de debugging

```bash
# Profiler V8
node --prof app.js

# CPU profiling
node --cpu-prof app.js

# Heap snapshot
node --heap-prof app.js

# Inspector
node --inspect app.js
```

### Electron DevTools

- **Performance panel**: profiling, frame rate
- **Memory panel**: heap snapshots, allocation timeline
- **Network panel**: IPC messages, resources

---

## Troubleshooting

### App lente au démarrage

1. Vérifier les modules chargés: `npx source-map-explorer dist/`
2. Activer V8 cache: vérifier `v8Cache.getStats()`
3. Précharger en arrière-plan: `preloadCriticalModules()`

### Memory leaks

1. Profiler la mémoire: `memoryManager.getStats()`
2. Vérifier les listeners: chercher `addEventListener` sans `removeEventListener`
3. Heap snapshot: Chrome DevTools > Memory > Take snapshot

### IPC lent

1. Vérifier le batching: `ipcOptimizer.getStats()`
2. Réduire la fréquence des messages
3. Utiliser le streaming pour gros payloads

### Database lent

1. Analyser les queries: `EXPLAIN QUERY PLAN ...`
2. Ajouter des indexes: `dbOptimizer.createOptimalIndexes()`
3. Vérifier le cache: `dbOptimizer.getCacheStats()`

---

## Changelog des optimisations

### v0.1.0 (Initial)
- ✅ V8 code caching
- ✅ Lazy module loading
- ✅ React.memo sur composants lourds
- ✅ Virtual scrolling
- ✅ Code splitting
- ✅ Web Workers support
- ✅ Debounce/throttle hooks
- ✅ SQLite WAL mode
- ✅ Prepared statements cache
- ✅ Batch operations
- ✅ Database indexes
- ✅ IPC batching
- ✅ IPC streaming
- ✅ Memory manager
- ✅ Performance profiler
- ✅ Bundle optimizations
- ✅ Terser minification

---

Pour plus d'informations, consultez le code source dans `packages/main/src/performance/` et `packages/renderer/src/hooks/use-performance.ts`.
