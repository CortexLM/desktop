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
    expect(screen.getByText('Hey, what should we build?')).toBeInTheDocument();
    expect(screen.getByText('Fix a failing test')).toBeInTheDocument();
    expect(screen.getByTestId('composer')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/@ for files and agents/)).toBeInTheDocument();
    expect(screen.getByTestId('git-context-panel')).toBeInTheDocument();
    expect(screen.getByTestId('new-session')).toBeInTheDocument();
  });

  it('queues composer text and exposes agent / plan modes', async () => {
    renderShell();
    expect(screen.getByTestId('agent-picker')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('composer-input'), {
      target: { value: 'Review my changes' },
    });
    fireEvent.click(screen.getByTestId('composer-send'));
    await waitFor(() =>
      expect(screen.getByTestId('goal-chip')).toHaveTextContent('Review my changes')
    );
  });
});
