# Chrome connector

`packages/chrome-extension` (Manifest V3, load unpacked from the folder the **Install extension** button opens) talks to the
desktop app over a loopback HTTP endpoint (`127.0.0.1`, ports 47821-47825) owned by `packages/desktop/src/browser-host.ts`.
Chrome native messaging was not used: it needs a per-OS manifest registration and an extension ID that only exists after store publishing.

- **Pairing**: the page asks main for a one-time 8-character code (5 min, burns after 5 wrong guesses). The extension posts it to
  `/pair` and receives a random bearer token kept in `chrome.storage.session`. Pairing again invalidates the old token.
- **Origin checks**: requests need a `chrome-extension://` Origin and a literal `127.0.0.1:<port>` Host; web pages are refused.
- **Consent**: the user shares the active tab from the extension popup (`activeTab` only; no cookies, history or host permissions beyond loopback).
  Only `http(s)` pages without embedded credentials can be shared. A shared tab that navigates elsewhere loses consent. Either side can revoke.
- **Agent tools**: `browser_tabs` and `browser_read` (`packages/core/src/tool.ts`) are offered only while a tab is shared; reads of any other tab are refused in `BrowserBridge` before reaching the browser and ask for permission each time.
- State is memory-only: restarting the app drops pairing and consents. The renderer sees status only, never page text.

Not done: Chrome Web Store publishing (the extension is loaded unpacked) and Firefox/Safari.
