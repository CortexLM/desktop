import { createSignal } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { parseUnifiedDiff, type DiffFile } from '../diff-view.tsx';
import {
  SessionDetailScreen,
  type SessionDetailScreenProps,
  type WorkbenchTab,
} from '../session-detail-screen.tsx';
import type { PlanStep } from '../session-timeline.tsx';

const PLAN: PlanStep[] = [
  { id: '1', label: 'Reproduce failure with pytest', state: 'done' },
  { id: '2', label: 'Isolate race in token refresh mock', state: 'done' },
  { id: '3', label: 'Patch mock to serialize refresh behind a lock', state: 'current' },
  { id: '4', label: 'Re-run suite 100x to confirm stability', state: 'pending' },
];

const FILES: DiffFile[] = [
  {
    path: 'tests/mocks/token_mock.py',
    added: 24,
    removed: 8,
    rows: parseUnifiedDiff(
      ['@@ -41,8 +41,16 @@ class TokenRefreshMock:', ' def refresh(self):', '-  return self._token', '+  with self._lock:', '+    return self._token'].join('\n'),
    ),
  },
];

function renderDetail(overrides: Partial<SessionDetailScreenProps> = {}) {
  const [tab, setTab] = createSignal<WorkbenchTab>(overrides.activeTab ?? 'changes');
  const [followUp, setFollowUp] = createSignal(overrides.followUp ?? '');
  const onBack = overrides.onBack ?? vi.fn();
  const onSendFollowUp = overrides.onSendFollowUp ?? vi.fn();

  const {
    activeTab: _t,
    onTabChange: _tc,
    followUp: _f,
    onFollowUpChange: _fc,
    onBack: _b,
    onSendFollowUp: _s,
    ...rest
  } = overrides;

  const result = render(() => (
    <SessionDetailScreen
      title="Fix flaky auth tests in CI"
      meta="backend-api · cortex/fix-flaky-auth-retries · Started 18 min ago"
      running
      files={FILES}
      prompt="The auth integration tests fail intermittently on CI."
      {...rest}
      activeTab={tab()}
      onTabChange={setTab}
      followUp={followUp()}
      onFollowUpChange={setFollowUp}
      onBack={onBack}
      onSendFollowUp={onSendFollowUp}
    />
  ));

  return { ...result, tab, followUp, onBack, onSendFollowUp };
}

describe('Session header', () => {
  it('shows the title and its context line', () => {
    renderDetail();

    expect(screen.getByRole('heading', { name: 'Fix flaky auth tests in CI' })).toBeInTheDocument();
    expect(screen.getByText(/cortex\/fix-flaky-auth-retries/)).toBeInTheDocument();
  });

  it('goes back to the list', () => {
    const { onBack } = renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Back to sessions' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('offers Stop only while the agent is running', () => {
    // Leaving it visible but disabled on a finished session would suggest the agent might
    // still be going.
    const running = renderDetail({ running: true, onStop: vi.fn() });
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    running.unmount();

    renderDetail({ running: false, onStop: vi.fn() });
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  it('stops the run', () => {
    const onStop = vi.fn();
    renderDetail({ onStop });
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it('does not show a View PR action — that chrome is not a live session control', () => {
    renderDetail();
    expect(screen.queryByRole('button', { name: /View PR/ })).toBeNull();
    expect(screen.queryByText(/You/)).toBeNull();
  });
});

describe('Session plan', () => {
  it('marks each step with its state', () => {
    renderDetail({ plan: PLAN });

    expect(screen.getAllByLabelText('Done')).toHaveLength(2);
    expect(screen.getAllByLabelText('In progress')).toHaveLength(1);
    expect(screen.getAllByLabelText('Not started')).toHaveLength(1);
  });

  it('gives only the current step full text colour', () => {
    const { container } = renderDetail({ plan: PLAN });
    expect(container.querySelectorAll('.cx-plan__step--current')).toHaveLength(1);
  });

  it('renders no plan block when there is no plan', () => {
    const { container } = renderDetail();
    expect(container.querySelector('.cx-plan')).toBeNull();
  });

  it('shows a mermaid diagram in mono and plan steps in sans', () => {
    const { container } = renderDetail({
      plan: PLAN,
      planMermaid: 'flowchart TD\n  A-->B',
    });
    const diagram = screen.getByLabelText('Plan diagram');
    expect(diagram.textContent).toContain('flowchart TD');
    expect(container.querySelector('.cx-plan__label')).toBeTruthy();
  });
});

describe('Session worklog', () => {
  const work = [
    { id: '1', text: 'pytest tests/auth -x --count=50' },
    { id: '2', text: 'Read src/auth/token_refresh.py' },
  ];

  it('keeps reasoning collapsed until opened', () => {
    renderDetail({ reasoning: 'Checking the lock around token refresh' });
    expect(screen.getByRole('button', { name: /Reasoning/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByText('Checking the lock around token refresh')).toBeNull();
  });

  it('keeps the summary visible and the detail collapsed', () => {
    // The detail is what you go looking for when something went wrong, not what you read
    // first; the summary keeps the cost in view either way.
    renderDetail({ workSummary: 'Worked for 4m 32s', work });

    expect(screen.getByRole('button', { name: /Worked for 4m 32s/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByText('pytest tests/auth -x --count=50')).toBeNull();
  });

  it('expands on request', () => {
    renderDetail({ workSummary: 'Worked for 4m 32s', work });

    fireEvent.click(screen.getByRole('button', { name: /Worked for 4m 32s/ }));

    expect(screen.getByText('pytest tests/auth -x --count=50')).toBeInTheDocument();
    expect(screen.getByText('Read src/auth/token_refresh.py')).toBeInTheDocument();
  });
});

describe('Session artifacts', () => {
  it('lists each artifact with its metadata', () => {
    renderDetail({
      artifacts: [
        { id: 'a1', name: 'flake-analysis.md', meta: 'Artifact · 2.1 KB · root-cause writeup' },
      ],
    });

    expect(screen.getByText('flake-analysis.md')).toBeInTheDocument();
    expect(screen.getByText('Artifact · 2.1 KB · root-cause writeup')).toBeInTheDocument();
  });

  it('offers View only when the artifact can be opened', () => {
    const onOpen = vi.fn();
    const withAction = renderDetail({
      artifacts: [{ id: 'a1', name: 'flake-analysis.md', meta: 'Artifact', onOpen }],
    });

    fireEvent.click(screen.getByRole('button', { name: 'View flake-analysis.md' }));
    expect(onOpen).toHaveBeenCalledOnce();
    withAction.unmount();

    renderDetail({ artifacts: [{ id: 'a1', name: 'x.md', meta: 'Artifact' }] });
    expect(screen.queryByRole('button', { name: /View/ })).toBeNull();
  });
});

describe('Session permission banner', () => {
  const request = { requestId: 'perm-1', summary: 'Create NOTES.md', risk: 'caution' as const };

  it('shows the request and resolves it with the chosen decision', () => {
    const onResolvePermission = vi.fn();
    renderDetail({ permission: request, onResolvePermission });

    expect(screen.getByText('Permission needed')).toBeInTheDocument();
    expect(screen.getByText('Create NOTES.md')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Allow' }));
    expect(onResolvePermission).toHaveBeenCalledExactlyOnceWith('perm-1', 'allow-once');
  });

  it('offers Always allow and Deny too', () => {
    const onResolvePermission = vi.fn();
    renderDetail({ permission: request, onResolvePermission });

    fireEvent.click(screen.getByRole('button', { name: 'Deny' }));
    expect(onResolvePermission).toHaveBeenCalledExactlyOnceWith('perm-1', 'deny');
  });

  it('disables the buttons after a decision', () => {
    // The banner only leaves the screen when the loop reacts; until then a second
    // click would race the first decision.
    const onResolvePermission = vi.fn();
    renderDetail({ permission: request, onResolvePermission });

    fireEvent.click(screen.getByRole('button', { name: 'Allow' }));
    fireEvent.click(screen.getByRole('button', { name: 'Allow' }));

    expect(onResolvePermission).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Deny' })).toBeDisabled();
  });

  it('replaces the activity line while it is up', () => {
    // "Waiting for permission" under a banner that says the same thing with buttons
    // would be saying it twice.
    renderDetail({ permission: request, activity: 'Waiting for permission: Create NOTES.md' });

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('Permission needed');
  });

  it('renders no banner when nothing is pending', () => {
    renderDetail();
    expect(screen.queryByText('Permission needed')).toBeNull();
  });
});

describe('Session follow-up', () => {
  it('sends a follow-up', () => {
    const { onSendFollowUp } = renderDetail({ followUp: 'Also add a regression test' });
    fireEvent.click(screen.getByRole('button', { name: 'Send follow-up' }));
    expect(onSendFollowUp).toHaveBeenCalledOnce();
  });

  it('names the send action for a follow-up rather than a new session', () => {
    renderDetail();
    expect(screen.getByRole('button', { name: 'Send follow-up' })).toBeInTheDocument();
  });

  it('shows the current activity above the composer', () => {
    renderDetail({ activity: 'Patching token mock — step 3 of 4…' });
    expect(screen.getByRole('status')).toHaveTextContent('step 3 of 4');
  });

  it('blocks the follow-up when the host says so', () => {
    renderDetail({
      followUp: 'more please',
      followUpDisabled: true,
      followUpDisabledReason: 'This session has finished',
    });

    expect(screen.getByRole('button', { name: 'Send follow-up' })).toBeDisabled();
  });
});

describe('Session workbench', () => {
  it('counts changed files on Files and Diff', () => {
    const { container } = renderDetail();
    expect(container.querySelectorAll('.cx-tabs__count')).toHaveLength(2);
    expect(container.querySelector('.cx-tabs__count')).toHaveTextContent('1');
  });

  it('shows the diff on the Changes tab', () => {
    renderDetail({ activeTab: 'changes' });
    expect(screen.getByText('tests/mocks/token_mock.py')).toBeInTheDocument();
  });

  it('swaps panels when the tab changes', () => {
    const { tab } = renderDetail({ activeTab: 'changes', shell: <p>shell output</p> });

    expect(screen.queryByText('shell output')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /Terminal/ }));

    expect(tab()).toBe('shell');
    expect(screen.getByText('shell output')).toBeInTheDocument();
  });

  it('renders the host-owned panels', () => {
    renderDetail({ activeTab: 'plan', plan: PLAN });
    expect(screen.getByText('Reproduce failure with pytest')).toBeInTheDocument();
  });
});

describe('Diff rendering', () => {
  it('collapses a file on request', () => {
    const { container } = renderDetail();
    const header = screen.getByRole('button', { expanded: true });

    fireEvent.click(header);

    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(container.querySelector('.cx-diff__body')).toBeNull();
  });

  it('shows each file its own diff counts', () => {
    renderDetail();
    expect(screen.getByText('+24')).toBeInTheDocument();
    expect(screen.getByText('\u22128')).toBeInTheDocument();
  });

  it('says so when nothing has changed yet', () => {
    renderDetail({ files: [] });
    expect(screen.getByText('No file changes yet.')).toBeInTheDocument();
  });
});

describe('parseUnifiedDiff', () => {
  it('numbers lines from the hunk header rather than counting from the top', () => {
    // A diff only carries the hunks it touches, so counting would number the second hunk as
    // though it followed the first.
    const rows = parseUnifiedDiff(
      ['@@ -41,2 +41,2 @@', ' context', '+added', '@@ -300,1 +310,1 @@', ' later'].join('\n'),
    );

    const later = rows.at(-1)!;
    expect(later.kind).toBe('context');
    expect(later.line).toBe(310);
  });

  it('classifies added, removed and context lines', () => {
    const rows = parseUnifiedDiff(['@@ -1,3 +1,3 @@', ' keep', '-gone', '+new'].join('\n'));
    expect(rows.map((row) => row.kind)).toEqual(['hunk', 'context', 'removed', 'added']);
  });

  it('strips the leading marker from the code', () => {
    const rows = parseUnifiedDiff(['@@ -1,1 +1,1 @@', '+  indented'].join('\n'));
    expect(rows[1]!.text).toBe('  indented');
  });

  it('drops the file headers, which carry no code', () => {
    // Otherwise `+++ b/path` would render in the added colour right under the path the card
    // already names.
    const rows = parseUnifiedDiff(
      ['diff --git a/x b/x', 'index 111..222 100644', '--- a/x', '+++ b/x', '@@ -1,1 +1,1 @@', '+one'].join(
        '\n',
      ),
    );

    expect(rows.map((row) => row.kind)).toEqual(['hunk', 'added']);
  });

  it('advances old and new line numbers independently', () => {
    const rows = parseUnifiedDiff(
      ['@@ -10,3 +20,3 @@', '-removed one', '-removed two', '+added one'].join('\n'),
    );

    expect(rows[1]!.line).toBe(10);
    expect(rows[2]!.line).toBe(11);
    expect(rows[3]!.line).toBe(20);
  });
});
