import type { ScreenDef } from "../../registry";
import { WorkBotConnection } from "../work/remote-work-bot";
import { BotOnboarding, BotPage, BotStudio } from "./bot";
import { BotRoster, BotSettings } from "./team";
import "../work/work.css";

const G = "bots.group";
export const SCREENS: ScreenDef[] = [
  { id: "bot-new", name: "bots.screen.bot-new", mode: "Cortex", group: G, render: () => <WorkBotConnection local={<BotOnboarding />} /> },
  { id: "bot", name: "bots.screen.bot", mode: "Cortex", group: G, render: () => <WorkBotConnection local={<BotPage />} /> },
  { id: "bot-studio", name: "bots.screen.bot-studio", mode: "Cortex", group: G, render: () => <WorkBotConnection local={<BotStudio />} /> },
  { id: "bot-roster", name: "bots.screen.bot-roster", mode: "Cortex", group: G, variants: [["team", "bots.variant.team", "equipe"], ["hierarchy", "bots.variant.hierarchy", "hierarchie"], ["templates", "bots.variant.templates", "modeles"], ["limit", "bots.variant.limit", "limite"]], render: () => <WorkBotConnection local={<BotRoster />} /> },
  { id: "bot-settings", name: "bots.screen.bot-settings", mode: "Cortex", group: G, variants: [["general", "bots.variant.general", "general"], ["permissions", "bots.variant.permissions", "autorisations"], ["memory", "bots.variant.memory", "memoire"], ["usage", "bots.variant.usage", "usage"]], render: () => <WorkBotConnection local={<BotSettings />} /> },
];
