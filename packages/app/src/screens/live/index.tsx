import { Root, type ScreenDef } from "../../registry";
import { CodeHome, CodeSession } from "../code/code";
import { LoginScreen } from "../system/account";
import { BotChannel, BotRoom, BotCompanion, BotComputer, BotCreate, BotInvite, BotInvites, BotShare } from "./bot";
import { CodeAutomation, CodeAutomations, CodeConnect } from "./code";
import { ConnectionScreen, RemoteChatScreen, ModelPicker, Models, ProviderDetail, Providers, ToolApproval } from "./platform";
import { McpAdd, PluginDetail, Plugins, Scheduled, ScheduledEdit, ScheduledHistory, Skills, Space, SpacePage } from "./productivity";
import "../code/lot-code.css";

const C = { mode: "Cortex" as const, group: "live.group" };
const K = { mode: "Cortex Code" as const, group: "live.group" };
// bot-room has no trunk route (integration/backend openapi): it shows the honest unavailable state, never a fake room.
export const SCREENS: ScreenDef[] = [
  { ...C, id: "bot-channel", name: "live.screen.bot-channel", render: () => <Root id="bot-channel"><BotChannel /></Root> },
  { ...C, id: "bot-room", name: "live.screen.bot-room", render: () => <Root id="bot-room"><BotRoom /></Root> },
  { ...C, id: "bot-companion", name: "live.screen.bot-companion", render: () => <Root id="bot-companion"><BotCompanion /></Root> },
  { ...C, id: "bot-invites", name: "live.screen.bot-invites", render: () => <Root id="bot-invites"><BotInvites /></Root> },
  { ...C, id: "bot-invite", name: "live.screen.bot-invite", render: () => <Root id="bot-invite"><BotInvite /></Root> },
  { ...C, id: "bot-share", name: "live.screen.bot-share", render: () => <Root id="bot-share"><BotShare /></Root> },
  { ...C, id: "bot-computer", name: "live.screen.bot-computer", render: () => <Root id="bot-computer"><BotComputer /></Root> },
  { ...C, id: "g4-bot-create", name: "live.screen.g4-bot-create", render: () => <Root id="g4-bot-create"><BotCreate first={false} /></Root> },
  { ...C, id: "g4-bot-first-run", name: "live.screen.g4-bot-first-run", render: () => <Root id="g4-bot-first-run"><BotCreate first /></Root> },
  { ...K, id: "code-automations", name: "live.screen.code-automations", render: () => <Root id="code-automations"><CodeAutomations /></Root> },
  { ...K, id: "code-automation", name: "live.screen.code-automation", render: () => <Root id="code-automation"><CodeAutomation /></Root> },
  { ...K, id: "code-connect", name: "live.screen.code-connect", render: () => <Root id="code-connect"><CodeConnect /></Root> },
  { ...K, id: "g4-code-home", name: "live.screen.g4-code-home", render: () => <Root id="g4-code-home"><CodeHome /></Root> },
  { ...K, id: "g4-code-session", name: "live.screen.g4-code-session", render: () => <Root id="g4-code-session"><CodeSession /></Root> },
  { ...C, id: "connection", name: "live.screen.connection", render: () => <Root id="connection"><ConnectionScreen /></Root> },
  { ...C, id: "providers", name: "live.screen.providers", render: () => <Root id="providers"><Providers /></Root> },
  { ...C, id: "provider-detail", name: "live.screen.provider-detail", render: () => <Root id="provider-detail"><ProviderDetail /></Root> },
  { ...C, id: "models", name: "live.screen.models", render: () => <Root id="models"><Models /></Root> },
  { ...C, id: "model-picker", name: "live.screen.model-picker", render: () => <Root id="model-picker"><ModelPicker /></Root> },
  { ...C, id: "remote-login", name: "live.screen.remote-login", render: () => <Root id="remote-login"><LoginScreen /></Root> },
  { ...C, id: "remote-chat", name: "live.screen.remote-chat", render: () => <Root id="remote-chat"><RemoteChatScreen /></Root> },
  { ...C, id: "tool-approval", name: "live.screen.tool-approval", render: () => <Root id="tool-approval"><ToolApproval /></Root> },
  { ...C, id: "space", name: "live.screen.space", render: () => <Root id="space"><Space /></Root> },
  { ...C, id: "space-page", name: "live.screen.space-page", render: () => <Root id="space-page"><SpacePage /></Root> },
  { ...C, id: "scheduled", name: "live.screen.scheduled", render: () => <Root id="scheduled"><Scheduled /></Root> },
  { ...C, id: "scheduled-edit", name: "live.screen.scheduled-edit", render: () => <Root id="scheduled-edit"><ScheduledEdit /></Root> },
  { ...C, id: "scheduled-history", name: "live.screen.scheduled-history", render: () => <Root id="scheduled-history"><ScheduledHistory /></Root> },
  { ...C, id: "plugins", name: "live.screen.plugins", render: () => <Root id="plugins"><Plugins /></Root> },
  { ...C, id: "plugin-detail", name: "live.screen.plugin-detail", render: () => <Root id="plugin-detail"><PluginDetail /></Root> },
  { ...C, id: "skills", name: "live.screen.skills", render: () => <Root id="skills"><Skills /></Root> },
  { ...C, id: "mcp-add", name: "live.screen.mcp-add", render: () => <Root id="mcp-add"><McpAdd /></Root> },
];
