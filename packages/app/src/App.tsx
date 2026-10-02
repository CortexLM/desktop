import * as React from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import { Toast } from "@base-ui/react/toast";
import { Menu } from "@base-ui/react/menu";
import { Toasts } from "./kit/ui";
import { Icon } from "./icons/Icon";
import { SCREENS, useVariant } from "./registry";
import { NavCtx, go, navigation, readHash, type Route } from "./shell/nav";
import { Shell } from "./shell/shell";
import { Gallery } from "./shell/gallery";
import { PreviewGate } from "./preview";
import { I18nProvider, useT } from "./i18n";

export type Theme = "light" | "dark";
export type ThemePref = Theme | "system";

export default function App() {
  const [h, setH] = React.useState(readHash);
  React.useLayoutEffect(() => {
    const f = (event: Event) => {
      const run = () => setH(readHash());
      // Keep screen transitions; snapshotting the gallery's hundreds of frames blocks input.
      if (h.route !== "gallery" && readHash().route !== "gallery" && (event as Event & { navigationType: string }).navigationType !== "replace" && document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(run); else run();
    };
    navigation.addEventListener("currententrychange", f);
    // Catch navigation between the initial render and subscription.
    const current = readHash();
    setH((previous) => previous.route === current.route && previous.params.toString() === current.params.toString() ? previous : current);
    return () => navigation.removeEventListener("currententrychange", f);
  }, [h.route]);
  React.useEffect(() => window.cortex?.onMenu?.((cmd) => {
    if (cmd === "back") history.back();
    else if (cmd === "forward") history.forward();
    else if (cmd === "new") go(SCREENS.find((s) => s.id === h.route)?.mode === "Cortex Code" ? "code" : "home");
    else if (cmd !== "focus" && cmd !== "sidebar") go(cmd);
  }), [h.route]);
  return (
    <I18nProvider>
      <PreviewGate>
        {h.route === "gallery" ? <Gallery /> : (
          <Tooltip.Provider delay={500} closeDelay={0}>
            <Toast.Provider timeout={4000} limit={3}>
              <Shell hash={h} />
              <Toasts />
            </Toast.Provider>
          </Tooltip.Provider>
        )}
      </PreviewGate>
    </I18nProvider>
  );
}

export { NavCtx, type Route };

/** Floating state picker for the current screen (preview only). */
export function VariantPicker({ variants }: { variants: [string, string, string?][] }) {
  const t = useT();
  const [v, setV] = useVariant(variants[0][0]);
  const cur = variants.find((x) => x[0] === v) ?? variants[0];
  return (
    <Menu.Root>
      <Menu.Trigger className="variant-pick"><Icon name="chevron-up-down" size={16} />{t("shell.statePicker", { state: t(cur[1]) })}</Menu.Trigger>
      <Menu.Portal><Menu.Positioner side="top" align="end" sideOffset={6}><Menu.Popup className="popup" style={{ maxHeight: 420, overflow: "auto", minWidth: 240 }}>
        <Menu.RadioGroup value={cur[0]} onValueChange={(x) => setV(x as string)}>
          {variants.map(([id, l]) => <Menu.RadioItem key={id} value={id} closeOnClick className="mitem"><span style={{ flex: 1 }}>{t(l)}</span><Menu.RadioItemIndicator><Icon name="check" /></Menu.RadioItemIndicator></Menu.RadioItem>)}
        </Menu.RadioGroup>
      </Menu.Popup></Menu.Positioner></Menu.Portal>
    </Menu.Root>
  );
}
export const screenDef = (id: string) => SCREENS.find((s) => s.id === id);
