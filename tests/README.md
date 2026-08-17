# Test Suites

## Directory Structure

```
tests/
├── integration/          # Integration tests for workflows
│   ├── git-workflow.test.ts
│   ├── terminal-operations.test.ts
│   ├── ai-chat-to-file.test.ts
│   └── workspace-editor.test.ts
│
├── performance/          # Performance benchmarks
│   ├── file-operations-bench.test.ts
│   ├── ipc-bench.test.ts
│   ├── ai-provider-bench.test.ts
│   ├── performance-budgets.ts
│   └── check-budgets.ts
│
├── visual-regression/    # Visual regression testing
│   ├── visual-regression.test.ts
│   ├── baseline-manager.ts
│   ├── baseline/         # Baseline screenshots
│   ├── current/          # Current screenshots
│   └── diff/             # Diff images
│
├── e2e/                  # End-to-end tests (Playwright)
│   ├── specs/
│   ├── page-objects/
│   └── fixtures/
│
├── visual/               # Visual component tests
│   ├── visual-regression.spec.ts
│   ├── component-isolation.spec.ts
│   └── storybook-screenshots.spec.ts
│
└── accessibility/        # Accessibility tests
    └── accessibility.spec.ts
```

## Running Tests

### All Tests
```bash
bun run test              # Unit tests
bun run test:integration  # Integration tests
bun run test:e2e          # E2E tests
bun run test:all          # All tests
```

### Specific Suites
```bash
# Integration
bun run test tests/integration/

# Performance
bun run vitest bench --run

# Visual regression
bun run test tests/visual-regression/
```

## Test Utilities

All tests can use utilities from `@cortex-ide/test-utils`:

```typescript
import {
  describe,
  it,
  expect,
  build,
  createMockIPC,
  createMockFS,
  createMockAIProvider,
  waitFor,
  retry,
  registerCustomMatchers
} from '@cortex-ide/test-utils';
```

## Documentation

- **Full Guide**: `../TESTING_IMPROVEMENTS.md`
- **Quick Start**: `../TESTING_QUICK_START.md`
- **Test Utils**: `../packages/test-utils/README.md`
