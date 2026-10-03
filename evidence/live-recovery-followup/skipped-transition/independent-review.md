# Skipped native transitions — independent source review

**Bounded approval. No concrete blocking finding in the three-file correction.**

## Source checks

- `packages/app/src/App.tsx:23-26`: handles only `ready` rejection whose value is a `DOMException` named `AbortError`. Other readiness failures are rethrown through the derived promise, remaining observable. The native route callback is neither cancelled, retried nor moved into the rejection handler; skipped animation still commits the route once.
- `packages/app/src/shell/shell.tsx:45-48`: same narrow readiness handling. The existing `finished.finally(...)` still removes `document.documentElement.dataset.vt` on fulfillment or rejection; readiness handling does not delay or bypass cleanup. The existing catch on that cleanup chain is unchanged.
- Neither change catches `updateCallbackDone`. Route callback failures also remain exposed through `finished`; theme callback failures remain exposed through `updateCallbackDone`. Even an update callback rejecting with its own `AbortError` would not be globally swallowed by the new readiness-only handlers.

## Regression strength

- `tests/e2e/navigation.spec.ts:12-38` calls the real native `startViewTransition` and `skipTransition()`, returns the native object, preserves its promises. The `ready.then` wrapper only observes handlers the application attaches; it does not independently consume the rejection. The `unhandledrejection` observer does not call `preventDefault`.
- `:47-65` requires Work route/selection, dark theme/URL, removed `data-vt`, exactly one callback per transition, handled native AbortError, zero unhandled/page errors. Soft assertions still fail the test and permit the callback-failure phase to execute.
- `:67-80` injects asynchronous failures inside the native update callback and requires the exact two route reports plus one theme report. Theme cleanup is checked again. This guards against suppressing real callback failures while suppressing skips. Existing navigation assertions were not weakened or removed.
- The test intentionally covers skipped transitions. Non-AbortError readiness rethrow is established by source inspection here; no additional runtime claim.

## Negative evidence inspected

- `baseline-result.json`: both native objects; one route/theme callback each; committed Work/dark; rejected promise identities are specifically `ready`, with `AbortError: Transition was skipped`.
- `baseline-callback-skip.json` and `baseline-callback-no-skip.json`: callback failures remain separately observable on native `updateCallbackDone`/`finished` as reported by the worker.
- `test-before-final.log`: exact regression fails on missing readiness handlers/unhandled skip errors; expected callback failures are still present. This is a genuine negative regression, not merely a probe asserting its own synthetic result.
- `ci-failure-summary.json`: five Work-scroll steps completed; final error assertion failed. Original macOS trigger/call site remains unproven because the archived trace lacks a renderer stack; this correction is supported by the separate native reproduction.

Read-only source/evidence review. No repository edits, tests, builds, Mac or CI actions. Did not read/poll `test-after.log`; coordinator verification remains independent. Only this report written; no delegation.

## Reviewed SHA-256

```text
48364d76d0b6253807701e64e45f503a27d2c40083cdc477d6c70aa311753a83  packages/app/src/App.tsx
249cd485e33aa9b693c026cceb71434e5794e8e6268aa17ff61b58784277ea13  packages/app/src/shell/shell.tsx
c75dee35eab42626507bddc8a0b625f3d05d5ba4d060f33b2d9d9b44d0f93a44  tests/e2e/navigation.spec.ts
```
