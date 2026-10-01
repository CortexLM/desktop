// Computer use through Cua Driver (https://github.com/trycua/cua), an MCP server over stdio (`cua-driver mcp`).
// Offered as a preset: the host detects the binary, the user enables it, every input action asks first,
// and "always allow" is never stored for actions that drive the user's apps.
import fs from "node:fs";
import path from "node:path";
import type { McpConfig } from "@cortex/schema";

export const COMPUTER_USE_SERVER = "computer-use";
/** Tools that only observe; everything else (click, type, keys, scroll, launch…) is an input action. */
const OBSERVE = /(^|_)(screenshot|list|get|find|read|describe|inspect|tree|state|windows?|apps?|elements?|size|position)(_|$)/i;

export const isComputerUseInput = (tool: string) => tool.startsWith(`${COMPUTER_USE_SERVER}_`) && !OBSERVE.test(tool.slice(COMPUTER_USE_SERVER.length + 1));

/** Finds the Cua Driver CLI: `CUA_DRIVER_PATH`, then PATH, then the macOS app bundle. */
export function findCuaDriver(env: NodeJS.ProcessEnv = process.env, exists: (p: string) => boolean = fs.existsSync): string | undefined {
  if (env.CUA_DRIVER_PATH && exists(env.CUA_DRIVER_PATH)) return env.CUA_DRIVER_PATH;
  const exe = process.platform === "win32" ? "cua-driver.exe" : "cua-driver";
  for (const dir of (env.PATH ?? "").split(path.delimiter).filter(Boolean)) if (exists(path.join(dir, exe))) return path.join(dir, exe);
  for (const p of ["/Applications/CuaDriver.app/Contents/MacOS/cua-driver", path.join(env.HOME ?? "", ".local/bin/cua-driver")]) if (exists(p)) return p;
  return undefined;
}

/** The MCP preset; disabled until the user turns it on. */
export function computerUsePreset(command: string): McpConfig {
  return { name: COMPUTER_USE_SERVER, type: "stdio", command, args: ["mcp"], enabled: false };
}
