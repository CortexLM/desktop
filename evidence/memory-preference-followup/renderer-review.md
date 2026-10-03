# Memory renderer boundary correction — independent review
**APPROVED, source only. Prior P2 is addressed; no further blocking finding in this correction.**
Scope: `packages/app/src/state/runtime-settings.ts`, 67→75 lines, exactly +18/-10 against the preserved pre-correction source.
Reviewed/current SHA-256: `a441e7e520e803c49f1fb5a5755c8e2cb0efed9dcdb4f30ce284a789f44e8c00` (matches supplied pin).
Predecessor SHA-256: `481982a480a648639a8361f5e2b2fd30c3c9edba853ef0d2887e7e3b421360b3`.
The six companion renderer files still match `/tmp/opencode/memory-renderer-review.md`; their prior bounded review is reused.

## Lifecycle findings
- Lines21–22 separate committed permission from actual URL eligibility; effect lifetime follows `permitted`, not a potentially unchanged rendered `active`.
- Lines43–48 synchronously drop the owner on live/preview/gallery boundary changes. Preview departure sets no React state, preserving the outgoing main tree until its route commits.
- Lines49–50 reset loading/busy/error on live re-entry, allocate fresh sequence/pending/refresh state and reread the engine when permitted, even if preview never committed.
- The navigation listener remains installed when permission is false: live re-entry causes a render so callers using `!isPreview()` can re-enable. No settings GET/subscription is created for ordinary non-migrating shell startup.
- Native menu Back/Forward use browser history (`App.tsx:36–40`); push/replace and history traversal share the existing `navigation.currententrychange` boundary. Live-to-live changes do not reset owners.
- `reload` ignores null owners/preview URLs; old GET, PUT and finally callbacks cannot update a fresh owner. Cleanup removes both subscriptions. A previously dispatched PUT may persist; the returning GET/event refresh reads its authoritative result.
- Both guards remain: committed preview/gallery cannot create an owner; actual preview/gallery cannot read/mutate through the hook. No shared-store framework is needed.
- Bootstrap remains shared, atomic initialize-if-absent. Owner/sequence/URL and captured-key equality still guard legacy-key removal; inactive replies cannot clear it.
- `RuntimeShell` receives default NavCtx, but its committed-hash migration flag plus actual-URL guard remains sufficient. Successful key removal disables migration before its effect resets; main content is not re-gated. Pre-renderer scheduled admission remains outside this import.

## Recorded reproduction and verification boundary
- `tests/e2e/runtime-settings.spec.ts:220–278`, SHA-256 `a3749931aa28b459844b9c4ab24bb52d8762a079210a379de524416624acffe8`, is unchanged at review.
- Its GET phase holds a real completed engine snapshot; PUT is held before engine admission, then released while the actual URL is preview. Engine values and PUT counts are checked through the real bridge.
- Lines255/264 assert the original `.systeme-memoff`/`.pg-panel` stays connected and preview home never mounts. Deferred callbacks are released only after Back restores the live URL; this tests recovery without replacing the original screen.
- Existing `navigation-baseline.json`/`.log` record one failed case, two assertions, 6281ms: GET control absent with engine true; PUT checked/disabled with engine false. Embedded evidence agrees. These failures remain retained.
- Corrected runtime results were not rerun or independently admitted here. Production build/targeted suites remain coordinator-owned; source approval establishes neither packaged/native acceptance nor a passing corrected run.
- Only this report written. Source/evidence reads, byte comparisons and hashes only; no delegation, application edits, test/build execution, network, CI queries or Mac actions.

## Supporting SHA-256
- `/tmp/opencode/memory-boundary-fix.patch`: `c3d0f19aac8cb37fec5914e14ce315656828a76468e3bceec4ac4b1a6fb2d78e`.
- `/tmp/opencode/memory-boundary-fix.md`: `32cd77bc46846006e5d3835f77d5a1d38046e02607100d337694b8c333d2a5c9`.
- Baseline JSON: `62ff46271f77e4ddd9b74aa210ff96d7b108a608e7e0212b0a3fc5ba30664df4`; log: `e63410d984dcd837dec86567e9e5315c463f74cce4e22206f9526b0bf30b1166`.
