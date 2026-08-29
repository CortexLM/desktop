# 08 — Testing

## 8.1 The commands

| Layer | Command | Proves |
| --- | --- | --- |
| Unit | `bun run test` (Vitest) | Logic, state stores, screen rendering |
| Unit (packages only) | `bun run test:unit` | Same, skipping the root projects |
| Discovery guard | `bun run test:discovery` | Every test file is actually collected, and nobody imported `bun:test` |
| Integration | `bun run test:integration` | Modules wired together |
| E2E | `bun run test:e2e` | The real Electron app, real navigation |
| Visual | `bun run test:visual`, `bun run paper:diff` | The screen still matches the Paper artboard |
| Performance | `bun run test:performance:budgets` | Budgets not regressed |
| Types | `bun run typecheck` | `strict` still holds |
| Lint | `npx eslint packages` | Complexity and size limits |

E2E needs `bunx playwright install chromium`; `test:e2e` and `test:visual` already
run under `xvfb-run`.

**Vitest only.** Do not `import … from 'bun:test'` — `test:discovery` fails the
build on it, and those files silently do not run in CI.

## 8.2 New behaviour gets a test

Not "gets tests eventually". The PR that adds the behaviour adds the test, in the
same diff, because that is the only moment anyone knows what the behaviour is
supposed to be.

A bug fix gets a test that fails before the fix. If you cannot write one, say so
in the PR and explain why.

## 8.3 Every screen covers its honest states

A screen has four states beyond the happy path — **empty, loading, error,
signed-out** — and they are the states users actually hit. Test them.

**Bad** — one test, the state a user rarely sees:

```tsx
it('renders plugins', () => {
  render(() => <PluginsScreen connected={['slack']} onConnect={vi.fn()} />);
  expect(screen.getByText('Slack')).toBeTruthy();
});
```

**Good** — the states that ship broken when nobody looks:

```tsx
it('shows an honest loading state', () => {
  render(() => <PluginsScreen connected={[]} onConnect={vi.fn()} loading />);
  expect(screen.getByText('Loading plugins')).toBeTruthy();
});

it('says plugins are unavailable without naming a vendor', () => {
  render(() => <PluginsScreen connected={[]} onConnect={vi.fn()} unavailable />);
  const body = screen.getByRole('alert').textContent ?? '';
  expect(body).toContain('not available');
  expect(body.toLowerCase()).not.toContain('composio');
});

it('locks the account-gated action for a guest', () => {
  render(() => <AutomationsScreen session={null} />);
  expect(screen.getByText('Automations need a Cortex account')).toBeTruthy();
});

it('shows an empty roster instead of seeded rows', () => {
  render(() => <MascotsScreen mascots={[]} />);
  expect(screen.getByText('No mascots yet')).toBeTruthy();
});
```

That second test is the shape to copy: **assert on copy, including what must not
be there.** A test that pins the absence of a vendor name is how `02-errors.md`
stops being a suggestion.

## 8.4 Test what the user experiences

- Query by role, label, and visible text — not by CSS class or component
  internals. A test that breaks when you rename a class was testing the wrong
  thing.
- Assert the copy a user reads. If a string matters enough to review, it matters
  enough to assert.
- Cover both hosts where behaviour differs: Electron bridge present vs absent
  (`hasElectronHost()`), and signed-in vs guest.
- Cover both themes and the narrow widths when you changed layout — a visual test
  at 1440 does not prove 390 works.

## 8.5 Tests must not lie either

The rules in `04-structure.md` about fake data apply doubly to tests, because a
dishonest test is worse than no test: it reports green.

**Bad** — asserts the mock, not the code:

```ts
vi.mock('./bots.ts', () => ({ mascots: () => [{ id: '1', name: 'Pip' }] }));

it('lists mascots', () => {
  expect(mascots()).toHaveLength(1);   // tests the mock
});
```

**Good** — stub the boundary, exercise the code:

```ts
it('caches only what the service returned', async () => {
  fetchMock.mockResolvedValueOnce(json({ data: [{ id: 'm_1', name: 'Pip' }] }));
  await loadMascots();
  expect(mascots().map((m) => m.id)).toEqual(['m_1']);
  expect(readJson(CACHE_KEY, [])).toHaveLength(1);
});

it('does not write the cache when the load fails', async () => {
  fetchMock.mockRejectedValueOnce(new Error('offline'));
  await loadMascots();
  expect(loadState()).toBe('error');
  expect(readJson(CACHE_KEY, [])).toEqual([]);
});
```

Other rules:

- No skipped tests without a linked issue in the skip reason.
- No snapshot that nobody reads. If a snapshot is the whole test, assert
  something specific instead.
- Fixtures use obvious placeholders, never real-looking keys or tokens
  (`01-security.md` § 1.2).
- Fixtures live under `__tests__`. Production modules never import them.
- Do not weaken an assertion to make CI green. Fix the code or fix the
  expectation on purpose and say so in the PR.

## 8.6 Native modules, so a red suite does not mislead you

`better-sqlite3` must load under two ABIs — Node for Vitest, Electron for the app.
Build both with `bun run build:native-dual-abi` and verify with
`bun run verify:native-abi`.

If every DB test suddenly fails with `Module did not self-register` or
`compiled against a different Node.js version`, you almost certainly ran
`electron-builder`, which rebuilt the addon for Electron's ABI. Re-run
`build:native-dual-abi`. It is not a regression in your change — and it is also
not a reason to skip the tests.
