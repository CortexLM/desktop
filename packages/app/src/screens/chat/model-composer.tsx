// Live composer: same markup as components/composer.tsx, with the configured models,
// capability badges, the thinking toggle and real file attachments.
import * as React from "react";
import { Menu } from "@base-ui/react/menu";
import type { ModelInfo, ModelRef } from "@cortex/schema";
import { Icon } from "../../icons/Icon";
import { IconBtn, Tip, Switch, useToast } from "../../kit/ui";
import { Composer, type ComposerAttachment } from "../../components/composer";
import { api } from "../../api";
import { useQuery } from "../../state/live";
import { isPreview } from "../../preview";
import { useNav } from "../../shell/nav";
import { useI18n } from "../../i18n";
import { StopBtn } from "./shared";

const MODEL_KEY = "cortex.model";
const THINK_KEY = "cortex.thinking";
export type SendOptions = { model: ModelRef; reasoning?: boolean };
export type LiveModels = ReturnType<typeof useModels>;
export type ComposerLeaveGuard = { tryLeave: () => boolean; resume: () => void };
type ModelOptions = { initialModel?: ModelRef; allowKeyless?: boolean; strictSelection?: boolean };

/** Code also supports explicitly configured keyless endpoints and exact session selections. */
export function useModels({ initialModel, allowKeyless = false, strictSelection = false }: ModelOptions = {}) {
  const q = useQuery(async () => {
    const providers = (await api.providers.list()).filter((p) => p.enabled && (p.hasKey || (allowKeyless && p.baseURL)));
    const lists = await Promise.all(providers.map((p) => api.catalog.models(p.providerID).catch(() => [] as ModelInfo[])));
    return lists.flat();
  }, [allowKeyless], (e) => e.type.startsWith("provider."));
  const [sel, setSel] = React.useState<string>(() => initialModel ? `${initialModel.providerID}/${initialModel.modelID}` : localStorage.getItem(MODEL_KEY) ?? "");
  const models = q.state === "ready" ? q.data : [];
  const key = (m: ModelInfo) => `${m.providerID}/${m.id}`;
  const current = models.find((m) => key(m) === sel) ?? (strictSelection && sel ? undefined : models[0]);
  const pick = (k: string) => { localStorage.setItem(MODEL_KEY, k); setSel(k); };
  return { state: q.state, models, current, pick, key, reload: q.reload };
}

const readFile = (f: File) => new Promise<ComposerAttachment>((ok, ko) => {
  const r = new FileReader();
  r.onload = () => ok({ name: f.name, mime: f.type || "application/octet-stream", dataUrl: String(r.result) });
  r.onerror = () => ko(r.error);
  r.readAsDataURL(f);
});

type Props = ModelOptions & {
  placeholder?: string;
  inputTestId?: string;
  onSend: (text: string, attachments: ComposerAttachment[], opts: SendOptions) => Promise<boolean>;
  /** Called when send is attempted but no provider is configured. */
  onNoModel?: () => void | Promise<void>;
  busy?: boolean;
  onStop?: () => void;
  live?: LiveModels;
  leaveGuard?: React.Ref<ComposerLeaveGuard>;
};

export function ModelComposer(p: Props) {
  const { params } = useNav();
  if (p.leaveGuard ? params.has("preview") || params.has("shot") : isPreview()) return <Composer placeholder={p.placeholder} />;
  return <LiveComposer {...p} />;
}

function LiveComposer({ placeholder, inputTestId = "composer-input", onSend, onNoModel, busy, onStop, live, initialModel, allowKeyless, strictSelection, leaveGuard }: Props) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const fmtCtx = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  const fmtCost = new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  const own = useModels({ initialModel, allowKeyless, strictSelection });
  const { models, current, pick, key } = live ?? own;
  const [text, setText] = React.useState("");
  const [files, setFiles] = React.useState<ComposerAttachment[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const pending = React.useRef(false);
  const reads = React.useRef(0);
  const [reading, setReading] = React.useState(false);
  const [think, setThink] = React.useState(() => localStorage.getItem(THINK_KEY) !== "off");
  const fileRef = React.useRef<HTMLInputElement>(null);
  const locked = React.useRef(false), latest = React.useRef({ text, files, busy });
  const [leaving, setLeaving] = React.useState(false);
  latest.current = { text, files, busy };
  React.useImperativeHandle(leaveGuard, () => ({
    tryLeave: () => {
      if (locked.current || latest.current.text.length || latest.current.files.length || latest.current.busy || reads.current || pending.current) return false;
      locked.current = true; setLeaving(true); return true;
    },
    resume: () => { locked.current = false; setLeaving(false); },
  }), []);
  const disabled = submitting || leaving;
  const caps = current?.capabilities;
  const ph = placeholder ?? t("composer.placeholder");
  const hasText = !!text.trim();
  const voice = () => { if (!locked.current && !pending.current) toast.add({ title: t("system.unavailable"), description: t("chat.home.draftKept"), data: { icon: "mic" } }); };
  const setThinking = (v: boolean) => { if (locked.current || pending.current) return; localStorage.setItem(THINK_KEY, v ? "on" : "off"); setThink(v); };

  const send = async () => {
    if (locked.current || !latest.current.text.trim() || latest.current.busy || pending.current || reads.current) return;
    const reasoning = caps?.reasoning ? think : undefined;
    pending.current = true; setSubmitting(true);
    try {
      if (!current) { await onNoModel?.(); return; }
      if (await onSend(latest.current.text.trim(), latest.current.files, { model: { providerID: current.providerID, modelID: current.id }, reasoning })) {
        latest.current.text = ""; latest.current.files = []; setText(""); setFiles([]);
      }
    } catch {
      toast.add({ title: t("chat.err.generic.title"), description: t("chat.err.generic.body"), data: { icon: "alert-triangle" } });
    } finally { pending.current = false; setSubmitting(false); }
  };
  const add = async (list: FileList | null) => {
    if (locked.current || pending.current || !list?.length) return;
    const chosen = [...list];
    reads.current++; setReading(true);
    try {
      const results = await Promise.allSettled(chosen.map(readFile));
      latest.current.files = [...latest.current.files, ...results.flatMap((r) => r.status === "fulfilled" ? [r.value] : [])]; setFiles(latest.current.files);
      results.forEach((r, i) => { if (r.status === "rejected") toast.add({ title: t("common.fileReadFailed", { name: chosen[i].name }), data: { icon: "alert-triangle" } }); });
    } finally { reads.current--; setReading(reads.current > 0); }
  };
  const groups = [...new Set(models.map((m) => m.providerID))];

  return (
    <div className="chat-box" inert={leaving}>
      {files.length > 0 && <div className="chat-attach">{files.map((f, i) => (
        <div key={i} className="chat-att">
          {f.mime.startsWith("image/") ? <span className="chat-att-img" style={{ backgroundImage: `url(${f.dataUrl})` }} /> : <span className="chat-att-ic"><Icon name="file" /></span>}
          <span className="chat-att-txt"><span className="ttl">{f.name}</span><span className="sub">{f.mime}</span></span>
          <IconBtn icon="close" label={t("chat.att.remove", { name: f.name })} disabled={disabled} size={16} className="chat-att-x" onClick={() => { if (!locked.current && !pending.current) { latest.current.files = latest.current.files.filter((_, k) => k !== i); setFiles(latest.current.files); } }} />
        </div>
      ))}</div>}
      <form className="composer" data-has-text={hasText || undefined} aria-busy={submitting || undefined} onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <input ref={fileRef} type="file" multiple hidden disabled={disabled} data-testid="attach-input" accept={caps?.imageInput ? undefined : "application/pdf,text/*"} onChange={(e) => { add(e.currentTarget.files); e.currentTarget.value = ""; }} />
        <Menu.Root>
          <Menu.Trigger render={<button type="button" className="ibtn round" disabled={disabled} aria-label={t("composer.add")}><Icon name="plus" /></button>} />
          <Menu.Portal><Menu.Positioner sideOffset={6} side="top" align="start"><Menu.Popup className="popup">
            <Menu.Item className="mitem" disabled={disabled} onClick={() => { if (!locked.current && !pending.current) fileRef.current?.click(); }}><Icon name="paperclip" /><span>{t("composer.addFiles")}</span></Menu.Item>
            {caps?.imageInput
              ? <Menu.Item className="mitem" disabled={disabled} onClick={() => { if (!locked.current && !pending.current && fileRef.current) { fileRef.current.accept = "image/*"; fileRef.current.click(); fileRef.current.accept = ""; } }}><Icon name="image" /><span>{t("chat.model.attachImage")}</span></Menu.Item>
              : <Tip label={t("chat.model.noImage")} side="right"><Menu.Item className="mitem" disabled aria-disabled style={{ opacity: 0.45 }}><Icon name="image" /><span>{t("chat.model.attachImage")}</span></Menu.Item></Tip>}
          </Menu.Popup></Menu.Positioner></Menu.Portal>
        </Menu.Root>
        <input value={text} disabled={disabled} onChange={(e) => { if (!locked.current && !pending.current) { latest.current.text = e.target.value; setText(e.target.value); } }} placeholder={ph} aria-label={ph} data-testid={inputTestId} />
        <Menu.Root>
          <Menu.Trigger className="model" type="button" disabled={disabled} data-testid="model-trigger">{current?.name ?? t("chat.model.none")}<Icon name="chevron-down" size={12} /></Menu.Trigger>
          <Menu.Portal><Menu.Positioner sideOffset={6} align="end" side="top"><Menu.Popup className="popup" style={{ width: 320, maxHeight: 420, overflow: "auto" }}>
            {models.length === 0 && <div className="chat-mgroup">{t("chat.model.noneHint")}</div>}
            <Menu.RadioGroup value={current ? key(current) : ""} onValueChange={(v) => { if (!locked.current && !pending.current) pick(v as string); }}>
              {groups.map((g) => (
                <React.Fragment key={g}>
                  <div className="chat-mgroup">{g}</div>
                  {models.filter((m) => m.providerID === g).map((m) => {
                    const c = m.capabilities;
                    return (
                      <Menu.RadioItem key={key(m)} value={key(m)} disabled={disabled} closeOnClick className="mitem" style={{ padding: "7px 10px" }} data-testid="model-option">
                        <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 500 }}>{m.name}</span>
                          <span className="chat-mbadges">
                            {c.reasoning && <span className="badge run">{t("chat.model.reasoning")}</span>}
                            {c.imageInput && <span className="badge ok">{t("chat.model.image")}</span>}
                            {c.tools && <span className="badge wait">{t("chat.model.tools")}</span>}
                            {c.contextWindow > 0 && <span className="badge">{fmtCtx.format(c.contextWindow)}</span>}
                            {(c.cost.input > 0 || c.cost.output > 0) && <span className="badge">{t("chat.model.cost", { input: fmtCost.format(c.cost.input), output: fmtCost.format(c.cost.output) })}</span>}
                          </span>
                        </span>
                        <Menu.RadioItemIndicator><Icon name="check" /></Menu.RadioItemIndicator>
                      </Menu.RadioItem>
                    );
                  })}
                </React.Fragment>
              ))}
            </Menu.RadioGroup>
            {caps?.reasoning && (
              <div className="chat-mthink">
                <span className="chat-grow"><span style={{ fontWeight: 500 }}>{t("chat.model.thinking")}</span><span className="chat-meta">{t("chat.model.thinkingHint")}</span></span>
                <span data-testid="thinking-toggle"><Switch checked={think} disabled={disabled} onCheckedChange={setThinking} aria-label={t("chat.model.thinking")} /></span>
              </div>
            )}
          </Menu.Popup></Menu.Positioner></Menu.Portal>
        </Menu.Root>
        <IconBtn type="button" icon="mic" label={t("composer.dictate")} className="round" disabled={disabled} onClick={voice} />
        {busy ? <StopBtn onStop={() => { if (!locked.current) onStop?.(); }} /> : (
          <Tip label={hasText ? t("composer.send") : t("composer.voice")} kbd={hasText ? "↵" : undefined}>
            <button type={hasText ? "submit" : "button"} onClick={hasText ? undefined : voice} className="send" disabled={disabled || reading} data-has-text={hasText ? "" : undefined} aria-label={hasText ? t("composer.send") : t("composer.voice")} data-testid="composer-send">
              <span className="swap"><Icon name="voice-wave" className="wave" /><Icon name="arrow-up" className="up" /></span>
            </button>
          </Tip>
        )}
      </form>
    </div>
  );
}
