# Design comparison

`node scripts/compare-shots.mjs` — every registered state, French (the design's copy), 1440×900 @2x, pixelmatch threshold 0.15, against `/root/cortex-ui/shots`.

- States compared: **416**, mean differing pixels **0.08%**, max **10.14%**.
- ≤ 1%: 414; 1–3%: 0; > 3%: 2.

## Gaps above 1% and their justification

| State | Diff % | Why |
|---|---|---|
| image-gen~results-dark | 10.14 | Copy uses the plural `{count}` placeholder, so it reads “4 propositions” where the design spells “quatre”. The sentence wraps one line shorter, which shifts the image grid 29 px. Same pictures and layout. |
| image-gen~results-light | 10.05 | Copy uses the plural `{count}` placeholder, so it reads “4 propositions” where the design spells “quatre”. The sentence wraps one line shorter, which shifts the image grid 29 px. Same pictures and layout. |

## States with no design shot

Settings sections Providers & models, Connection, Bot, Notifications and Privacy have no shot in the design (sections are reached by clicking). Providers & models and Connection have no design at all and were requested in `/root/cortex-ui/DESIGN-REQUESTS.md`:

settings~bot-dark, settings~bot-light, settings~connection-dark, settings~connection-light, settings~notifications-dark, settings~notifications-light, settings~privacy-dark, settings~privacy-light, settings~providers-dark, settings~providers-light

## Files

`report.json` (all rows). For size, only gaps above 0.5% keep `<state>.{app,design,diff}.png`; the rest can be regenerated with the script.
