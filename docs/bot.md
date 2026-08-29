# Bot

Bot is a first-class product (`/bot`), not a locked card on Chat Home.

## Rule

**Exactly one dedicated computer per mascot.** A mascot never shares a VM,
disk, VNC session, or recording with another mascot. Creating a mascot
creates its machine. Deleting a mascot retires that machine.

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
| `/bot/new` | Create — shape + color |
| `/bot/:id` | Conversation |
| `/bot/:id/messages` | Message history |
| `/bot/:id/videos` | Recordings (cursor + click-zoom) |
| `/bot/:id/computer` | VNC / computer |
| `/bot/:id/settings` | Settings rail for that mascot |

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
| Running | Dedicated box is up. VNC surface mounts when a stream URL exists. |
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
