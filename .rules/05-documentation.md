# 05 — Documentation

## 5.1 Docs ship in the same PR as the code

Documentation is not a follow-up. A PR that changes behaviour and leaves the docs
describing the old behaviour has shipped a defect: the next contributor reads the
doc, trusts it, and builds on a false premise.

`AGENTS.md` **must** be updated in the same PR when the change touches any of:

- **Product surfaces** — a new or removed screen, a renamed destination, a change
  to what Chat / Code / Bot each contain, a change to the product switcher.
- **Routes** — anything in `packages/app/src/routes.ts` or `route-tree.tsx`.
- **Environment and configuration** — a new variable, a changed default, a new
  required setup step, a toolchain or native-module change.
- **Error copy conventions** — a new classification, a new honest-state kind, a
  change to how a failure is worded.
- **Anything that would have saved you the hour you just lost.** That is the real
  test for whether it belongs in `AGENTS.md`.

## 5.2 Which file to update

| Change | Update |
| --- | --- |
| Agent-facing rules, gotchas, non-obvious setup | `AGENTS.md` |
| A coding rule with teeth | the matching `.rules/*.md` |
| Product behaviour of one surface | `docs/chat.md`, `docs/code.md`, `docs/bot.md`, `docs/bot-runtime.md` |
| Host differences | `docs/web-vs-electron.md` |
| Package boundaries, data flow | `ARCHITECTURE.md` |
| IPC channels | `docs/IPC_ARCHITECTURE.md` + `packages/shared/src/types/ipc/*` |
| Service endpoints and observed behaviour | `packages/cortex-api/CONTRACT.md` |
| How to run and contribute | `README.md`, `CONTRIBUTING.md` |
| Test layers and commands | `TESTING.md`, `08-testing.md` |
| Security posture | `SECURITY.md` |

## 5.3 Documentation states what is true today

Write documentation in the present tense about the code as it is. Aspirations
belong in an issue.

**Bad** — describes a design that the code abandoned. This exact drift exists in
`docs/chat.md` and `ARCHITECTURE.md`, which still say Planning, Projects and
Library persist to `localStorage`; they have been service-backed since
`createRemoteCollection` landed:

```md
Planning, Projects and Library are stored in `localStorage` and are per-device.
```

**Good**:

```md
Planning, Projects and Library are service-backed (`/v1/planning/tasks`,
`/v1/projects`, `/v1/library`) through `createRemoteCollection`. `localStorage`
holds no product rows.
```

**Bad** — a command that does not exist. `AGENTS.md` referenced
`bun run quality:check`; the root manifest only has `quality:duplication` and
`quality:circular`:

```md
Run `bun run quality:check` before opening a PR.
```

**Good** — commands copied from `package.json`:

```md
Run `bun run typecheck`, `npx eslint packages`, `bun run test`, and
`bun run test:discovery` before opening a PR.
```

If you find drift while working on something else, fix it in your PR when it is a
line or two, and say so in the description. If it is larger, open an issue and
link it from the doc.

## 5.4 What a good comment is for

Comments explain **why**, constraints, and traps. They do not narrate the code.

**Bad**:

```ts
// Increment the counter
count += 1;

// Loop over the mascots
for (const mascot of mascots()) { … }
```

**Good** — the reason the code is shaped this oddly:

```ts
/*
 * Fonts resolve from the local install rather than being fetched: this is an
 * Electron client, and a webfont round-trip on launch shows unstyled text on
 * the first frame.
 */
```

Module headers in this repo carry real history — why a store stopped being
`localStorage`, why a native addon needs two ABIs. Keep that habit. Do not write
comments that explain the diff to a reviewer ("changed this to fix the bug"); the
PR description is where that goes.

New comments are English. Some older modules in `packages/ai-engine` have French
comments; leave them unless you are rewriting the module, and write the
replacement in English.

## 5.5 Generated files

`packages/tokens/src/tokens.generated.*`, `packages/ui/src/icons/geometry.generated.ts`
and `design/paper/screens.json` are produced by `bun run paper:sync` from the
Paper file. Editing them by hand is silently reverted by the next sync and breaks
the tests that compare routes to the manifest. Change the design, sync, and commit
the result.

`packages/tokens/src/layout.ts` is **not** generated — it is measured by hand from
the artboards and mirrored into `layout.css`, and a test checks both directions.

## 5.6 Documentation naming

The product is Cortex. Documentation, like UI copy, never names another assistant
brand or an internal codename, and never names a vendor where a capability is
meant (`02-errors.md`). The domain is `cortex.foundation`.
