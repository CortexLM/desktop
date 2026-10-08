// Pill composer: + · field · model ⌄ · mic · send/voice (morphs with text).
// Stable contract used by every screen; the Chat lot owns the model-aware internals.
import * as React from "react";
import { Menu } from "@base-ui/react/menu";
import { Icon } from "../icons/Icon";
import { IconBtn, Tip, Pop, MItem, useToast } from "../kit/ui";
import { useT } from "../i18n";
import { go, useNav } from "../shell/nav";
import { isPreview } from "../preview";
import { useSendEnter } from "../state/send-enter";

/** Preview navigation stores the initial request in browser history, never in the engine. */
export function startPreviewChat(route: "chat" | "code-session", text: string, model: string) {
  if (!isPreview() || !text.trim()) return;
  go(route, undefined, { text: text.trim(), model });
}

export function previewChatStart(): { text: string; model: string } | null {
  if (!isPreview()) return null;
  const value = history.state?.cortexChat;
  return value && typeof value.text === "string" && typeof value.model === "string" ? { text: value.text, model: value.model } : null;
}

export type ComposerAttachment = { name: string; mime: string; dataUrl: string };
export type ComposerProps = {
  placeholder?: string;
  /** Live sends return false on refusal; preview callbacks may return void. */
  onSend?: (text: string, attachments: ComposerAttachment[], previewModel: string) => boolean | void | Promise<boolean>;
  /** Display labels only; live callers resolve engine models independently. */
  models?: string[];
  initialModel?: string;
  onModelChange?: (model: string) => void;
  disabled?: boolean;
  /** data-testid prefix: `<id>-input`, `<id>-send`. */
  testId?: string;
  /** Live tool pages send with the account default model; hide the display-only model menu. */
  hideModel?: boolean;
};

export function Composer({ placeholder, onSend, models, initialModel, onModelChange, disabled, testId = "composer", hideModel }: ComposerProps) {
  const t = useT();
  const { go } = useNav();
  const toast = useToast();
  const enter = useSendEnter();
  const instructions = enter.value === null ? t("common.sendEnterUnavailable") : enter.value ? t("system.settings.t.general.enterDesc") : t("common.sendEnterOff");
  const list = models ?? [t("composer.model.fast"), t("composer.model.thinking"), t("composer.model.pro")];
  const hints = [t("composer.model.fastHint"), t("composer.model.thinkingHint"), t("composer.model.proHint")];
  const [text, setText] = React.useState("");
  const [model, setModel] = React.useState(initialModel && list.includes(initialModel) ? initialModel : list[0]);
  const [submitting, setSubmitting] = React.useState(false);
  const pending = React.useRef(false);
  const ph = placeholder ?? t("composer.placeholder");
  const hasText = !!text.trim();
  const send = async () => {
    if (!hasText || !onSend || disabled || pending.current) return;
    pending.current = true; setSubmitting(true);
    try {
      if (await onSend(text.trim(), [], model) !== false) setText("");
    } catch {
      toast.add({ title: t("chat.err.generic.title"), description: t("chat.err.generic.body"), data: { icon: "alert-triangle" } });
    } finally { pending.current = false; setSubmitting(false); }
  };
  return (
    <form className="composer" data-has-text={hasText || undefined} aria-busy={submitting || undefined} onSubmit={(e) => { e.preventDefault(); void send(); }}>
      <Pop trigger={<button type="button" className="ibtn round" disabled={submitting} aria-label={t("composer.add")}><Icon name="plus" /></button>} side="top">
        <MItem icon="paperclip" onClick={() => go("upload")}>{t("composer.addFiles")}</MItem>
        <MItem icon="image" onClick={() => go("image-gen")}>{t("composer.createImage")}</MItem>
        <MItem icon="globe" onClick={() => go("search-results")}>{t("composer.webSearch")}</MItem>
        <MItem icon="bot" onClick={() => go("bot")}>{t("composer.handToBot")}</MItem>
      </Pop>
      {enter.live
        ? <textarea rows={1} {...enter.field} data-testid={`${testId}-input`} value={text} disabled={submitting} onChange={(e) => setText(e.target.value)} placeholder={ph} aria-label={ph} aria-description={instructions} />
        : <input data-testid={`${testId}-input`} value={text} disabled={submitting} onChange={(e) => setText(e.target.value)} placeholder={ph} aria-label={ph} />}
      {enter.live && enter.value === null && <span className="composer-storage-error" role="status">{instructions}</span>}
      {!hideModel && <Menu.Root>
        <Menu.Trigger className="model" type="button" disabled={submitting}>{model}<Icon name="chevron-down" size={12} /></Menu.Trigger>
        <Menu.Portal><Menu.Positioner sideOffset={6} align="end" side="top"><Menu.Popup className="popup" style={{ width: 220 }}>
          <Menu.RadioGroup value={model} onValueChange={(v) => { setModel(v as string); onModelChange?.(v as string); }}>
            {list.map((m, i) => (
              <Menu.RadioItem key={m} value={m} closeOnClick className="mitem" style={{ padding: "7px 10px" }}>
                <span style={{ flex: 1, display: "flex", flexDirection: "column" }}><span style={{ fontWeight: 500 }}>{m}</span><span className="sub">{hints[i]}</span></span>
                <Menu.RadioItemIndicator><Icon name="check" /></Menu.RadioItemIndicator>
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.Popup></Menu.Positioner></Menu.Portal>
      </Menu.Root>}
      <IconBtn type="button" icon="mic" label={t("composer.dictate")} className="round" disabled={submitting} onClick={() => go("voice")} />
      <Tip label={hasText ? t("composer.send") : t("composer.voice")} kbd={hasText && enter.value === true ? "↵" : undefined}>
        <button type={hasText ? "submit" : "button"} onClick={hasText ? undefined : () => go("voice")} data-testid={`${testId}-send`} className="send" disabled={disabled || submitting || (hasText && !onSend)} data-has-text={hasText ? "" : undefined} aria-label={hasText ? t("composer.send") : t("composer.voice")}>
          <span className="swap"><Icon name="voice-wave" className="wave" /><Icon name="arrow-up" className="up" /></span>
        </button>
      </Tip>
    </form>
  );
}
