# Remote JSON adapter

The protocol/server/client expose nine routes under `/api/remote`: model discovery,
session list/create/get/messages, prompt, detach, resume and known history. They
delegate to existing process-owned `core.remoteSessions`; local routes are unchanged.
Prompt and resume acknowledge validated admission with `{messageID}`, never the
completion promise. Existing remote bus events use the existing SSE transport.

Five client-through-server tests pass. Full unit regression passes 304 tests with
one optional skip across 27 files; types and lint pass. Scoped independent review
approves with no blockers in `.omo/evidence/remote-api-adapter-review.md`.

An additional `POST /api/remote/sessions/:id/upload` accepts strict
`{filename,mime,data}` JSON and returns `RemoteFile` with status 201. Canonical
padded/unpadded base64 and an 8 MiB decoded ceiling are checked before Buffer/Blob
allocation. This does not bound IPC string allocation or JSON parsing. Existing
main MIME/signature checks remain authoritative; no image decoding guarantee is added.
Core retains upload locks, session-owned file IDs and epoch cancellation.

The upload increment passes 51 tests across API/core/main, types and lint. An initial
8 MiB test exceeded its deadline using generic deep equality; native `Buffer.equals`
preserves exact-byte comparison and the corrected single run passes. Scoped review
approves without blockers in `.omo/evidence/remote-upload-review.md`.

Optional `oneOffModelSlug` now propagates through upload eligibility and prompt
admission to main's `one_off_model_slug`. Recorded model/effort stay unchanged;
effective image capability and model membership are checked, original replay retains
the override, and the next ordinary turn omits it. Historical-image fresh follow-ups
remain refused. This increment passes 56 API/core/main tests, types/lint and scoped
review (`.omo/evidence/remote-oneoff-review.md`). The first test run's Blob-internals
comparison failure is distinguished from its corrected MIME/content assertion.

This is not renderer integration. Composer consumption of the one-off selection,
remote Chat rendering, cold restoration and native/real-account acceptance are not
provided by this adapter. No arbitrary conversation ID or replacement replay body
is accepted. History remains the known limited window, not a complete transcript.
