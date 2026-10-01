import * as React from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import { Toast } from "@base-ui/react/toast";
import { Menu } from "@base-ui/react/menu";
import { Toasts } from "./kit/ui";
import { Icon } from "./icons/Icon";
import { SCREENS, useVariant } from "./registry";
import { NavCtx, readHash, type Route } from "./shell/nav";
import { Shell } from "./shell/shell";
import { Gallery } from "./shell/gallery";
import { PreviewGate } from "./preview";
import { I18nProvider, useT } from "./i18n";

export type Theme = "light" | "dark";
export type ThemePref = Theme | "system";

export default function App() {
  const [h, setH] = React.useState(readHash);
  React.useEffect(() => { const f = () => setH(readHash()); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return (
    <I18nProvider>
      <PreviewGate>
        {h.route === "gallery" ? <Gallery /> : (
          <Tooltip.Provider delay={500} closeDelay={0}>
            <Toast.Provider timeout={4000} limit={3}>
              <Shell key={h.shot ? location.hash : "app"} initialRoute={h.route} initialTheme={h.theme} />
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
