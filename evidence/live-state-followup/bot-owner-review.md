# Bot route-owner correction — bounded source approval

**APPROVED for explicit live Bot route-ID changes. No blocker found.**

## Exact reviewed delta

`packages/app/src/screens/bots/bot.tsx:167–170`:

```tsx
export function BotPage() {
  const { params } = useNav();
  return isPreview() ? <BotPagePreview /> : <BotPageLive key={params.get("id")} />;
}
```

- Corrected file SHA-256: `f660ed2a4ab303bf55527ed8c9d8c4e535df786675790509f51a55c21409a6f1`.
- Reversing exactly this two-line replacement reproduces baseline SHA-256 `e721403221a1103b20752f91dffb4512ca021d629d57d3be3fd8153109105969`; baseline matches the retained negative-run source. No other Bot-file delta.
- Test SHA-256: `21af3392fad947945861063d93625d6115675f288ff43273568ea1fe4c50cdff`; current 145-line test equals the negative-run copy.

## Ownership and navigation

- A changed committed `id` replaces the entire live subtree: `sid`, session/memory/routine query state, `useMessages`, and Composer draft/submission state. Beta starts with fresh queries and no Alpha session selection (`bot.tsx:246–259,328`; `composer.tsx:43–56`).
- Key and `useTargetBot` both read `useNav().params`. App stores the route/history snapshot in `h`, passes it to Shell, then to `NavCtx` (`App.tsx:18–33,42–46`; `shell.tsx:20–22,86`; `nav.tsx:26–31`). A pending URL change alone cannot change this key or prematurely clear the outgoing live draft; replacement occurs with the committed route snapshot.
- `theme`/`v` changes with the same `id` preserve this key. The preview branch receives no new key; its fixture markup and existing parent remount policy remain unchanged. This delta does not alter the existing `isPreview()` predicate or preview gate.
- Late query completions retain the old instance's state setters; they cannot populate the new keyed instance. `useMessages` also invalidates its lifetime on cleanup (`live.ts:119`). This is instance isolation, not cancellation of every outstanding read.
- An Alpha send already invoked before navigation retains its captured `bot`/`current` and created-session result (`bot.tsx:268–274`). It may finish against Alpha; its late `setSid`/Composer setters cannot select or clear Beta's new instance. No cancellation or broad privacy guarantee is implied.
- Boundary: absent/empty `id` falls back to the first Bot (`bot.tsx:28–35`). A list mutation changing that implicit owner without a route-ID change is outside this approval. Switching explicit IDs intentionally discards the outgoing local draft.

## Regression evidence inspected

- Read `tests/e2e/bot-owner.spec.ts` and `/tmp/opencode/bot-owner-regression/README.md`, plus `negative-complete/summary.json` and retained source copies.
- Two themes, real Electron preload/IPC and persisted engine histories. The gate delays one already-computed Beta session-list response; it does not fabricate that list. Checks cover empty user/assistant rows while held, released Beta history, observed DOM ownership, actual prompt path, and both persisted histories (`bot-owner.spec.ts:85–135`).
- Negative receipt records two failed cases, twelve intended assertion failures, zero setup failures/skips/flaky cases. Both actual follow-ups went to Alpha. Soft assertions continue to the wrong-write proof and still fail the cases; the test contains no expected-failure waiver.
- The test establishes the reported route/session defect. It does not directly exercise an unsent draft, an already-pending Alpha send, or same-ID query changes; those conclusions above are bounded source reasoning.

Source review only; no tests, builds, CI, native actions or captures run here. Positive rebuilt-package verification remains coordinator-owned. The earlier `compare-initial` receipt remains pinned to its pre-key source fingerprint, not this corrected renderer.
