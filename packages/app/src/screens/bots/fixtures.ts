// Shape of the Bot page preview fixtures (packages/i18n/locales/<locale>/fixtures/bot.json). Preview only.
import type { MascotConfig } from "../../mascot/Mascot";
export type BotFx = {
  heroTip: string; hello: string; summary: string;
  team: string[];
  feed: [string, string, string, string][];
  approve: { t: string; d: string; to: string };
  routines: [string, string, string, boolean][];
  memory: string[];
};
export type RosterFx = {
  templates: [string, string, string, string[], MascotConfig][];
  chiefDoing: string;
  more: string; moreSub: string;
};
export type SettingsFx = {
  identity: string;
  channels: [string, string, string, boolean][];
  log: [string, string, string][];
  rules: [string, string, string, "allow" | "ask" | "deny"][];
  alwaysRules: [string, string][];
  memory: string[];
  usage: [string, string][];
  spent: number;
};
