# Preview departure — independent source review

**Bounded approval. The demonstrated Work-preview-to-live-Code null-context crash is addressed. No concrete blocking regression found in the scoped change.**

## Direct cause and closure

- Installed negative evidence `evidence/mac/b0e6d78/terminal-departure-failure/manifest.json:12-14` records the null `live` destructuring error. The worker's `/tmp/opencode/preview-departure-fix/baseline-direct.log:7-24` independently records null `cfg` during the real held native transition. Both expose the mismatch between the advanced URL and still-mounted preview.
- `packages/app/src/App.tsx:42,46` now supplies preview lifetime from the same committed `h` snapshot used by Shell. A shell-only rerender during deferred navigation cannot change that provider lifetime based on the destination URL.
- `packages/app/src/preview.tsx:22-24` returns the mounted provider's context. `packages/app/src/screens/work/home.tsx:260-276` selects the preview branch and its variant from committed navigation parameters and obtains its mascot from that context. The outgoing Work tree no longer calls the global-URL-dependent `useMainBot()!.cfg`, nor borrows the incoming route's variant.
- Variant setters remain the existing `useVariant` setter. Its history replacement commits new parameters through App; Work reads the committed parameters. The unused variant value may still trigger a render on hash change, but it no longer changes Work's identity/state ahead of that commit.

## Live boundary and preview lifetime

- `preview.tsx:66` passes a null locale on the committed live render. `:28-35` resets `initial`/`data` during provider rendering before descendants render, so live children receive null context (`:40`). This does not extend preview state beyond the live commit.
- Prior preview setters retain an old `initial` identity; the guards at `:36-38` reject their updates after live/locale reset. In particular, Work's departure cleanup at `home.tsx:308-314` cannot restore its former activity into a null live context. Returning to preview creates a fresh initial identity/name/activity/draft; no persistence was added.
- A committed Work preview only mounts after fixture loading (`preview.tsx:61-66`), with the matching provider initialized. The non-null destructure at `home.tsx:272` therefore has an owner throughout the reviewed departure path. The retained `BotPagePreview` consumer at `screens/bots/bot.tsx:177-178` likewise no longer loses context merely because the global URL advances while its preview instance remains mounted.
- No engine write or live fixture fallback was introduced. This is approval of the demonstrated departure/lifetime change, not a claim that every existing global `isPreview()` consumer has been migrated.

## Regression review

`tests/e2e/navigation.spec.ts:316-379` holds the actual native update callback and returns its native promises/object. It changes only same-document `location.hash`, reproducing the installed transition boundary. The DOM sidebar click at `:351` deliberately forces an outgoing-tree rerender while native painting is suspended; it does not substitute a transition or fake screen data.

The test asserts the original element remains connected, the Done widget/draft remain present before release (`:352-355`), then requires live Code, disconnected outgoing DOM, no variant picker/fixture sidebar labels and empty real engine Bot/session lists (`:356-369`). Page-error assertions remain strict. Existing Bot lifetime coverage at `tests/e2e/bot-safety.spec.ts:211-258` checks locale reset, exit/re-entry name/activity/draft reset and engine isolation; read only, not rerun here.

## Verification boundary

Source/diff and supplied negative-evidence review only. No tests, builds, Mac/CI actions, commits or source edits. Auth and terminal-CSS work excluded. Only this report written; no delegation. The coordinator's prior 90-case pass predates this correction and is not used as post-fix runtime proof.

## Reviewed SHA-256

```text
b48dcc43f2142029197d451c749713dfd94c47742785ebb094900ca7517c6518  packages/app/src/App.tsx
5734b59643af8811a75159c651ee23bf3c766b5abe5d428cbef34b8f70873629  packages/app/src/preview.tsx
61e37805bd9591619ce82e1e0e73af39fcf79b76ac0277bbf6b531a311cfd5b8  packages/app/src/screens/work/home.tsx
59faac9327ee70fa71750953e089552b97b3507388f391bc22b1ff2434a55f62  tests/e2e/navigation.spec.ts
```
