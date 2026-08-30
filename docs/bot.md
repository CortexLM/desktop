# Bot

Bot is a separate desktop app. This repository is Cortex Chat + Code; `/bot`
routes and the mascot API client remain here so the service contract is not
deleted, but they are not in the product switcher, command palette, or Chat
home cards.

## Rule

**Exactly one dedicated computer per mascot.** A mascot never shares a VM,
disk, VNC session, or recording with another mascot. Creating a mascot
creates its machine. Deleting a mascot retires that machine.

That machine is a **cloud farm box**. Cortex Bot does not run on This PC, and
it does not offer SSH as a host. This PC is a Cortex Code runtime on the
desktop app. SSH is SSH, on Code. Copy never says “This desktop” on Bot or
on SSH chrome.

## Visual system

Each mascot is one **Kernel pebble** — a flat rounded stone, not a triangle
and not a gradient. Identity is a **look** (Meadow, Teal, Terracotta, Amber,
Plum, Slate), a **resting face** (open eyes, narrow, wink), and a resting tilt of
±5° (suppressed below 48px). Eyes stay ivory. The user picks look and face
on create and in settings; the service stores them.

Live states are procedural SVG + CSS/WAAPI, not a canned animation file:

| App signal | Mascot state |
| --- | --- |
| idle | blink every 4–7s and a micro eye drift |
| computer waking | thinking — eyes up-left, 2.5° sway, 3.2s loop |
| busy / sending / computer running | working — slit eyes, squash pulse, 1.6s loop |
| unread or waiting on you | notify — wink |
| a send that landed | success — smile and a 900ms pop, then idle |

Looks lift one step on a dark canvas. There are no seeded mascots.

## Destinations

| Route | Screen |
| --- | --- |
| `/bot` | Mascot list |
| `/bot/new` | Create — look + face. The Bot sidebar stays on. |
| `/bot/:id` | Conversation workbench (thread + computer rail) |
| `/bot/:id/messages` | Message history |
| `/bot/:id/videos` | Recordings (cursor + click-zoom) |
| `/bot/:id/computer` | Dedicated computer page (stream + take control) |
| `/bot/:id/memory` | Memory |
| `/bot/:id/skills` | Skills |
| `/bot/:id/routines` | Routines |
| `/bot/:id/groups` | Groups |
| `/bot/:id/settings` | Settings rail for that mascot |
| `/bot/approvals` | Pending questions and secrets across mascots |

The Bot sidebar is always present on these routes. It lists the live roster
(honest empty when the account has none — never Sprite, Finch, or Pebble) and
Studio: Routines, Memory, Approvals.

## Conversation

The header is the **mascot name**. The subtitle is the computer's honest state
(Asleep, Waking, Offline, This PC / SSH / Cloud, Dedicated computer). It never
says Running, never View PR, and never a user's first name.

Messages are employee-style bubbles. A SendToUser turn with blank lines becomes
more than one bubble. `tool_call` / `tool_result` stay off the thread.

The right rail is **Computer**: a noVNC stream when the ticket includes an
https `stream_url`, otherwise a screenshot. Take control / Release. Runtime
This PC (desktop app), SSH, and Cloud (account). This is not a Terminal / Files
tab navbar. Opening another mascot drops the previous computer's stream and
screenshot immediately; the rail stays empty until this mascot's computer
answers, including when that refresh fails. The rail never falls back to a
stream URL stored on a different mascot.

## Farm machines

When a computer is provisioned on the Cortex farm it is:

- x86_64
- ≥ 4 vCPU
- ≥ 16 GiB RAM
- browser preinstalled
- hibernated while unused

This repository does not ship a hypervisor. The UI talks to the live API
when reachable (`packages/cortex-api`) and otherwise shows honest states.
A VNC signaling ticket is a hash only — never a password. Viewing a mascot
joins `mascot:{id}`; a miss is `not_found`.

## Computer states

| State | What the user sees |
| --- | --- |
| Empty | No machine yet (should only exist mid-create). |
| Hibernated | Asleep to save the farm. Wake is offered. |
| Waking / Connecting | Wake requested. |
| Running | Dedicated box is up. The computer rail mounts a noVNC stream when an https URL exists; otherwise it polls screenshots. Take control to type and click. |
| Wake failed | The farm did not come back. Retry + `farm-wake-fail` notification. |
| Ask user | The mascot is blocked on a question. `bot-ask-user` notification. |

## Videos

Recordings are per-mascot. Playback is the cursor path plus click-zoom —
not a generic screen grab shared across bots.

## Persistence

The mascot list, messages, computer lifecycle, and videos are server-side
(`packages/cortex-api`). The renderer may cache the last successful **list**
in `localStorage` and must reconcile on open. Writes never succeed by
updating that cache alone. See [bot-runtime.md](./bot-runtime.md).
This client never stores SSH or host keys.
