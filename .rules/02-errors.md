# 02 — Errors and user-facing copy

## 2.1 Never show a vendor name to a user

A user bought Cortex. They did not buy our supplier list. When something we
depend on fails, the user needs to know **which capability of Cortex** is
degraded and **what to do next** — not which company we route through.

Naming a vendor in user-facing copy is wrong for four reasons: it leaks our
architecture, it is meaningless to the user, it ages badly the moment we switch
supplier, and it turns our outage into someone else's brand impression.

### The translation table

| Internal dependency | User-facing capability |
| --- | --- |
| groq | the audio service |
| WorkOS | sign-in |
| Composio | plugins |
| Polly | speech |
| any model vendor (hosted inference) | the model / the assistant |
| any transcription vendor | transcription |
| the realtime socket | the live connection |

**Bad**:

```tsx
<HonestState kind="error" title="Error" body="The groq service is unavailable" />
```

**Good**:

```tsx
<HonestState
  kind="error"
  title="Audio is unavailable"
  body="The audio service is temporarily unavailable. Try again in a few minutes."
/>
```

**Bad**:

```tsx
body="WorkOS returned 401. Check your WorkOS session."
```

**Good**:

```tsx
body="Your sign-in expired. Sign in again to continue."
```

**Bad** — this is a real defect in the tree today,
`packages/app/src/screens/chat/library-plugins-screens.tsx`:

```tsx
<PageHeader
  title="Plugins"
  subtitle="Connect the services you already use. Install path is Composio."
/>
…
body={props.error || 'Composio is not configured on this backend. Drive and Slack are not connected.'}
…
<Button variant="primary" onClick={() => props.onConnect(card.id)}>
  Connect with Composio
</Button>
```

**Good**:

```tsx
<PageHeader
  title="Plugins"
  subtitle="Connect the services you already use."
/>
…
body={props.error || 'Plugins are not available on this workspace yet. Nothing is connected.'}
…
<Button variant="primary" onClick={() => props.onConnect(card.id)}>
  Connect
</Button>
```

**Bad**:

```tsx
body="Polly synthesis failed (ThrottlingException)."
```

**Good**:

```tsx
body="Speech is busy right now. Try again in a moment."
```

### Where the name may still appear

The ban is on **user-facing strings**, not on the codebase:

- Environment variable names, service class names, module names, types, adapter
  filenames, comments, and tests may name the dependency. That is how you know
  which adapter to open.
- **Provider brands the user chose themselves are allowed to be named.** Settings
  → Providers lists the catalogue from `PROVIDER_CATALOG` in
  `packages/cortex-api` because the user is pasting *their* key for *that*
  account. A row label there is the user's own vocabulary.
- Plugin cards name the service the user is connecting to — Google Drive, Slack,
  GitHub, Paper — with official brand marks. That service *is* the product the
  user wants. The middleware we install it through is not, and never appears.
  See `06-product.md`.

The line: **the user's chosen counterparty may be named; our plumbing may not.**

## 2.2 Never leak a raw error to the surface

`error.message` is written by whoever threw it — a fetch stack, an HTTP client, a
service that may not follow our copy rules. Passing it through renders vendor
names, stack fragments, and status codes into the UI.

**Bad** — this is the pattern that lets `Composio key missing` from a 503 body
reach a user's screen:

```tsx
catch (error) {
  setError(error instanceof Error ? error.message : String(error));
}
…
<HonestState kind="error" title="Could not load plugins" body={error()} />
```

**Good** — classify, then map to copy we own:

```tsx
catch (error) {
  setState(classifyError(error));   // packages/cortex-api/src/classify.ts
}
…
<HonestState kind="error" {...copyFor(state())} />
```

Classification helpers already exist and should be extended rather than bypassed:
`classifyError` (`packages/cortex-api/src/classify.ts`), `classifyBotError`,
`backendTooOldCopy`, `farmOfflineCopy` (`packages/cortex-api/src/bot-errors.ts`),
and `CortexApiError` (`packages/cortex-api/src/errors.ts`). A raw string from the
service may be logged; it may not be rendered.

## 2.3 What good error copy looks like

Three parts, in this order: what is affected, what state it is in, what the user
can do. Sentence case. No exclamation marks. No blame. No jargon.

| Rule | Bad | Good |
| --- | --- | --- |
| No status codes | "Request failed with status code 503" | "The service is temporarily unavailable." |
| No stack fragments | "TypeError: Cannot read properties of undefined" | "Something went wrong loading this session." |
| No blame | "You entered an invalid key" | "That key was not accepted. Check it and try again." |
| Say what is affected | "Error" | "This session could not start." |
| Offer the next step | "Failed." | "The live connection dropped. Reconnecting…" |
| No internal identifiers | "code_session:abc123 not_found" | "This session no longer exists." |
| Never fake success | a toast saying "Saved" on a failed write | "Could not save. Your changes are still here — try again." |

A retry that the app performs automatically is stated in the present continuous
("Reconnecting…"). A retry the user must trigger gets a button.

## 2.4 Copy is reviewed like code

Every user-visible string is part of the diff a reviewer reads. If your PR adds
or changes one:

- Check it against `2.1` and `2.3`.
- Keep it English, sentence case, and free of placeholders like "TODO copy".
- If the string appears on a Paper artboard, match the artboard. Paper is the
  source of truth for wording on the screens it covers (`06-product.md`).
- If you changed error copy anywhere, say so in the PR and update `AGENTS.md`
  when the change alters a documented behaviour (`05-documentation.md`).
