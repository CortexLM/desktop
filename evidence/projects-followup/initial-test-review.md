# Projects discovery/Electron tests — independent source review

**CHANGES REQUESTED: close the bounded evidence gaps below before treating these tests as acceptance.**
Readback 2026-10-03 14:19:32 UTC; HEAD `0597848cdbdec362e1441b44c67bf74c525feefa`. AGENTS update/rules and adopted 43-line contract read.
Scope: three discovery diffs and `tests/e2e/projects.spec.ts`; incumbent APIs/kit plus selector-only markup consulted. No review of unfinished engine/project-screen logic.
SHA-256: `shell/shell.tsx` `6ad04c18e21af3345e6f6c845efb9449629d54505a8da2600b4a97cff7183c1d`;
`screens/system/search.tsx` `3d1080ab1c3e79d61e2e50f51ef1cd49497b80a6276fa879d10acd70eea0269b`;
`screens/chat/pages.tsx` `6575d12d2393b28987b6b43643e185b97a853c5d0986f44d17de985009e3cb0b`;
`tests/e2e/projects.spec.ts` **323 lines**, `ae913237bea7aaba7b70899f393c4c52287a6338484079c913dad90ab22b2e16`.

## Findings and minimum changes
1. **P1 — released owner races can pass before the late result paints** (`projects.spec.ts:259–278`). B's URL/text already match before `release()`; the following positive assertions can return immediately. Database GETs verify committed storage, not renderer settlement.
   Add a delivered marker/response equality to the existing gate; await delivery, one bridge round trip and React paint, then assert B's identity/text. Use the incumbent `provider-key-pending`/`live-state` fence pattern; no extra case/image.
2. **P2 — History exclusion can pass while still loading** (`:161–164`). `toHaveCount(0)` is true before `useSessions` resolves; unfiltered History could satisfy that check, then satisfy B's positive check too.
   Await the ready empty copy `Your history is empty.` for A, then zero rows; keep B's positive row check. This distinguishes loading/error from real exclusion.
3. **P2 — restarted grid image lacks a ready-state/theme assertion** (`:192–197`, capture `:22–36`). Engine GETs, fonts and outer-main geometry can succeed while the Projects UI shows loading/error. A `*-dark` filename does not verify dark pixels.
   Before the existing capture, await the single remaining card/name, no loading/error, matching HTML theme and expected viewport. Attach page/console-error listeners on each new window before bridge readiness; add an error list to case3. No new capture.
4. **P2 — changed sidebar discards session-read failures** (`shell.tsx:247,254–257`). Projects may load while sessions fail; each project receives `[]`, no loading/error/retry indicates its missing chats.
   Add one shared session loading/error/Retry row using `sessions.reload`; keep ProjectRows and membership filtering unchanged.
5. **P2 — disabled-provider refusal is not identified** (`projects.spec.ts:112–124`). One session, retained text and zero fixture calls do not establish the actual rejection code or absence of an admitted user message.
   Record the real first prompt reply, assert `provider_disabled` and empty stored messages before enabling/retrying. Incumbent provider updates emit no refresh event: earlier model-refresh concern is withdrawn.

## Source approval and coverage boundaries
- Discovery filters root Chat membership correctly; Library/sidebar use record IDs, duplicate names remain separate. Search renders and navigates the same category-flattened order; History uses committed Nav params, including scoped New chat. Collapsers are native buttons with `aria-expanded`/`aria-controls` and inert descendants.
- Search/Library project loading/error/retry paths are present. Existing clear controls, preview branches and registry/component inventories are preserved by these diffs; no new fixture rows enter live discovery.
- Consulted English labels/selectors match: creation dialog/radios, instructions controls, Chat project select, Search/Library inputs and sidebar rows. No concrete selector mismatch found.
- Exactly **three cases**, **eight planned positive captures**: four per theme in cases1/2; case3 has none. Two restarts per themed case reuse both engine and renderer directories. Catalog is local data-URL, inference uses the loopback fixture.
- The gate delegates to the real IPC handler before holding its unchanged reply. One `Request.text` mutation adds forbidden `id`; assert the 400 body's `invalid_request` too. New persistent list-refusal flag correctly replaces the earlier fragile one-shot override.
- Production Vite builds do not replay StrictMode effects; earlier duplicate-read concern is not a blocker for this built-app scope. Dev-renderer runs would need all matching reads held or explicit exclusion.
- Current cases exercise persisted instruction edits/next turn, move/detach metadata, transcript preservation and post-delete ungrouped send. They do **not** exercise missing-project Home send, `expectedProjectID` races, system-role/token-budget placement, or mixed-category project keyboard selection; retain those precise boundaries, leave engine-race work with its owner.
- Same-file strengthening only: check matching system-role fixture messages, settled successful assistant UI, and exactly three upstream requests before final success; avoid claiming these from assistant-count polling alone. Cleanup should nest `finally` so a failed release/restore/close cannot skip remaining teardown.

Only this report written. Source-only; no tests, runtime, build, CI/network/Mac, captures, source edits, commits or delegation.
