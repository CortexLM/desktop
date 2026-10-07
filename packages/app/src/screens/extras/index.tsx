import type { ScreenDef } from "../../registry";
import { Widgets, Browser, Planning, PlanDetail, Organisation, Approvals, WhatsNew } from "./extras";

const G = "extras.group";
// Design lot-workspace-extras.tsx. Live screens only: no preview fixtures, so the gallery shows the signed-out state.
export const SCREENS: ScreenDef[] = [
  { id: "library-dashboard", name: "extras.screen.widgets", mode: "Cortex", group: G, render: () => <Widgets /> },
  { id: "browser-authorization", name: "extras.screen.browser", mode: "Cortex", group: G, render: () => <Browser /> },
  { id: "planning", name: "extras.screen.planning", mode: "Cortex", group: G, render: () => <Planning /> },
  { id: "planning-detail", name: "extras.screen.plan", mode: "Cortex", group: G, render: () => <PlanDetail /> },
  { id: "settings-organisation", name: "extras.screen.organisation", mode: "Cortex", group: G, render: () => <Organisation /> },
  { id: "settings-approvals", name: "extras.screen.approvals", mode: "Cortex", group: G, render: () => <Approvals /> },
  { id: "whats-new", name: "extras.screen.whatsNew", mode: "Cortex", group: G, render: () => <WhatsNew /> },
];
