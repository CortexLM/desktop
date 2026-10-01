// Pill composer: + · field · model ⌄ · mic · send/voice (morphs with text).
// Stable contract used by every screen; the Chat lot owns the model-aware internals.
import * as React from "react";
import { Menu } from "@base-ui/react/menu";
import { Icon } from "../icons/Icon";
import { IconBtn, Tip, Pop, MItem } from "../kit/ui";
import { useT } from "../i18n";

export type ComposerAttachment = { name: string; mime: string; dataUrl: string };
export type ComposerProps = {
  placeholder?: string;
  onSend?: (text: string, attachments: ComposerAttachment[]) => void;
  /** Preview-only labels for the model menu; live mode lists configured models. */
  models?: string[];
  disabled?: boolean;
};

export function Composer({ placeholder, onSend, models, disabled }: ComposerProps) {
  const t = useT();
  const list = models ?? [t("composer.model.fast"), t("composer.model.thinking"), t("composer.model.pro")];
  const hints = [t("composer.model.fastHint"), t("composer.model.thinkingHint"), t("composer.model.proHint")];
  const [text, setText] = React.useState("");
  const [model, setModel] = React.useState(list[0]);
  const ph = placeholder ?? t("composer.placeholder");
  const send = () => { if (text.trim() && !disabled) { onSend?.(text.trim(), []); setText(""); } };
  return (
    <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <Pop trigger={<button type="button" className="ibtn round" aria-label={t("composer.add")}><Icon name="plus" /></button>} side="top">
        <MItem icon="paperclip">{t("composer.addFiles")}</MItem>
        <MItem icon="image">{t("composer.createImage")}</MItem>
        <MItem icon="globe">{t("composer.webSearch")}</MItem>
        <MItem icon="bot">{t("composer.handToBot")}</MItem>
      </Pop>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={ph} aria-label={ph} />
      <Menu.Root>
        <Menu.Trigger className="model" type="button">{model}<Icon name="chevron-down" size={12} /></Menu.Trigger>
        <Menu.Portal><Menu.Positioner sideOffset={6} align="end" side="top"><Menu.Popup className="popup" style={{ width: 220 }}>
          <Menu.RadioGroup value={model} onValueChange={(v) => setModel(v as string)}>
            {list.map((m, i) => (
              <Menu.RadioItem key={m} value={m} closeOnClick className="mitem" style={{ padding: "7px 10px" }}>
                <span style={{ flex: 1, display: "flex", flexDirection: "column" }}><span style={{ fontWeight: 500 }}>{m}</span><span className="sub">{hints[i]}</span></span>
                <Menu.RadioItemIndicator><Icon name="check" /></Menu.RadioItemIndicator>
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.Popup></Menu.Positioner></Menu.Portal>
      </Menu.Root>
      <IconBtn type="button" icon="mic" label={t("composer.dictate")} className="round" />
      <Tip label={text ? t("composer.send") : t("composer.voice")} kbd={text ? "↵" : undefined}>
        <button type="submit" className="send" data-has-text={text ? "" : undefined} aria-label={text ? t("composer.send") : t("composer.voice")}>
          <span className="swap"><Icon name="voice-wave" className="wave" /><Icon name="arrow-up" className="up" /></span>
        </button>
      </Tip>
    </form>
  );
}
