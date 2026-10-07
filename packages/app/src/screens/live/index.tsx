import type { ScreenDef } from "../../registry";
import { CodeHome, CodeSession } from "../code/code";
import { LoginScreen } from "../system/account";
import { BotChannel, BotCompanion, BotComputer, BotCreate, BotInvite, BotInvites, BotShare } from "./bot";
import { CodeAutomation, CodeAutomations, CodeConnect } from "./code";
import { ConnectionScreen, RemoteChatScreen, ModelPicker, Models, ProviderDetail, Providers, ToolApproval } from "./platform";
import { McpAdd, PluginDetail, Plugins, Scheduled, ScheduledEdit, ScheduledHistory, Skills, Space, SpacePage } from "./productivity";
import "../code/lot-code.css";

const C = { mode: "Cortex" as const, group: "live.group" };
const K = { mode: "Cortex Code" as const, group: "live.group" };
// bot-room has no trunk route (integration/backend openapi): recorded missing-backend, not registered.
export const SCREENS: ScreenDef[] = [
  { ...C, id: "bot-channel", name: "live.screen.bot-channel", render: () => <BotChannel /> },
  { ...C, id: "bot-companion", name: "live.screen.bot-companion", render: () => <BotCompanion /> },
  { ...C, id: "bot-invites", name: "live.screen.bot-invites", render: () => <BotInvites /> },
  { ...C, id: "bot-invite", name: "live.screen.bot-invite", render: () => <BotInvite /> },
  { ...C, id: "bot-share", name: "live.screen.bot-share", render: () => <BotShare /> },
  { ...C, id: "bot-computer", name: "live.screen.bot-computer", render: () => <BotComputer /> },
  { ...C, id: "g4-bot-create", name: "live.screen.g4-bot-create", render: () => <BotCreate first={false} /> },
  { ...C, id: "g4-bot-first-run", name: "live.screen.g4-bot-first-run", render: () => <BotCreate first /> },
  { ...K, id: "code-automations", name: "live.screen.code-automations", render: () => <CodeAutomations /> },
  { ...K, id: "code-automation", name: "live.screen.code-automation", render: () => <CodeAutomation /> },
  { ...K, id: "code-connect", name: "live.screen.code-connect", render: () => <CodeConnect /> },
  { ...K, id: "g4-code-home", name: "live.screen.g4-code-home", render: () => <CodeHome /> },
  { ...K, id: "g4-code-session", name: "live.screen.g4-code-session", render: () => <CodeSession /> },
  { ...C, id: "connection", name: "live.screen.connection", render: () => <ConnectionScreen /> },
  { ...C, id: "providers", name: "live.screen.providers", render: () => <Providers /> },
  { ...C, id: "provider-detail", name: "live.screen.provider-detail", render: () => <ProviderDetail /> },
  { ...C, id: "models", name: "live.screen.models", render: () => <Models /> },
  { ...C, id: "model-picker", name: "live.screen.model-picker", render: () => <ModelPicker /> },
  { ...C, id: "remote-login", name: "live.screen.remote-login", render: () => <LoginScreen /> },
  { ...C, id: "remote-chat", name: "live.screen.remote-chat", render: () => <RemoteChatScreen /> },
  { ...C, id: "tool-approval", name: "live.screen.tool-approval", render: () => <ToolApproval /> },
  { ...C, id: "space", name: "live.screen.space", render: () => <Space /> },
  { ...C, id: "space-page", name: "live.screen.space-page", render: () => <SpacePage /> },
  { ...C, id: "scheduled", name: "live.screen.scheduled", render: () => <Scheduled /> },
  { ...C, id: "scheduled-edit", name: "live.screen.scheduled-edit", render: () => <ScheduledEdit /> },
  { ...C, id: "scheduled-history", name: "live.screen.scheduled-history", render: () => <ScheduledHistory /> },
  { ...C, id: "plugins", name: "live.screen.plugins", render: () => <Plugins /> },
  { ...C, id: "plugin-detail", name: "live.screen.plugin-detail", render: () => <PluginDetail /> },
  { ...C, id: "skills", name: "live.screen.skills", render: () => <Skills /> },
  { ...C, id: "mcp-add", name: "live.screen.mcp-add", render: () => <McpAdd /> },
];
