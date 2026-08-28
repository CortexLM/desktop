/**
 * Chat destinations that are not Home / Conversation: Planning, projects,
 * library, plugins, research, settings.
 */

import { createMemo, createSignal, type JSX } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';

import { useAccount } from '../state/session-context.tsx';
import { scheduledTasks, setTaskStatus, markTaskRan } from '../state/planning.ts';
import { addProjectSource, chatProjects, createProject, projectById } from '../state/projects.ts';
import { libraryItems } from '../state/library.ts';
import { installPlugin, installedPlugins } from '../state/plugins.ts';
import { postInbox } from '../state/inbox.ts';
import { showOsNotification } from '../state/os-notify.ts';
import { PlanningScreen } from '../screens/chat/planning-screen.tsx';
import { ProjectsScreen } from '../screens/chat/projects-screen.tsx';
import { ProjectScreen, ProjectSourcesScreen } from '../screens/chat/project-detail-screens.tsx';
import { LibraryScreen, PluginsScreen } from '../screens/chat/library-plugins-screens.tsx';
import { ChatSettingsScreen, ResearchScreen } from '../screens/chat/research-settings-screens.tsx';
import { readJson, writeJson } from '../state/persist.ts';

export function PlanningRoute(): JSX.Element {
  const account = useAccount();
  const navigate = useNavigate();

  const run = (id: string) => {
    const task = scheduledTasks().find((entry) => entry.id === id);
    if (!task) return;
    if (task.requiresAccount && !account.capabilities().authenticated) {
      navigate('/sign-in');
      return;
    }
    markTaskRan(id);
    const item = postInbox({
      kind: 'scheduled-task',
      message: `${task.title} finished`,
      href: '/planning',
    });
    void showOsNotification({ title: 'Planning', body: item.message, kind: 'scheduled-task' });
  };

  return (
    <PlanningScreen
      tasks={scheduledTasks()}
      signedIn={account.capabilities().authenticated}
      onToggle={(id) => {
        const task = scheduledTasks().find((entry) => entry.id === id);
        if (task) setTaskStatus(id, task.status === 'active' ? 'paused' : 'active');
      }}
      onRun={run}
      onSignIn={() => navigate('/sign-in')}
    />
  );
}

export function ProjectsRoute(): JSX.Element {
  const navigate = useNavigate();
  return (
    <ProjectsScreen
      projects={chatProjects()}
      onOpen={(id) => navigate(`/projects/${id}`)}
      onCreate={() => navigate(`/projects/${createProject('Untitled project').id}`)}
    />
  );
}

export function ProjectRoute(): JSX.Element {
  const params = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const project = createMemo(() => projectById(params.projectId));
  return (
    <ProjectScreen
      project={project()}
      onOpenSources={() => navigate(`/projects/${params.projectId}/sources`)}
      onBack={() => navigate('/projects')}
    />
  );
}

export function ProjectSourcesRoute(): JSX.Element {
  const params = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const project = createMemo(() => projectById(params.projectId));
  return (
    <ProjectSourcesScreen
      project={project()}
      onAdd={() => addProjectSource(params.projectId, { label: 'Untitled source', kind: 'url' })}
      onBack={() => navigate(`/projects/${params.projectId}`)}
    />
  );
}

export function LibraryRoute(): JSX.Element {
  const account = useAccount();
  const navigate = useNavigate();
  return (
    <LibraryScreen
      items={libraryItems()}
      signedIn={account.capabilities().authenticated}
      onSignIn={() => navigate('/sign-in')}
    />
  );
}

export function PluginsRoute(): JSX.Element {
  return <PluginsScreen installed={installedPlugins()} onInstall={installPlugin} />;
}

export function ResearchRoute(): JSX.Element {
  const account = useAccount();
  const navigate = useNavigate();
  return (
    <ResearchScreen
      signedIn={account.capabilities().authenticated}
      onSignIn={() => navigate('/sign-in')}
    />
  );
}

export function ChatSettingsRoute(): JSX.Element {
  const [stream, setStream] = createSignal(readJson('cortex.chat.stream', true));
  const [mentions, setMentions] = createSignal(readJson('cortex.chat.mentions', true));
  return (
    <ChatSettingsScreen
      streamReplies={stream()}
      onStreamReplies={(value) => {
        setStream(value);
        writeJson('cortex.chat.stream', value);
      }}
      notifyMentions={mentions()}
      onNotifyMentions={(value) => {
        setMentions(value);
        writeJson('cortex.chat.mentions', value);
      }}
    />
  );
}
