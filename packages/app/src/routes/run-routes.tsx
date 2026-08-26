/**
 * The routes that show runs: Home, the inbox, and one session's detail.
 *
 * Split out of `route-components.tsx` because they are the only routes with real
 * behaviour rather than prop plumbing — starting a run, filtering an inbox,
 * projecting a timeline — and because that file had grown into a grab bag of
 * every screen's adapter.
 */

import { createMemo, createSignal, onMount, type JSX } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';

import { useAccount } from '../state/session-context.tsx';
import { useSessions } from '../state/sessions-context.tsx';
import {
  composerDraft,
  resetComposerDraft,
  setComposerDraft,
} from '../state/composer-draft.ts';
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

/**
 * Starts a run from the current draft.
 *
 * Extracted from `HomeRoute` because it owns a lifecycle rather than markup: an
 * in-flight guard, an error the screen surfaces, and the ordering that matters —
 * the draft is cleared only once the run exists, so a failed start does not throw
 * away the prompt at exactly the moment the user still needs it.
 */
function createStartRun(
  runs: ReturnType<typeof useSessions>,
  navigate: (path: string) => void,
  setError: (message: string | undefined) => void,
): () => Promise<void> {
  let inFlight = false;

  return async () => {
    const draft = composerDraft();
    if (!draft.prompt.trim() || inFlight) return;

    inFlight = true;
    setError(undefined);
    try {
      const session = await runs.start({
        prompt: draft.prompt.trim(),
        runtime: draft.runtime,
        ...(draft.repo ? { repo: draft.repo } : {}),
        ...(draft.branch ? { branch: draft.branch } : {}),
        ...(draft.model ? { model: draft.model } : {}),
      });
      resetComposerDraft(draft.runtime);
      navigate(`/code/sessions/${session.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      inFlight = false;
    }
  };
}

/** The branches of whichever repository the draft points at. */
function branchNames(runs: ReturnType<typeof useSessions>): readonly string[] {
  const draft = composerDraft();
  const repositories = runs.repositories() ?? [];
  const repo = repositories.find((entry) => entry.id === draft.repo) ?? repositories[0];
  return repo?.branches ?? [];
}

/**
 * Advances a draft field to the next option.
 *
 * Cycling rather than opening a menu: the common case is a single repository — the
 * open workspace — and a dropdown holding one row is a worse affordance than a
 * chip that shows what is selected. It becomes a menu when there is more than one
 * workspace to choose between.
 */
function cycleDraftField(field: 'repo' | 'branch', options: readonly string[]): void {
  if (options.length === 0) return;

  const current = composerDraft()[field] ?? '';
  const next = options[(options.indexOf(current) + 1) % options.length];
  setComposerDraft((draft) => ({ ...draft, [field]: next }));
}

/**
 * The get-started checklist, from actual state.
 *
 * Returns `undefined` once everything is done, rather than a list of ticks: a
 * completed checklist is a permanent congratulation occupying the space above the
 * composer. Dismissing it is not offered for the same reason — it goes away on its
 * own.
 */
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
      // Signing in grants the Cortex models and a provider key is the other route to
      // the same place, so either satisfies the step.
      done: state.signedIn || state.hasModel,
      ...(state.signedIn ? {} : { action: 'Settings', onAction: state.openSettings }),
    },
    { id: 'run', label: 'Start your first session', done: state.hasRun },
  ];

  return steps.every((step) => step.done) ? undefined : { title: 'Get started', steps };
}

/**
 * A failed start, in the design's banner above the composer.
 *
 * Not a toast: the prompt is still in the box, and the message explains why it did
 * not go anywhere — so it belongs next to it, with the action that fixes it.
 */
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

/**
 * Advances the repository, or opens a folder when there is nothing to advance to.
 *
 * With an empty list the picker used to cycle nothing, silently. Opening a folder is
 * the action that actually helps at that point.
 */
function pickRepo(names: readonly string[], openFolder: () => void): void {
  if (names.length === 0) {
    openFolder();
    return;
  }
  cycleDraftField('repo', names);
}

export function HomeRoute(): JSX.Element {
  const account = useAccount();
  const runs = useSessions();
  const navigate = useNavigate();

  // The draft lives in `state/composer-draft.ts`, not here: a signal owned by this route is
  // disposed the moment you navigate away, which silently emptied the composer on the way
  // back. See that module for why it is not persisted to disk either.
  //
  // The runtime is still corrected against capabilities on mount rather than defaulting to
  // Cloud: signed out, a draft pointing at a runtime the user cannot reach would fail on send.
  onMount(() => {
    const allowed = account.capabilities().runtimes;
    if (!allowed.includes(composerDraft().runtime)) {
      setComposerDraft((current) => ({ ...current, runtime: allowed[0] ?? 'local' }));
    }
  });

  const [startError, setStartError] = createSignal<string>();
  const start = createStartRun(runs, navigate, setStartError);

  const recent = createMemo(() =>
    (runs.sessions() ?? [])
      .filter((session) => !session.archived)
      .slice(0, 5)
      .map((session) => toRecentRow(session)),
  );

  const repositoryNames = createMemo(() => (runs.repositories() ?? []).map((repo) => repo.id));

  const checklist = createMemo(() =>
    buildChecklist({
      hasRepository: repositoryNames().length > 0,
      hasRun: (runs.sessions() ?? []).length > 0,
      signedIn: account.capabilities().authenticated,
      hasModel: Boolean(composerDraft().model),
      openFolder: () => void runs.openWorkspace(),
      openSettings: () => navigate('/code/settings'),
    }),
  );

  const limit = createMemo(() => toLimitNotice(startError(), () => navigate('/code/settings')));

  return (
    <HomeScreen
      capabilities={account.capabilities()}
      greeting={
        account.user()?.displayName
          ? `What should we build, ${account.user()!.displayName!.split(/\s+/)[0]}?`
          : 'What should we build?'
      }
      draft={composerDraft()}
      onDraftChange={setComposerDraft}
      onStart={() => void start()}
      recentSessions={recent()}
      onOpenSession={(id) => navigate(`/code/sessions/${id}`)}
      onViewAllSessions={() => navigate('/code/sessions')}
      onPickModel={() => navigate('/code/settings')}
      onPickRepo={() => pickRepo(repositoryNames(), () => void runs.openWorkspace())}
      onPickBranch={() => cycleDraftField('branch', branchNames(runs))}
      {...(checklist() ? { checklist: checklist()! } : {})}
      {...(limit() ? { limit: limit()! } : {})}
    />
  );
}

const SESSION_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'review', label: 'Needs review' },
  { id: 'archived', label: 'Archived' },
];

/** Copy that names the filter, so an empty list explains itself. */
const EMPTY_STATES: Record<string, { title: string; body: string }> = {
  all: {
    title: 'No sessions yet',
    body: 'Start one from the composer on Home, and it will show up here as it runs.',
  },
  active: {
    title: 'Nothing running',
    body: 'Sessions appear here while an agent is working on them.',
  },
  review: {
    title: 'Nothing to review',
    body: 'Finished sessions with changes land here for you to look over.',
  },
  archived: { title: 'Nothing archived', body: 'Sessions you archive are kept here.' },
};

export function SessionsRoute(): JSX.Element {
  const runs = useSessions();
  const navigate = useNavigate();
  const [filter, setFilter] = createSignal('all');
  const [query, setQuery] = createSignal('');

  const visible = createMemo(() => {
    const term = query().trim().toLowerCase();
    const active = filter();

    return (runs.sessions() ?? [])
      .filter((session) => {
        if (active === 'archived') return session.archived;
        if (session.archived) return false;
        if (active === 'active') return session.status === 'queued' || session.status === 'running';
        if (active === 'review') return session.status === 'review';
        return true;
      })
      .filter((session) => {
        if (term === '') return true;
        // Repo and branch are searched as well as the title: "the thing I ran on
        // the release branch" is how people look for a run they cannot name.
        return [session.title, session.repo, session.branch]
          .filter(Boolean)
          .some((field) => field!.toLowerCase().includes(term));
      })
      .map((session) => toInboxSession(session));
  });

  return (
    <SessionsScreen
      sessions={visible()}
      filters={SESSION_FILTERS}
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

export function SessionDetailRoute(): JSX.Element {
  const runs = useSessions();
  const navigate = useNavigate();
  const params = useParams<{ sessionId: string }>();
  const [tab, setTab] = createSignal<WorkbenchTab>('changes');
  const [followUp, setFollowUp] = createSignal('');

  const detail = createSessionDetail(() => params.sessionId, runs);

  /**
   * The Shell tab's contents.
   *
   * Mounted only while its tab is showing: an xterm instance per visited session,
   * all live at once, is a lot of canvas for panes nobody is looking at. Main keeps
   * the PTY alive across the unmount, so reopening the tab reattaches to the same
   * shell rather than spawning a second one.
   */
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
