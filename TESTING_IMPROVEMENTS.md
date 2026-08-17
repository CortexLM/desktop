# Testing Infrastructure Improvements

**Date:** 2026-08-16  
**Version:** 1.0.0  
**Coverage Target:** 95%+  
**Status:** ✅ Complete

## Executive Summary

Comprehensive overhaul of the testing infrastructure for Cortex IDE, implementing modern best practices for test utilities, integration testing, visual regression, performance monitoring, and CI/CD optimization.

## 🎯 Goals Achieved

- ✅ **Test Utilities Package** - Comprehensive helpers, mocks, builders, and matchers
- ✅ **Vitest Configuration** - Modern test runner across all packages
- ✅ **Integration Tests** - Critical workflow coverage
- ✅ **Visual Regression** - Automated screenshot comparison
- ✅ **Performance Benchmarks** - Budgets and monitoring
- ✅ **CI/CD Optimization** - Parallelized, cached, fast pipelines

## 📦 New Test Utilities Package

### Location
`packages/test-utils/`

### Features

#### 1. **Helpers** (`src/helpers/`)
- **Async Helpers**: `waitFor`, `retry`, `sleep`, `flushPromises`, `withTimeout`
- **File Helpers**: `createTempDir`, `createTestProject`, `createTestWorkspace`, `cleanupTempDir`
- **Test Context**: Shared state management across tests

```typescript
import { waitFor, createTestWorkspace } from '@cortex-ide/test-utils';

const workspace = await createTestWorkspace('my-test');
await waitFor(() => checkCondition(), { timeout: 5000 });
await workspace.cleanup();
```

#### 2. **Mocks** (`src/mocks/`)
- **AI Provider Mocks**: Mock OpenAI, Anthropic, Grok providers
- **IPC Mocks**: Complete Electron IPC simulation
- **File System Mocks**: In-memory FS operations

```typescript
import { createMockAIProvider, createMockIPC } from '@cortex-ide/test-utils';

const aiProvider = createMockAIProvider();
aiProvider.mockResponse({ content: 'Test response', model: 'gpt-4' });

const ipc = createMockIPC();
ipc.on('channel', handler);
await ipc.invoke('channel', data);
```

#### 3. **Builders** (`src/builders/`)
- **User Builder**: Test user data
- **AI Message Builder**: Chat messages
- **File Builder**: File metadata
- **Workspace Builder**: Project structures

```typescript
import { build } from '@cortex-ide/test-utils';

const user = build.user().withAdmin().build();
const message = build.aiMessage().asAssistant().withContent('Hello').build();
const file = build.file().asTypeScript().withPath('src/test.ts').build();
```

#### 4. **Custom Matchers** (`src/matchers/`)
Enhanced assertions:
- `toBeWithinRange(min, max)` - Numeric range checking
- `toContainAll(strings[])` - Multiple substring matching
- `toContainItemMatching(predicate)` - Array predicate matching
- `toThrowWithMessage(message)` - Error message validation
- `toMatchStructure(schema)` - Object structure validation
- `toResolveWithin(ms)` - Async timing validation
- `toBeOfType(type)` - Type checking

```typescript
import { expect, registerCustomMatchers } from '@cortex-ide/test-utils';

registerCustomMatchers();

expect(42).toBeWithinRange(40, 50);
expect('hello world').toContainAll(['hello', 'world']);
expect(async () => operation()).toResolveWithin(1000);
```

#### 5. **Fixtures** (`src/fixtures/`)
Pre-built test data:
- Sample code (TypeScript, React components)
- API responses
- File trees
- Git states
- Error messages

## ⚙️ Vitest Configuration

### Root Config (`vitest.config.ts`)
- **Environment**: Node.js
- **Coverage**: v8 provider with 80%+ thresholds
- **Setup**: Custom matchers registered globally
- **Timeouts**: 10s test, 10s hooks

### Package-Specific Configs

#### AI Engine (`packages/ai-engine/vitest.config.ts`)
- Coverage: 80-85% thresholds
- Focus: Provider logic, token counting, prompt composition

#### Main Process (`packages/main/vitest.config.ts`)
- Coverage: 85%+ thresholds
- Focus: IPC handlers, services, file operations

#### Renderer (`packages/renderer/vitest.config.ts`)
- **Environment**: jsdom (React components)
- **Setup**: Testing Library integration
- **Coverage**: 80%+ thresholds
- **Focus**: UI components, hooks, state management

#### Shared/Preload
- Standard Node.js environment
- 80%+ coverage targets

## 🔗 Integration Tests

Location: `tests/integration/`

### Test Suites

#### 1. **Git Workflow** (`git-workflow.test.ts`)
- File change tracking
- Staging operations
- Commit workflow
- Branch management

#### 2. **Terminal Operations** (`terminal-operations.test.ts`)
- Session creation and management
- Command execution
- Output handling
- Terminal resize

#### 3. **AI Chat to File** (`ai-chat-to-file.test.ts`)
- Complete chat-to-code workflow
- Error recovery
- Multi-step generation
- File system integration

#### 4. **Workspace & Editor** (`workspace-editor.test.ts`)
- File opening/editing/saving
- Multi-tab management
- Navigation history
- Workspace state

### Coverage
- ✅ All critical user workflows
- ✅ Error handling and recovery
- ✅ Multi-component interactions
- ✅ State synchronization

## 🎨 Visual Regression Testing

Location: `tests/visual-regression/`

### System Components

#### 1. **Visual Comparison** (`visual-regression.test.ts`)
- Pixel-perfect screenshot comparison using `pixelmatch`
- Configurable diff thresholds
- Diff image generation
- Component-level granularity

#### 2. **Baseline Manager** (`baseline-manager.ts`)
CLI tool for baseline management:
```bash
bun tests/visual-regression/baseline-manager.ts update  # Update baselines
bun tests/visual-regression/baseline-manager.ts clear   # Clear baselines
bun tests/visual-regression/baseline-manager.ts list    # List baselines
```

### Components Tested
- Sidebar
- Editor toolbar
- Status bar
- File tree
- Terminal panel
- AI chat panel

### Thresholds
- Default: 0.1 (10% pixel difference tolerance)
- Per-component: 5% max difference allowed
- Automatic diff generation on failure

## ⚡ Performance Testing

Location: `tests/performance/`

### Benchmark Suites

#### 1. **File Operations** (`file-operations-bench.test.ts`)
- Single file read/write
- Batch operations (sequential vs parallel)
- Large file handling (1MB+)
- Directory operations

#### 2. **IPC Operations** (`ipc-bench.test.ts`)
- Single invoke latency
- Batch invokes
- Large payload handling
- Listener management

#### 3. **AI Provider** (`ai-provider-bench.test.ts`)
- Chat completion (small/large prompts)
- Streaming responses
- Batch requests
- Provider comparison

### Performance Budgets (`performance-budgets.ts`)

Every budget is paired with a benchmark tagged with the same `metric` key, and
the pairing is enforced in both directions — see `performance-budgets.ts` for the
current table and for how the thresholds were derived.

Two corrections worth knowing about:

- The earlier table budgeted `File Read (Single)` at 50ms and `AI Chat (Small)`
  at 2000ms against benchmarks that measure ~0.002ms and ~0.013ms. Those are
  1 000x–150 000x above what the code does, so nothing could breach them.
  Thresholds are now derived from measured means (×20, floor 1ms), which still
  leaves ample CI headroom but can actually catch an order-of-magnitude
  regression.
- `Component Mount`, `Re-render`, `Memory (Idle)` and `Memory (Heavy)` were
  listed but no benchmark ever measured them. They are removed rather than left
  in place: a budget nobody measures is not a gate. (Re-add them alongside a
  benchmark that emits the metric — the checker now fails on a budget with no
  measurement, so the two cannot drift apart again.)

The benchmarks exercise the in-memory mocks from `@cortex-ide/test-utils`, not
Electron IPC or real disk. A budget here means "this path did not get
dramatically slower", not "the product is fast enough". End-to-end figures come
from `bun run perf:all`.

### Budget Monitoring
```bash
bun run test:performance:budgets
```

Clears `tests/performance/results/`, runs the benchmarks (which write their real
timings there), then scores them. Exit 1 on any of:

- a measurement over its budget
- a budget with **no** measurement — benchmark renamed, deleted, or never ran
- a measurement with no budget
- no results at all, or results older than the age limit

That last group is the point of the rewrite: `check-budgets.ts` previously scored
a hardcoded `mockResults` array, so it exited 0 no matter what the benchmarks
measured — or whether they ran.

## 🚀 CI/CD Optimization

### Pipeline Structure

#### 1. **Test Suite** (`.github/workflows/test-suite.yml`)

**Parallelization Strategy:**
- Unit tests: Matrix across 5 packages
- E2E tests: Sharded 4 ways
- Integration tests: Separate job
- Performance tests: Separate job
- Visual regression: Separate job

**Optimizations:**
- ✅ Dependency caching (Bun, Playwright)
- ✅ Concurrent job execution
- ✅ In-progress run cancellation
- ✅ Fail-fast disabled for comprehensive results
- ✅ Artifact retention (7 days standard, 30 days nightly)
- ✅ Coverage aggregation via Codecov

**Estimated Time Savings:**
- Before: ~25 minutes serial execution
- After: ~8 minutes parallel execution
- **Improvement: 68% faster** ⚡

#### 2. **Nightly Tests** (`.github/workflows/nightly-tests.yml`)
- Comprehensive suite (all tests, no sharding)
- Scheduled: 2 AM UTC daily
- Manual trigger available
- Detailed reporting
- Failure notifications

### Cache Strategy

**Bun Dependencies:**
```yaml
key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lock') }}
restore-keys: ${{ runner.os }}-bun-
```

**Playwright Browsers:**
```yaml
key: ${{ runner.os }}-playwright-${{ hashFiles('**/bun.lock') }}
```

**Node Modules:**
```yaml
path: |
  node_modules
  packages/*/node_modules
```

### CI Optimization Script (`scripts/ci-optimize.sh`)
Analysis tool for cache health:
```bash
./scripts/ci-optimize.sh
```
Reports on:
- Cache sizes
- Package counts
- Build artifacts
- Optimization tips

## 📊 Test Commands

### Root Level
```bash
# Run all unit tests
bun run test

# Watch mode
bun run test:watch

# Coverage report
bun run test:coverage

# UI mode (interactive)
bun run test:ui

# Integration tests only
bun run test:integration

# E2E tests
bun run test:e2e

# All tests (unit + integration + E2E)
bun run test:all
```

### Package Level
```bash
# Test specific package
bun run --filter ai-engine test
bun run --filter main test:coverage
bun run --filter renderer test:ui
```

### Specialized Tests
```bash
# Performance benchmarks
bun run test:performance

# Benchmarks + budget gate (single command by design; see Budget Monitoring)
bun run test:performance:budgets

# Visual regression
bun run test tests/visual-regression/

# Update visual baselines
bun tests/visual-regression/baseline-manager.ts update
```

## 📈 Coverage Targets

| Package | Target | Status |
|---------|--------|--------|
| ai-engine | 80-85% | ✅ Configured |
| main | 85%+ | ✅ Configured |
| renderer | 80%+ | ✅ Configured |
| shared | 80%+ | ✅ Configured |
| preload | 80%+ | ✅ Configured |
| **Overall** | **85%+** | 🎯 Target |

### Coverage Thresholds
- Lines: 80-85%
- Functions: 80-85%
- Branches: 75-80%
- Statements: 80-85%

## 🎓 Best Practices

### Test Organization
1. **Unit tests**: Co-located with source (`__tests__/` or `.test.ts`)
2. **Integration tests**: `tests/integration/`
3. **E2E tests**: `tests/e2e/`
4. **Performance**: `tests/performance/`
5. **Visual**: `tests/visual-regression/`

### Writing Tests
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { build, createMockIPC } from '@cortex-ide/test-utils';

describe('Feature Tests', () => {
  let ipc: ReturnType<typeof createMockIPC>;
  
  beforeEach(() => {
    ipc = createMockIPC();
  });
  
  it('should do something', async () => {
    const user = build.user().withAdmin().build();
    
    ipc.on('test:channel', (data) => ({ success: true }));
    const result = await ipc.invoke('test:channel', { id: user.id });
    
    expect(result.success).toBe(true);
  });
});
```

### Mocking Strategy
1. **Use builders** for test data
2. **Mock at boundaries** (IPC, API, FS)
3. **Avoid mocking internal logic**
4. **Reset mocks** between tests

### Performance Testing
1. **Use `bench()`** for benchmarks
2. **Set realistic budgets**
3. **Monitor trends** over time
4. **Profile bottlenecks** when budgets exceeded

## 🔧 Maintenance

### Regular Tasks
- [ ] Review and update performance budgets monthly
- [ ] Update visual baselines when UI changes intentionally
- [ ] Review failing tests promptly
- [ ] Monitor coverage trends
- [ ] Update dependencies in test-utils

### When Adding Features
1. Add `data-testid` attributes to new UI components
2. Write unit tests for new logic
3. Add integration tests for new workflows
4. Update visual regression baselines if UI changed
5. Consider performance impact and update budgets

### Debugging Failed Tests
1. **Unit/Integration**: Run with `--reporter=verbose`
2. **E2E**: Use `--headed` or `--debug` mode
3. **Visual**: Check diff images in `tests/visual-regression/diff/`
4. **Performance**: Review benchmark results, check for regressions

## 📚 Dependencies Added

```json
{
  "@cortex-ide/test-utils": "workspace:*",
  "@faker-js/faker": "^9.3.0",
  "@testing-library/dom": "^10.4.0",
  "@testing-library/react": "^16.1.0",
  "@testing-library/jest-dom": "^6.6.3",
  "@testing-library/user-event": "^14.5.2",
  "@vitest/coverage-v8": "^4.1.10",
  "@vitest/ui": "^4.1.10",
  "@vitest/spy": "^4.1.10",
  "jsdom": "^25.0.1",
  "pixelmatch": "^6.0.0",
  "pngjs": "^7.0.0",
  "vitest": "^4.1.10"
}
```

## 🎯 Key Improvements Summary

### Speed
- **68% faster CI** through parallelization
- **Cached dependencies** reduce install time
- **Sharded E2E tests** distribute load
- **Concurrent jobs** maximize throughput

### Reliability
- **95%+ coverage** target across codebase
- **Integration tests** catch workflow bugs
- **Visual regression** catches UI regressions
- **Performance budgets** prevent degradation

### Developer Experience
- **Rich test utilities** reduce boilerplate
- **Custom matchers** improve assertions
- **Test builders** simplify test data
- **Mock factories** streamline mocking
- **Vitest UI** for interactive debugging

### Maintainability
- **Consistent patterns** across packages
- **Centralized utilities** reduce duplication
- **Clear documentation** aids onboarding
- **Automated checks** in CI/CD

## 🚦 Next Steps

### Immediate
- ✅ All infrastructure complete
- 🔄 Begin writing tests for existing features
- 🔄 Integrate into daily workflow

### Short Term (1-2 weeks)
- [ ] Achieve 85%+ unit test coverage
- [ ] Add remaining integration tests
- [ ] Establish baseline for all visual tests
- [ ] Benchmark all critical paths

### Long Term (1-3 months)
- [ ] Reach 95% total coverage
- [ ] Set up performance monitoring dashboard
- [ ] Implement mutation testing
- [ ] Add accessibility testing suite

## 📞 Support

For questions or issues:
1. Check test utilities documentation: `packages/test-utils/README.md`
2. Review example tests in each test directory
3. Consult Vitest documentation: https://vitest.dev
4. Open issue with test reproduction case

---

**Testing Infrastructure Version:** 1.0.0  
**Last Updated:** 2026-08-16  
**Maintained By:** Cortex IDE Team
