import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CortexCodeShell } from '../CortexCodeShell';
import { WorkbenchProvider } from '../../../contexts/WorkbenchContext';
import { DebugProvider } from '../../../contexts/DebugContext';

beforeEach(() => {
  window.localStorage.setItem('cortex:workspace-path', '/repo');
  (window as unknown as { cortex: unknown }).cortex = {
    db: { query: vi.fn(async () => ({ success: true, data: { rows: [] } })) },
    ai: {
      createSession: vi.fn(async () => ({ success: true, data: { sessionId: 's1' } })),
      streamResponse: vi.fn(async () => undefined),
      stopStream: vi.fn(async () => undefined),
      resolvePermission: vi.fn(async () => ({ success: true, data: { requestId: 'p' } })),
    },
    mcp: { listPermissions: vi.fn(async () => ({ success: true, data: { permissions: [] } })) },
  };
  (window as unknown as { ipc: unknown }).ipc = {
    invoke: vi.fn(async (channel: string) => {
      if (channel === 'git:stash-list') {
        return { success: true, data: { stashes: [] } };
      }
      return { success: true, data: {} };
    }),
    on: vi.fn(() => () => undefined),
  };
  (window as unknown as { electron: unknown }).electron = {
    invoke: vi.fn(async () => ({
      success: true,
      data: { branch: 'fix/upload-hardening', ahead: 0, behind: 0, files: [], isClean: true },
    })),
  };
});

function renderShell() {
  return render(
    <WorkbenchProvider>
      <DebugProvider>
        <CortexCodeShell />
      </DebugProvider>
    </WorkbenchProvider>
  );
}

describe('CortexCodeShell', () => {
  it('renders the empty session chrome from Paper', () => {
    renderShell();
    expect(screen.getByTestId('cortex-code-shell')).toBeInTheDocument();
    expect(screen.getByTestId('cortex-code-shell')).toHaveAttribute(
      'data-session-chrome',
      '240-320-36'
    );
    expect(screen.getByRole('heading', { name: /Hey,\s+what should we build\?/ })).toBeInTheDocument();
    expect(screen.getByText('Fix a failing test')).toBeInTheDocument();
    expect(screen.getByTestId('composer')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/@ for files and agents/)).toBeInTheDocument();
    expect(screen.getByTestId('git-context-panel')).toBeInTheDocument();
    expect(screen.getByTestId('new-session')).toBeInTheDocument();
    expect(screen.getByTestId('agent-picker')).toBeInTheDocument();
    expect(screen.getByTestId('composer-model')).toBeInTheDocument();
    expect(screen.getByTestId('composer-send')).toBeInTheDocument();
  });

  it('keeps the live-session rail to the Paper order and swaps the 320 panel', () => {
    renderShell();
    const rail = screen.getByTestId('sidebar');
    expect(rail).toHaveAttribute('data-rail-count', '9');
    const order = [
      'sidebar-git',
      'sidebar-prs',
      'sidebar-explorer',
      'sidebar-terminal',
      'sidebar-notes',
      'sidebar-plans',
      'sidebar-preview',
      'sidebar-ai-chat',
      'sidebar-browser',
    ];
    const buttons = [...rail.querySelectorAll('button')].map((el) => el.getAttribute('data-testid'));
    expect(buttons).toEqual(order);
    expect(screen.queryByTestId('sidebar-settings')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('sidebar-terminal'));
    expect(screen.getByTestId('terminal-context-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('git-context-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('cortex-code-shell')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('sidebar-git'));
    expect(screen.getByTestId('git-context-panel')).toBeInTheDocument();
  });

  it('opens the 310 model picker from the composer chip', () => {
    renderShell();
    fireEvent.click(screen.getByTestId('composer-model'));
    const picker = screen.getByTestId('model-picker');
    expect(picker).toBeInTheDocument();
    expect(picker.className).toContain('w-[310px]');
    expect(screen.getByText('Manage models…')).toBeInTheDocument();
  });

  it('proposes a model switch instead of applying it silently', () => {
    renderShell();
    expect(screen.getByTestId('composer-model')).toHaveTextContent('Claude Sonnet 4');
    fireEvent.click(screen.getByTestId('composer-model'));
    fireEvent.click(screen.getByText('Claude Opus 4.8'));
    expect(screen.queryByTestId('model-picker')).not.toBeInTheDocument();
    expect(screen.getByTestId('model-switch-proposal')).toHaveTextContent('claude-opus-4.8');
    expect(screen.getByTestId('composer-model')).toHaveTextContent('Claude Sonnet 4');
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.queryByTestId('model-switch-proposal')).not.toBeInTheDocument();
    expect(screen.getByTestId('composer-model')).toHaveTextContent(/Opus/i);
  });

  it('requires confirmation before deleting a session', () => {
    renderShell();
    fireEvent.click(screen.getByLabelText('Delete session'));
    expect(screen.getByTestId('delete-session-confirm')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('delete-session-confirm')).not.toBeInTheDocument();
  });

  it('uses a 52px session top bar', () => {
    renderShell();
    expect(screen.getByTestId('cortex-topbar').className).toContain('h-[52px]');
  });

  it('queues composer text and exposes agent / plan modes', async () => {
    renderShell();
    expect(screen.getByTestId('agent-picker')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('composer-input'), {
      target: { value: 'Review my changes' },
    });
    fireEvent.click(screen.getByTestId('composer-send'));
    // Paper shows the user message as a right-aligned bubble in the transcript,
    // not a separate floating goal chip.
    await waitFor(() =>
      expect(screen.getByTestId('agent-transcript')).toHaveTextContent('Review my changes')
    );
  });
});
