import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { CommandPalette, type PaletteCommand } from '../command-palette.tsx';
import { Notifications, type AppNotification } from '../notifications.tsx';
import { UpgradeModal } from '../upgrade-modal.tsx';

const COMMANDS: PaletteCommand[] = [
  { id: 'go-home', label: 'Home', section: 'Navigate', icon: 'home' },
  { id: 'go-sessions', label: 'Sessions', section: 'Navigate', icon: 'sessions', hint: '⌘2' },
  { id: 'go-settings', label: 'Settings', section: 'Navigate' },
  {
    id: 'open-repo',
    label: 'Open backend API',
    section: 'Repositories',
    keywords: ['forge/backend-api'],
  },
  { id: 'go-usage', label: 'Usage', section: 'Navigate', disabled: true },
];

const NOTIFICATIONS: AppNotification[] = [
  { id: 'n1', message: 'Fix flaky auth tests opened PR #482', age: '4m ago', unread: true },
  { id: 'n2', message: 'Rate limiting session finished', age: '1h ago' },
];

describe('Scrim behaviour', () => {
  it('dismisses on Escape', () => {
    const onDismiss = vi.fn();
    render(() => <CommandPalette commands={COMMANDS} onRun={vi.fn()} onDismiss={onDismiss} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('dismisses on a click outside the panel', () => {
    const onDismiss = vi.fn();
    render(() => <CommandPalette commands={COMMANDS} onRun={vi.fn()} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('dialog'));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('does not dismiss on a click inside the panel', () => {
    // Checked on the event target rather than by having the panel swallow clicks, which
    // would also swallow them from anything legitimately listening higher up.
    const onDismiss = vi.fn();
    const { container } = render(() => (
      <CommandPalette commands={COMMANDS} onRun={vi.fn()} onDismiss={onDismiss} />
    ));

    fireEvent.click(container.querySelector('.cx-palette')!);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('announces itself as a modal dialog', () => {
    render(() => <CommandPalette commands={COMMANDS} onRun={vi.fn()} onDismiss={vi.fn()} />);
    const dialog = screen.getByRole('dialog');

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Command palette');
  });

  it('unbinds Escape when it unmounts', () => {
    const onDismiss = vi.fn();
    const { unmount } = render(() => (
      <CommandPalette commands={COMMANDS} onRun={vi.fn()} onDismiss={onDismiss} />
    ));

    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('Command palette filtering', () => {
  it('lists everything before anything is typed', () => {
    render(() => <CommandPalette commands={COMMANDS} onRun={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(COMMANDS.length);
  });

  it('groups results under their section', () => {
    render(() => <CommandPalette commands={COMMANDS} onRun={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.getByText('Navigate')).toBeInTheDocument();
    expect(screen.getByText('Repositories')).toBeInTheDocument();
  });

  it('filters on a substring of the label', () => {
    render(() => <CommandPalette commands={COMMANDS} onRun={vi.fn()} onDismiss={vi.fn()} />);

    fireEvent.input(screen.getByLabelText('Search commands'), { target: { value: 'sett' } });

    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Home' })).toBeNull();
  });

  it('matches on keywords, so a friendly label can still be found by its real name', () => {
    render(() => <CommandPalette commands={COMMANDS} onRun={vi.fn()} onDismiss={vi.fn()} />);

    fireEvent.input(screen.getByLabelText('Search commands'), {
      target: { value: 'forge/backend' },
    });

    expect(screen.getByRole('button', { name: 'Open backend API' })).toBeInTheDocument();
  });

  it('ranks a prefix match above a mid-string one', () => {
    const { container } = render(() => (
      <CommandPalette
        commands={[
          { id: 'a', label: 'Open sessions', section: 'X' },
          { id: 'b', label: 'Sessions', section: 'X' },
        ]}
        onRun={vi.fn()}
        onDismiss={vi.fn()}
      />
    ));

    fireEvent.input(screen.getByLabelText('Search commands'), { target: { value: 'sess' } });

    const labels = [...container.querySelectorAll('.cx-palette__option-label')].map(
      (node) => node.textContent,
    );
    expect(labels[0]).toBe('Sessions');
  });

  it('says so when nothing matches', () => {
    render(() => <CommandPalette commands={COMMANDS} onRun={vi.fn()} onDismiss={vi.fn()} />);

    fireEvent.input(screen.getByLabelText('Search commands'), { target: { value: 'zzzz' } });
    expect(screen.getByText(/No matches for/)).toBeInTheDocument();
  });
});

describe('Command palette keyboard', () => {
  it('highlights the first result to begin with', () => {
    render(() => <CommandPalette commands={COMMANDS} onRun={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute(
      'data-highlighted',
      'true',
    );
  });

  it('moves the highlight with the arrow keys', () => {
    render(() => <CommandPalette commands={COMMANDS} onRun={vi.fn()} onDismiss={vi.fn()} />);
    const input = screen.getByLabelText('Search commands');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('button', { name: /Sessions/ })).toHaveAttribute(
      'data-highlighted',
      'true',
    );
  });

  it('wraps at the ends', () => {
    render(() => <CommandPalette commands={COMMANDS} onRun={vi.fn()} onDismiss={vi.fn()} />);

    fireEvent.keyDown(screen.getByLabelText('Search commands'), { key: 'ArrowUp' });

    // Wraps to the last *selectable* command, skipping the disabled one.
    expect(screen.getByRole('button', { name: 'Open backend API' })).toHaveAttribute(
      'data-highlighted',
      'true',
    );
  });

  it('never highlights a disabled command', () => {
    render(() => <CommandPalette commands={COMMANDS} onRun={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Usage' })).toHaveAttribute(
      'data-highlighted',
      'false',
    );
  });

  it('runs the highlighted command on Enter', () => {
    const onRun = vi.fn();
    render(() => <CommandPalette commands={COMMANDS} onRun={onRun} onDismiss={vi.fn()} />);
    const input = screen.getByLabelText('Search commands');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRun).toHaveBeenCalledWith('go-sessions');
  });

  it('resets the highlight when the query changes', () => {
    // Keeping a stale index would leave the highlight on whatever happened to land in that
    // position after filtering.
    const onRun = vi.fn();
    render(() => <CommandPalette commands={COMMANDS} onRun={onRun} onDismiss={vi.fn()} />);
    const input = screen.getByLabelText('Search commands');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.input(input, { target: { value: 'se' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRun).toHaveBeenCalledWith('go-sessions');
  });

  it('does nothing on Enter with no matches', () => {
    const onRun = vi.fn();
    render(() => <CommandPalette commands={COMMANDS} onRun={onRun} onDismiss={vi.fn()} />);
    const input = screen.getByLabelText('Search commands');

    fireEvent.input(input, { target: { value: 'zzzz' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRun).not.toHaveBeenCalled();
  });

  it('runs a command on click', () => {
    const onRun = vi.fn();
    render(() => <CommandPalette commands={COMMANDS} onRun={onRun} onDismiss={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onRun).toHaveBeenCalledWith('go-settings');
  });
});

describe('Notifications', () => {
  it('lists each notification with its age', () => {
    render(() => (
      <Notifications notifications={NOTIFICATIONS} onOpen={vi.fn()} onDismiss={vi.fn()} />
    ));

    expect(screen.getByText('Fix flaky auth tests opened PR #482')).toBeInTheDocument();
    expect(screen.getByText('4m ago')).toBeInTheDocument();
  });

  it('reserves the unread lane on every row', () => {
    const { container } = render(() => (
      <Notifications notifications={NOTIFICATIONS} onOpen={vi.fn()} onDismiss={vi.fn()} />
    ));

    expect(container.querySelectorAll('.cx-notification__lane')).toHaveLength(2);
    expect(container.querySelectorAll('.cx-notification__dot')).toHaveLength(1);
  });

  it('opens a notification by id', () => {
    const onOpen = vi.fn();
    render(() => (
      <Notifications notifications={NOTIFICATIONS} onOpen={onOpen} onDismiss={vi.fn()} />
    ));

    fireEvent.click(screen.getByText('Fix flaky auth tests opened PR #482').closest('button')!);
    expect(onOpen).toHaveBeenCalledWith('n1');
  });

  it('offers Mark all read only while something is unread', () => {
    // Against an already-read list the action provably does nothing.
    const withUnread = render(() => (
      <Notifications
        notifications={NOTIFICATIONS}
        onOpen={vi.fn()}
        onMarkAllRead={vi.fn()}
        onDismiss={vi.fn()}
      />
    ));
    expect(screen.getByRole('button', { name: 'Mark all read' })).toBeInTheDocument();
    withUnread.unmount();

    render(() => (
      <Notifications
        notifications={[{ id: 'n2', message: 'Read already', age: '1h ago' }]}
        onOpen={vi.fn()}
        onMarkAllRead={vi.fn()}
        onDismiss={vi.fn()}
      />
    ));
    expect(screen.queryByRole('button', { name: 'Mark all read' })).toBeNull();
  });

  it('says so when there is nothing new', () => {
    render(() => <Notifications notifications={[]} onOpen={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText('Nothing new.')).toBeInTheDocument();
  });
});

describe('Upgrade modal', () => {
  it('shows the reason it was raised, not a generic blurb', () => {
    // "You have run out of credits" and "this model needs a higher plan" lead to the same
    // place but are not the same message.
    render(() => (
      <UpgradeModal
        title="Upgrade to keep going"
        body="You have used all of this month’s credits."
        benefits={['Unlimited sessions', 'Cortex Opus', 'Cloud runtimes']}
        confirmLabel="Upgrade to Pro"
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />
    ));

    expect(screen.getByText('You have used all of this month’s credits.')).toBeInTheDocument();
  });

  it('lists each benefit', () => {
    render(() => (
      <UpgradeModal
        title="Upgrade"
        body="x"
        benefits={['Unlimited sessions', 'Cortex Opus']}
        confirmLabel="Upgrade"
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />
    ));

    expect(screen.getByText('Unlimited sessions')).toBeInTheDocument();
    expect(screen.getByText('Cortex Opus')).toBeInTheDocument();
  });

  it('confirms and declines', () => {
    const onConfirm = vi.fn();
    const onDismiss = vi.fn();
    render(() => (
      <UpgradeModal
        title="Upgrade"
        body="x"
        benefits={[]}
        confirmLabel="Upgrade to Pro"
        onConfirm={onConfirm}
        onDismiss={onDismiss}
      />
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Pro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
