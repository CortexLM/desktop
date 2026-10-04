import type { ScreenDef } from "../../registry";
import { Home, Chat } from "./live-chat";
import { ChatStates, CHAT_STATE_VARIANTS } from "./states";
import { Voice, VOICE_VARIANTS } from "./voice";
import { Canvas, CANVAS_VARIANTS } from "./canvas";
import { SearchResults, DeepResearch, SEARCH_VARIANTS, DEEP_VARIANTS } from "./research";
import { ImageGen, Share, TempChat, IMAGE_VARIANTS, SHARE_VARIANTS, TEMP_VARIANTS } from "./extras";
import { History, Library } from "./pages";

const G = "chat.group";
export const SCREENS: ScreenDef[] = [
  { id: "home", name: "chat.screen.home", mode: "Cortex", group: G, render: () => <Home /> },
  { id: "chat", name: "chat.screen.chat", mode: "Cortex", group: G, render: () => <Chat /> },
  { id: "chat-states", name: "chat.screen.chat-states", mode: "Cortex", group: G, variants: CHAT_STATE_VARIANTS, render: () => <ChatStates /> },
  { id: "voice", name: "chat.screen.voice", mode: "Cortex", group: G, variants: VOICE_VARIANTS, render: () => <Voice /> },
  { id: "canvas", name: "chat.screen.canvas", mode: "Cortex", group: G, variants: CANVAS_VARIANTS, render: () => <Canvas /> },
  { id: "search-results", name: "chat.screen.search-results", mode: "Cortex", group: G, variants: SEARCH_VARIANTS, render: () => <SearchResults /> },
  { id: "deep-research", name: "chat.screen.deep-research", mode: "Cortex", group: G, variants: DEEP_VARIANTS, render: () => <DeepResearch /> },
  { id: "image-gen", name: "chat.screen.image-gen", mode: "Cortex", group: G, variants: IMAGE_VARIANTS, render: () => <ImageGen /> },
  { id: "share", name: "chat.screen.share", mode: "Cortex", group: G, variants: SHARE_VARIANTS, render: () => <Share /> },
  { id: "temp-chat", name: "chat.screen.temp-chat", mode: "Cortex", group: G, variants: TEMP_VARIANTS, render: () => <TempChat /> },
  { id: "history", name: "chat.screen.history", mode: "Cortex", group: G, render: () => <History /> },
  { id: "library", name: "chat.screen.library", mode: "Cortex", group: G, render: () => <Library /> },
];
