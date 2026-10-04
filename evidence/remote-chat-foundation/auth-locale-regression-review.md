# Authentication locale regression — bounded source review

**One P2 cleanup correction required. Geometry/focus assertions and the retained passing receipt are otherwise sound within this scope.**

Reviewed only the appended case in `tests/e2e/remote-auth.spec.ts:409-500`, its existing helpers, relevant renderer layout, and supplied evidence. Reviewed file SHA-256: `f6740a98f19f100c04603c7c09b1c2eb0f1d6e7ac40a33d734c6cd7b3bea7600`.

## P2 — HTTP fixture cleanup is skipped on setup or teardown failure

**Locations:** `tests/e2e/remote-auth.spec.ts:411-412,442,496-498`.

`authBackend()` has already opened a listening server before `launch()` runs, but the cleanup `try` starts only at line 442. A rejected Electron launch/readiness wait therefore leaves the HTTP server open. Inside the current `finally`, a rejected geometry attachment skips both closes; a rejected `app.close()` skips `backend.close()`. These are deterministic exception paths in the new case, not failures observed in the passing receipt. The fixture's listener retains its captured state until worker termination instead of releasing its resources when the case fails.

**Minimum correction:** put everything after backend creation, including launch, inside an outer `try/finally` whose finalizer closes the backend. Keep app cleanup inside that scope; wrap attachment writing in `try/finally` so it cannot prevent `app.close()`. An outer backend finalizer then still executes if app teardown rejects. Preserve assertion failures and diagnostics; no helper rewrite or changes to the six existing tests are needed.

Normal-path event isolation is otherwise appropriate: listeners and arrays belong to one test/page, survive renderer reloads intentionally, and disappear with app disposal. The fixture has a distinct port/tag; its existing close releases held requests and closes active connections.

## Checks that hold

- **Non-vacuous matrix:** sixteen explicit locale/theme combinations. Exact heading/description/button-list assertions establish each primary state and expected controls; wrong-code assertions additionally require the editable retained input and exactly six painted digits. `readable()` rejects zero matches and empty text rectangles. Final counts require 80 measurements and 48 code HTTP requests.
- **Clipping:** lines 422-431 intersect viewport with actual per-axis overflow-clipping client boxes, including borders/scrollbars. Text vertical bounds are not constrained to an unclipped element's line box; horizontal checks enforce allocated width. Fonts and finite animations settle first; opacity is checked. The retained geometry contains 48 primary text rows extending vertically beyond their own element bounds while correctly passing. Example: English code heading element y=229.5–261.5, text Range y=228.5–262.5. This avoids the earlier font-height false refusal.
- **Focus:** lines 473-479 seed focus only on Help, then issue actual Tab presses and require each successive form control focused, enabled, fully within clipping bounds and center-hit-testable. The code input is intentionally transparent; its visible digits are checked separately. Expected button lists plus input/value checks prevent an empty control loop from passing the primary states. Retained counts are 5/2/2 stops per combination, totaling 144.
- **Real state/privacy:** UI submits wrong and accepted codes; enrollment uses the existing controlled HTTP fixture. Signed-in/enrollment states are re-read after renderer reload. Exact main auth status/email and the existing private-state guard run in all 48 primary states. No response/DOM stubbing, preview mode, or CSS injection was added.
- **Timeout/skip behavior:** no skip, expected-failure annotation or timeout-to-success path. All looped steps and assertions are awaited. A caught error is rethrown after attempted capture; even a capture failure still fails the test. The 180-second limit is finite. Node 22 supports the used APIs; browser geometry APIs run in Electron. No new platform-specific dependency appears. macOS execution remains unverified by this review.

## Independently checked retained receipt

- Current file hash matches the passing receipt. The original 407-line `7885736` file is an exact byte prefix; the six existing cases/imports/helpers are unchanged. Addition: 93 lines.
- `run/results.json`: one expected pass, duration 39,767ms, retry 0, no annotations/errors; zero skipped/unexpected/flaky.
- Decoded original `auth-locale-geometry` attachment equals `run/geometry.json`: 80 measured states, 48 primary states, 144 keyboard stops, 384 text rows. All recorded text rows are readable; all recorded focus controls are reachable. Eight PNG attachments retained; contact sheet and Japanese full-size capture inspected.
- Before/after integrity manifests are identical and list 90 dist members at `78857365a509d78af10ebdda5b52348a2e50e961`. This receipt exercises the frozen old dist, not the active main implementation.

Read-only source/evidence review. Only this report written. No delegation, tests, builds, Mac/CI operations, source edits or commit; active core/remote-session implementation excluded. No full-product or current-main acceptance claim.

## Cleanup correction — approved

**The P2 above is closed. Bounded source approval; this section supersedes the opening blocker.**

- `tests/e2e/remote-auth.spec.ts:412-413`: rejected launch/readiness now awaits `backend.close()` before rethrowing. The new case's HTTP fixture is cleaned even when launch returns no app handle.
- `tests/e2e/remote-auth.spec.ts:497-499`: attachment creation is protected by a finalizer that attempts app closure; a nested finalizer attempts backend closure even if app closure rejects. Test/capture/attachment/close rejections remain failures; no catch converts them to success.
- Remaining pre-`try` statements only initialize local values, register valid page event handlers and define functions; they introduce no additional awaited failure path. No concrete new-case backend leak remains in the reviewed control flow. Generic `launch()` ownership of an app not returned to its caller remains outside this bounded correction.

Corrected SHA-256: `7973cd05ffb32367de7afa8254e4d0002bd91a27b64df8fec645b44f24684062`. Reversing only these two cleanup edits in memory reproduces the previously reviewed `f6740a98f19f100c04603c7c09b1c2eb0f1d6e7ac40a33d734c6cd7b3bea7600` exactly. The six-case `7885736` prefix remains byte-identical; all locale/geometry/focus assertions are unchanged.

Source-only follow-up; no rerun or repository writes. Prior old-dist positive remains revision-scoped. Coordinator's planned rebuilt 97-case run supplies subsequent runtime evidence.
