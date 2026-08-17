# Playwright E2E Testing - Quick Reference

## Installation & Setup

```bash
# Install dependencies
bun install

# Install Playwright browsers
bunx playwright install chromium

# Build the application
bun run build
```

## Running Tests

| Command | Description |
|---------|-------------|
| `bun run test:e2e` | Run all tests (headless) |
| `bun run test:e2e:headed` | Run tests with visible browser |
| `bun run test:e2e:debug` | Run tests in debug mode |
| `bun run test:e2e:ui` | Open Playwright UI |
| `bun run test:e2e:report` | View HTML report |
| `./run-e2e-tests.sh headed` | Run with helper script |
| `./run-e2e-tests.sh specific tests/e2e/specs/editor.spec.ts` | Run specific test |
| `./run-e2e-tests.sh grep "should save"` | Run tests matching pattern |
| `./run-e2e-tests.sh parallel 8` | Run with 8 workers |
| `./run-e2e-tests.sh shard 1/3` | Run shard 1 of 3 |

## Test Suites Overview

| Suite | File | Tests |
|-------|------|-------|
| **Editor** | `editor.spec.ts` | 7 tests - File operations, tabs, autocomplete |
| **Git** | `git.spec.ts` | 9 tests - Status, stage, commit, diff, branches |
| **Terminal** | `terminal.spec.ts` | 10 tests - Commands, multiple terminals, sessions |
| **AI Chat** | `ai-chat.spec.ts` | 10 tests - Messages, streaming, sessions, code blocks |
| **Workspace** | `workspace.spec.ts` | 14 tests - Navigation, theme switching |
| **Automations** | `automations.spec.ts` | 9 tests - Create, configure, run, logs |
| **Extensions** | `extensions.spec.ts` | 9 tests - Marketplace, install, configure, tools |
| **Account** | `account.spec.ts` | 10 tests - Profile, team, billing |
| **Integration** | `integration.spec.ts` | 8 tests - Complex multi-feature workflows |
| **Performance** | `performance.spec.ts` | 7 tests - Load time, memory, responsiveness |
| **Error Handling** | `error-handling.spec.ts` | 7 tests - Network, invalid input, recovery |
| **Theme** | `theme.spec.ts` | 5 tests - Light/dark switching, persistence |
| **Window** | `window.spec.ts` | 5 tests - Launch, resize, minimize, close |

**Total: ~110 E2E tests**

## Quick Test Commands

```bash
# Run all tests
./run-e2e-tests.sh

# Run specific suite
./run-e2e-tests.sh specific tests/e2e/specs/editor.spec.ts

# Run tests with "save" in the name
./run-e2e-tests.sh grep "should save"

# Debug a failing test
./run-e2e-tests.sh debug

# Open test UI for interactive debugging
./run-e2e-tests.sh ui

# View last test report
./run-e2e-tests.sh report

# Clean test results
./run-e2e-tests.sh clean
```

## Page Objects

All page interactions are encapsulated in Page Objects:

- `EditorPage` - File editing, tabs, Monaco operations
- `GitPage` - Git status, staging, commits, diffs
- `TerminalPage` - Terminal creation, commands, management
- `AIChatPage` - AI chat messages, sessions, code blocks
- `WorkspacePage` - Navigation between views, theme
- `AutomationPage` - Automation management
- `ExtensionsPage` - MCP extensions and tools
- `AccountPage` - Profile, team, billing

## Common Selectors

All elements use `data-testid` attributes:

```typescript
// Sidebar navigation
'[data-testid="sidebar-explorer"]'
'[data-testid="sidebar-git"]'
'[data-testid="sidebar-terminal"]'
'[data-testid="sidebar-ai-chat"]'

// Editor
'[data-testid="editor-tab"]'
'[data-testid="save-file"]'

// Git
'[data-testid="git-panel"]'
'[data-testid="commit-button"]'

// Terminal
'[data-testid="terminal-panel"]'
'[data-testid="new-terminal"]'

// AI Chat
'[data-testid="ai-chat-panel"]'
'[data-testid="send-message"]'
```

## Test Structure

```typescript
import { test, expect } from '../fixtures/electron';
import { EditorPage } from '../page-objects';

test.describe('Feature Tests', () => {
  let page: EditorPage;

  test.beforeEach(async ({ page: electronPage }) => {
    page = new EditorPage(electronPage);
    await electronPage.waitForLoadState('domcontentloaded');
  });

  test('should do something', async ({ page: electronPage }) => {
    // Test implementation
    await page.openFile('test.ts');
    await expect(electronPage.locator('.monaco-editor')).toBeVisible();
  });
});
```

## Debugging Tips

1. **Use headed mode** to see what's happening:
   ```bash
   ./run-e2e-tests.sh headed
   ```

2. **Use debug mode** to step through:
   ```bash
   ./run-e2e-tests.sh debug
   ```

3. **Check screenshots** in `test-results/` for failures

4. **View traces** for detailed debugging:
   ```bash
   playwright show-trace test-results/traces/trace.zip
   ```

5. **Use Playwright Inspector** to validate selectors:
   ```bash
   bunx playwright codegen
   ```

## CI/CD Integration

See `tests/e2e/CI_EXAMPLES.md` for:
- GitHub Actions workflow
- GitLab CI configuration
- Jenkins pipeline
- CircleCI config
- Docker setup

## Configuration

Main config: `playwright.config.ts`

Key settings:
- **Timeout**: 30s per test, 5s for assertions
- **Workers**: 4 parallel workers (2 in CI)
- **Retries**: 0 locally, 2 in CI
- **Screenshots**: On failure only
- **Videos**: On failure only
- **Traces**: On failure only

## Sharding for Parallel Execution

```bash
# Run 3 shards in parallel
./run-e2e-tests.sh shard 1/3 &
./run-e2e-tests.sh shard 2/3 &
./run-e2e-tests.sh shard 3/3 &
wait
```

## Best Practices

✅ **DO:**
- Use `data-testid` for element selection
- Use Page Objects for reusability
- Wait for load states explicitly
- Handle async operations properly
- Clean up after tests

❌ **DON'T:**
- Use fixed `setTimeout()` - use `waitFor` instead
- Test implementation details
- Create test dependencies
- Leave console errors unhandled
- Ignore flaky tests

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Tests won't start | Run `bun run build` first |
| Tests timeout | Increase timeout in config |
| Flaky tests | Add proper waits, check for race conditions |
| CI failures | Check resources, use sharding |
| Element not found | Verify `data-testid` exists and is correct |

## Resources

- Full documentation: `tests/e2e/README.md`
- CI examples: `tests/e2e/CI_EXAMPLES.md`
- Playwright docs: https://playwright.dev
