# E2E Testing Guide for Cortex IDE

## Overview

This directory contains the end-to-end (E2E) test suite for Cortex IDE using Playwright. The tests cover all major features and user workflows in the Electron application.

## Directory Structure

```
tests/e2e/
├── fixtures/
│   └── electron.ts          # Electron test fixture
├── page-objects/            # Page Object Model implementations
│   ├── BasePage.ts          # Base page with common utilities
│   ├── EditorPage.ts        # Editor operations
│   ├── GitPage.ts           # Git integration
│   ├── TerminalPage.ts      # Terminal operations
│   ├── AIChatPage.ts        # AI chat interactions
│   ├── WorkspacePage.ts     # Workspace navigation
│   ├── AutomationPage.ts    # Automation management
│   ├── ExtensionsPage.ts    # MCP extensions
│   ├── AccountPage.ts       # Account/team/billing
│   └── index.ts             # Exports
├── specs/                   # Test specifications
│   ├── editor.spec.ts       # Editor tests
│   ├── git.spec.ts          # Git tests
│   ├── terminal.spec.ts     # Terminal tests
│   ├── ai-chat.spec.ts      # AI chat tests
│   ├── workspace.spec.ts    # Workspace tests
│   ├── automations.spec.ts  # Automation tests
│   ├── extensions.spec.ts   # Extension tests
│   ├── account.spec.ts      # Account tests
│   ├── integration.spec.ts  # Complex integration tests
│   ├── performance.spec.ts  # Performance tests
│   ├── error-handling.spec.ts # Error handling tests
│   ├── theme.spec.ts        # Theme switching tests
│   ├── window.spec.ts       # Window management tests
│   └── database-persistence.spec.ts # SQLite round-trips through the UI
├── global-setup.ts          # Global test setup (build app)
└── global-teardown.ts       # Global test cleanup
```

## Environment prerequisites

Two environment issues stop the suite before a single assertion runs. Both are
silent-ish, so they are worth knowing about up front.

### Running as root (containers, CI)

Chromium refuses to start as root without `--no-sandbox`, and the refusal is a
`FATAL` abort:

```
[FATAL:electron_main_delegate.cc] Running as root without --no-sandbox is not supported.
```

The process dies before any window exists, so `firstWindow()` can only ever time
out. The symptom looks like a timeout problem and is not one — raising the
timeout changes nothing.

The fixture handles this by adding `--no-sandbox` **only when it detects it is
running as root** (`tests/e2e/fixtures/electron.ts`). The flag belongs to the
test launcher, not the app: Cortex must never ship with its own sandbox
disabled.

### better-sqlite3 must be built for BOTH ABIs

`better-sqlite3` is a native addon, so its binary is locked to one
`NODE_MODULE_VERSION`. Two runtimes load it and they do not share an ABI:

| Runtime               | ABI |
| --------------------- | --- |
| Electron 39 (the app) | 140 |
| Host Node (vitest)    | computed at `bun run build:native-dual-abi` |

Building for one breaks the other. Build both:

```bash
bun run build:native-dual-abi   # builds both ABIs
bun run verify:native-abi       # opens a real DB in each runtime
```

**This one does not announce itself.** When the addon's ABI is wrong for
Electron, the main process catches the error and logs
`Database initialization failed`, then keeps going. The app boots, the window
opens, every view renders, and the E2E suite passes — while chat history, plans
and every other DB-backed feature silently return nothing. A green run is not
evidence the database works; `database-persistence.spec.ts` is what actually
checks it.

Note that `@electron/rebuild -f -w better-sqlite3` does **not** work in this
repo. It prints `✔ Rebuild Complete` in under a second without touching the
binary, because the package lives in Bun's content-addressed `node_modules/.bun/`
store and is only symlinked into `packages/main/node_modules`. Check the file's
mtime before believing the success message.

## Prerequisites

1. **Build the application** before running tests:
   ```bash
   bun run build
   ```

2. **Install Playwright browsers**:
   ```bash
   bunx playwright install chromium
   ```

## Running Tests

### Run all tests (headless)
```bash
bun run test:e2e
```

### Run tests with UI visible (headed mode)
```bash
bun run test:e2e:headed
```

### Run tests in debug mode
```bash
bun run test:e2e:debug
```

### Run tests with Playwright UI
```bash
bun run test:e2e:ui
```

### Run specific test file
```bash
bun run test:e2e tests/e2e/specs/editor.spec.ts
```

### Run tests with specific tag
```bash
bun run test:e2e --grep "@smoke"
```

### Run tests in parallel
```bash
bun run test:e2e --workers=4
```

### Run tests with sharding (for CI)
```bash
bun run test:e2e --shard=1/3
bun run test:e2e --shard=2/3
bun run test:e2e --shard=3/3
```

## Viewing Reports

### HTML Report
```bash
bun run test:e2e:report
```

### Trace Viewer (for debugging failures)
```bash
bun run test:e2e:trace test-results/traces/trace.zip
```

## Test Coverage

### Editor Tests (`editor.spec.ts`)
- Open files from explorer
- Type and save content
- Manage multiple tabs
- Show unsaved changes indicator
- Trigger autocomplete
- Handle keyboard shortcuts
- Persist editor state after reload

### Git Tests (`git.spec.ts`)
- Display git status
- Stage and unstage files
- Commit changes
- View file diff
- Display current branch
- Open branch selector
- Refresh git status
- Handle empty state

### Terminal Tests (`terminal.spec.ts`)
- Open terminal panel
- Create new terminals
- Execute commands
- Switch between terminals
- Close terminals
- Clear terminal
- Handle long-running commands
- Handle multiple concurrent terminals
- Persist terminal sessions

### AI Chat Tests (`ai-chat.spec.ts`)
- Open AI chat panel
- Send messages and receive responses
- Display streaming indicator
- Stop generation
- Create and switch chat sessions
- Display and copy code blocks
- Handle multiple messages
- Persist chat history

### Workspace Tests (`workspace.spec.ts`)
- Load workspace successfully
- Navigate between views (Explorer, Git, Terminal, AI Chat, Extensions, Notes, Plans, Browser, Account, Automations)
- Toggle light/dark theme
- Switch themes multiple times
- Navigate between multiple views quickly

### Automation Tests (`automations.spec.ts`)
- Open automation panel
- Create new automation
- Configure triggers and actions
- Save automation
- Toggle automation on/off
- Run automation manually
- View automation logs
- Delete automation
- Handle multiple automations

### Extension Tests (`extensions.spec.ts`)
- Open extensions panel
- Display marketplace
- Search for extensions
- View installed extensions
- Install and uninstall extensions
- Configure extensions
- View extension tools
- Invoke tools
- Handle extension errors

### Account Tests (`account.spec.ts`)
- Open account panel
- Display profile, team, and billing tabs
- Get profile information
- Edit profile
- Display team members
- Invite team members
- Display billing plan and usage stats
- Switch between tabs

### Integration Tests (`integration.spec.ts`)
- Concurrent operations (edit + commit + AI chat)
- Rapid view transitions
- State persistence after reload
- Error recovery
- Multiple terminal + editor tabs
- Theme change during operations
- Long-running operations
- File operations with git tracking

### Performance Tests (`performance.spec.ts`)
- Workspace load time
- Rapid clicks without freezing
- Multiple editor tabs efficiency
- Large AI responses
- Concurrent terminal operations
- Memory efficiency over time
- Complex UI rendering

### Error Handling Tests (`error-handling.spec.ts`)
- Network errors
- Invalid file paths
- Invalid git operations
- AI service errors
- Terminal command errors
- Concurrent error scenarios
- Error logging

### Theme Tests (`theme.spec.ts`)
- Switch between light and dark themes
- Persist theme preference
- Apply theme to all components
- Animate theme transitions
- Handle rapid theme toggles

### Window Tests (`window.spec.ts`)
- Launch application window
- Correct window dimensions
- Handle window resize
- Minimize and maximize
- Close gracefully

## Writing New Tests

### 1. Create a Page Object (if needed)

```typescript
// tests/e2e/page-objects/MyFeaturePage.ts
import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class MyFeaturePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  private selectors = {
    myButton: '[data-testid="my-button"]',
    myInput: '[data-testid="my-input"]'
  };

  async clickMyButton(): Promise<void> {
    await this.page.click(this.selectors.myButton);
  }

  async typeInInput(text: string): Promise<void> {
    await this.page.fill(this.selectors.myInput, text);
  }
}
```

### 2. Create a Test Spec

```typescript
// tests/e2e/specs/my-feature.spec.ts
import { test, expect } from '../fixtures/electron';
import { MyFeaturePage } from '../page-objects';

test.describe('My Feature Tests', () => {
  let myFeaturePage: MyFeaturePage;

  test.beforeEach(async ({ page }) => {
    myFeaturePage = new MyFeaturePage(page);
    await page.waitForLoadState('domcontentloaded');
  });

  test('should do something', async ({ page }) => {
    await myFeaturePage.clickMyButton();
    await myFeaturePage.typeInInput('test');
    
    await expect(page.locator('[data-testid="result"]')).toBeVisible();
  });
});
```

## Best Practices

### 1. Use Data Test IDs
Always add `data-testid` attributes to elements you need to test:
```tsx
<button data-testid="save-button">Save</button>
```

### 2. Use Page Objects
Encapsulate page interactions in Page Object classes for maintainability.

### 3. Wait for Load States
Always wait for the appropriate load state before interacting:
```typescript
await page.waitForLoadState('domcontentloaded');
```

### 4. Use Explicit Waits
Prefer explicit waits over fixed timeouts:
```typescript
await page.waitForSelector('[data-testid="element"]', { timeout: 5000 });
```

### 5. Clean Up After Tests
Use `beforeEach` and `afterEach` hooks to ensure clean state:
```typescript
test.afterEach(async ({ page }) => {
  // Clean up
});
```

### 6. Handle Async Operations
Always await promises and handle timeouts appropriately:
```typescript
await aiChatPage.waitForResponse(30000); // 30 second timeout
```

### 7. Use Descriptive Test Names
```typescript
test('should stage files and commit with message', async ({ page }) => {
  // ...
});
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bunx playwright install chromium
      - run: bun run build
      - run: bun run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: test-results/
```

## Debugging Failed Tests

### 1. Run in Debug Mode
```bash
bun run test:e2e:debug
```

### 2. View Screenshots
Failed tests automatically capture screenshots in `test-results/`.

### 3. View Videos
Failed tests record videos in `test-results/`.

### 4. View Traces
```bash
playwright show-trace test-results/traces/trace.zip
```

### 5. Inspect Element Selectors
Use Playwright Inspector to validate selectors:
```bash
bunx playwright codegen
```

## Troubleshooting

### Tests Fail to Launch Electron
- Ensure the app is built: `bun run build`
- Check that paths in `electron.ts` fixture are correct

### Tests Timeout
- Increase timeout in `playwright.config.ts`
- Check if the app is loading properly
- Verify selectors are correct

### Flaky Tests
- Add appropriate waits
- Check for race conditions
- Use `waitForLoadState` and `waitForSelector`

### CI Tests Fail but Pass Locally
- Ensure CI has enough resources
- Check for timing issues
- Use sharding to distribute load

## Performance Considerations

- Tests run in parallel by default (4 workers)
- Use `test.describe.serial()` for tests that must run sequentially
- Adjust `workers` in `playwright.config.ts` based on your system

## Maintenance

- Update Page Objects when UI changes
- Keep test data minimal and clean
- Regularly review and update selectors
- Archive obsolete tests

## Contributing

1. Write tests for new features
2. Update Page Objects for UI changes
3. Follow the existing test structure
4. Document complex test scenarios
5. Ensure tests pass before committing
