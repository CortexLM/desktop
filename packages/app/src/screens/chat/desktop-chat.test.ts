import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { vi } from "vitest";

vi.mock("../../api", () => ({ api: {} }));
vi.mock("../../shell/nav", () => ({ useNav: () => ({ params: new URLSearchParams(), route: "home" }) }));
vi.mock("../../state/live", () => ({ useQuery: () => ({ state: "ready", data: { mode: "local" } }) }));
vi.mock("../../i18n", () => ({ useT: () => (key: string) => key }));
vi.mock("../../preview", () => ({ isPreview: () => false }));
vi.mock("./live-chat", () => ({ Home: () => null }));
vi.mock("./voice", () => ({ Voice: () => null, VOICE_VARIANTS: [] }));
vi.mock("./canvas", () => ({ Canvas: () => null, CANVAS_VARIANTS: [] }));
vi.mock("./research", () => ({ SearchResults: () => null, DeepResearch: () => null, SEARCH_VARIANTS: [], DEEP_VARIANTS: [] }));
vi.mock("./extras", () => ({ ImageGen: () => null, Share: () => null, TempChat: () => null, IMAGE_VARIANTS: [], SHARE_VARIANTS: [], TEMP_VARIANTS: [] }));
vi.mock("./pages", () => ({ History: () => null, Library: () => null }));
vi.mock("../../registry", () => ({ Root: ({ children }: { children: React.ReactNode }) => createElement("div", null, children) }));
import { SCREENS } from "./index";

describe("desktop Chat registration", () => {
  it("keeps conversation and state samples out of discovery", () => {
    expect(SCREENS.map(s => s.id)).not.toContain("chat");
    expect(SCREENS.map(s => s.id)).not.toContain("chat-states");
  });
  it.each(["canvas", "search-results", "deep-research", "image-gen", "share", "temp-chat"])("%s direct route shares the local capability state", id => {
    const screen = SCREENS.find(s => s.id === id)!;
    const html = renderToStaticMarkup(screen.render());
    expect(html).toContain('data-testid="chat-capability-empty"');
    expect(html).toContain("<button");
  });
});
