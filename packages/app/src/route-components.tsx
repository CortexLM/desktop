import { createSignal, onMount, type JSX } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';

import { useAccount } from './state/session-context.tsx';
import { composerDraft, setComposerDraft } from './state/composer-draft.ts';
import { AutomationsScreen } from './screens/automations/automations-screen.tsx';
import { HomeScreen } from './screens/home/home-screen.tsx';
import {
  ConnectGitHubScreen,
  SshConnectScreen,
  WorkspaceSetupScreen,
  type FlowStep,
} from './screens/onboarding/flow-screens.tsx';
import { ReviewScreen } from './screens/review/review-screen.tsx';
import { SecretsScreen } from './screens/secrets/secrets-screen.tsx';
import { SessionDetailScreen, type WorkbenchTab } from './screens/session/session-detail-screen.tsx';
import { SessionsScreen } from './screens/sessions/sessions-screen.tsx';
import { IntegrationsScreen } from './screens/settings/integrations-screen.tsx';
import {
  SettingsScreen,
  type WorkspaceDefaults,
  type WorkspacePermissions,
} from './screens/settings/settings-screen.tsx';
import { UsageScreen } from './screens/usage/usage-screen.tsx';
import { SignInScreen } from './screens/auth/sign-in-screen.tsx';
import { DeviceCodeScreen } from './screens/auth/device-code-screen.tsx';
import { createDeviceFlow } from './screens/auth/device-flow.ts';

/**
 * Route components.
 *
 * Each one adapts the account context and the router to a screen's props. They hold no data
 * of their own: until the orchestrator lands, every list is genuinely empty and the screens
 * show their own empty states rather than placeholder rows. Fake data here would make an
 * unfinished app look finished, and would be the first thing to rot.
 */

const ONBOARDING_STEPS: readonly FlowStep[] = [
  { id: 'account', label: 'Account', done: true },
  { id: 'github', label: 'GitHub', done: false },
  { id: 'workspace', label: 'Workspace', done: false },
];

export function HomeRoute(): JSX.Element {
  const account = useAccount();
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

  return (
    <HomeScreen
      capabilities={account.capabilities()}
      draft={composerDraft()}
      onDraftChange={setComposerDraft}
      onStart={() => navigate('/sessions')}
      recentSessions={[]}
      onOpenSession={(id) => navigate(`/sessions/${id}`)}
      onViewAllSessions={() => navigate('/sessions')}
      onPickModel={() => navigate('/settings')}
    />
  );
}

export function SessionsRoute(): JSX.Element {
  const navigate = useNavigate();
  const [filter, setFilter] = createSignal('all');
  const [query, setQuery] = createSignal('');

  return (
    <SessionsScreen
      sessions={[]}
      filters={[
        { id: 'all', label: 'All' },
        { id: 'mine', label: 'Mine' },
        { id: 'archived', label: 'Archived' },
      ]}
      activeFilter={filter()}
      onFilterChange={setFilter}
      query={query()}
      onQueryChange={setQuery}
      onOpenSession={(id) => navigate(`/sessions/${id}`)}
      onNewSession={() => navigate('/')}
    />
  );
}

export function SessionDetailRoute(): JSX.Element {
  const navigate = useNavigate();
  const params = useParams<{ sessionId: string }>();
  const [tab, setTab] = createSignal<WorkbenchTab>('changes');
  const [followUp, setFollowUp] = createSignal('');

  return (
    <SessionDetailScreen
      title={`Session ${params.sessionId}`}
      meta="Not yet connected to the orchestrator"
      running={false}
      files={[]}
      prompt=""
      activeTab={tab()}
      onTabChange={setTab}
      followUp={followUp()}
      onFollowUpChange={setFollowUp}
      onSendFollowUp={() => undefined}
      followUpDisabled
      followUpDisabledReason="Sessions are not wired to the orchestrator yet"
      onBack={() => navigate('/sessions')}
    />
  );
}

export function SettingsRoute(): JSX.Element {
  const account = useAccount();

  const [defaults, setDefaults] = createSignal<WorkspaceDefaults>({
    model: '',
    repository: '',
    baseBranch: '',
    branchPrefix: 'cortex/',
    createPullRequests: 'draft',
  });

  const [permissions, setPermissions] = createSignal<WorkspacePermissions>({
    runShellCommands: true,
    applyDatabaseMigrations: false,
    slackNotifications: false,
    networkAccess: 'allowlist',
  });

  // The catalogue loads signed out, so a locked Cortex model still appears in the picker -
  // which explains what an account adds far better than an empty list would.
  const modelOptions = () =>
    account.catalogue().map((entry) => ({
      value: entry.model.id,
      label: entry.model.display_name ?? entry.model.id,
      disabled: !entry.selectable,
    }));

  return (
    <SettingsScreen
      capabilities={account.capabilities()}
      defaults={defaults()}
      onDefaultChange={(key, value) => setDefaults((current) => ({ ...current, [key]: value }))}
      permissions={permissions()}
      onPermissionChange={(key, value) =>
        setPermissions((current) => ({ ...current, [key]: value }))
      }
      modelOptions={modelOptions()}
      repositoryOptions={[]}
      providers={[]}
      onProviderKeyChange={() => undefined}
      networkOptions={[
        { value: 'allowlist', label: 'Allowlist only' },
        { value: 'all', label: 'All destinations' },
        { value: 'none', label: 'No network' },
      ]}
      pullRequestOptions={[
        { value: 'draft', label: 'As drafts' },
        { value: 'ready', label: 'Ready for review' },
        { value: 'never', label: 'Never' },
      ]}
    />
  );
}

export function IntegrationsRoute(): JSX.Element {
  const account = useAccount();

  return (
    <IntegrationsScreen
      capabilities={account.capabilities()}
      integrations={[
        {
          id: 'github',
          name: 'GitHub',
          description: 'Read repositories and open pull requests',
          icon: 'github',
          connected: false,
          requiresAccount: true,
        },
      ]}
      onConnect={() => undefined}
      onDisconnect={() => undefined}
      apiKeys={[]}
      onCreateKey={() => undefined}
      onRevokeKey={() => undefined}
    />
  );
}

export function SecretsRoute(): JSX.Element {
  const account = useAccount();

  return (
    <SecretsScreen
      capabilities={account.capabilities()}
      secrets={[]}
      onCreate={() => undefined}
      onDelete={() => undefined}
    />
  );
}

export function UsageRoute(): JSX.Element {
  const account = useAccount();
  const navigate = useNavigate();

  return (
    <UsageScreen
      capabilities={account.capabilities()}
      period="this month"
      stats={[]}
      rows={[]}
      onSignIn={() => navigate('/sign-in')}
    />
  );
}

export function ReviewRoute(): JSX.Element {
  const account = useAccount();
  const navigate = useNavigate();

  return (
    <ReviewScreen
      capabilities={account.capabilities()}
      items={[]}
      onOpen={(id) => navigate(`/sessions/${id}`)}
      onSignIn={() => navigate('/sign-in')}
    />
  );
}

export function AutomationsRoute(): JSX.Element {
  const account = useAccount();
  const navigate = useNavigate();

  return (
    <AutomationsScreen
      capabilities={account.capabilities()}
      stats={[]}
      active={[]}
      suggested={[]}
      onToggle={() => undefined}
      onOpen={(id) => navigate(`/automations/${id}`)}
      onCreate={() => navigate('/automations/new')}
      onSignIn={() => navigate('/sign-in')}
    />
  );
}

export function SignInRoute(): JSX.Element {
  const navigate = useNavigate();

  return (
    <SignInScreen
      onContinueWithGitHub={() => navigate('/sign-in/device')}
      onContinueWithGoogle={() => navigate('/sign-in/device')}
      onContinueWithEmail={() => navigate('/sign-in/device')}
      // The anonymous route is the only one that lands somewhere usable today, which is
      // consistent with it being the path that needs no backend at all.
      onContinueWithoutAccount={() => navigate('/')}
    />
  );
}

/**
 * Auth Device Code, driven by the real flow.
 *
 * The state machine lives in `device-flow.ts`; this only binds it to the screen and the
 * router. On approval it goes straight to Home — the account context is corrected by the
 * account-changed event, so the workspace it lands on is already the signed-in one.
 */
export function DeviceCodeRoute(): JSX.Element {
  const account = useAccount();
  const navigate = useNavigate();

  const flow = createDeviceFlow({ host: account.host, onAuthorized: () => navigate('/') });

  onMount(() => void flow.start());

  return (
    <DeviceCodeScreen
      userCode={flow.userCode()}
      verificationUri={flow.verificationUri()}
      status={flow.status()}
      secondsRemaining={flow.secondsRemaining()}
      errorMessage={flow.errorMessage()}
      onOpenBrowser={() => void flow.openBrowser()}
      onCopyCode={() => void flow.copyCode()}
      onCancel={() => {
        void flow.cancel();
        navigate('/sign-in');
      }}
      onRetry={() => void flow.start()}
    />
  );
}

export function ConnectGitHubRoute(): JSX.Element {
  const navigate = useNavigate();

  return (
    <ConnectGitHubScreen
      steps={ONBOARDING_STEPS}
      onConnect={() => undefined}
      onSkip={() => navigate('/sign-in/workspace')}
    />
  );
}

export function WorkspaceSetupRoute(): JSX.Element {
  const navigate = useNavigate();

  return <WorkspaceSetupScreen steps={ONBOARDING_STEPS} onCreate={() => navigate('/')} />;
}

export function SshConnectRoute(): JSX.Element {
  const navigate = useNavigate();

  return <SshConnectScreen onConnect={() => undefined} onCancel={() => navigate('/')} />;
}
