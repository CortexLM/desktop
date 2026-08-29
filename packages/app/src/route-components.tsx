/**
 * The route table's components, in one import site.
 *
 * A barrel rather than an implementation. Every route used to live here and the file
 * became a grab bag: the routes that show runs sat next to the ones that edit
 * settings, and it was the only file in the package that kept hitting the line limit.
 * They are grouped by what they talk to now — runs, settings, automations,
 * insights, onboarding flows, auth — and `app.tsx` still imports from one place.
 */

export { ChatHomeRoute, ConversationRoute } from './routes/chat-routes.tsx';
export { HomeRoute, SessionsRoute, SessionDetailRoute } from './routes/run-routes.tsx';
export { SettingsRoute, IntegrationsRoute } from './routes/settings-routes.tsx';
export { NotificationsRoute } from './routes/notification-routes.tsx';
export { AutomationsRoute, NewAutomationRoute } from './routes/automation-routes.tsx';
export { ReviewRoute, UsageRoute } from './routes/insight-routes.tsx';
export {
  ConnectGitHubRoute,
  SshConnectRoute,
  WorkspaceSetupRoute,
} from './routes/flow-routes.tsx';
export { SignInRoute, DeviceCodeRoute } from './routes/auth-routes.tsx';
