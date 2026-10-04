# Saved local text — independent viewer source review
**APPROVED for this bounded source scope. No concrete blocking P1/P2 found. Runtime/UI acceptance remains unverified here.**
Scope: `text.tsx`, live-only Files CSS, registry dispatch, minimal Chat Open integration; supplied contract and contract review applied.
Pure byte/UTF-8/filename-helper correctness and locale completeness remain separately owned; this approval does not cover them.

## Reviewed SHA256 pins
- `packages/app/src/screens/files/text.tsx` (142 lines): `7e26ead69a64cbf15d7f6ebbf7bf651980789639480d448e57a9f528d731475d`
- `packages/app/src/screens/files/files.css` (434 lines): `247cc3d9e34a01181bf871607cbe5fde28691d177e9d84846b09a39d080cd083`
- `packages/app/src/screens/files/index.tsx` (37 lines): `f33a232565478e175af9da31b5fdb9a183e6327641a13a08802c0d664747e228`
- `packages/app/src/screens/chat/live-chat.tsx` (430 lines): `e8622687ab5fa179fcc8fb26974895572169c70761a51d4f3ecdf4e1e8cc0e04`
- `packages/app/src/screens/chat/chat.css` (430 lines): `a6b3ce458c29b88048d242a864e085f05f3b68078c66a87f2499bb7f5b707a0e`
Related image/media/composer/nav/shell/live-state/kit sources match `d20a012`; hashes above identify working source, not a build.

## Source findings
- `text.tsx:18–31,40–58`: singleton complete IDs, exact Chat/message/part ownership, committed preview dispatch and actual-route permission checks align. Unbound routes use Upload; preview/shot retains CodeScreen.
- `:26–28,37–65,97–104`: stable tuple identity, layout-effect subscription before GET, synchronous generations and deletion tombstone fence late reads. Shell changes retain the owner; tuple changes remount it.
- `:90–104`: departure clears ready data/actions; return after canceled deferred navigation rearms and reloads. Deletion remains unavailable on reentry; matching part updates invalidate pending reads/actions before reload.
- `:67–88`: Copy/Download share one synchronous pending fence. Fresh session GET, exact ID/kind, actual route, source generation and ready identity are rechecked before dispatch; stale completion cannot overwrite a newer view.
- `:76–79,88,128`: Copy awaits fulfillment before current-owner success. Missing clipboard API/rejection retains selectable text and localized manual-copy guidance; already-dispatched writes remain non-revocable as documented.
- `:61–62,80–85`: Download uses decoder-supplied original bytes and helper-supplied safe name, with independent 60-second Blob URL cleanup and immediate anchor removal; no synthetic saved-success claim.
- `:64,87,135–139`: 404/ownership failures become unavailable; other read/revalidation failures offer Retry; decoder refusals use bounded copy. Raw errors never render.
- `:112–139`, `files.css:358–371`: escaped source plus one hidden, nonselectable gutter string; native focusable scrollport; header/actions outside it. Live-only min-size rules, bounded filename scrolling and wrapping metadata/status address narrow panes without altering preview geometry.
- `live-chat.tsx:212–214,311–324`: native labeled text Open uses the existing exact-ownership, draft/read/submission/header guards, pointer-focus protection and canceled-Back latch; only MIME-based destination changes.
- No new provider/model/account lookup, persistence write, external fetch, interpreted Markdown, editor or fixture fallback appears in this viewer path.

## Verification boundary
Source inspection and repeated hashes only. Real Electron clipboard-after-IPC, denial, race cases, 960×640/theme/locale geometry and upper-budget responsiveness remain coordinator-owned proof.
No fix requested. Old image/build evidence does not establish text-viewer behavior.
Only this report written; no repository edits, staging/commit, delegation, app runtime, product tests/builds, network, CI or device actions.
One read-only hash-helper invocation had a Python syntax error; corrected invocation succeeded. Neither invocation executed product code.
