# Code harness

The harness is the privileged worker that can read and write a workspace,
open a PTY, and run Git. It is **not** the SolidJS app and it is **not**
the browser tab.

## Where it runs

| Surface | Harness |
| --- | --- |
| Electron desktop | Local process in `packages/main` (default). Optional cloud / SSH. |
| Web | Never in the page. Cloud worker, or a remote Cortex Code host. |

A remote host is a machine that already runs Cortex Code (another desktop
install or a server). The web app talks to it the same way the renderer
talks to main: through `packages/cortex-api` and a session the server
issued. The browser does not receive SSH keys or host keys.

## Status values the UI may show

- **Cloud only** — this surface cannot run local tools (web, or desktop
  with local disabled).
- **Connecting** — handshake in flight.
- **Connected** — named host (hostname or "this Mac" / "this PC").
- **Disconnected** — a host was configured and is gone.
- **Cloud session running** — a run is alive on Cortex cloud regardless
  of the local socket.
- **Permission blocked** — the session is waiting on Allow / Always / Deny.
- **Failed wake** — a remote / farm worker did not come back.

`packages/app/src/state/harness.ts` is the single reader for this status.
Screens must not invent a fourth "ready" that the host did not report.

## Agent loop (Task, plan, artifacts)

The coding-agent loop lives in `packages/ai-engine`. It is not a mock:

- **Background Task** kinds are `explore`, `plan`, and `worker`. Nested Task is
  forbidden. Children must not AskUser. The parent receives `task_started`,
  `task_progress`, `task_completed`, and `task_failed` with `id`, `summary`, and
  optional `artifact_id`. A hung child times out as `task_failed`. Cancel aborts
  open children.
- **Plan mode** strips MUTATE tools. ExitSpecMode requires a mermaid fence
  whose body starts with `flowchart` or `sequenceDiagram`. Session detail shows
  that diagram in mono; plan prose uses Inter.
- **Artifacts** offload oversized tool output. The agent pages them with Read
  or Grep and `artifact_id`. Compaction keeps `open_artifact_ids`, `active_plan`,
  and `open_task_ids`.
- **Plugin tools** come from connections the user already made (Chat / Bot /
  both). Code uses a Code-side catalog only when the host supplies one.
- Parallel tool results stay in call order. Secret values are redacted on
  `tool_result`.

## Talking to a remote host

1. Desktop A (or a server) runs Cortex Code and is signed in.
2. Web or Desktop B enters that host in **Code → Settings** (URL only).
3. `packages/cortex-api` calls the live API (`CortexLM/backend` when
   reachable) to attach the session. Cloning the backend repo is not
   required.

If the API is unreachable the UI stays on Disconnected / Cloud only and
says so. It does not simulate a connected PTY.
