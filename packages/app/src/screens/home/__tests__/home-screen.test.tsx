import { createSignal } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { ANONYMOUS_CAPABILITIES, AUTHENTICATED_CAPABILITIES } from '@cortex-ide/cortex-api';

import { HomeScreen, type HomeScreenProps, type SessionDraft } from '../home-screen.tsx';
import type { RecentSessionRow } from '../recent-sessions.tsx';

const ROWS: RecentSessionRow[] = [
  {
    id: 's1',
    title: 'Fix flaky auth tests',
    context: 'backend-api · agent/auth-tests-fix',
    status: 'running',
    diff: { added: 186, removed: 42 },
    age: '4m ago',
  },
  {
    id: 's2',
    title: 'Add rate limiting to public API',
    context: 'backend-api · agent/rate-limit-middleware',
    status: 'pr-ready',
    diff: { added: 312, removed: 18 },
    age: '1h ago',
  },
  {
    id: 's3',
    title: 'Investigate memory leak in worker pool',
    context: 'infra-tools · agent/worker-leak-probe',
    status: 'error',
    diff: { added: 12, removed: 0 },
    age: '2d ago',
  },
];

function renderHome(overrides: Partial<HomeScreenProps> = {}) {
  const [draft, setDraft] = createSignal<SessionDraft>(
    overrides.draft ?? { prompt: '', runtime: 'local' },
  );
  const onStart = overrides.onStart ?? vi.fn();
  const onOpenSession = overrides.onOpenSession ?? vi.fn();
  const {
    draft: _draft,
    onDraftChange: _onDraftChange,
    onStart: _onStart,
    onOpenSession: _onOpenSession,
    ...rest
  } = overrides;

  const result = render(() => (
    <HomeScreen
      capabilities={ANONYMOUS_CAPABILITIES}
      greeting="What should we build?"
      recentSessions={ROWS}
      {...rest}
      draft={draft()}
      onDraftChange={setDraft}
      onStart={onStart}
      onOpenSession={onOpenSession}
    />
  ));

  return { ...result, draft, setDraft, onStart, onOpenSession };
}

describe('Home composer', () => {
  it('starts a session with the current draft', () => {
    const { onStart, setDraft } = renderHome();
    setDraft({ prompt: 'Fix the flaky auth tests', repo: 'forge/backend-api', runtime: 'local' });

    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));

    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'Fix the flaky auth tests', repo: 'forge/backend-api' }),
    );
  });

  it('reports typing back through the draft', () => {
    const { draft } = renderHome();
    fireEvent.input(screen.getByLabelText('Prompt'), { target: { value: 'Do the thing' } });
    expect(draft().prompt).toBe('Do the thing');
  });

  it('names the pickers from the draft, and prompts when a slot is empty', () => {
    renderHome({ draft: { prompt: '', runtime: 'local' } });

    expect(screen.getByRole('button', { name: /Open a folder/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^main$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Choose a model/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Local$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^This PC$/ })).toBeInTheDocument();
  });

  it('shows the chosen runtime', () => {
    renderHome({
      capabilities: AUTHENTICATED_CAPABILITIES,
      draft: { prompt: '', runtime: 'cloud' },
    });
    expect(screen.getByRole('button', { name: /Cloud/ })).toBeInTheDocument();
  });

  it('disables the runtime picker when there is only one runtime to pick', () => {
    // Signed out there is only This PC, so an enabled picker would promise a choice that does
    // not exist - even with a handler wired.
    renderHome({ capabilities: ANONYMOUS_CAPABILITIES, onPickRuntime: vi.fn() });
    expect(screen.getByRole('button', { name: /^Local$/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^This PC$/ })).toBeDisabled();
  });

  it('enables the runtime picker once there is more than one runtime', () => {
    renderHome({ capabilities: AUTHENTICATED_CAPABILITIES, onPickRuntime: vi.fn() });
    expect(screen.getByRole('button', { name: /^Local$/ })).not.toBeDisabled();
  });

  it('names SSH as SSH, never as This PC or This desktop', () => {
    renderHome({
      capabilities: AUTHENTICATED_CAPABILITIES,
      draft: { prompt: '', runtime: 'ssh' },
    });
    expect(screen.getByRole('button', { name: /^SSH$/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /This desktop/i })).toBeNull();
  });

  it('renders an unwired picker as a disabled button rather than inert text', () => {
    // Inert text looks identical to a live control and silently does nothing when clicked.
    renderHome({ capabilities: AUTHENTICATED_CAPABILITIES });
    expect(screen.getByRole('button', { name: /Open a folder/ })).toBeDisabled();
  });

  it('opens each picker', () => {
    const onPickRepo = vi.fn();
    const onPickModel = vi.fn();
    renderHome({ onPickRepo, onPickModel });

    fireEvent.click(screen.getByRole('button', { name: /Open a folder/ }));
    fireEvent.click(screen.getByRole('button', { name: /Choose a model/ }));

    expect(onPickRepo).toHaveBeenCalledOnce();
    expect(onPickModel).toHaveBeenCalledOnce();
  });

  it('offers Ask, Plan and Agent on the composer', () => {
    renderHome();
    expect(screen.getByRole('button', { name: 'Ask' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Plan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agent' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the worktree chip from the draft', () => {
    renderHome({ draft: { prompt: '', runtime: 'local', repo: 'app', worktree: 'app' } });
    expect(screen.getAllByRole('button', { name: /app/ }).length).toBeGreaterThanOrEqual(2);
  });
});

describe('Home limit notices', () => {
  it('shows a usage warning without blocking the composer', () => {
    // A warning is information to act on later; the user can still start a session.
    renderHome({
      draft: { prompt: 'Do the thing', runtime: 'local' },
      limit: { kind: 'warning', message: 'You have used 80% of this month’s credits' },
    });

    expect(screen.getByRole('status')).toHaveTextContent('80%');
    expect(screen.getByRole('button', { name: 'Start session' })).not.toBeDisabled();
  });

  it('blocks the composer when the limit is reached', () => {
    // Offering a send button that cannot work would be worse than saying so.
    renderHome({
      draft: { prompt: 'Do the thing', runtime: 'local' },
      limit: { kind: 'reached', message: 'Monthly credit limit reached' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Monthly credit limit reached');
    expect(screen.getByRole('button', { name: 'Start session' })).toBeDisabled();
  });

  it('announces a reached limit assertively and a warning politely', () => {
    const warning = renderHome({ limit: { kind: 'warning', message: 'Nearly out' } });
    expect(screen.getByRole('status')).toBeInTheDocument();
    warning.unmount();

    renderHome({ limit: { kind: 'reached', message: 'Out' } });
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('offers the upgrade action from the notice', () => {
    const onAction = vi.fn();
    renderHome({
      limit: { kind: 'reached', message: 'Out of credits', actionLabel: 'Upgrade', onAction },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Upgrade' }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('shows no notice when there is no limit to report', () => {
    renderHome();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('Home checklist', () => {
  const checklist = {
    title: 'Get started with Cortex Code',
    steps: [
      { id: '1', label: 'Connect your GitHub account', done: true },
      { id: '2', label: 'Set up the dev environment', done: true },
      { id: '3', label: 'Run your first session', done: false, action: 'Start' },
      { id: '4', label: 'Enable your first automation', done: false, action: 'Browse' },
    ],
  };

  it('counts completed steps rather than trusting a supplied number', () => {
    renderHome({ checklist });
    expect(screen.getByText('2 of 4')).toBeInTheDocument();
  });

  it('offers an action only on the steps still open', () => {
    renderHome({ checklist });

    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect your GitHub account' })).toBeNull();
  });

  it('marks each step done or not for assistive technology', () => {
    renderHome({ checklist });

    expect(screen.getAllByLabelText('Done')).toHaveLength(2);
    expect(screen.getAllByLabelText('Not started')).toHaveLength(2);
  });

  it('dismisses on request and stays dismissed', () => {
    renderHome({ checklist });

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('2 of 4')).toBeNull();
  });

  it('shows nothing when there is no checklist', () => {
    renderHome();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });
});

describe('Home recent sessions', () => {
  it('lists each session with its context and age', () => {
    renderHome();

    expect(screen.getByText('Fix flaky auth tests')).toBeInTheDocument();
    expect(screen.getByText('backend-api · agent/auth-tests-fix')).toBeInTheDocument();
    expect(screen.getByText('4m ago')).toBeInTheDocument();
  });

  it('formats diff counts with a minus sign', () => {
    renderHome();
    expect(screen.getByText('+186')).toBeInTheDocument();
    expect(screen.getByText('\u221242')).toBeInTheDocument();
  });

  it('tones each status dot: copper for live, error for failed', () => {
    // C3 gives every status a dot in its own hue: Running is the copper accent,
    // Error the oxblood, and settled outcomes the brand green.
    const { container } = renderHome();
    expect(container.querySelectorAll('.cx-recent__status--accent')).toHaveLength(1);
    expect(container.querySelectorAll('.cx-recent__status--error')).toHaveLength(1);
  });

  it('opens a session by id', () => {
    const { onOpenSession } = renderHome();
    fireEvent.click(screen.getByText('Fix flaky auth tests').closest('button')!);
    expect(onOpenSession).toHaveBeenCalledWith('s1');
  });

  it('offers View all only when the host handles it', () => {
    const withLink = renderHome({ onViewAllSessions: vi.fn() });
    expect(screen.getByRole('button', { name: 'View all' })).toBeInTheDocument();
    withLink.unmount();

    renderHome();
    expect(screen.queryByRole('button', { name: 'View all' })).toBeNull();
  });

  it('omits the whole table when there is nothing recent', () => {
    const { container } = renderHome({ recentSessions: [] });
    expect(container.querySelector('.cx-recent')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Ship features, not lines.' })).toBeInTheDocument();
  });

  it('starts from the empty CTA and shows a failed start next to it', () => {
    const { onStart } = renderHome({
      recentSessions: [],
      limit: { kind: 'reached', message: 'No model is configured' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Start a session' }));

    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        runtime: 'local',
        prompt: 'Look around this workspace and summarise the layout.',
      }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('No model is configured');
  });
});
