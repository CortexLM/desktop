import { createSignal } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { Menu, MenuItem, MenuSeparator } from '../menu.tsx';
import { SessionCard } from '../session-card.tsx';
import { TabPanel, Tabs, type TabDefinition } from '../tabs.tsx';
import { Toast } from '../toast.tsx';

describe('SessionCard', () => {
  it('pairs the title with its status badge', () => {
    render(() => <SessionCard title="Refactor auth middleware" status="pr-ready" />);

    expect(screen.getByText('Refactor auth middleware')).toBeInTheDocument();
    expect(screen.getByText('PR ready')).toBeInTheDocument();
  });

  it('formats the removed count with a minus sign, not a hyphen', () => {
    // The design sets U+2212; at 12px a hyphen sits noticeably higher and shorter than the
    // plus it pairs with.
    render(() => (
      <SessionCard title="x" status="running" diff={{ added: 248, removed: 86 }} />
    ));

    expect(screen.getByText('+248')).toBeInTheDocument();
    expect(screen.getByText('\u221286')).toBeInTheDocument();
  });

  it('omits the diff stats when there are none', () => {
    const { container } = render(() => <SessionCard title="x" status="draft" />);
    expect(container.querySelector('.cx-session-card__added')).toBeNull();
  });

  it('renders as an article when it does not open anything', () => {
    const { container } = render(() => <SessionCard title="x" status="draft" />);

    expect(container.querySelector('article')).not.toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });

  it('becomes a button when it opens a session', () => {
    const onOpen = vi.fn();
    render(() => <SessionCard title="x" status="draft" onOpen={onOpen} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('shows branch and age when supplied', () => {
    render(() => (
      <SessionCard title="x" status="merged" branch="agent/auth-refactor" age="2h ago" />
    ));

    expect(screen.getByText('agent/auth-refactor')).toBeInTheDocument();
    expect(screen.getByText('2h ago')).toBeInTheDocument();
  });

  it('lets a call site extend the status copy', () => {
    render(() => <SessionCard title="x" status="running" statusLabel="Running · 4m 32s" />);
    expect(screen.getByText('Running · 4m 32s')).toBeInTheDocument();
  });
});

describe('Menu', () => {
  it('announces itself as a menu', () => {
    render(() => (
      <Menu>
        <MenuItem label="Re-index now" />
      </Menu>
    ));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Re-index now/ })).toBeInTheDocument();
  });

  it('narrows for the runtime picker', () => {
    const { container } = render(() => (
      <Menu compact>
        <MenuItem label="Local" />
      </Menu>
    ));
    expect(container.querySelector('.cx-menu')).toHaveClass('cx-menu--compact');
  });

  it('always renders the trailing slot, with or without a shortcut', () => {
    // Collapsing it would let labels reflow between rows and break the vertical lane.
    const withShortcut = render(() => <MenuItem label="Re-index now" shortcut="⇧R" />);
    expect(withShortcut.container.querySelector('.cx-menu__trailing')).toHaveTextContent('⇧R');
    withShortcut.unmount();

    const without = render(() => <MenuItem label="Edit wiki" />);
    expect(without.container.querySelector('.cx-menu__trailing')).not.toBeNull();
  });

  it('marks the selected row and shows a check instead of a shortcut', () => {
    render(() => <MenuItem label="Cloud" selected shortcut="⇧C" />);
    const item = screen.getByRole('menuitem');

    expect(item).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Selected')).toBeInTheDocument();
  });

  it('tints a destructive row', () => {
    const { container } = render(() => <MenuItem label="Remove repository" destructive />);
    expect(container.querySelector('.cx-menu__item')).toHaveClass('cx-menu__item--destructive');
  });

  it('does not fire a disabled row', () => {
    const onClick = vi.fn();
    render(() => <MenuItem label="Cloud" disabled onClick={onClick} />);

    fireEvent.click(screen.getByRole('menuitem'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders the separator as an hr so it is announced', () => {
    const { container } = render(() => <MenuSeparator />);
    expect(container.querySelector('hr.cx-menu__separator')).not.toBeNull();
  });
});

describe('Toast', () => {
  it('announces politely rather than interrupting', () => {
    // A toast confirms something the user just did; interrupting a screen reader
    // mid-sentence would be worse than waiting for a pause.
    render(() => <Toast message="Session ID copied to clipboard" />);
    const toast = screen.getByRole('status');

    expect(toast).toHaveAttribute('aria-live', 'polite');
    expect(toast).toHaveTextContent('Session ID copied to clipboard');
  });

  it('paints the mark glyph in the toast background, not a foreground colour', () => {
    // The disc is filled and the glyph knocked out of it, which a currentColor icon from
    // the registry cannot express.
    const { container } = render(() => <Toast message="Saved" />);
    const mark = container.querySelector('.cx-toast__mark')!;

    expect(mark.innerHTML).toContain('var(--color-toast-accent)');
    expect(mark.innerHTML).toContain('var(--color-toast-bg)');
  });

  it('swaps the glyph and the disc colour for an error', () => {
    const { container } = render(() => <Toast message="Could not save" tone="error" />);
    expect(container.querySelector('.cx-toast__mark')!.innerHTML).toContain('var(--color-error)');
  });

  it('hides the mark from assistive technology, since the message carries the meaning', () => {
    const { container } = render(() => <Toast message="Saved" />);
    expect(container.querySelector('.cx-toast__mark')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Tabs', () => {
  const tabs: TabDefinition[] = [
    { id: 'shell', label: 'Shell', icon: 'terminal' },
    { id: 'changes', label: 'Changes', icon: 'changes', count: 2 },
    { id: 'pr', label: 'PR', icon: 'pullRequest' },
    { id: 'browser', label: 'Browser', icon: 'browser' },
  ];

  function renderTabs(initial = 'changes', overrides: Partial<TabDefinition>[] = []) {
    const merged = tabs.map((tab, index) => ({ ...tab, ...(overrides[index] ?? {}) }));
    const [active, setActive] = createSignal(initial);
    const result = render(() => (
      <Tabs tabs={merged} active={active()} onChange={setActive} label="Session workbench" />
    ));
    return { ...result, active };
  }

  it('marks only the active tab as selected', () => {
    renderTabs('changes');

    expect(screen.getByRole('tab', { name: /Changes/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Shell/ })).toHaveAttribute('aria-selected', 'false');
  });

  it('keeps only the active tab in the tab order', () => {
    // Arrow keys move within the strip; Tab should move past it, not through all four.
    renderTabs('changes');

    expect(screen.getByRole('tab', { name: /Changes/ })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: /Shell/ })).toHaveAttribute('tabindex', '-1');
  });

  it('moves selection with the arrow keys', () => {
    const { active } = renderTabs('shell');
    const list = screen.getByRole('tablist');

    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(active()).toBe('changes');

    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    expect(active()).toBe('shell');
  });

  it('wraps at the ends rather than stopping', () => {
    // With four tabs, clamping means reversing direction to reach the neighbour you started
    // next to.
    const { active } = renderTabs('shell');
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowLeft' });
    expect(active()).toBe('browser');
  });

  it('jumps to the ends with Home and End', () => {
    const { active } = renderTabs('changes');
    const list = screen.getByRole('tablist');

    fireEvent.keyDown(list, { key: 'End' });
    expect(active()).toBe('browser');

    fireEvent.keyDown(list, { key: 'Home' });
    expect(active()).toBe('shell');
  });

  it('skips a disabled tab when moving', () => {
    const { active } = renderTabs('shell', [{}, { disabled: true }]);
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(active()).toBe('pr');
  });

  it('ignores keys it does not handle', () => {
    const { active } = renderTabs('changes');
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'a' });
    expect(active()).toBe('changes');
  });

  it('shows a count pill only on the tabs that have one', () => {
    const { container } = renderTabs();
    expect(container.querySelectorAll('.cx-tabs__count')).toHaveLength(1);
    expect(container.querySelector('.cx-tabs__count')).toHaveTextContent('2');
  });

  it('renders an indicator on every tab so selection does not resize the strip', () => {
    const { container } = renderTabs();
    expect(container.querySelectorAll('.cx-tabs__indicator')).toHaveLength(4);
  });

  it('selects on click', () => {
    const { active } = renderTabs('shell');
    fireEvent.click(screen.getByRole('tab', { name: /PR/ }));
    expect(active()).toBe('pr');
  });
});

describe('TabPanel', () => {
  it('renders only the active panel', () => {
    render(() => (
      <>
        <TabPanel tabId="shell" active="changes">
          shell content
        </TabPanel>
        <TabPanel tabId="changes" active="changes">
          changes content
        </TabPanel>
      </>
    ));

    expect(screen.queryByText('shell content')).toBeNull();
    expect(screen.getByText('changes content')).toBeInTheDocument();
  });

  it('ties the panel back to its tab', () => {
    render(() => (
      <TabPanel tabId="changes" active="changes">
        content
      </TabPanel>
    ));
    const panel = screen.getByRole('tabpanel');

    expect(panel).toHaveAttribute('id', 'panel-changes');
    expect(panel).toHaveAttribute('aria-labelledby', 'tab-changes');
  });
});
