# Skipped native transitions

## Finding

- CI 37088533094 at application 749bc0c: 82 passed, one failed, zero skipped/flaky. All five Work-scroll steps completed successfully. Only the final page-error assertion failed with `Transition was skipped`.
- Archived `trace.zip` contains `test.trace`, test sources and attachments, no renderer trace/exception stack. The original macOS skip trigger and exact call site cannot be recovered from this archive.
- Unchanged baseline renderer `packages/app/dist/assets/index-BiiO_bNG.js` reproduced the error through **both** real `document.startViewTransition` calls. The observational wrapper returned the native `ViewTransition`, called its real `skipTransition()`, and compared `unhandledrejection.event.promise` by identity against its three native promises. Both failures were **`ready`**, `AbortError: Transition was skipped`; `finished` and `updateCallbackDone` resolved. Route and theme callbacks each ran once, committing Work/dark.
- Recorded caller stacks point to `index-BiiO_bNG.js:202:82553` (navigation, `App.tsx`) and `:202:67403` (theme, `shell.tsx`). Reproduced DOMExceptions themselves carry an empty stack.

## Change

- `packages/app/src/App.tsx`: catch native `ready` DOMException/AbortError only; rethrow other readiness failures.
- `packages/app/src/shell/shell.tsx`: identical readiness handling; retain existing `finished` cleanup. No additional catch on callback/finished promises.
- `tests/e2e/navigation.spec.ts`: one regression, motion enabled. Real native skip for both paths; application handler observation does not itself handle the readiness rejection. Assert callbacks/route/theme, clean page errors, then inject async callback failures through native update processing and require the exact reported errors.
- `fix.patch` contains the scoped diff. No shared build performed.

## Evidence

- `ci-failure-summary.json`: archived CI stats/five successful steps/failed result.
- `baseline-hashes.json`, `final-dist-check.json`: baseline/final dist hashes match.
- `baseline.mjs`, `baseline.log`, `baseline-result.json`, `baseline-trace.zip`: standalone negative reproduction against unchanged baseline; process exits 1 on empty-page-errors assertion.
- `callback-probe.mjs`, `callback-probe.log`, `baseline-callback-{skip,no-skip}.json`: native callback rejection paths remain observable on baseline. With skip: route callback failures surface from `updateCallbackDone` and `finished`; theme callback failure surfaces from `updateCallbackDone`.
- `test-before-final.log`, `test-before-final.json`, `test-before-final-artifacts/`: exact final committed regression fails against unchanged baseline, 3.3 seconds. Initial route/theme both produce native ready failures; async callback failures also remain reported.
- `lint.log`, `typecheck.log`, `diff-check.log`: targeted ESLint, whole-project TypeScript, `git diff --check` pass.

## Coordinator verification

Post-fix runtime remains pending the requested single integrated build. Then run:

```sh
NODE_ENV=test xvfb-run -a -s '-screen 0 1920x1080x24' bun run test:e2e tests/e2e/navigation.spec.ts tests/e2e/work-scroll.spec.ts --workers=1
```

Continue CI/native macOS recovery in the coordinator session.
