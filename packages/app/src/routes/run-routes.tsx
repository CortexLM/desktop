/**
 * The routes that show runs: Home, the inbox, and one session's detail.
 *
 * Split out of `route-components.tsx` because they are the only routes with real
 * behaviour rather than prop plumbing — starting a run, filtering an inbox,
 * projecting a timeline.
 */

import { createEffect, createMemo, createSignal, onMount, type JSX } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';

import type { RuntimeKind } from '@cortex-ide/cortex-api';
import type { SessionSummary } from '@cortex-ide/shared';

import { useAccount } from '../state/session-context.tsx';
import { useSessions } from '../state/sessions-context.tsx';
import { composerDraft, setComposerDraft } from '../state/composer-draft.ts';
import { toInboxSession, toRecentRow } from '../state/session-view.ts';
import { HomeScreen } from '../screens/home/home-screen.tsx';
import type { ChecklistStep } from '../screens/home/checklist.tsx';
import { SessionsScreen } from '../screens/sessions/sessions-screen.tsx';
import {
  SessionDetailScreen,
  type WorkbenchTab,
} from '../screens/session/session-detail-screen.tsx';
import { createSessionDetail } from '../screens/session/session-detail-state.ts';
import { ShellView } from '../screens/session/shell-view.tsx';
import { harnessStatus, remoteHost, setRemoteHost } from '../state/harness.ts';
import { codePermissionBlocked, realtimeStatus } from '../state/realtime-bridge.ts';
import { createStartRun, cycleDraftField, cycleRuntime, pickRepo } from './start-run.ts';
import { EMPTY_STATES, filterCounts, workspaceSummary } from './sessions-inbox.ts';

function branchNames(runs: ReturnType<typeof useSessions>): readonly string[] {
  const draft = composerDraft();
  const repositories = runs.repositories() ?? [];
  const repo = repositories.find((entry) => entry.id === draft.repo) ?? repositories[0];
  return repo?.branches ?? [];
}

function buildChecklist(state: {
  hasRepository: boolean;
  hasRun: boolean;
  signedIn: boolean;
  hasModel: boolean;
  openFolder: () => void;
  openSettings: () => void;
}): { title: string; steps: ChecklistStep[] } | undefined {
  const steps: ChecklistStep[] = [
    {
      id: 'folder',
      label: 'Open a folder to work in',
      done: state.hasRepository,
      ...(state.hasRepository ? {} : { action: 'Open', onAction: state.openFolder }),
    },
    {
      id: 'model',
      label: 'Choose a model, or add a provider key',
      done: state.signedIn || state.hasModel,
      ...(state.signedIn ? {} : { action: 'Settings', onAction: state.openSettings }),
    },
    { id: 'run', label: 'Start your first session', done: state.hasRun },
  ];

  return steps.every((step) => step.done) ? undefined : { title: 'Get started', steps };
}

function toLimitNotice(message: string | undefined, openSettings: () => void) {
  return message
    ? {
        kind: 'reached' as const,
        message,
        actionLabel: 'Open settings',
        onAction: openSettings,
      }
    : undefined;
}

function codeGreeting(displayName?: string): string {
  return displayName
    ? `What should we build, ${displayName.split(/\s+/)[0]}?`
    : 'What should we build?';
}

function correctDraftRuntime(allowed: readonly RuntimeKind[]): void {
  if (!allowed.includes(composerDraft().runtime)) {
    setComposerDraft((current) => ({ ...current, runtime: allowed[0] ?? 'cloud' }));
  }
}

function syncDraftWorkspace(runs: ReturnType<typeof useSessions>): void {
  const first = (runs.repositories() ?? [])[0];
  if (!first) return;
  setComposerDraft((draft) => ({
    ...draft,
    repo: draft.repo && (runs.repositories() ?? []).some((row) => row.id === draft.repo)
      ? draft.repo
      : first.id,
    branch: draft.branch ?? first.branch,
    worktree: first.worktree ?? first.id,
  }));
}

function useHomeStatus(
  account: ReturnType<typeof useAccount>,
  runs: ReturnType<typeof useSessions>,
  navigate: (path: string) => void,
) {
  const repositoryNames = createMemo(() => (runs.repositories() ?? []).map((repo) => repo.id));

  return {
    repositoryNames,
    checklist: createMemo(() =>
      buildChecklist({
        hasRepository: repositoryNames().length > 0,
        hasRun: (runs.sessions() ?? []).length > 0,
        signedIn: account.capabilities().authenticated,
        hasModel: Boolean(composerDraft().model),
        openFolder: () => void runs.openWorkspace(),
        openSettings: () => navigate('/code/settings'),
      }),
    ),
    harness: createMemo(() =>
      harnessStatus({
        authenticated: account.capabilities().authenticated,
        cloudSession: (runs.sessions() ?? []).some((session) => session.status === 'running'),
        permissionBlocked: codePermissionBlocked(),
        connecting: realtimeStatus() === 'connecting',
      }),
    ),
  };
}

export function HomeRoute(): JSX.Element {
  const account = useAccount();
  const runs = useSessions();
  const navigate = useNavigate();

  onMount(() => correctDraftRuntime(account.capabilities().runtimes));
  createEffect(() => syncDraftWorkspace(runs));

  const [startError, setStartError] = createSignal<string>();
  const start = createStartRun({
    runs,
    navigate,
    setError: setStartError,
    signedIn: () => account.capabilities().authenticated,
  });
  const recent = createMemo(() =>
    (runs.sessions() ?? []).filter((session) => !session.archived).slice(0, 5).map(toRecentRow),
  );
  const { repositoryNames, checklist, harness } = useHomeStatus(account, runs, navigate);
  const limit = createMemo(() => toLimitNotice(startError(), () => navigate('/code/settings')));

  return (
    <HomeScreen
      capabilities={account.capabilities()}
      greeting={codeGreeting(account.user()?.displayName)}
      draft={composerDraft()}
      onDraftChange={setComposerDraft}
      onStart={(draft) => void start(draft)}
      recentSessions={recent()}
      onOpenSession={(id) => navigate(`/code/sessions/${id}`)}
      onViewAllSessions={() => navigate('/code/sessions')}
      onPickModel={() => navigate('/code/settings')}
      onPickRepo={() => pickRepo(repositoryNames(), () => void runs.openWorkspace())}
      onPickBranch={() => cycleDraftField('branch', branchNames(runs))}
      onPickRuntime={() => cycleRuntime(account.capabilities().runtimes)}
      harness={harness()}
      remoteHost={remoteHost()}
      onRemoteHostChange={setRemoteHost}
      {...(checklist() ? { checklist: checklist()! } : {})}
      {...(limit() ? { limit: limit()! } : {})}
    />
  );
}

export function SessionsRoute(): JSX.Element {
  const runs = useSessions();
  const navigate = useNavigate();
  const [filter, setFilter] = createSignal('all');
  const [query, setQuery] = createSignal('');

  const visible = createMemo(() => inboxRows(runs.sessions() ?? [], filter(), query()));
  const summary = createMemo(() => workspaceSummary(runs.sessions() ?? []));
  const filters = createMemo(() => filterCounts(runs.sessions() ?? []));

  return (
    <SessionsScreen
      sessions={visible()}
      summary={summary()}
      filters={filters()}
      activeFilter={filter()}
      onFilterChange={setFilter}
      query={query()}
      onQueryChange={setQuery}
      onOpenSession={(id) => navigate(`/code/sessions/${id}`)}
      onNewSession={() => navigate('/code')}
      emptyState={EMPTY_STATES[filter()] ?? EMPTY_STATES.all}
    />
  );
}

function inboxRows(sessions: readonly SessionSummary[], active: string, query: string) {
  const term = query.trim().toLowerCase();
  return sessions
    .filter((session) => matchesFilter(session, active))
    .filter((session) => matchesQuery(session, term))
    .map((session) => toInboxSession(session));
}

function matchesFilter(session: SessionSummary, active: string): boolean {
  if (active === 'archived') return session.archived;
  if (session.archived) return false;
  if (active === 'active') return session.status === 'queued' || session.status === 'running';
  if (active === 'review') return session.status === 'review';
  return true;
}

function matchesQuery(session: SessionSummary, term: string): boolean {
  if (term === '') return true;
  return [session.title, session.repo, session.branch]
    .filter(Boolean)
    .some((field) => field!.toLowerCase().includes(term));
}

export function SessionDetailRoute(): JSX.Element {
  const runs = useSessions();
  const navigate = useNavigate();
  const params = useParams<{ sessionId: string }>();
  const [tab, setTab] = createSignal<WorkbenchTab>('changes');
  const [followUp, setFollowUp] = createSignal('');

  const detail = createSessionDetail(() => params.sessionId, runs);
  const shell = createMemo(() =>
    tab() === 'shell' ? <ShellView sessionId={params.sessionId} /> : undefined,
  );

  const send = async () => {
    const text = followUp().trim();
    if (!text) return;
    setFollowUp('');
    await runs.host.followUp(params.sessionId, text);
  };

  return (
    <SessionDetailScreen
      {...detail.view()}
      activeTab={tab()}
      onTabChange={setTab}
      followUp={followUp()}
      onFollowUpChange={setFollowUp}
      onSendFollowUp={() => void send()}
      onBack={() => navigate('/code/sessions')}
      onStop={() => void runs.stop(params.sessionId)}
      onResolvePermission={(requestId, decision) =>
        void runs.host.resolvePermission(params.sessionId, requestId, decision)
      }
      shell={shell()}
    />
  );
}
