# 05 — Documentation

## 5.1 Docs ship in the same PR as the code

A PR that changes behaviour and leaves docs describing the old behaviour ships a defect.
`AGENTS.md` **must** be updated in the same PR when the change touches:

- **Product surfaces** — a screen added/removed, an area renamed, something moving from
  preview-only to live, a blocked surface getting a design.
- **Engine routes** — `packages/protocol/src/index.ts`.
- **Environment and configuration** — a new `process.env` read, a changed default, a new
  setup step, `electron-builder.yml`, CI runners.
- **Error copy conventions** — a new `ErrorCode` or a new way of wording failures.
- Anything that would have saved you the hour you just lost.

## 5.2 Which file to update

| Change | Update |
| --- | --- |
| Agent-facing rules, gotchas, setup | `AGENTS.md` |
| A coding rule with teeth | the matching `.rules/*.md` |
| Package boundaries, IPC, data flow | `docs/architecture.md` |
| Sessions, tools, permissions, storage, bots, scheduler | `docs/engine.md`, `packages/core/README.md` |
| Catalog, providers, keys, capabilities | `docs/providers.md` |
| Local / cloud / self-host | `docs/connection-modes.md` |
| Locales, catalogs, fixtures | `docs/i18n.md` |
| Test suites, CI jobs, scripts | `docs/testing.md` |
| Computer use | `docs/computer-use.md` |
| Vendored SDK | `vendor/README.md` |

## 5.3 State what is true today

Write the present tense of the code. If something is not built, say "not yet" and where it
is tracked; never describe a plan as a feature.

**Bad**: "Cortex Cloud sign-in lets you sync chats."
**Good**: "Cortex Cloud sign-in has no engine route yet; the login screen says so."

Every path and command in a doc must exist. Check before you push:

```bash
test -e packages/core/src/computer-use.ts
grep '"audit:i18n"' package.json
```

## 5.4 Comments

Comments explain *why* or a non-obvious contract (see the header of
`packages/desktop/src/preload.ts`). Do not narrate the code. Match surrounding density.

## 5.5 Naming

Docs follow the same rules as UI copy: product **Cortex**, domain **`cortex.foundation`**,
English, no other assistant brand or codename.
