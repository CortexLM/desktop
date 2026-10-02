import type { ScreenDef } from "../../registry";
import { WorkHome, WorkTask } from "./home";
import { Automations, AutomationEdit } from "./routines";
import { Inbox, Approvals, Activity, Notifications, Connectors } from "./desk";

const G = "work.group";
export const SCREENS: ScreenDef[] = [
  { id: "work-home", name: "work.screen.work-home", mode: "Cortex", group: G, variants: [["board", "work.variant.board", "tableau"], ["list", "work.variant.list", "liste"], ["empty", "work.variant.empty", "vide"], ["loading", "work.variant.loading", "chargement"]], render: () => <WorkHome /> },
  { id: "work-task", name: "work.screen.work-task", mode: "Cortex", group: G, variants: [["running", "work.variant.running", "encours"], ["computer", "work.variant.computer", "apercu"], ["takeover", "work.variant.takeover", "main"], ["approval", "work.variant.approval", "validation"], ["blocked", "work.variant.blocked", "bloque"], ["done", "work.variant.done", "termine"], ["failed", "work.variant.failed", "echec"], ["paused", "work.variant.paused", "pause"]], render: () => <WorkTask /> },
  { id: "automations", name: "work.screen.automations", mode: "Cortex", group: G, variants: [["list", "work.variant.list", "liste"], ["empty", "work.variant.empty", "vide"], ["failed", "work.variant.routineFailed", "echec"]], render: () => <Automations /> },
  { id: "automation-edit", name: "work.screen.automation-edit", mode: "Cortex", group: G, variants: [["schedule", "work.variant.schedule", "horaire"], ["event", "work.variant.event", "evenement"], ["test", "work.variant.test", "test"], ["passed", "work.variant.passed", "reussi"]], render: () => <AutomationEdit /> },
  { id: "inbox", name: "work.screen.inbox", mode: "Cortex", group: G, variants: [["normal", "work.variant.normal", "normal"], ["empty", "work.variant.allHandled", "vide"]], render: () => <Inbox /> },
  { id: "approvals", name: "work.screen.approvals", mode: "Cortex", group: G, variants: [["list", "work.variant.list", "liste"], ["detail", "work.variant.detail", "detail"], ["approved", "work.variant.approved", "approuve"], ["denied", "work.variant.denied", "refuse"]], render: () => <Approvals /> },
  { id: "activity", name: "work.screen.activity", mode: "Cortex", group: G, variants: [["timeline", "work.variant.timeline", "chronologie"], ["filtered", "work.variant.filtered", "filtree"], ["loading", "work.variant.loading", "chargement"]], render: () => <Activity /> },
  { id: "notifications", name: "work.screen.notifications", mode: "Cortex", group: G, variants: [["unread", "work.variant.unread", "nonlues"], ["allread", "work.variant.allread", "toutlu"], ["settings", "work.variant.settings", "reglages"]], render: () => <Notifications /> },
  { id: "connectors", name: "work.screen.connectors", mode: "Cortex", group: G, variants: [["grid", "work.variant.grid", "grille"], ["connecting", "work.variant.connecting", "connexion"], ["permissions", "work.variant.permissions", "permissions"], ["error", "work.variant.error", "erreur"]], render: () => <Connectors /> },
];
