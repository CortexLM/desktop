# Installed b0e6d78 — bounded native review

**12 recovery checks and two warm-font Work cases pass their recorded assertions.
Two application failures remain: preview departure and long-output terminal viewport.
No full terminal or product acceptance.** Audit completed `2026-10-03`; existing artifacts
only, no application/source-fix execution or live Mac access.

## Package and source binding

- Revision: `b0e6d78bdfe5a4cc74aed3fdefb6ecf4001cb874`.
- Application ZIP SHA-256: `a7844d93d70286e6b0ed31e2ea82e26616a777b8a100e06c9ca2eba1715f755b`; **144,920,353 bytes**, 697 entries / 376 non-directory members.
- ASAR SHA-256: `71f560e62bf0d0a8cf0e72beb85611eb413acf9fe10e2cacc3d9f1fedd5b4c04`; **28,346,113 bytes**. Independently parsed its 91 members and checked its integrity hashes; all **90 build members** equal both the retained manifests and pristine isolated build. ZIP-embedded ASAR equals the separately retained ASAR.
- This confirms [package.json](package.json) and [build/package-match.json](build/package-match.json). The copied [build README](build/README.md) is the earlier preparation receipt; its “not yet checked” statement predates the successful comparison.
- Additional package check: exactly **8 locales × 13 catalogs = 104 JSON files**, each byte-matching the pinned Git-source manifest; `skills/summarize/SKILL.md` also matches. No fixture directories or `.source.json` files among ZIP resource members. Renderer preview content remains inside its bundle; this exclusion is not a claim that preview code is absent.
- Packaged metadata: Cortex `0.2.0`, identifier `foundation.cortex.desktop`, executable `Cortex`, main `packages/desktop/dist/main.cjs`; no package scripts/dependency lists. Other native archive resources were not compared or executed.

[Source observation](source-observation.json) correctly separates **17 observed files**:
14 match the pristine pin; `packages/app/src/screens/system/settings.tsx`,
`packages/protocol/src/index.ts`, `packages/i18n/locales/en/system.json` differ.
Compared recorded hashes against the retained pristine source manifest, without reading
current implementation files. These mixed observations do not replace the installed-ASAR
binding or the pristine 473-file fingerprint
`6c90fb3eb38af09db9566e68b33f441da4eea3dd367ccfec39c31d06419f8902`.

## All sixteen originals reviewed

Opened **every source PNG at full resolution**, not just contacts. Recomputed PNG/WebP
file hashes, dimensions and decoded RGBA bytes against all three `retained.json` files:
**16/16 exact**, 16 unique originals. Recovery/Work: fourteen **960×640** images;
terminal: two **1024×685** images (actual size, despite helper's 1024×686 request).
All manifest-listed capture hashes match. Original JSON receipts equal retained copies.

| Original filenames, both themes unless noted | Full-resolution observation |
| --- | --- |
| `memory-add-refused-{light,dark}.png` | Draft `Keep this memory.` remains readable with save-failure toast; native traffic lights visible. |
| `memory-add-pending-{light,dark}.png` | Draft remains visible; Add visibly disabled while request is held. |
| `memory-delete-refused-{light,dark}.png` | System Memory retains `Retain this note.`, delete action and failure toast. |
| `memory-wipe-partial-{light,dark}.png` | One survivor plus failure toast **under a native confirmation overlay**. Dialog says “Erases all 2 memories. Can’t be undone.” while background count is 1. |
| `approvals-load-error-{light,dark}.png` | Recovery heading/body and `Try again` readable. |
| `settings-model-metadata-{light,dark}.png` | Matching model context/cost and three capability badges readable; saved key hint only. Lower provider-detail model row is outside these frames. |
| `work-done-bottom-{light,dark}.png` | Settled preview summary above composer, native chrome intact; no board/task overlap in these frames. |
| `terminal-exit-light.png` | French `[Commande terminée avec le code 7]` visible; next command awaiting permission. This is the one successful terminal capture assertion. |
| `terminal-unreachable-tail.png` | Additional **English** diagnostic after failed run/locale cleanup; repeated output extends below frame, tail absent. Not a successful French truncation capture. |

The two wipe images are **not unobstructed interaction proof**. Recovery helper hash
matches the run; it asserts one accepted confirm event per wipe call, initial wipe plus
retry in each theme. Manifest records zero unexpected dialogs, but no numeric accepted
confirmation counter. Renderer `elementFromPoint`/opacity checks cannot detect native
modal occlusion. Capture timing versus native dismissal remains unresolved; do not infer
that an engine mutation was still pending from the visible dialog. Narrow wipe helper
copy is also ellipsized.

Capture scripts POST native window IDs to forwarded helper port 19445; the pinned helper
uses `screencapture -o -x -l`. Images include OS-rendered traffic lights/rounded window edges.
Recovery has a run-pinned helper hash; Work/terminal manifests omit helper hashes. Those
helper hashes are audit-time observations, not retrospective execution attestations.

## Runtime assertions and limits

**Recovery:** six cases per theme plus one setup record; 12 captures. Recorded real-engine
responses: deleted-owner add `404/not_found`; held duplicate Enter/blur yields one `201`;
Bot/System single-delete refusals `404`, retry `200`; partial wipe waits for both `404/200`,
preserves the exact survivor, then deletes only that survivor on `200` retry. Matching and
provider-detail model rows each pass readability/non-overlap checks in both themes.
Approval Retry ends at a genuinely empty list; **no pending-permission native coverage**.
Recovery records no page/console errors, restored request hooks/appearance and identical
before/after installed ASAR/process. Runtime checks do not remove the wipe-image overlay limit.

**Work:** both warm/ambient-font cases reach `top=609`, `height=1068`, `viewport=459`,
`gap=0`; user wheel leaves `top=469`, `gap=140`. No recorded page errors. Cold-font ordering
is outside this native lot. First attempt failed solely on helper `playwright` import;
corrected helper produced the two successful cases. Original failure log remains retained.

**Application failure 1 — preview departure:**
[manifest](terminal-departure-failure/manifest.json) records
`Cannot destructure property 'live' of 'eg(...)' as it is null.`, followed by a missing
Code composer timeout. Coordinator identifies preview Work `usePreviewBot` context loss
on departure to live mode; this audit confirms the recorded error, not a new source
diagnosis. No screenshot was produced by that failed attempt.

**Application failure 2 — terminal viewport:**
[manifest](terminal-viewport-failure/manifest.json) remains **failed**. Light-theme French
full-text, exit/truncation metadata, preserved English output lookalikes and exact reload
checks passed first. Native truncation-marker visibility then failed. The subsequent
[inspection](terminal-viewport-failure/scroll-inspection.json) records `pre.term` rect height
**58,966**, client/scroll height **58,964**, `scrollTop=0`; annotation y **59,083** exceeds
the 685px window. A clipped ancestor prevents the tail from being reached through that
terminal viewport. Provider receipt has only `exit`, `large`, `complete`: **no replay
request**, no dark-theme completion. No terminal `asarAfter` field was written on failure;
the later cleanup receipt separately records the same ASAR.

Earlier [terminal setup failure](terminal-first-failure/manifest.json) is also preserved:
loopback provider unavailable, zero captures/checks. Coordinator attributed it to
`/tmp` versus `/private/tmp` starter identity; inspected corrected starter resolves the
script path. This harness failure is separate from both application failures.

## Handoff

Detailed local inventory/assertions: `/tmp/opencode/native-b0e6d78-audit/`
(`images.json`, `native-checks.json`, `source-binding.json`, `asar-members.json`,
`package-resources.json`, `helper-receipts.json`, `audit.json`, runnable `verify.py`).
Source PNGs remain in the three coordinator-provided `/tmp/opencode/native-*-b0e6d78*`
directories; retained WebPs remain RGBA-identical.

[Cleanup](cleanup.json) records capture/provider shutdown, ordinary LaunchServices launch,
dark appearance and unchanged ASAR. Port closure and lease release are coordinator-reported;
not re-probed here. This review used no Mac/CI/build/runtime operations, current fix source,
or real-provider requests. Later fixes require their own revision-bound evidence.
