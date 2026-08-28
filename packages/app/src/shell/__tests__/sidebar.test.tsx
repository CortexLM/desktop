import { fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';

import type { Product } from '../../routes.ts';

import { ANONYMOUS_CAPABILITIES, AUTHENTICATED_CAPABILITIES } from '@cortex-ide/cortex-api';
import { ThemeProvider } from '@cortex-ide/ui';

import { Sidebar, type RecentRun, type SidebarProps } from '../sidebar.tsx';

const RUNS: RecentRun[] = [
  { id: 'run-1', title: 'Fix flaky auth tests', repo: 'forge/backend-api', age: '4m', running: true },
  { id: 'run-2', title: 'Add rate limiting to API', repo: 'forge/backend-api', age: '1h' },
  { id: 'run-3', title: 'Migrate dashboard charts', repo: 'forge/dashboard', age: '1d' },
];

function renderSidebar(overrides: Partial<SidebarProps> = {}) {
  const onNavigate = overrides.onNavigate ?? vi.fn();
  const onOpenRun = overrides.onOpenRun ?? vi.fn();
  const onSwitchProduct = overrides.onSwitchProduct ?? vi.fn();

  const result = render(() => (
    <ThemeProvider initial="light">
      <Sidebar
        product="code"
        capabilities={ANONYMOUS_CAPABILITIES}
        activeSlug="code-home"
        recentRuns={RUNS}
        recentChats={[]}
        onOpenChat={vi.fn()}
        onNewChat={vi.fn()}
        onNewSession={vi.fn()}
        onNewMascot={vi.fn()}
        {...overrides}
        onSwitchProduct={onSwitchProduct}
        onNavigate={onNavigate}
        onOpenRun={onOpenRun}
      />
    </ThemeProvider>
  ));

  return { ...result, onNavigate, onOpenRun, onSwitchProduct };
}

describe('Sidebar navigation', () => {
  it('lists the five destinations in the design order', () => {
    renderSidebar();
    const labels = screen
      .getAllByRole('button')
      .map((button) => button.textContent?.trim())
      .filter((text) => text && ['Home', 'Sessions', 'Automations', 'Review', 'Usage'].includes(text));

    expect(labels).toEqual(['Home', 'Sessions', 'Automations', 'Review', 'Usage']);
  });

  it('marks the active destination', () => {
    renderSidebar({ activeSlug: 'code-sessions' });
    expect(screen.getByRole('button', { name: 'Sessions' })).toHaveAttribute('aria-current', 'page');
  });

  it('reports a navigation by slug', () => {
    const { onNavigate } = renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
    expect(onNavigate).toHaveBeenCalledWith('code-sessions');
  });

  it('shows the unread dot where the caller says there is activity', () => {
    const { container } = renderSidebar({ unread: { 'code-sessions': true } });
    expect(container.querySelectorAll('.cx-nav-item__indicator--unread')).toHaveLength(1);
  });
});

describe('Sidebar product switcher', () => {
  it('offers all three products with the Code side active here', () => {
    renderSidebar();
    expect(screen.getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Code' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Bot' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches products', () => {
    const { onSwitchProduct } = renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(onSwitchProduct).toHaveBeenCalledWith('chat');
    fireEvent.click(screen.getByRole('button', { name: 'Bot' }));
    expect(onSwitchProduct).toHaveBeenCalledWith('bot');
  });

  it('shows the chat sections when the Chat product is active', () => {
    renderSidebar({ product: 'chat' });

    expect(screen.getByText('New chat')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Planning' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Plugins' })).toBeInTheDocument();
  });

  it('shows Bot as a first-class product, not a locked card', () => {
    renderSidebar({ product: 'bot' });
    expect(screen.getByText('New mascot')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mascots' })).toBeInTheDocument();
  });

  it('replaces Chat sections when the product prop changes after mount', () => {
    // A bare `if (props.product)` in the component body freezes the first
    // product's sections. E2E starts on Chat and then sets `#/code`.
    const [product, setProduct] = createSignal<Product>('chat');
    render(() => (
      <ThemeProvider initial="light">
        <Sidebar
          product={product()}
          capabilities={ANONYMOUS_CAPABILITIES}
          activeSlug="home"
          recentRuns={[]}
          recentChats={[]}
          onOpenChat={vi.fn()}
          onNewChat={vi.fn()}
          onNewSession={vi.fn()}
          onNewMascot={vi.fn()}
          onSwitchProduct={vi.fn()}
          onNavigate={vi.fn()}
          onOpenRun={vi.fn()}
        />
      </ThemeProvider>
    ));

    expect(screen.getByText('New chat')).toBeInTheDocument();

    setProduct('code');

    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sessions' })).toBeInTheDocument();
    expect(screen.queryByText('New chat')).toBeNull();
  });
});

describe('Sidebar gating', () => {
  it('shows Cortex-only destinations locked rather than hiding them when signed out', () => {
    // Hiding them would make the signed-out app look like a smaller product. Locked rows
    // are how the design advertises what an account adds, same as the model picker.
    renderSidebar({ capabilities: ANONYMOUS_CAPABILITIES });

    // `aria-disabled` rather than `disabled`: the row stays focusable so a keyboard user can
    // reach it and read why, which a `disabled` button makes impossible.
    for (const label of ['Automations', 'Review', 'Usage']) {
      const row = screen.getByRole('button', { name: label });
      expect(row).toHaveAttribute('aria-disabled', 'true');
      expect(row).toHaveAttribute('title', `Sign in to Cortex to use ${label}`);
    }
  });

  it('leaves the surfaces that work signed out enabled', () => {
    renderSidebar({ capabilities: ANONYMOUS_CAPABILITIES });

    expect(screen.getByRole('button', { name: 'Home' })).not.toHaveAttribute('aria-disabled');
    expect(screen.getByRole('button', { name: 'Sessions' })).not.toHaveAttribute('aria-disabled');
  });

  it('explains why a locked destination is unavailable', () => {
    renderSidebar({ capabilities: ANONYMOUS_CAPABILITIES });
    expect(screen.getByRole('button', { name: 'Usage' })).toHaveAttribute(
      'title',
      'Sign in to Cortex to use Usage',
    );
  });

  it('unlocks everything once signed in', () => {
    renderSidebar({ capabilities: AUTHENTICATED_CAPABILITIES });

    for (const label of ['Automations', 'Review', 'Usage']) {
      expect(screen.getByRole('button', { name: label }), label).not.toBeDisabled();
    }
  });

  it('does not navigate to a locked destination', () => {
    const { onNavigate } = renderSidebar({ capabilities: ANONYMOUS_CAPABILITIES });
    fireEvent.click(screen.getByRole('button', { name: 'Usage' }));
    expect(onNavigate).not.toHaveBeenCalled();
  });
});

describe('Sidebar recent sessions', () => {
  it('groups runs under their repo without repeating the heading', () => {
    renderSidebar();

    expect(screen.getAllByText('forge/backend-api')).toHaveLength(1);
    expect(screen.getAllByText('forge/dashboard')).toHaveLength(1);
  });

  it('keeps the order runs arrived in', () => {
    const { container } = renderSidebar();
    const titles = [...container.querySelectorAll('.cx-sidebar__run-title')].map(
      (node) => node.textContent,
    );

    expect(titles).toEqual([
      'Fix flaky auth tests',
      'Add rate limiting to API',
      'Migrate dashboard charts',
    ]);
  });

  it('opens a run by id', () => {
    const { onOpenRun } = renderSidebar();
    fireEvent.click(screen.getByText('Fix flaky auth tests').closest('button')!);
    expect(onOpenRun).toHaveBeenCalledWith('run-1');
  });

  it('marks the runs still in progress with the copper dot', () => {
    const { container } = renderSidebar();
    expect(container.querySelectorAll('.cx-sidebar__run-live')).toHaveLength(1);
  });

  it('omits the whole section when there is nothing recent', () => {
    // An empty "Recent sessions" heading is worse than no heading: it reads as a failure to
    // load rather than as a fresh install.
    renderSidebar({ recentRuns: [] });
    expect(screen.queryByText('Recent sessions')).toBeNull();
  });
});

describe('Sidebar footer', () => {
  it('shows the plan meter with an accessible value', () => {
    renderSidebar({ plan: { label: 'Pro trial · 12 days left', progress: 0.6 } });
    const meter = screen.getByRole('progressbar');

    expect(meter).toHaveAttribute('aria-valuenow', '60');
    expect(meter).toHaveAttribute('aria-label', 'Pro trial · 12 days left');
  });

  it('clamps a meter value outside 0-1 rather than overflowing its track', () => {
    const { container } = renderSidebar({ plan: { label: 'Over', progress: 1.4 } });
    expect(container.querySelector<HTMLElement>('.cx-sidebar__meter-fill')!.style.width).toBe('100%');
  });

  it('omits the plan card when there is no plan to report', () => {
    const { container } = renderSidebar();
    expect(container.querySelector('.cx-sidebar__upgrade')).toBeNull();
  });

  it('shows the signed-in identity', () => {
    renderSidebar({ user: { name: 'Alex Chen', plan: 'Pro workspace', initials: 'AC' } });

    expect(screen.getByRole('button', { name: 'Account: Alex Chen' })).toBeInTheDocument();
    expect(screen.getByText('Pro workspace')).toBeInTheDocument();
  });

  it('offers a way in when nobody is signed in', () => {
    const onSignIn = vi.fn();
    renderSidebar({ onSignIn });

    // The footer used to render only for a signed-in user, which made anonymous a one-way
    // door: every other `onSignIn` handler hangs off Usage, Review and Automations, and all
    // three are locked *because* nobody is signed in.
    fireEvent.click(screen.getByRole('button', { name: /Sign in/ }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('says what signing in adds rather than only that it is possible', () => {
    renderSidebar();
    expect(screen.getByText('Unlock Cortex models')).toBeInTheDocument();
  });

  it('toggles the theme when signed out too', () => {
    // The toggle lived in the signed-in row, so the dark palette was unreachable without an
    // account — for a design that draws every screen in it.
    renderSidebar();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggles the theme from the user row', () => {
    renderSidebar({ user: { name: 'Alex Chen', plan: 'Pro workspace', initials: 'AC' } });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('offers the sidebar collapse only when the host handles it', () => {
    const withToggle = renderSidebar({ onToggleSidebar: vi.fn() });
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    withToggle.unmount();

    renderSidebar();
    expect(screen.queryByRole('button', { name: 'Collapse sidebar' })).toBeNull();
  });
});
