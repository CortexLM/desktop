# Testing Documentation - Cortex IDE

## Overview

Cortex IDE uses **Playwright** for comprehensive end-to-end (E2E) testing of the Electron application. The test suite covers all major features with over 110 automated tests.

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Install Playwright browsers
bunx playwright install chromium

# 3. Build the application
bun run build

# 4. Run tests
bun run test:e2e

# 5. View report
bun run test:e2e:report
```

## Test Structure

```
tests/e2e/
├── fixtures/           # Test fixtures (Electron setup)
├── page-objects/       # Page Object Model
├── specs/              # Test specifications
│   ├── editor.spec.ts
│   ├── git.spec.ts
│   ├── terminal.spec.ts
│   ├── ai-chat.spec.ts
│   ├── workspace.spec.ts
│   ├── automations.spec.ts
│   ├── extensions.spec.ts
│   ├── account.spec.ts
│   ├── integration.spec.ts
│   ├── performance.spec.ts
│   ├── error-handling.spec.ts
│   ├── theme.spec.ts
│   └── window.spec.ts
├── README.md           # Full documentation
├── QUICK_REFERENCE.md  # Quick reference guide
└── CI_EXAMPLES.md      # CI/CD configurations
```

## Test Coverage

| Category | Tests | Description |
|----------|-------|-------------|
| **Editor** | 7 | File operations, tabs, Monaco features |
| **Git** | 9 | Status, staging, commits, diffs, branches |
| **Terminal** | 10 | Commands, multiple terminals, sessions |
| **AI Chat** | 10 | Messages, streaming, sessions, code blocks |
| **Workspace** | 14 | Navigation, views, theme switching |
| **Automations** | 9 | Create, configure, run automations |
| **Extensions** | 9 | MCP marketplace, install, tools |
| **Account** | 10 | Profile, team, billing management |
| **Integration** | 8 | Complex multi-feature workflows |
| **Performance** | 7 | Load time, memory, responsiveness |
| **Error Handling** | 7 | Error recovery, resilience |
| **Theme** | 5 | Light/dark mode switching |
| **Window** | 5 | Window management, resize |
| **Total** | **~110** | **Complete E2E coverage** |

## Running Tests

### Basic Commands

```bash
# Run all tests
bun run test:e2e

# Run with visible browser
bun run test:e2e:headed

# Run in debug mode
bun run test:e2e:debug

# Open Playwright UI
bun run test:e2e:ui

# View HTML report
bun run test:e2e:report
```

### Helper Script

```bash
# Make executable (first time)
chmod +x run-e2e-tests.sh

# Run tests
./run-e2e-tests.sh                    # Headless
./run-e2e-tests.sh headed             # With browser visible
./run-e2e-tests.sh debug              # Debug mode
./run-e2e-tests.sh ui                 # Playwright UI

# Run specific tests
./run-e2e-tests.sh specific tests/e2e/specs/editor.spec.ts
./run-e2e-tests.sh grep "should save"

# Parallel execution
./run-e2e-tests.sh parallel 8         # 8 workers
./run-e2e-tests.sh shard 1/3          # Shard 1 of 3

# Utilities
./run-e2e-tests.sh report             # View report
./run-e2e-tests.sh clean              # Clean results
./run-e2e-tests.sh help               # Show help
```

## Configuration

Main configuration in `playwright.config.ts`:

- **Test Directory**: `./tests/e2e`
- **Timeout**: 30 seconds per test
- **Workers**: 4 parallel (2 in CI)
- **Retries**: 0 locally, 2 in CI
- **Reporters**: HTML, JSON, List
- **Artifacts**: Screenshots, videos, traces (on failure)

## Page Object Pattern

All page interactions use the Page Object Model for maintainability:

```typescript
import { EditorPage } from '../page-objects';

const editorPage = new EditorPage(page);
await editorPage.openFile('test.ts');
await editorPage.setEditorContent('console.log("test")');
await editorPage.saveFile();
```

Available Page Objects:
- `EditorPage` - File editing operations
- `GitPage` - Git integration
- `TerminalPage` - Terminal operations
- `AIChatPage` - AI chat interactions
- `WorkspacePage` - Workspace navigation
- `AutomationPage` - Automation management
- `ExtensionsPage` - Extension management
- `AccountPage` - Account operations

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '../fixtures/electron';
import { EditorPage } from '../page-objects';

test.describe('My Feature Tests', () => {
  let editorPage: EditorPage;

  test.beforeEach(async ({ page }) => {
    editorPage = new EditorPage(page);
    await page.waitForLoadState('domcontentloaded');
  });

  test('should perform action', async ({ page }) => {
    await editorPage.openFile('test.ts');
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });
});
```

### Best Practices

✅ **DO:**
- Use `data-testid` attributes for selectors
- Use Page Objects for reusability
- Wait for load states explicitly
- Handle async operations properly
- Clean up after tests

❌ **DON'T:**
- Use fixed timeouts - use `waitFor` methods
- Test implementation details
- Create test dependencies
- Ignore flaky tests

## Debugging

### Debugging Failed Tests

1. **Run in headed mode**:
   ```bash
   ./run-e2e-tests.sh headed
   ```

2. **Use debug mode**:
   ```bash
   ./run-e2e-tests.sh debug
   ```

3. **Check artifacts**:
   - Screenshots: `test-results/artifacts/`
   - Videos: `test-results/artifacts/`
   - Traces: `test-results/traces/`

4. **View traces**:
   ```bash
   playwright show-trace test-results/traces/trace.zip
   ```

5. **Use Playwright Inspector**:
   ```bash
   bunx playwright codegen
   ```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3]
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bunx playwright install chromium
      - run: bun run build
      - run: bun run test:e2e --shard=${{ matrix.shard }}/3
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results-${{ matrix.shard }}
          path: test-results/
```

See `tests/e2e/CI_EXAMPLES.md` for more CI configurations.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Tests won't start | Run `bun run build` first |
| Tests timeout | Increase timeout in `playwright.config.ts` |
| Flaky tests | Add proper waits, check for race conditions |
| Element not found | Verify `data-testid` exists in component |
| CI failures | Check resources, enable sharding |
| Build errors | Fix build before running tests |

## Performance

- Tests run in parallel with 4 workers (configurable)
- Use sharding for CI to distribute load
- Average test suite completion: 3-5 minutes
- Individual test timeout: 30 seconds

## Maintenance

- Update Page Objects when UI changes
- Keep selectors up to date
- Review flaky tests regularly
- Archive obsolete tests
- Update documentation

## Documentation

- **Full Guide**: `tests/e2e/README.md`
- **Quick Reference**: `tests/e2e/QUICK_REFERENCE.md`
- **CI Examples**: `tests/e2e/CI_EXAMPLES.md`
- **Test Results**: `test-results/README.md`

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Electron Testing](https://www.electronjs.org/docs/latest/tutorial/automated-testing)
- [Page Object Model](https://playwright.dev/docs/pom)

## Contributing

When adding new features:
1. Add `data-testid` attributes to UI elements
2. Create/update Page Objects
3. Write comprehensive tests
4. Ensure tests pass locally
5. Update documentation

## Support

For issues or questions:
- Check documentation first
- Review example tests
- Open an issue with reproduction steps
- Include test output and traces
