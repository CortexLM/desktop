# Bot

Bot is a first-class product (`/bot`), not a locked card on Chat Home.

## Rule

**Exactly one dedicated computer per mascot.** A mascot never shares a VM,
disk, VNC session, or recording with another mascot. Creating a mascot
creates its machine. Deleting a mascot retires that machine.

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

Mascot list and local drafts live in the renderer store (`localStorage`)
so web and desktop can open the same pages. The farm lease, VNC token, and
recordings are server-side when the API is reachable; this client never
stores SSH or host keys.
