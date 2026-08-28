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
| `/code/secrets` | Secrets (values never return to the renderer) |
| `/code/notifications` | Inbox of notable events |
| `/code/runtimes/ssh` | Connect a server (keys stay server-side) |

Permissions on a session are **Allow / Always / Deny**. File writes and shell
commands are not silent.

## Harness

The harness is the process that can touch a disk, a PTY, and Git.

- **Desktop Electron** may run it locally. Status: Connected (this machine's
  hostname), Connecting, Disconnected, permission blocked, failed wake.
- **Web** never runs it in the tab. Status starts at **Cloud only**, or
  Connecting / Connected to a **named** Cortex Code host the user already
  runs, or Disconnected / failed wake.

A session that is running in Cortex cloud shows **Cloud session running**
even if the local harness is down.

See [docs/harness.md](./harness.md).

## Providers

Settings lists an OpenClaw-style catalogue (`PROVIDER_CATALOG` in
`packages/cortex-api`) and the Cortex model list from `GET /v1/models`.
Keys are written main → keychain. The form never reads a key back.

SSH and host keys are not downloaded to the client.

## Honest states

Signed-out: Home, Sessions, Session detail, Settings, Secrets work with
local / BYO providers on desktop. Automations, Review, Usage, SSH connect
are gated.

Web signed-out: no `local` runtime. The composer says Cloud needs an
account, or offers connecting a remote Cortex Code host.
