# Testing Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies
```bash
bun install
```

### 2. Run Your First Test
```bash
# Run all unit tests
bun run test

# Run with coverage
bun run test:coverage

# Watch mode for development
bun run test:watch
```

### 3. Write Your First Test

Create `src/my-feature.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { build, createMockIPC } from '@cortex-ide/test-utils';

describe('My Feature', () => {
  it('should work correctly', async () => {
    // Use test builders
    const user = build.user().withAdmin().build();
    
    // Use mock IPC
    const ipc = createMockIPC();
    ipc.on('test:action', () => ({ success: true }));
    
    const result = await ipc.invoke('test:action', { userId: user.id });
    
    expect(result.success).toBe(true);
  });
});
```

### 4. Run Integration Tests
```bash
bun run test:integration
```

### 5. Run E2E Tests
```bash
# Build first
bun run build

# Run E2E
bun run test:e2e
```

## 📚 Next Steps

- Read full documentation: `TESTING_IMPROVEMENTS.md`
- Explore test utilities: `packages/test-utils/README.md`
- Check example tests in `tests/` directories
- Review CI/CD pipelines: `.github/workflows/`

## 🎯 Common Tasks

### Check Coverage
```bash
bun run test:coverage
open coverage/index.html
```

### Run Performance Benchmarks
```bash
# Benchmarks + budget gate in one command. Must be one command: the checker
# scores the JSON this run writes to tests/performance/results/, and refuses
# results older than 10 minutes rather than scoring a previous run's.
bun run test:performance:budgets

# Benchmarks only (each still asserts its own maxMeanMs)
bun run test:performance
```

Note: `vitest bench --run` finds nothing here — there are no `*.bench.ts` files.
The benchmarks are ordinary vitest tests driven by `tests/performance/bench-harness.ts`,
so that `vitest run` executes them instead of skipping them.

### Update Visual Baselines
```bash
bun tests/visual-regression/baseline-manager.ts update
```

### Debug Failing Test
```bash
# Run in UI mode
bun run test:ui

# Run specific test file
bun run vitest src/my-feature.test.ts

# Debug mode
bun run vitest --inspect-brk src/my-feature.test.ts
```

## 💡 Pro Tips

1. **Use builders** instead of manually creating test data
2. **Mock at boundaries** (IPC, FS, API) not internal functions  
3. **Test behaviors** not implementation details
4. **Keep tests fast** - unit tests should be < 100ms each
5. **Use custom matchers** for better assertions

## 🆘 Troubleshooting

### Tests won't run
- Make sure dependencies are installed: `bun install`
- Check Node/Bun version compatibility

### Coverage too low
- Write more unit tests for uncovered code
- Check coverage report: `coverage/index.html`

### E2E tests failing
- Ensure app is built: `bun run build`
- Check if display server is running (Linux)
- Review test output and screenshots

### Performance budgets exceeded
- Review benchmark results
- Profile slow operations
- Consider optimization or updating budgets

---

**Quick Start Version:** 1.0.0  
**For Full Docs:** See `TESTING_IMPROVEMENTS.md`
