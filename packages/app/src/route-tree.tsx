import type { JSX } from 'solid-js';
import { Navigate, Route } from '@solidjs/router';

import {
  AutomationsRoute,
  ChatHomeRoute,
  ConversationRoute,
  NewAutomationRoute,
  ConnectGitHubRoute,
  DeviceCodeRoute,
  HomeRoute,
  IntegrationsRoute,
  NotificationsRoute,
  ReviewRoute,
  SecretsRoute,
  SessionDetailRoute,
  SessionsRoute,
  SettingsRoute,
  SignInRoute,
  SshConnectRoute,
  UsageRoute,
  WorkspaceSetupRoute,
} from './route-components.tsx';
import {
  ChatSettingsRoute,
  LibraryRoute,
  PlanningRoute,
  PluginsRoute,
  ProjectRoute,
  ProjectSourcesRoute,
  ProjectsRoute,
  ResearchRoute,
} from './routes/chat-product-routes.tsx';
import {
  BotComputerRoute,
  BotConversationRoute,
  BotCreateRoute,
  BotGroupsRoute,
  BotHomeRoute,
  BotMemoryRoute,
  BotMessagesRoute,
  BotRoutinesRoute,
  BotSettingsRoute,
  BotSkillsRoute,
  BotVideosRoute,
} from './routes/bot-routes.tsx';

/** The route tree, shared by HashRouter and MemoryRouter. */
export function appRoutes(): JSX.Element {
  return (
    <>
      <Route path="/" component={ChatHomeRoute} />
      <Route path="/chat/:conversationId" component={ConversationRoute} />
      <Route path="/research" component={ResearchRoute} />
      <Route path="/planning" component={PlanningRoute} />
      <Route path="/projects" component={ProjectsRoute} />
      <Route path="/projects/:projectId" component={ProjectRoute} />
      <Route path="/projects/:projectId/sources" component={ProjectSourcesRoute} />
      <Route path="/library" component={LibraryRoute} />
      <Route path="/plugins" component={PluginsRoute} />
      <Route path="/settings" component={ChatSettingsRoute} />

      <Route path="/code" component={HomeRoute} />
      <Route path="/code/sessions" component={SessionsRoute} />
      <Route path="/code/sessions/:sessionId" component={SessionDetailRoute} />
      <Route path="/code/sessions/:sessionId/focus" component={SessionDetailRoute} />
      <Route path="/code/automations" component={AutomationsRoute} />
      <Route path="/code/automations/new" component={NewAutomationRoute} />
      <Route path="/code/review" component={ReviewRoute} />
      <Route path="/code/usage" component={UsageRoute} />
      <Route path="/code/settings" component={SettingsRoute} />
      <Route path="/code/settings/integrations" component={IntegrationsRoute} />
      <Route path="/code/secrets" component={SecretsRoute} />
      <Route path="/code/notifications" component={NotificationsRoute} />
      <Route path="/code/runtimes/ssh" component={SshConnectRoute} />

      <Route path="/bot" component={BotHomeRoute} />
      <Route path="/bot/new" component={BotCreateRoute} />
      <Route path="/bot/:mascotId" component={BotConversationRoute} />
      <Route path="/bot/:mascotId/messages" component={BotMessagesRoute} />
      <Route path="/bot/:mascotId/videos" component={BotVideosRoute} />
      <Route path="/bot/:mascotId/computer" component={BotComputerRoute} />
      <Route path="/bot/:mascotId/memory" component={BotMemoryRoute} />
      <Route path="/bot/:mascotId/skills" component={BotSkillsRoute} />
      <Route path="/bot/:mascotId/routines" component={BotRoutinesRoute} />
      <Route path="/bot/:mascotId/groups" component={BotGroupsRoute} />
      <Route path="/bot/:mascotId/settings" component={BotSettingsRoute} />

      <Route path="/sign-in" component={SignInRoute} />
      <Route path="/sign-in/device" component={DeviceCodeRoute} />
      <Route path="/sign-in/github" component={ConnectGitHubRoute} />
      <Route path="/sign-in/workspace" component={WorkspaceSetupRoute} />
      <Route path="/onboarding" component={ConnectGitHubRoute} />
      <Route path="*" component={() => <Navigate href="/" />} />
    </>
  );
}
