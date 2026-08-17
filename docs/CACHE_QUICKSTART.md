# Cache & Compaction Quick Start Guide

## Installation

The cache and compaction system is built into `@cortex-ide/ai-engine`. No additional installation required.

## Basic Usage

### 1. Simple Caching

```typescript
import { PromptCacheManager, CacheLevel, AnthropicProvider } from '@cortex-ide/ai-engine';

// Create cache manager
const cacheManager = new PromptCacheManager({
  maxSize: 500_000, // 500k tokens
  defaultTTL: 3600_000, // 1 hour
});

// Initialize provider with cache
const provider = new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY,
  cacheManager,
});

// Use with caching enabled
const response = await provider.chat(messages, {
  useCache: true,
  cacheLevel: CacheLevel.L1_SYSTEM,
});

// Check cache stats
const stats = cacheManager.getStats();
console.log(`Saved $${stats.costReduction.toFixed(2)}`);
```

### 2. Automatic Compaction

```typescript
import { AdaptiveCompactor, ProviderTokenCounter } from '@cortex-ide/ai-engine';

const compactor = new AdaptiveCompactor();
const tokenCounter = new ProviderTokenCounter('anthropic');

// Compact automatically based on budget
const result = compactor.compact(
  largeCodeContext,
  currentTokens,
  targetTokens,
  (text) => tokenCounter.count(text)
);

console.log(`Reduced from ${result.originalTokens} to ${result.compactedTokens} tokens`);
```

### 3. Full Orchestration (Recommended)

```typescript
import { CacheOrchestrator, PromptCacheManager } from '@cortex-ide/ai-engine';

const cacheManager = new PromptCacheManager();

const orchestrator = new CacheOrchestrator({
  provider: 'anthropic',
  model: 'claude-opus-4.8',
  maxTokens: 200_000,
  cacheManager,
  enableCompaction: true,
});

// Process messages with automatic optimization
const result = await orchestrator.processMessages(messages);

// Use optimized messages
const response = await provider.chat(result.messages);
```

## Configuration Examples

### Development (Fast iteration, no caching)

```typescript
const cacheManager = new PromptCacheManager({
  maxSize: 200_000,
  defaultTTL: 300_000, // 5 minutes
  persistToDisk: false,
});
```

### Production (Aggressive caching)

```typescript
const cacheManager = new PromptCacheManager({
  maxSize: 1_000_000, // 1M tokens
  defaultTTL: 7200_000, // 2 hours
  persistToDisk: true,
  cacheDir: '~/.cortex-ide/cache',
});
```

## Monitoring

```typescript
// Get real-time statistics
const stats = orchestrator.getStats();

console.log({
  hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
  tokensSaved: stats.tokensSaved.toLocaleString(),
  costReduction: `$${stats.costReduction.toFixed(2)}`,
  cacheUtilization: `${(stats.utilization * 100).toFixed(1)}%`,
});
```

## Cache Invalidation

```typescript
import { CacheInvalidationWatcher } from '@cortex-ide/ai-engine';

const watcher = new CacheInvalidationWatcher();

// Invalidate on file changes
watcher.watch('/path/to/src', () => {
  cacheManager.invalidate({ level: CacheLevel.L3_FILE });
});

// Invalidate on git changes
exec('git diff --name-only', (err, stdout) => {
  if (stdout.includes('package.json')) {
    cacheManager.invalidate({ level: CacheLevel.L2_PROJECT });
  }
});
```

## Best Practices

1. **Use L1 cache for system prompts** - they never change
2. **Enable disk persistence in production** - survives restarts
3. **Monitor hit rates** - aim for >70% hit rate
4. **Set up invalidation watchers** - keep cache fresh
5. **Use orchestrator for automatic optimization** - simplest integration

## Performance Benchmarks

| Metric | Without Cache | With Cache | Improvement |
|--------|--------------|------------|-------------|
| Tokens per request | 185k | 45k | **75.7%** ↓ |
| Cost per 1M tokens | $15 | $3.75 | **$11.25** saved |
| Response time | 8.5s | 2.1s | **75.3%** ↑ |

## Troubleshooting

**Cache not working?**
```typescript
// Check if provider supports caching
console.log(cacheManager.supportsNativeCache('anthropic')); // true

// Debug cache operations
const cached = cacheManager.getCachedPrompt(provider, model, hash, level);
console.log('Cache result:', cached);
```

**Too much compaction?**
```typescript
// Increase threshold
const orchestrator = new CacheOrchestrator({
  compactionThreshold: 300_000, // Higher = less aggressive
});
```

## Examples

See `packages/ai-engine/src/examples/` for:
- `basic-cache.ts` - Simple caching example
- `compaction-demo.ts` - Compaction strategies
- `persistence-demo.ts` - Disk persistence and invalidation
- `orchestrator-demo.ts` - Full integration

## API Reference

> **Lien retiré le 17/08/2026** : cette ligne pointait vers
> `CACHE_IMPLEMENTATION.md`, qui n'existe nulle part dans le dépôt
> (`find . -name 'CACHE_IMPLEMENTATION.md'` → aucun résultat). Rien n'indique
> que ce document ait été écrit.

Référence à jour : le code source des modules de cache, et les démos listées
ci-dessus.
