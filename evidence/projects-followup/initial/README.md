# Retained initial attempts

The first three-case run passed both restart/theme journeys. Its race case passed through
draft preservation, stale-owner navigation and protocol refusal, then failed to observe a
Library list error. A one-shot request redirect could be consumed by a pending sidebar
refresh. Keeping that injected refusal active until explicit Retry passed the unchanged
behavior assertions in a separate 3.5-second case (4.3 seconds overall).

The first full suite used an incorrect build environment: `NODE_ENV=test` was set during
Vite build, retaining development React and StrictMode effect replay. **109/116 cases pass**;
four one-read history gates, one auth-read gate and two Base UI warning assertions fail.
Its bundle was 2,947,956 bytes and contained development `act` diagnostics; the corrected
production bundle is separately bound. Original tests and application assertions were not
weakened to hide these failures. Raw logs, artifacts and build receipts remain distinct.
Earlier JSON reports were overwritten by the configured reporter path; retained logs and
artifact directories establish their recorded scope, not an invented raw-report archive.

Independent test review additionally required explicit delivered-response/paint fences,
ready History/grid/theme assertions and exact refusal codes. The sidebar gained a shared
loading/error/Retry treatment for session reads. These are separately recorded source/test
changes; the production confirmation does not relabel the original build.

The first packaged smoke attempt omitted Xvfb and failed with `Missing X server or $DISPLAY`.
The same package launches under Xvfb. Final production package/smoke is recorded separately.
