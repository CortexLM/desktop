# Approved continuation adaptation

Authority: `/root/cortex-ui/review/g1-remote-adoption.md`, request 92,
`owned-auth-continuation`. This permits existing Login regions, not a new shell.

The coordinator recomputed the four sealed SHA-256 values; all match the receipt:

| Source beneath `/tmp/opencode/cortex-remote-completion-20261004/final-build/sealed/` | SHA-256 |
| --- | --- |
| `desktop/src/screens/lot-platform.tsx` | `322f1549558dc7d4dd3be8ac7c66585a721784b7f9b239c1b7fe6f58b20774ae` |
| `desktop/src/screens/lot-platform.css` | `c490a8b90ef32c972cb22262152ecc0fc1ad1f9cca7aae12c9e418c9370c3deb` |
| `ios/src/screens/lot-platform-auth.tsx` | `7dc5c87c56162e8deaef73b76129a513e46c725ecd3c2518751bd45dde987be4` |
| `ios/src/screens/lot-platform.css` | `adeb0fd7e7935e2fff20289547f1224c6b4827fad51a987523edd54c016d8991` |

Adapt only the labeled form and primary/restart ordering into existing
`account.tsx::LoginScreen`. Reuse the shared field, button, error and OTP components.
Verification accepts 1–128 trimmed characters, including letters and punctuation;
MFA uses six numeric digits. Main supplies checked status, owner and candidate.
Existing owned submission/cancel paths remain authoritative. Pending B never
becomes authenticated merely because active A makes `signedIn` true.

Enrollment remains unavailable. Expiry has no admitted signal: no invented TTL,
countdown or expiry state. Do not import prototype credentials, timers, diagnostic
JSON, QR material, transport fixtures or the prototype shell.

Acceptance requires real SDK-backed continuation tests, stale-owner and cancel
refusals, retry draft retention, eight localized catalogs, keyboard access and
both-theme narrow/wide captures. This map records scope, not implementation or
whole-product acceptance. Production forms are implemented. Fourteen targeted
Electron cases pass at `/tmp/opencode/auth-continuation-corrected`; the initial
11-pass/3-failure run is retained separately. Those failures came from an attribute
assertion on an implicit native text input and an incomplete MFA fixture response.

Scoped independent review approves the forms and eight English screenshots:
`.omo/evidence/continuation-form-gate-review.md`. Expanded locale verification
passes in 59.5 seconds at `/tmp/opencode/auth-continuation-locales-corrected`,
covering both continuations in eight languages and both themes, Tab reachability
and Enter submission. It records 112 state observations including existing auth
states and 32 new continuation captures. Two preceding geometry failures are kept:
the measurement incorrectly clipped the input's border to its own content box;
ancestor clipping and actual hit-testing remain enforced after correction.

Full Electron regression passes all 169 cases in 17.5 minutes with one worker at
`/tmp/opencode/auth-continuation-full`; preceding typecheck and lint pass. Coordinator
inspection of French light verification and Japanese dark MFA captures confirms
readable copy and reachable focused controls at 960×640; this is a sample, not an
independent review of all 32 locale captures.
The matching Linux package also passes its startup check (`SMOKE OK`, exit 0).
Native verification, real account acceptance and immutable build binding remain open.
