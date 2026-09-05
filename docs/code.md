# Code

Code is the coding-agent workbench. Every Code route lives under `/code`.

## Destinations

| Route | Screen |
| --- | --- |
| `/code` | Home — composer, recent sessions, harness status |
| `/code/sessions` | Inbox |
| `/code/sessions/:id` | Session detail (plan, permissions, terminal, changes) |
| `/code/automations` | Automations (account) |
| `/code/review` | Review (account) |
| `/code/usage` | Usage (account) |
| `/code/settings` | Providers, workspace defaults, remote host |
| `/code/settings/integrations` | Integrations |
| `/code/notifications` | Inbox of notable events |
| `/code/runtimes/ssh` | Connect a server (keys stay server-side) |

Permissions on a session are **Allow / Always / Deny**. File writes and shell
commands are not silent.

There is **no Secrets destination**. Code does not offer a screen for storing
values, and nothing in Code asks for a token to paste
([`.rules/06-product.md`](../.rules/06-product.md) § 6.2.1). Provider credentials
are entered in Settings → Providers and go main → keychain.

## This PC

On the **desktop app**, the local Code runtime is labelled **This PC**. The
native folder picker may bind a session to a directory on this machine. Web
Code never offers This PC. This PC is not a Cortex Bot host, and SSH chrome
never uses that name — SSH stays SSH.

## Harness

The harness is the process that can touch a disk, a PTY, and Git.

- **Desktop Electron** may run it locally. Status: Connected (this machine's
  hostname), Connecting, Disconnected, permission blocked, failed wake.
- **Web** never runs it in the tab. Status starts at **Cloud only**, or
  Connecting / Connected to a **named** Cortex Code host the user already
  runs, or Disconnected / failed wake.

A session that is running in Cortex cloud shows **Cloud session running**
even if the local harness is down.

On the web, starts and Allow/Always/Deny go over `/v1/realtime` when that
socket is up. There is no HTTP fallback that runs tools in the tab.

A connected host is paired with a one-time code (the service stores a hash;
the client never does). Heartbeats carry a device token, never SSH or
provider keys. Viewing a session joins `code_session:{id}`; a miss is
`not_found`.

See [docs/harness.md](./harness.md) and [docs/realtime.md](./realtime.md).

The local coding-agent loop (`packages/ai-engine`) runs Background Task children
(`explore` / `plan` / `worker`), plan mode with a mermaid fence, and artifact
offload for oversized tool output. Compaction keeps `open_artifact_ids`,
`active_plan`, and `open_task_ids`. Session detail shows the mermaid diagram
and artifact cards. There is no Secrets page change; values stay write-only.

## Providers

Settings lists an OpenClaw-style catalogue (`PROVIDER_CATALOG` in
`packages/cortex-api`) and the Cortex model list from `GET /v1/models`.
Keys are written main → keychain. The form never reads a key back.

SSH and host keys are not downloaded to the client.

## Honest states

Signed-out: Chat and **This PC** Code work with local / BYO providers.
Automations, Review, Usage, Cloud and SSH stay shown and locked. Leftover
`/bot` create needs an account.

This PC: the native folder picker is required. Cancel leaves no session and
does not invent a path. Cloud and SSH fail closed if the control-plane route
is missing (`POST /v1/code/sessions` historically 404).

Web signed-out: no `local` runtime. The composer says Cloud needs an
account, or offers connecting a remote Cortex Code host.

## This PC

On desktop, **This PC** is a session bound to a directory on the user's
machine. It is not a Cortex Bot host. SSH chrome stays SSH.

1. The user picks a folder in the OS directory dialog (`openDirectory`).
2. That folder becomes the workspace. The renderer never sees the absolute
   path — only a repository id (the folder name).
3. The coding agent runs tools against that tree in the Electron main harness.

There is no fallback to the process working directory, and a This PC start
never silently becomes a Cloud session.

Cloud and SSH starts call `POST /v1/code/sessions`. If that route is missing
the start fails with a product-language error and the user can stay on This
PC.

Ask reads; Plan writes a mermaid plan before edits; Agent is the default loop.
