# Session admission and historical attachment safety

Local-engine correction after `cc758a6`; renderer source remains unchanged.

- Reserve each session before asynchronous catalog/provider lookup. Concurrent prompts
  receive `session_busy`; validation/persistence exceptions release the reservation.
- Abort/delete cover pending admission. Parent cancellation precedes descendant waits;
  synchronous model-update listeners can cancel before a user message is persisted.
- Validate replayed historical images/PDFs against the proposed model before changing
  session metadata or admitting the follow-up. History and refused drafts remain intact.

## Regression evidence

Seven deterministic unit cases failed before their respective corrections:

| Case | Observed failure | Retained log |
| --- | --- | --- |
| Two simultaneous prompts | Both admitted | `before.log` |
| Abort during credential lookup | Prompt admitted after abort | `before.log` |
| Delete during credential lookup | Late write raises `ERR_SQLITE_ERROR` | `before.log` |
| Parent deletion waits for child | Parent prompt admitted while deletion waits | `review-before.log` |
| Synchronous model-update listener abort | Outer prompt admitted despite cancellation | `review-before.log` |
| Historical image / PDF with non-capable model | Both follow-ups admitted | `review-before.log` |

The first log tests the old application source. The second tests the initial early-reservation
correction, before the independent review's additional fixes. Filtered tests in those logs
are unselected cases, not conditional acceptance skips. Cancellation assertions check the
durable journal as well as the projection, so deletion cannot hide a briefly persisted turn.
An independent [source review](source-review.md) accepts the final correction within scope.
This does not add multi-event admission rollback; each durable event retains its own transaction.

## Verification

Local full suite: **138 unit passes**, one optional backend skip (`CORTEX_TEST_BACKEND_URL`
absent), lint/types pass, i18n **63 files / 2,265 used keys / 3,395 English keys / zero findings**.
Full Electron suite: **50/50**, 426 registered renders. Built Linux package launches and renders
the shell (`SMOKE OK`); its renderer screenshot was inspected. New history-refusal UI assertions
are separately verified after that full run; both themes retain the typed follow-up without
a new provider request. CI and current installed-Mac evidence follow after the commit.

The renderer/frozen source did not change. Earlier native package evidence stays revision-bound;
no new full visual comparison is inferred. Test inference is controlled local SSE, not actual
Cortex authentication or remote image/reasoning inference. G3's canonical versioned pair and
approved new design surfaces remain prerequisites for the complete objective.
