# Computer use

Cortex can let an agent see and drive desktop apps through **Cua Driver**
(https://github.com/trycua/cua), an MCP server over stdio started as `cua-driver mcp`.
Code: `packages/core/src/computer-use.ts`, `packages/core/src/permission.ts`.

## Detection

`findCuaDriver()` runs in main at startup, in order:

1. `CUA_DRIVER_PATH`, if the file exists;
2. `cua-driver` (`cua-driver.exe` on Windows) on `PATH`;
3. `/Applications/CuaDriver.app/Contents/MacOS/cua-driver`, then `~/.local/bin/cua-driver`.

Nothing is bundled or downloaded.

## Registration

When found, `core.start({ computerUse })` adds the MCP preset once:

```ts
{ name: "computer-use", type: "stdio", command: <path>, args: ["mcp"], enabled: false }
```

It is **disabled** until the user enables it (`PATCH /api/mcp/computer-use`). Its tools
appear as `computer-use_<tool>`.
The command and arguments stay in the main-only MCP credential store. Public preset reads
expose its name/type/enabled/status/tools, not connection configuration.

## Permissions

- Every MCP tool call asks through the permission service.
- Tools whose name matches observe verbs (`screenshot`, `list`, `get`, `find`, `read`,
  `describe`, `inspect`, `tree`, `state`, `window(s)`, `app(s)`, `element(s)`, `size`,
  `position`) are observe tools; everything else (click, type, keys, scroll, launch…) is an
  **input action** (`isComputerUseInput`).
- For input actions an "always" reply is honoured once and **never stored**, so the next
  action asks again. A configured deny rule still wins.
- Covered by `packages/core/test/computer-use.test.ts`.

## Not built yet

There is no Plugins & skills screen (blocked on design), so the preset cannot be enabled
from the UI today; only through the engine route.
