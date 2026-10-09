import type { ReactNode } from "react";
import { Root, type ScreenDef } from "../../registry";
import { Home } from "./live-chat";
import { Voice, VOICE_VARIANTS } from "./voice";
import { Canvas, CANVAS_VARIANTS } from "./canvas";
import { SearchResults, DeepResearch, SEARCH_VARIANTS, DEEP_VARIANTS } from "./research";
import { ImageGen, Share, TempChat, IMAGE_VARIANTS, SHARE_VARIANTS, TEMP_VARIANTS } from "./extras";
import { History, Library } from "./pages";
import { useT } from "../../i18n";
import { useNav } from "../../shell/nav";
import { isPreview } from "../../preview";
import { useQuery } from "../../state/live";
import { api } from "../../api";

/** Local Chat has no remote feature transport. Direct links explain the missing capability. */
function CapabilityRoute({ feature, children }: { feature: string; children: ReactNode }) {
  const t = useT();
  const { go } = useNav();
  const connection = useQuery(() => api.connection.get(), []);
  if (isPreview()) return children;
  if (connection.state === "loading") return <div role="status">{t("chat.live.loading")}</div>;
  if (connection.state === "error") return <div className="chat-err" role="alert"><span>{t("chat.err.network.body")}</span><button className="btn secondary" onClick={connection.reload}>{t("common.retry")}</button></div>;
  if (connection.data.mode !== "local") return children;
  return <Root id={feature}><div className="empty" data-testid="chat-capability-empty">
    <h2>{t(`chat.screen.${feature}`)}</h2><p>{t("chat.unavailable.body")}</p>
    <button className="btn primary" onClick={() => go("providers")}>{t("composer.addProvider")}</button>
  </div></Root>;
}

const G = "chat.group";
export const SCREENS: ScreenDef[] = [
  { id: "home", name: "chat.screen.home", mode: "Cortex", group: G, render: () => <Root id="home"><Home /></Root> },
  { id: "voice", name: "chat.screen.voice", mode: "Cortex", group: G, variants: VOICE_VARIANTS, render: () => <Voice /> },
  { id: "canvas", name: "chat.screen.canvas", mode: "Cortex", group: G, variants: CANVAS_VARIANTS, render: () => <CapabilityRoute feature="canvas"><Canvas /></CapabilityRoute> },
  { id: "search-results", name: "chat.screen.search-results", mode: "Cortex", group: G, variants: SEARCH_VARIANTS, render: () => <CapabilityRoute feature="search-results"><SearchResults /></CapabilityRoute> },
  { id: "deep-research", name: "chat.screen.deep-research", mode: "Cortex", group: G, variants: DEEP_VARIANTS, render: () => <CapabilityRoute feature="deep-research"><DeepResearch /></CapabilityRoute> },
  { id: "image-gen", name: "chat.screen.image-gen", mode: "Cortex", group: G, variants: IMAGE_VARIANTS, render: () => <CapabilityRoute feature="image-gen"><ImageGen /></CapabilityRoute> },
  { id: "share", name: "chat.screen.share", mode: "Cortex", group: G, variants: SHARE_VARIANTS, render: () => <CapabilityRoute feature="share"><Share /></CapabilityRoute> },
  { id: "temp-chat", name: "chat.screen.temp-chat", mode: "Cortex", group: G, variants: TEMP_VARIANTS, render: () => <CapabilityRoute feature="temp-chat"><TempChat /></CapabilityRoute> },
  { id: "history", name: "chat.screen.history", mode: "Cortex", group: G, render: () => <Root id="history"><History /></Root> },
  { id: "library", name: "chat.screen.library", mode: "Cortex", group: G, render: () => <Root id="library"><Library /></Root> },
];
