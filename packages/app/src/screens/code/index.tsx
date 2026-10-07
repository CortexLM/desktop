import type { ScreenDef } from "../../registry";
import { CodeHome, CodeSession } from "./code";
import { CodeMachines } from "./remote-code";
import { TasksScreen, ReviewScreen, DiffScreen, TerminalScreen, EnvScreen, PrScreen, SettingsScreen } from "./lot-code";

const M = "Cortex Code" as const;
const G = "code.group";
const V = (screen: string, id: string, design: string): [string, string, string] => [id, `code.variant.${screen}.${id}`, design];

export const SCREENS: ScreenDef[] = [
  { id: "code", name: "code.screen.code", mode: M, group: G, render: () => <CodeHome /> },
  { id: "code-session", name: "code.screen.code-session", mode: M, group: G, render: () => <CodeSession /> },
  { id: "code-tasks", name: "code.screen.code-tasks", mode: M, group: G, variants: [V("code-tasks", "list", "liste"), V("code-tasks", "filtered", "filtree"), V("code-tasks", "empty", "vide"), V("code-tasks", "attempts", "tentatives")], render: () => <TasksScreen /> },
  { id: "code-review", name: "code.screen.code-review", mode: M, group: G, variants: [V("code-review", "review", "revue"), V("code-review", "applied", "appliquee"), V("code-review", "approved", "approuvee")], render: () => <ReviewScreen /> },
  { id: "code-diff", name: "code.screen.code-diff", mode: M, group: G, variants: [V("code-diff", "unified", "unifie"), V("code-diff", "split", "cote"), V("code-diff", "comment", "commentaire"), V("code-diff", "conflict", "conflit")], render: () => <DiffScreen /> },
  { id: "code-terminal", name: "code.screen.code-terminal", mode: M, group: G, variants: [V("code-terminal", "running", "encours"), V("code-terminal", "approval", "approbation"), V("code-terminal", "failed", "echec"), V("code-terminal", "done", "termine")], render: () => <TerminalScreen /> },
  { id: "code-env", name: "code.screen.code-env", mode: M, group: G, variants: [V("code-env", "list", "liste"), V("code-env", "edit", "edition"), V("code-env", "booting", "demarrage"), V("code-env", "error", "erreur")], render: () => <EnvScreen /> },
  { id: "code-pr", name: "code.screen.code-pr", mode: M, group: G, variants: [V("code-pr", "draft", "brouillon"), V("code-pr", "checks", "checks"), V("code-pr", "failed", "echec"), V("code-pr", "ready", "prete"), V("code-pr", "merged", "fusionnee")], render: () => <PrScreen /> },
  { id: "code-machines", name: "code.screen.code-machines", mode: M, group: G, render: () => <CodeMachines /> },
  { id: "code-settings", name: "code.screen.code-settings", mode: M, group: G, variants: [V("code-settings", "repos", "depots"), V("code-settings", "instructions", "instructions"), V("code-settings", "approvals", "approbations"), V("code-settings", "usage", "usage")], render: () => <SettingsScreen /> },
];
