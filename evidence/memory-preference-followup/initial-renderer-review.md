# Memory renderer — independent source review
**NEEDS CORRECTION: one P2 lifecycle finding. Other reviewed bindings match the bounded contract.**
Base: `74579d574646aff5dbd462247b4fd47a99dd2cdd`. Only this report written; no implementation, tests, builds, network, CI or native actions.
Reviewed seven renderer files and sixteen changed catalogs. Concurrent new E2E source was not reviewed.

## P2 — canceled preview navigation can strand the live settings owner
- `state/runtime-settings.ts:21,33–37,59–64`: response acceptance uses the actual URL, but owner reset/reload depends only on rendered `active` (`40–48`). Actual URL changes are not subscribed to.
- `App.tsx:23–28` deliberately defers route commits. A live page can therefore retain its mounted owner while the URL already points at preview.
- Read/migration sequence: hold its response; start a deferred live-to-preview navigation; deliver the response while `liveRoute()` is false; Back to the original live entry before preview commits. The response is discarded, yet `active` was true before and after; no effect reruns. Loading/bootstrap can remain indefinitely with no Retry.
- PUT sequence: start toggle, hold reply, enter that same uncommitted preview URL, deliver reply, then Back. Success/error handlers are skipped; `finally` clears only the ref's pending flag and returns before `setBusy(false)`/queued refresh. The original live switch can remain disabled with stale state.
- This is a source-derived interleaving, not a newly executed reproduction. Existing `tests/e2e/navigation.spec.ts:85–124,160–190` already establishes the supported deferred/canceled-route pattern.
- Minimal correction: observe actual live/preview boundary transitions (existing `navigation.currententrychange`), invalidate the old request owner, and rearm/reload on live re-entry even if the committed route never changed. Clear busy/queued-refresh state for the new owner; retain both committed-mode and actual-URL write guards.
- Add one bounded held-response navigation regression covering initial/migration read and PUT: return without committing preview; require recovery, actual engine value, no preview mutation and no stuck disabled control. No shared global settings store is required.

## Other reviewed invariants
- `RuntimeShell` is outside Shell's NavCtx and receives default home/empty params (`nav.tsx:7`); its explicit committed-hash `migrating` flag plus hook `liveRoute()` prevents that default from authorizing ordinary preview/gallery writes.
- Startup legacy-false gate replaces main content until accepted import; error offers Retry. Shell still mounts navigation. The acknowledged pre-renderer scheduled-admission limitation remains separate.
- Shared bootstrap calls only initialize-if-absent PUT; settled current owner/sequence plus exact captured localStorage value are required before key removal (`runtime-settings.ts:13–15,30–35`). Engine values win.
- A settings event during bootstrap joins the pending promise or performs a no-change initialization; it does not create an unbounded settings-event loop.
- Normal mounted-live PUT invalidates older GETs, synchronously rejects duplicates, queues event refresh behind the write and retains the last accepted checked value on refusal. Error copy stays catalog-owned, never raw.
- Committed unmount/active changes invalidate callbacks through owner identity; the finding concerns canceled navigation without an intervening inactive render.
- Memory and Privacy show loading/error rather than invented on/off. Save refusal preserves state and supplies Retry; unknown settings do not falsely show the paused banner.
- Live Memory rows are no longer faded/inert while paused; manual export/Forget and prior mutation guards remain. First-listed-Bot ownership is unchanged; live note provenance now uses saved time, not “learned” copy.
- Privacy's live row is a div, so whole-row label activation is removed; the directly named Base UI switch retains keyboard/control access and disabled support. Not a blocking accessibility finding for this contract.
- Bot empty-copy replacement is confined to the live branch; preview text/temporary controls remain. Exactly seven new keys exist in each locale, prior catalog values unchanged, `{name}` preserved only where required.
- Author-reported scoped lint and integrated260-unit/one-optional-skip results are noted, not rerun or upgraded to renderer proof. Type/E2E and native acceptance remain pending; f82 evidence does not certify Memory.

## SHA-256 — reviewed renderer bytes
- `packages/app/src/state/runtime-settings.ts`: `481982a480a648639a8361f5e2b2fd30c3c9edba853ef0d2887e7e3b421360b3`
- `packages/app/src/App.tsx`: `8e70b0f8e145da3a89d5337330c84f6bfdaa2ce2f24d629466f375d7887aba7d`
- `packages/app/src/shell/shell.tsx`: `05eb0b2d7e013d735a3d95d259986a8fb5202f9b04e5c1142d787126bdfc0056`
- `packages/app/src/kit/ui.tsx`: `df465e775780fca2e8022cd591a6e33a6865191c4b1a8818c32eb664f238bd50`
- `packages/app/src/screens/system/projects.tsx`: `7928365a51f542d6c1af0a1dab3f11c3d7a80560e105130746b39adabb425011`
- `packages/app/src/screens/system/settings.tsx`: `8b012ffa2b1b464bb82b7f050b82275564ecb1dc9708dce2be35a64aefcd6d48`
- `packages/app/src/screens/bots/team.tsx`: `1953d41d75427d9d5b55f3baec75102443149df6b802900e0d8ed513562eb14c`

## Catalog SHA-256 (`packages/i18n/locales/<locale>/`; system.json then bots.json)
- en: `11c7908686eaee10c25a9426441fb79c1e72a48d324e22e486fcf0db9aaba8fe` / `3c16b300332752ca200884548941ebb3b5562fd4a9ed1a2ce5f350411798681f`
- fr: `6f7ffa8dd7df0b777d31765fe137adaf6a4cefaed5d2d093ade6085d089eafa4` / `04b273e95c79e8028ac2f87722c2090ba06be49d925775b77abb6944bcc4444e`
- es: `42ff4ba0148e93fd253c93042f63a10b170a17ce0927cfe84223e965a3b40ba3` / `13d924e10d0b0f54f24c418635d6bb29d3d70fb97842c9c96c60dbed34867586`
- de: `39b5eaf5e868100d58d573ca8eef2d79107ddad33e8b53f0a87b88ca70da2f3a` / `b7d3ad8f372e43945a62a78af1f796b6b14a12365b19de196d325d4f9eeadc33`
- ja: `2d98ffc71f748bafef451cf863a4016261ee93bd04464d3e29333940879b09b5` / `7f618da63fba22af74c99a7fcdade46aeb9e7601eeed2f01c9f884bd71626986`
- zh-Hans: `6e58861ef1eac4edaf06c6ea0afe567fe1e4044a3330174fce7e85a0bf016c70` / `6026f342983369aea5561921504e29b1b8fac05fb93e17145325c26d7920ca32`
- pt-BR: `c948340c14c778ccdc228bd5d05624973b38b8cb363d3d241edf192b37d5b260` / `51ae0004e67f5d19bbc2e4be119971554aad7249838fe87da8527bf8bc11f48b`
- ko: `cbec22765b16d4663acd124bb0c52e1d01879eacee74670ce1d565a22eb5e5ef` / `f2bc182ca5f775bce137f1178b0e6c5f65301bdce7c4fb2424b8cc92f4d496bb`
