/**
 * View registry and the `lazyNamed` helper.
 *
 * `views.ts` is small but load-bearing: the activity bar, the command palette,
 * the status bar and the E2E page objects all read it, and `Workbench.tsx`
 * indexes `VIEW_BY_ID[view].panelTestId` without a null guard. A gap in the
 * registry is therefore a crash, not a cosmetic problem.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import * as React from 'react';

import {
  VIEWS,
  VIEW_BY_ID,
  formatShortcut,
  isMac,
  lazyNamed,
  type ViewDefinition,
} from '../views';
import type { WorkbenchView } from '../../../contexts/WorkbenchContext';

/**
 * Every member of the `WorkbenchView` union, listed exhaustively.
 *
 * Written as the keys of a `Record<WorkbenchView, true>` so that adding a view
 * to the union without adding it here fails `tsc --noEmit` (TS2739, missing
 * property). That makes the registry test below impossible to leave stale — the
 * usual failure mode for "is the registry complete?" assertions, which silently
 * stop covering new members.
 */
const ALL_VIEWS: Record<WorkbenchView, true> = {
  explorer: true,
  search: true,
  git: true,
  terminal: true,
  'ai-chat': true,
  extensions: true,
  notes: true,
  plans: true,
  browser: true,
  account: true,
  automations: true,
  settings: true,
};

const ALL_VIEW_IDS = Object.keys(ALL_VIEWS) as WorkbenchView[];

describe('view registry', () => {
  it('defines every view in the WorkbenchView union', () => {
    // Workbench.mainAreaTestId does `VIEW_BY_ID[view].panelTestId` with no
    // optional chaining, so a view in the union but missing from VIEWS throws
    // on activation and the whole main area goes blank.
    const registered = VIEWS.map((view) => view.id).sort();
    expect(registered).toEqual([...ALL_VIEW_IDS].sort());

    for (const id of ALL_VIEW_IDS) {
      expect(VIEW_BY_ID[id], `VIEW_BY_ID has no entry for "${id}"`).toBeDefined();
      expect(VIEW_BY_ID[id].panelTestId).toBeTruthy();
      expect(VIEW_BY_ID[id].testId).toBeTruthy();
      expect(VIEW_BY_ID[id].label).toBeTruthy();
    }
  });

  it('keeps testids unique across views', () => {
    // Two views sharing a testid makes the E2E selectors ambiguous: a strict
    // locator throws, and a loose one silently asserts against the wrong panel.
    const testIds = VIEWS.map((view) => view.testId);
    const panelTestIds = VIEWS.map((view) => view.panelTestId);

    expect(new Set(testIds).size).toBe(testIds.length);
    expect(new Set(panelTestIds).size).toBe(panelTestIds.length);
  });

  it('matches the sidebar-<id> convention the E2E page objects rely on', () => {
    for (const view of VIEWS) {
      expect(view.testId).toBe(`sidebar-${view.id}`);
    }
  });

  it('places every view in exactly one activity-bar group', () => {
    // ActivityBar renders `group === 'primary'` and `group === 'secondary'`
    // separately; a third value would drop the view off the rail entirely while
    // leaving it reachable by shortcut.
    const groups = new Set(VIEWS.map((view) => view.group));
    expect([...groups].sort()).toEqual(['primary', 'secondary']);

    const rendered = VIEWS.filter(
      (view) => view.group === 'primary' || view.group === 'secondary'
    );
    expect(rendered).toHaveLength(VIEWS.length);
  });

  it('gives VIEW_BY_ID the same object identity as the VIEWS entry', () => {
    for (const view of VIEWS) {
      expect(VIEW_BY_ID[view.id]).toBe(view);
    }
  });

  it('keeps shortcuts unique among the views that declare one', () => {
    const shortcuts = VIEWS.map((view) => view.shortcut).filter(
      (shortcut): shortcut is string => shortcut !== undefined
    );
    expect(new Set(shortcuts).size).toBe(shortcuts.length);
  });
});

describe('formatShortcut', () => {
  /** Swaps `navigator.platform`, which `isMac()` reads. */
  function withPlatform<T>(platform: string, run: () => T): T {
    const original = Object.getOwnPropertyDescriptor(navigator, 'platform');
    Object.defineProperty(navigator, 'platform', { configurable: true, value: platform });
    try {
      return run();
    } finally {
      if (original) Object.defineProperty(navigator, 'platform', original);
      else delete (navigator as unknown as Record<string, unknown>).platform;
    }
  }

  it('rewrites Cmd to Ctrl off macOS', () => {
    // Definitions are authored with `Cmd`. Shipping them verbatim on the Linux
    // and Windows builds advertises a key combination that does nothing.
    withPlatform('Linux x86_64', () => {
      expect(formatShortcut('Cmd+B')).toBe('Ctrl+B');
      expect(formatShortcut('Cmd+Shift+E')).toBe('Ctrl+Shift+E');
      expect(isMac()).toBe(false);
    });
    withPlatform('Win32', () => {
      expect(formatShortcut('Cmd+P')).toBe('Ctrl+P');
    });
  });

  it('uses the glyphs on macOS', () => {
    withPlatform('MacIntel', () => {
      expect(formatShortcut('Cmd+B')).toBe('⌘+B');
      expect(formatShortcut('Cmd+Shift+E')).toBe('⌘+⇧+E');
      expect(isMac()).toBe(true);
    });
    withPlatform('iPhone', () => {
      expect(isMac()).toBe(true);
    });
  });

  it('rewrites every occurrence, not just the first', () => {
    withPlatform('Linux x86_64', () => {
      expect(formatShortcut('Cmd+K Cmd+S')).toBe('Ctrl+K Ctrl+S');
    });
  });

  it('leaves a shortcut with no Cmd untouched on both platforms', () => {
    // The terminal's `Ctrl+\`` is already platform-neutral.
    withPlatform('Linux x86_64', () => expect(formatShortcut('Ctrl+`')).toBe('Ctrl+`'));
    withPlatform('MacIntel', () => expect(formatShortcut('Ctrl+`')).toBe('Ctrl+`'));
  });

  it('passes undefined through, so a view without a shortcut renders no hint', () => {
    expect(formatShortcut(undefined)).toBeUndefined();
  });

  it('does not throw when navigator.platform is absent', () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'platform');
    Object.defineProperty(navigator, 'platform', { configurable: true, value: undefined });
    try {
      expect(() => formatShortcut('Cmd+B')).not.toThrow();
      expect(isMac()).toBe(false);
    } finally {
      if (original) Object.defineProperty(navigator, 'platform', original);
    }
  });

  it('formats every registered shortcut without producing a stray Cmd', () => {
    withPlatform('Linux x86_64', () => {
      for (const view of VIEWS) {
        const formatted = formatShortcut(view.shortcut);
        if (view.shortcut === undefined) {
          expect(formatted).toBeUndefined();
        } else {
          expect(formatted).not.toContain('Cmd');
        }
      }
    });
  });
});

describe('lazyNamed', () => {
  afterEach(cleanup);

  it('renders the named export of the loaded module', async () => {
    const Greeting = ({ name }: { name: string }) => <p>hello {name}</p>;
    const Lazy = lazyNamed(async () => ({ Greeting }), 'Greeting');

    render(
      <React.Suspense fallback={<span>loading</span>}>
        <Lazy name="world" />
      </React.Suspense>
    );

    await waitFor(() => expect(screen.getByText('hello world')).toBeInTheDocument());
  });

  it('forwards every prop, including callbacks and objects', async () => {
    // The bug this guards: `lazyNamed` was declared with a free
    // `T extends ComponentType<any>` that nothing bound to an argument, so TS
    // resolved it to the constraint and the wrapped component's props became
    // `any`. Callers lost their prop types (TS7006 on JSX callbacks) — the type
    // was erased in transit, not missing from the shared package.
    interface Item {
      id: string;
      label: string;
    }

    const onPick = vi.fn();
    const Picker = ({
      item,
      count,
      onPick: pick,
    }: {
      item: Item;
      count: number;
      onPick: (item: Item) => void;
    }) => (
      <button type="button" onClick={() => pick(item)}>
        {item.label} x{count}
      </button>
    );

    const Lazy = lazyNamed(async () => ({ Picker }), 'Picker');
    const item: Item = { id: 'a', label: 'Alpha' };

    render(
      <React.Suspense fallback={<span>loading</span>}>
        <Lazy item={item} count={3} onPick={onPick} />
      </React.Suspense>
    );

    const button = await waitFor(() => screen.getByRole('button', { name: 'Alpha x3' }));
    button.click();

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(item);
  });

  it('keeps prop types checked rather than widening them to any', async () => {
    // A *type-level* regression test. `bun run typecheck` compiles this file, so
    // if `lazyNamed` ever loses the inference that binds its generic to the
    // loader's return type, the props widen to `any`, these deliberate errors
    // stop being errors, and `@ts-expect-error` fails the build with
    // "Unused '@ts-expect-error' directive".
    const Typed = ({ label, count }: { label: string; count: number }) => (
      <span>
        {label}:{count}
      </span>
    );
    const Lazy = lazyNamed(async () => ({ Typed }), 'Typed');

    render(
      <React.Suspense fallback={<span>loading</span>}>
        {/* @ts-expect-error count must be a number, not a string */}
        <Lazy label="ok" count="3" />
      </React.Suspense>
    );
    await waitFor(() => expect(screen.getByText('ok:3')).toBeInTheDocument());

    cleanup();

    render(
      <React.Suspense fallback={<span>loading</span>}>
        {/* @ts-expect-error label is required */}
        <Lazy count={1} />
      </React.Suspense>
    );
    await waitFor(() => expect(screen.getByText(':1')).toBeInTheDocument());

    cleanup();

    render(
      <React.Suspense fallback={<span>loading</span>}>
        {/* @ts-expect-error nope is not a prop of Typed */}
        <Lazy label="ok" count={2} nope="x" />
      </React.Suspense>
    );
    await waitFor(() => expect(screen.getByText('ok:2')).toBeInTheDocument());
  });

  it('rejects a name that is not an export of the module', async () => {
    // `name` is constrained to the loader module's keys, so a typo'd export name
    // is a compile error rather than a component that renders undefined at
    // runtime. The `@ts-expect-error` is the real assertion here — it fails
    // `tsc --noEmit` as an unused directive if the constraint is ever loosened.
    const Only = () => <span>only</span>;
    // @ts-expect-error 'Misspelled' is not a key of the loader's module type
    void (() => lazyNamed(async () => ({ Only }), 'Misspelled'));

    // Runtime companion: the correctly-named export does resolve, so the test
    // above is rejecting the typo rather than rejecting everything.
    const Lazy = lazyNamed(async () => ({ Only }), 'Only');
    render(
      <React.Suspense fallback={<span>loading</span>}>
        <Lazy />
      </React.Suspense>
    );
    await waitFor(() => expect(screen.getByText('only')).toBeInTheDocument());
  });

  it('shows the Suspense fallback until the module resolves', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const Late = () => <p>arrived</p>;
    const Lazy = lazyNamed(async () => {
      await gate;
      return { Late };
    }, 'Late');

    render(
      <React.Suspense fallback={<span data-testid="fallback">loading</span>}>
        <Lazy />
      </React.Suspense>
    );

    // Held at the fallback while the import is in flight.
    expect(screen.getByTestId('fallback')).toBeInTheDocument();
    expect(screen.queryByText('arrived')).not.toBeInTheDocument();

    release();

    await waitFor(() => expect(screen.getByText('arrived')).toBeInTheDocument());
    expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
  });

  it('calls the loader lazily — not at module definition time', async () => {
    // Code splitting is the whole point: the chunk must not be fetched until the
    // view is rendered, or Monaco and xterm land in the startup bundle again.
    const loader = vi.fn(async () => ({ Thing: () => <p>thing</p> }));
    const Lazy = lazyNamed(loader, 'Thing');

    expect(loader).not.toHaveBeenCalled();

    render(
      <React.Suspense fallback={<span>loading</span>}>
        <Lazy />
      </React.Suspense>
    );

    await waitFor(() => expect(screen.getByText('thing')).toBeInTheDocument());
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('re-attempts a failed import only when a new lazy component is built', async () => {
    // React caches a lazy component's rejected import promise on the component
    // object itself. Retrying by reusing the *same* `lazyNamed` result re-throws
    // that cached rejection, so the retry affordance does nothing for the failure
    // it exists for: a code-split chunk that failed to download. Recovery
    // requires a fresh `lazyNamed` call, which is what remounting the import site
    // produces.
    //
    // Measured as the difference between the two arrangements, so the claim rests
    // on the loader-call log rather than on this comment. Note the operative part
    // is the new lazy component, not the boundary's `key` by itself — a boundary
    // that resets its error state while holding the old lazy component stays
    // broken, as the second half asserts.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const attempts: string[] = [];
      const makeLoader = (tag: string) => {
        let calls = 0;
        return async () => {
          calls += 1;
          attempts.push(`${tag}:${calls}`);
          if (calls === 1) throw new Error('chunk load failed');
          return { Recovered: () => <p>{tag} loaded</p> };
        };
      };

      class Boundary extends React.Component<
        { children: React.ReactNode; onRetry: () => void },
        { error: Error | null }
      > {
        state: { error: Error | null } = { error: null };
        static getDerivedStateFromError(error: Error) {
          return { error };
        }
        render() {
          if (this.state.error) {
            return (
              <button
                type="button"
                onClick={() => {
                  this.setState({ error: null });
                  this.props.onRetry();
                }}
              >
                retry
              </button>
            );
          }
          return this.props.children;
        }
      }

      // 1. Retry rebuilds the lazy component, as remounting the import site does.
      const keyedLoader = makeLoader('keyed');
      function Keyed() {
        const [attempt, setAttempt] = React.useState(0);
        const Lazy = React.useMemo(() => lazyNamed(keyedLoader, 'Recovered'), [attempt]);
        return (
          <Boundary key={`view-${attempt}`} onRetry={() => setAttempt((value) => value + 1)}>
            <React.Suspense fallback={<span>loading</span>}>
              <Lazy />
            </React.Suspense>
          </Boundary>
        );
      }

      render(<Keyed />);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'retry' })).toBeInTheDocument()
      );
      fireEvent.click(screen.getByRole('button', { name: 'retry' }));
      await waitFor(() => expect(screen.getByText('keyed loaded')).toBeInTheDocument());
      expect(attempts.filter((a) => a.startsWith('keyed'))).toEqual(['keyed:1', 'keyed:2']);

      cleanup();

      // 2. Holding on to one lazy component: retry cannot re-attempt at all.
      const UnkeyedLazy = lazyNamed(makeLoader('unkeyed'), 'Recovered');
      function Unkeyed() {
        const [, setAttempt] = React.useState(0);
        return (
          <Boundary onRetry={() => setAttempt((value) => value + 1)}>
            <React.Suspense fallback={<span>loading</span>}>
              <UnkeyedLazy />
            </React.Suspense>
          </Boundary>
        );
      }

      render(<Unkeyed />);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'retry' })).toBeInTheDocument()
      );
      fireEvent.click(screen.getByRole('button', { name: 'retry' }));
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Still broken, and the loader was never called a second time.
      expect(screen.queryByText('unkeyed loaded')).not.toBeInTheDocument();
      expect(attempts.filter((a) => a.startsWith('unkeyed'))).toEqual(['unkeyed:1']);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('surfaces a failed import to the nearest error boundary', async () => {
    // A chunk that fails to load (offline, bad deploy) must reach the boundary
    // that offers a retry, not resolve to an undefined component.
    const Lazy = lazyNamed(
      async () => {
        throw new Error('chunk load failed');
      },
      // The module type is inferred as never here; the cast keeps the call
      // legal while still exercising the runtime path.
      'Anything' as never
    );

    class Boundary extends React.Component<
      { children: React.ReactNode },
      { message: string | null }
    > {
      state: { message: string | null } = { message: null };
      static getDerivedStateFromError(error: Error) {
        return { message: error.message };
      }
      render() {
        return this.state.message ? <p>caught: {this.state.message}</p> : this.props.children;
      }
    }

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <Boundary>
          <React.Suspense fallback={<span>loading</span>}>
            {React.createElement(Lazy as unknown as React.ComponentType)}
          </React.Suspense>
        </Boundary>
      );

      await waitFor(() =>
        expect(screen.getByText(/caught: chunk load failed/)).toBeInTheDocument()
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe('ViewDefinition shape', () => {
  it('types every entry, so a malformed definition fails typecheck', () => {
    // Runtime companion to the compile-time type: catches a definition that
    // typechecks via a widened literal but is empty at runtime.
    const definitions: ViewDefinition[] = VIEWS;
    for (const definition of definitions) {
      expect(typeof definition.label).toBe('string');
      expect(definition.label.trim()).not.toBe('');
      expect(typeof definition.icon).not.toBe('undefined');
    }
  });
});
