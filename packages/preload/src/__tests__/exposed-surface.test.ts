/**
 * Preload exposure surface — what the renderer can reach, and what it must not.
 *
 * The preload is the only bridge between the renderer (least-trusted process:
 * it renders remote content, including through a `<webview>`) and main. The IPC
 * allowlist in `ipc-allowlist.test.ts` guards *which channels* are callable.
 * This suite guards the complementary hole: whether the bridge hands the
 * renderer a privileged **object** in the first place.
 *
 * Leaking one would make the allowlist irrelevant. With a reference to raw
 * `ipcRenderer`, renderer-side script calls `ipcRenderer.invoke('db:execute',
 * ...)` directly and never passes through `invokeAllowedChannel`. With `require`
 * or `process`, it does not need IPC at all — `require('fs')` or
 * `process.binding` reaches the filesystem in-process.
 *
 * Method: walk the object graph actually handed to
 * `contextBridge.exposeInMainWorld` and assert every reachable leaf is a
 * function or a plain-data value. This is a structural assertion over the real
 * exposed objects, not a restatement of the source: adding
 * `exposeInMainWorld('node', { require })` to index.ts fails it without the
 * test being touched.
 *
 * `electron` is mocked locally: this package has no global setup file, and
 * `electron`'s npm entry point exports a *string* (the binary path), so
 * `import { ipcRenderer } from 'electron'` cannot link outside a real Electron
 * runtime.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Electron mock
//
// `ipcRenderer` is given the shape of the real thing (including the privileged
// members a leak would carry: `send`, `sendSync`, `postMessage`) so that a test
// looking for "did a whole ipcRenderer escape?" has something recognisable to
// find.
// ---------------------------------------------------------------------------

const exposed = new Map<string, unknown>();

const ipcRendererMock = {
  invoke: vi.fn(async (channel: string) => `ok:${channel}`),
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
  send: vi.fn(),
  sendSync: vi.fn(),
  sendTo: vi.fn(),
  sendToHost: vi.fn(),
  postMessage: vi.fn(),
};

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (name: string, api: unknown) => {
      exposed.set(name, api);
    },
  },
  ipcRenderer: ipcRendererMock,
}));

beforeAll(async () => {
  await import('../index');
});

// ---------------------------------------------------------------------------
// Object-graph walk
// ---------------------------------------------------------------------------

interface Node {
  path: string;
  value: unknown;
  isLeaf: boolean;
}

/**
 * Every own-enumerable node reachable from the exposed bridges — the
 * intermediate objects as well as the leaves.
 *
 * Intermediate nodes are recorded deliberately. An earlier version of this
 * helper kept only leaves, and a deliberate mutation that added `ipcRenderer` to
 * the `electron` bridge slipped past two of the three leak assertions: the walk
 * descended *into* the leaked object, so its own reference was never compared,
 * and the leaf keys it produced were `invoke` / `send` rather than
 * `ipcRenderer`. Only the "raw method" check caught it. Recording every node
 * closes that.
 *
 * Own-enumerable only, mirroring what `contextBridge` actually copies into the
 * isolated world: inherited `Object.prototype` members are not part of the
 * exposed surface.
 */
function walk(value: unknown, path: string, out: Node[], seen: Set<object>): void {
  if (value === null || typeof value !== 'object') {
    out.push({ path, value, isLeaf: true });
    return;
  }
  if (seen.has(value as object)) {
    out.push({ path: `${path} (cycle)`, value, isLeaf: true });
    return;
  }
  seen.add(value as object);

  // Recorded before descending, so a leaked object is asserted on by identity
  // even though its children are walked too.
  out.push({ path, value, isLeaf: false });

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    walk(child, `${path}.${key}`, out, seen);
  }
}

/** Every node under one bridge, the bridge object included. */
function nodesOf(name: string): Node[] {
  const out: Node[] = [];
  walk(exposed.get(name), name, out, new Set());
  return out;
}

function allNodes(): Node[] {
  return [...exposed.keys()].flatMap(nodesOf);
}

function allLeaves(): Node[] {
  return allNodes().filter((n) => n.isLeaf);
}

/**
 * The bridge objects themselves, which are legitimately objects and so are
 * excluded when asking "what objects did we hand over?".
 *
 * `cortex.fs`, `cortex.git` &c. are namespaces, not capabilities: they hold
 * only functions. They are allowed here by path, not by name, so a *new*
 * namespace has to be added consciously.
 */
const EXPECTED_NAMESPACES = [
  'cortex',
  'cortex.fs',
  'cortex.editor',
  'cortex.git',
  'cortex.ai',
  'cortex.mission',
  'cortex.mcp',
  'cortex.terminal',
  'cortex.db',
  'cortex.automation',
  'cortex.update',
  // Cortex account and model catalogue. The renderer's only route to
  // `api.cortex.foundation`: its `file://` origin makes its own requests fail
  // the CORS check. Carries no token in either direction — see
  // `shared/types/ipc/cortex.ts`.
  'cortex.cortex',
  'ipc',
  'electron',
];

describe('exposed bridge inventory', () => {
  it('exposes exactly three named bridges', () => {
    // A fourth bridge is not automatically wrong, but it is a new hole in the
    // security boundary and must be a deliberate, reviewed change rather than
    // something that appears in a refactor.
    expect([...exposed.keys()].sort()).toEqual(['cortex', 'electron', 'ipc']);
  });

  it('exposes something on every bridge', () => {
    for (const name of exposed.keys()) {
      expect(exposed.get(name), name).toBeTypeOf('object');
      expect(Object.keys(exposed.get(name) as object).length, name).toBeGreaterThan(0);
    }
  });
});

describe('no privileged object reaches the renderer', () => {
  it('exposes only functions as leaves', () => {
    // The bridge is meant to be a wall of functions. Any object leaf is a
    // reference the renderer holds onto, and the interesting leaks (ipcRenderer,
    // process, module) are all objects.
    const nonFunctions = allLeaves().filter(({ value }) => typeof value !== 'function');

    expect(nonFunctions.map((l) => l.path)).toEqual([]);
  });

  it('does not leak the ipcRenderer object itself', () => {
    // The concrete bypass: with a reference to ipcRenderer, renderer script
    // calls invoke() directly and the allowlist in invokeAllowedChannel is
    // never consulted.
    //
    // Checked over every node, not just leaves: the leaked object is an
    // interior node of the graph, and its children are ordinary functions.
    for (const { path, value } of allNodes()) {
      expect(value, `${path} is the ipcRenderer object`).not.toBe(ipcRendererMock);
    }
  });

  it('hands over no object beyond the known namespaces', () => {
    // The general form of the ipcRenderer check. Every object the renderer can
    // reach is a reference it keeps; the allowlisted paths are the API
    // namespaces, which hold only functions. Anything else — a leaked
    // `ipcRenderer`, a `process` shim, a config object with a token in it — is
    // a new object on the wrong side of the boundary.
    const unexpected = allNodes()
      .filter((n) => !n.isLeaf)
      .filter((n) => !EXPECTED_NAMESPACES.includes(n.path));

    expect(unexpected.map((n) => n.path)).toEqual([]);
  });

  it('does not expose any raw ipcRenderer method', () => {
    // Not just the object: exposing `send` alone is enough to reach every
    // `ipcMain.on` handler, and `sendSync` blocks main as a bonus.
    const rawMethods = new Set<unknown>(Object.values(ipcRendererMock));

    const leaked = allLeaves().filter(({ value }) => rawMethods.has(value));

    expect(leaked.map((l) => l.path)).toEqual([]);
  });

  it('exposes no key named after a privileged global', () => {
    // Names, independent of value: catches `{ process: {...} }` shims and
    // `require` re-exports even when the value is a wrapper rather than the
    // real thing.
    const forbidden = [
      'require',
      'process',
      'module',
      'exports',
      '__dirname',
      '__filename',
      'global',
      'globalThis',
      'Buffer',
      'child_process',
      'fs',
      'ipcRenderer',
      'webFrame',
      'webContents',
      'BrowserWindow',
      'app',
    ];

    // Over every node: a leaked `process` is an object, so a leaf-only check
    // would see `process.env` and miss `process`. `cortex.fs` is a namespace of
    // functions, not the `fs` module, so it is matched on the full path rather
    // than by bare key.
    const offenders = allNodes().filter(({ path }) => {
      const key = path.split('.').pop() ?? '';
      return forbidden.includes(key) && path !== 'cortex.fs';
    });

    expect(offenders.map((l) => l.path)).toEqual([]);
  });
});
