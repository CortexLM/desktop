# Independent review — local transcript reconciliation

**`useMessages`: bounded source approval against current local producers. No new hook defect found.** One actual **P2 Bot-owner integration defect** remains: selecting another Bot can retain the first Bot's locally selected session, show its messages under the second Bot, and persist the next prompt into the first session. This is pre-existing caller state, not introduced by the hook patch.

## Reviewed source

HEAD during review: `1076c2584941cf054efffaf709a149b4195bc1c4`. The candidate is an uncommitted working-tree change; approval attaches to its bytes:

| File | SHA-256 |
| --- | --- |
| `packages/app/src/state/live.ts` | `fde8193d44f8e943915b18a5b3dc074ef048dc1f37cd580f25db1f2bfab6ed34` |
| `packages/app/src/screens/bots/bot.tsx` | `e721403221a1103b20752f91dffb4512ca021d629d57d3be3fd8153109105969` |
| `packages/core/src/session.ts` | `8bdaadc276264e3e755c73df44bd894b884826875a6e582149dccc69086b81d4` |
| `packages/core/src/storage.ts` | `1c56b82e24b89b68733e7cf5ba38a7d241f11f66e7a3857e0561ec3728bff255` |
| `packages/core/src/bus.ts` | `5e75b98b548cb4adc8f7eb98d23ee89bea86705c45eee485b494632a8ec0bb53` |
| `packages/schema/src/index.ts` | `0403846e16c38e7f06c077d7980a9c375898ba413f5aa5f93cf863d7229f5361` |

## Hook integration conclusions

1. **Snapshot/live overlap:** `live.ts:59–75,98–117` retains rows/parts by ID. Empty stored text cannot overwrite received deltas; a final full text/reasoning part replaces the partial text rather than appending it. A full snapshot arriving ahead of queued SSE marks that part settled, suppressing queued empty starts/deltas. Live final values survive a late snapshot. Parts arriving before message info remain buffered until info arrives. Older history is merged rather than discarded.
2. **The `settled` assumption holds for actual local producers.** `session.ts:332–358` publishes an empty text/reasoning start, live-only deltas, then the full part on close. `297–302,399,415` close/remove open parts at text end, step end or finalization. No current producer persists incremental nonempty text under the same part ID and then continues its deltas. User text is published once (`174–181`). Tool parts move pending/running to completed/error (`360–387,416–420`). Files and step markers are immutable. This is a local producer guarantee, stronger than the bare `Part` schema.
3. **Storage and object lifetime:** `bus.ts:12–16` clones publisher objects and commits durable events before delivery; later provider mutations do not mutate the renderer's prior published objects. `storage.ts:24–25,103–110` persists full updates, not deltas. `141–149` sorts messages/parts by ID, matching the hook's comparator for the ASCII IDs generated in `schema/src/index.ts:8–18`. Snapshot reads are synchronous in-process.
4. **Completion cannot regress to open:** `live.ts:62–63` rejects an incomplete update over a completed message and lets completed snapshot info upgrade an incomplete live row. Current local code assigns `time.completed` only once, in `session.ts:422–424`; no competing completed revision exists.
5. **Admission does not get masked by an older completed assistant.** `session.ts:135–145` reserves the session before async validation but emits no `session.status` there. The new user is persisted at `150/174–181`; the new assistant is persisted at `286`; only then is `busy` published at `287`. Therefore an observed new-run busy event has a new incomplete assistant ahead of the old completed one on the ordered SSE stream. The hook's `live.ts:55–57` normalization does not discard that active status. There is no current local `retry` publisher. A future pre-admission busy/retry producer would require revisiting this inference; it is not a present defect. Composer submission guards cover their own pending requests (`model-composer.ts:69,81–91`; `composer.ts:46–56`).
6. **Deletion/session-argument changes:** `live.ts:81–85` clears state and invalidates the captured read; cleanup also invalidates old callbacks. `121` hides mismatched-session messages/status during render, before effects run. The hook correctly handles a changed argument, including undefined. It cannot detect a changed Bot owner when its caller keeps supplying the same old session ID.

These are source-review conclusions, not a new Electron acceptance claim. The original four negative Electron cases in `/tmp/opencode/live-state-race/README.md` were read, not rerun. Coordinator owns rebuilt positive verification. No `useQuery` redesign is recommended by this hook review.

## P2 — Bot selection retains the previous Bot's `sid`

**Location:** `packages/app/src/screens/bots/bot.tsx:167–168,249–258,267–272`.

- `BotPageLive` is unkeyed. The shell also preserves the live Bot subtree across Bot query-parameter changes (`shell/shell.tsx:120`).
- Sending the first request to a Bot without sessions sets `sid` at `bot.tsx:270`.
- Navigating to another Bot changes its title/config, but `sid` remains. `current = sid ?? list[0]?.id` therefore keeps the previous session even after the new Bot's actual session-list response finishes.
- `useMessages(current)` receives the unchanged old ID, so its render-time owner check cannot help. `send` also uses that old `current`, causing a real wrong-session write.
- Even without a locally set `sid`, retained `useQuery` data can briefly keep the old session before the new list resolves. Keying this screen boundary addresses both cases without changing the shared query hook.

### Bounded actual reproduction

One isolated Chromium/Vite browser probe imports the real repository app and current hook. Ephemeral ports, separate in-memory core/SQLite, actual session runner/client/server and fixture HTTP provider. No source transformation, mocked message events, fabricated history, shared API, app build or Electron launch.

1. Create Alpha/Beta through the real core. Persist Beta's existing turn through the provider.
2. Open Alpha, initially without sessions. Send its first request using the real Composer, setting the component's `sid` through ordinary UI behavior.
3. Click Beta in the actual roster. Hold one completed real `GET /api/bots/{beta}/sessions` response; leave all other responses/SSE live.
4. Beta's title and composer placeholder appear, but Alpha's transcript remains. Release the unchanged response; Alpha's transcript still remains.
5. Submit `Intended for Beta after navigation` from Beta's displayed composer. The real engine persists it in Alpha's session; Beta's session is unchanged.

Observed final user text:

```json
{
  "Alpha": ["Alpha first request", "Intended for Beta after navigation"],
  "Beta": ["Beta saved request"]
}
```

**One test, four intended assertion failures**, zero page errors, Node22.23.3, exit1 in4.972s. Screenshot `bot-wrong-owner.png` inspected: Beta title/placeholder with Alpha request/answer. This is browser content, not installed/native evidence. `bot.tsx` matches HEAD exactly; the defect is not attributed to the candidate hook diff.

### Smallest correction recommendation — not applied

At the existing `BotPage` boundary, key only the live page by route owner, as Chat/Work/Code already do for session owners:

```tsx
export function BotPage() {
  const { params } = useNav();
  return isPreview() ? <BotPagePreview /> : <BotPageLive key={params.get("id")} />;
}
```

Coordinator owns approval and application of this separate caller fix. The current hook can receive scoped approval; a claim that Bot route ownership is fixed cannot.

## Receipts

`/tmp/opencode/live-state-review/` contains:
- `bot-owner.test.ts`, `vitest.config.mjs`: isolated runnable reproduction.
- `bot-owner-results.json`, `bot-owner.log`, `bot-owner-observation.json`, `command.json`: final intended negative result and exact observations.
- `bot-wrong-owner.png`: inspected rendered contradiction.
- `source/`, `provenance-before.json`, `provenance.json`: exact reviewed sources, before/after hashes. All90 existing dist members remained unchanged during each probe; hook, core, SDK source and the other owner's E2E file also remained unchanged.
- `setup-timeout/`, `setup-locator/`: retained harness failures. Initial run timed out awaiting an exact accessible name; bounded diagnostics located the same mismatch on the roster button. Final harness clicks its existing button class plus visible text. These setup failures are not counted as defect proof.

```sh
NODE_ENV=test TMPDIR=/tmp/opencode/live-state-review /root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node node_modules/vitest/vitest.mjs run --config /tmp/opencode/live-state-review/vitest.config.mjs --configLoader runner
```

Only assigned temporary review files written. No repository edits, delegation, build, repository/global suite, Mac, CI, commit or push.
