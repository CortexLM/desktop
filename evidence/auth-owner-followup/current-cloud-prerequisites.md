# Public Cloud prerequisites: resumption readback

Read-only unauthenticated checks on 2026-10-04, after the final local regression:

- `https://api.cortex.foundation/v1/instance` returns a problem document with
  `status: 404`, `code: not_found`, `detail: No such endpoint.` and request ID
  `req_01a1066b0efb74f995a442fc2fbb9380`.
- `https://api.cortex.foundation/v1/models` returns `has_more: false`. Its two Chat
  entries, `cortex-1-mini` and `cortex-teutonic-1`, both report
  `supports_reasoning: true` and `supports_vision: false`.
- The third entry, `cortex-image-1`, has `kind: image`, not Chat, and also reports
  `supports_vision: false`.

These responses establish discovery facts only, not authentication or inference.
They do not supply a vision-capable Chat model for the requested real image plus
reasoning exchange. No account request, inference or external write was performed.
Local controlled-backend acceptance does not close this external prerequisite.
