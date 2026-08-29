/**
 * Chat destinations that are not Home / Conversation: Planning, projects,
 * library, plugins, research, settings.
 *
 * Every one of these reads from the account. They used to read `localStorage`,
 * which is why each route now has a load effect and passes a lifecycle state
 * through to its screen rather than an array that was always present.
 */

import { createEffect, createSignal, untrack, type JSX } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';

import { useAccount } from '../state/session-context.tsx';
import {
  addPlanningTask,
  availableTemplates,
  loadPlanning,
  planningError,
  planningState,
  runTaskNow,
  scheduledTasks,
  setTaskStatus,
  type PlanningTemplate,
} from '../state/planning.ts';
import {
  addProjectSource,
  chatProjects,
  createProject,
  loadProject,
  loadProjects,
  openProject,
  projectError,
  projectsError,
  projectsState,
  projectState,
  removeProjectSource,
  renameProject,
} from '../state/projects.ts';
import {
  libraryError,
  libraryItems,
  libraryState,
  loadLibrary,
  removeLibraryItem,
} from '../state/library.ts';
import {
  loadResearch,
  researchError,
  researchRuns,
  researchState,
  startResearch,
} from '../state/research.ts';
import {
  chatPreferences,
  loadChatPreferences,
  preferencesEditable,
  preferencesError,
  saveChatPreference,
} from '../state/chat-preferences.ts';
import {
  assignPluginSurfaces,
  classifyPluginWrite,
  installPlugin,
  isPluginConnected,
  pluginApps,
  pluginError,
  pluginState,
  reconcilePlugins,
  removePlugin,
  type PluginWriteFailure,
} from '../state/plugins.ts';
import type { PluginSurface } from '../state/plugin-surfaces.ts';
import { rememberPluginConnect, takePendingPluginConnect } from '../state/pending-connect.ts';
import { postInbox } from '../state/inbox.ts';
import { showOsNotification } from '../state/os-notify.ts';
import { PlanningScreen } from '../screens/chat/planning-screen.tsx';
import { ProjectsScreen } from '../screens/chat/projects-screen.tsx';
import { ProjectScreen, ProjectSourcesScreen } from '../screens/chat/project-detail-screens.tsx';
import { LibraryScreen } from '../screens/chat/library-screen.tsx';
import { PluginsScreen } from '../screens/chat/plugins-screen.tsx';
import { ChatSettingsScreen, ResearchScreen } from '../screens/chat/research-settings-screens.tsx';

export function PlanningRoute(): JSX.Element {
  const account = useAccount();
  const navigate = useNavigate();

  createEffect(() => {
    void loadPlanning();
  });

  /**
   * Asks Cortex to run a job now and follows the result.
   *
   * The notification is posted from what the service returned, not composed
   * locally: the previous version bumped a local timestamp and posted "finished"
   * for work that had never been requested of anything.
   */
  const run = async (id: string) => {
    const task = scheduledTasks().find((entry) => entry.id === id);
    if (!task) return;
    if (task.requiresAccount && !account.capabilities().authenticated) {
      navigate('/sign-in');
      return;
    }

    try {
      const result = await runTaskNow(id);
      const item = postInbox({
        kind: 'scheduled-task',
        message: `${task.title} finished`,
        href: result.conversationId ? `/chat/${result.conversationId}` : '/planning',
      });
      void showOsNotification({ title: 'Planning', body: item.message, kind: 'scheduled-task' });
    } catch (error) {
      postInbox({
        kind: 'scheduled-task',
        message: `${task.title} could not run: ${error instanceof Error ? error.message : String(error)}`,
        href: '/planning',
      });
    }
  };

  return (
    <PlanningScreen
      tasks={scheduledTasks()}
      state={planningState()}
      error={planningError()}
      signedIn={account.capabilities().authenticated}
      templates={availableTemplates()}
      onToggle={(id) => {
        const task = scheduledTasks().find((entry) => entry.id === id);
        if (task) void setTaskStatus(id, task.status === 'active' ? 'paused' : 'active');
      }}
      onRun={(id) => void run(id)}
      onAdd={(template: PlanningTemplate) => void addPlanningTask(template)}
      onRetry={() => void loadPlanning()}
      onSignIn={() => navigate('/sign-in')}
    />
  );
}

export function ProjectsRoute(): JSX.Element {
  const navigate = useNavigate();

  createEffect(() => {
    void loadProjects();
  });

  return (
    <ProjectsScreen
      projects={chatProjects()}
      state={projectsState()}
      error={projectsError()}
      onOpen={(id) => navigate(`/projects/${id}`)}
      onCreate={() => {
        void createProject('Untitled project').then((id) => {
          if (id) navigate(`/projects/${id}`);
        });
      }}
      onRetry={() => void loadProjects()}
    />
  );
}

export function ProjectRoute(): JSX.Element {
  const params = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  createEffect(() => {
    void loadProject(params.projectId);
  });

  return (
    <ProjectScreen
      project={openProject()}
      state={projectState()}
      error={projectError()}
      onOpenSources={() => navigate(`/projects/${params.projectId}/sources`)}
      onSaveBrief={(brief) => {
        const project = openProject();
        if (project) void renameProject(project.id, project.title, brief);
      }}
      onBack={() => navigate('/projects')}
    />
  );
}

export function ProjectSourcesRoute(): JSX.Element {
  const params = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  createEffect(() => {
    void loadProject(params.projectId);
  });

  return (
    <ProjectSourcesScreen
      project={openProject()}
      state={projectState()}
      error={projectError()}
      onAdd={(source) => void addProjectSource(params.projectId, source)}
      onRemove={(sourceId) => void removeProjectSource(params.projectId, sourceId)}
      onBack={() => navigate(`/projects/${params.projectId}`)}
    />
  );
}

export function LibraryRoute(): JSX.Element {
  const account = useAccount();
  const navigate = useNavigate();

  createEffect(() => {
    if (account.capabilities().authenticated) void loadLibrary();
  });

  return (
    <LibraryScreen
      items={libraryItems()}
      state={libraryState()}
      error={libraryError()}
      signedIn={account.capabilities().authenticated}
      onRemove={(id) => void removeLibraryItem(id)}
      onRetry={() => void loadLibrary()}
      onSignIn={() => navigate('/sign-in')}
    />
  );
}

/**
 * Connect and re-assign, and the sign-in detour the first of them may take.
 *
 * `POST /v1/plugins/{slug}/connect` refuses a guest — a guest session cannot be
 * signed back into, so the connection could never be revoked later — and that
 * refusal is not something to show: an account is what the user needs, not the
 * reason they need one. So Connect on a guest opens the sign-in screen, keeps
 * the slug and the Chat / Bot choice, and finishes the job once the account
 * arrives.
 *
 * Failures become a `PluginWriteFailure` rather than a message: the screen owns
 * the wording, so nothing the service wrote is rendered (`.rules/02-errors.md`).
 */
function createPluginWrites(signedIn: () => boolean, navigate: (path: string) => void) {
  const [writeError, setWriteError] = createSignal<PluginWriteFailure | undefined>();

  const signInThenConnect = (slug: string, surfaces: readonly PluginSurface[]) => {
    setWriteError(undefined);
    rememberPluginConnect(slug, surfaces, '/plugins');
    navigate('/sign-in');
  };

  const connect = async (slug: string, surfaces: readonly PluginSurface[]): Promise<void> => {
    if (!signedIn()) {
      signInThenConnect(slug, surfaces);
      return;
    }
    setWriteError(undefined);
    try {
      // The service can still refuse a session this side believes in.
      if ((await installPlugin(slug, surfaces)) === 'needs-account') {
        signInThenConnect(slug, surfaces);
      }
    } catch (error) {
      setWriteError(classifyPluginWrite(error, 'connect'));
    }
  };

  const assign = async (slug: string, surfaces: readonly PluginSurface[]): Promise<void> => {
    setWriteError(undefined);
    try {
      await assignPluginSurfaces(slug, surfaces);
    } catch (error) {
      setWriteError(classifyPluginWrite(error, 'assign'));
    }
  };

  return { connect, assign, writeError };
}

/** Plugins: the marketplace catalogue, and the account connecting an app needs. */
export function PluginsRoute(): JSX.Element {
  const account = useAccount();
  const navigate = useNavigate();

  // A guest is projected to a null user, so this is already the `is_guest`
  // answer from `/v1/me` rather than a second, weaker notion of signed in.
  const signedIn = () => account.capabilities().authenticated;
  const { connect, assign, writeError } = createPluginWrites(signedIn, navigate);

  createEffect(() => {
    void reconcilePlugins();
  });

  // Resumes the connection that sent the user to sign in. `untrack` so clearing
  // the slug does not re-run the effect that just consumed it.
  createEffect(() => {
    if (!signedIn()) return;
    const resumed = untrack(takePendingPluginConnect);
    if (resumed) void connect(resumed.slug, resumed.surfaces);
  });

  const connected = () => pluginApps().map((app) => app.slug).filter(isPluginConnected);

  return (
    <PluginsScreen
      apps={pluginApps()}
      connected={connected()}
      loading={pluginState() === 'loading'}
      unavailable={pluginState() === 'unavailable'}
      notLive={pluginState() === 'not-live'}
      error={
        pluginState() === 'error' || pluginState() === 'not-live' ? pluginError() : undefined
      }
      signedIn={signedIn()}
      {...(writeError() ? { writeError: writeError()! } : {})}
      onSignIn={() => navigate('/sign-in')}
      onCreateAccount={() => navigate('/sign-in')}
      onConnect={(slug, surfaces) => void connect(slug, surfaces)}
      onSurfaces={(slug, surfaces) => void assign(slug, surfaces)}
      onDisconnect={(slug: string) => void removePlugin(slug)}
    />
  );
}

export function ResearchRoute(): JSX.Element {
  const account = useAccount();
  const navigate = useNavigate();

  createEffect(() => {
    if (account.capabilities().authenticated) void loadResearch();
  });

  return (
    <ResearchScreen
      runs={researchRuns()}
      state={researchState()}
      error={researchError()}
      signedIn={account.capabilities().authenticated}
      onStart={(question) => void startResearch(question)}
      onOpen={(run) => {
        if (run.conversationId) navigate(`/chat/${run.conversationId}`);
      }}
      onRetry={() => void loadResearch()}
      onSignIn={() => navigate('/sign-in')}
    />
  );
}

export function ChatSettingsRoute(): JSX.Element {
  createEffect(() => {
    void loadChatPreferences();
  });

  return (
    <ChatSettingsScreen
      streamReplies={chatPreferences().streamReplies}
      onStreamReplies={(value) => void saveChatPreference({ streamReplies: value }).catch(() => {})}
      notifyMentions={chatPreferences().notifyOnMentions}
      onNotifyMentions={(value) =>
        void saveChatPreference({ notifyOnMentions: value }).catch(() => {})
      }
      editable={preferencesEditable()}
      error={preferencesError()}
    />
  );
}
