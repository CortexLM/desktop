// Live composer: configured models, capability badges and real attachments.
import * as React from "react";
import { Menu } from "@base-ui/react/menu";
import type { ModelInfo, ModelRef } from "@cortex/schema";
import { Icon } from "../../icons/Icon";
import { IconBtn, Tip, Switch, useToast } from "../../kit/ui";
import { Composer, type ComposerAttachment } from "../../components/composer";
import { api } from "../../api";
import { useQuery } from "../../state/live";
import { useNav } from "../../shell/nav";
import { useI18n } from "../../i18n";
import { useSendEnter } from "../../state/send-enter";

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

/** Time is the behavior: mount only for the active run, clean up on settlement. */
export function BusyStrip({ onStop }: { onStop?: () => void }) {
  const { t } = useI18n();
  const [seconds, setSeconds] = React.useState(0);
  React.useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 250);
    return () => clearInterval(timer);
  }, []);
  return <div data-testid="chat-busy-strip" role="status" style={{ display: "flex", alignItems: "center", gap: 8, height: 28, color: "var(--t2)" }}>
    <span className="thinking">{t("chat.thinking")}</span>
    <time data-testid="chat-busy-timer" style={{ fontVariantNumeric: "tabular-nums" }}>{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</time>
    <span style={{ flex: 1 }} />
    {onStop && <button type="button" className="chat-link" onClick={onStop}>{t("composer.stop")}</button>}
  </div>;
}

type Props = ModelOptions & {
  placeholder?: string;
  inputTestId?: string;
  onSend: (text: string, attachments: ComposerAttachment[], opts: SendOptions) => Promise<boolean>;
  onNoModel?: () => void | Promise<void>;
  busy?: boolean;
  onStop?: () => void;
  live?: LiveModels;
  leaveGuard?: React.Ref<ComposerLeaveGuard>;
};

export function ModelComposer(p: Props) {
  const { params, route } = useNav();
  if (route === "gallery" || params.has("preview") || params.has("shot")) return <Composer placeholder={p.placeholder} />;
  return <LiveComposer {...p} />;
}

function LiveComposer({ placeholder, inputTestId = "composer-input", onSend, onNoModel, busy, onStop, live, initialModel, allowKeyless, strictSelection, leaveGuard }: Props) {
  const { t, locale } = useI18n();
  const { go, route } = useNav();
  const code = route === "code" || route === "code-session";
  const toast = useToast();
  const enter = useSendEnter();
  const instructions = enter.value === null ? t("common.sendEnterUnavailable") : enter.value ? t("system.settings.t.general.enterDesc") : t("common.sendEnterOff");
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
  const send = async () => {
    if (locked.current || !latest.current.text.trim() || latest.current.busy || pending.current || reads.current) return;
    if (!current) { if (code) await onNoModel?.(); return; }
    pending.current = true; setSubmitting(true);
    try {
      if (await onSend(latest.current.text.trim(), latest.current.files, { model: { providerID: current.providerID, modelID: current.id }, reasoning: caps?.reasoning ? think : undefined })) {
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
  return <div className="chat-box" inert={leaving}>
    {!code && busy && <BusyStrip onStop={onStop} />}
    {files.length > 0 && <div className="chat-attach">{files.map((f, i) => <div key={i} className="chat-att">
      {f.mime.startsWith("image/") ? <span className="chat-att-img" style={{ backgroundImage: `url(${f.dataUrl})` }} /> : <span className="chat-att-ic"><Icon name="file" /></span>}<span className="chat-att-txt"><span className="ttl">{f.name}</span><span className="sub">{f.mime}</span></span>
      <IconBtn icon="close" label={t("chat.att.remove", { name: f.name })} disabled={disabled} size={16} className="chat-att-x" onClick={() => { if (!locked.current && !pending.current) { latest.current.files = latest.current.files.filter((_, k) => k !== i); setFiles(latest.current.files); } }} />
    </div>)}</div>}
    <form className="composer" data-has-text={code && hasText || undefined} aria-busy={submitting || undefined} style={code ? undefined : { display: "grid", gridTemplateColumns: "32px minmax(0, 1fr) 32px 36px", alignItems: "end", gap: 4, padding: 10 }} onSubmit={(e) => { e.preventDefault(); void send(); }}>
      <textarea rows={1} {...enter.field} value={text} disabled={disabled} onChange={(e) => { if (!locked.current && !pending.current) { latest.current.text = e.target.value; setText(e.target.value); } }} placeholder={ph} aria-label={ph} aria-description={instructions} data-testid={inputTestId} style={code ? undefined : { gridColumn: "1 / -1", width: "100%", minHeight: 20, maxHeight: "8lh", lineHeight: "20px", padding: 0, margin: 0, outline: "none", resize: "none", overflowY: "auto", scrollbarWidth: "none" }} />
      <input ref={fileRef} type="file" multiple hidden disabled={disabled} data-testid="attach-input" accept={caps?.imageInput ? undefined : "application/pdf,text/*"} onChange={(e) => { void add(e.currentTarget.files); e.currentTarget.value = ""; }} />
      <Menu.Root>
        <Menu.Trigger render={<button type="button" className="ibtn round" disabled={disabled} aria-label={t("composer.add")}><Icon name="plus" /></button>} />
        <Menu.Portal><Menu.Positioner sideOffset={6} side="top" align="start"><Menu.Popup className="popup">
          <Menu.Item className="mitem" disabled={disabled} onClick={() => fileRef.current?.click()}><Icon name="paperclip" /><span>{t("composer.addFiles")}</span></Menu.Item>
          {caps?.imageInput && <Menu.Item className="mitem" disabled={disabled} onClick={() => { if (!locked.current && !pending.current && fileRef.current) { fileRef.current.accept = "image/*"; fileRef.current.click(); fileRef.current.accept = ""; } }}><Icon name="image" /><span>{t("chat.model.attachImage")}</span></Menu.Item>}
        </Menu.Popup></Menu.Positioner></Menu.Portal>
      </Menu.Root>
      {current ? <Menu.Root>
        <Menu.Trigger className="model" type="button" disabled={disabled} data-testid="model-trigger" style={code ? undefined : { justifySelf: "start" }}>{current.name}<Icon name="chevron-down" size={12} /></Menu.Trigger>
        <Menu.Portal><Menu.Positioner sideOffset={8} align={code ? "end" : "start"} side={code ? "top" : "bottom"} collisionPadding={8} collisionAvoidance={code ? undefined : { side: "none", align: "shift", fallbackAxisSide: "none" }}><Menu.Popup className="popup" data-testid="model-picker" style={{ width: "min(360px, calc(100vw - 16px))", maxHeight: "min(420px, var(--available-height))", overflow: "auto" }}>
          <Menu.RadioGroup value={key(current)} onValueChange={(v) => { if (!locked.current && !pending.current) pick(String(v)); }}>
            {groups.map((g) => <React.Fragment key={g}><div className="chat-mgroup">{g}</div>{models.filter((m) => m.providerID === g).map((m) => <Menu.RadioItem key={key(m)} value={key(m)} disabled={disabled} closeOnClick className="mitem" data-testid="model-option">
              <span className="chat-grow"><span className="ttl">{m.name}</span><span className="chat-mbadges">{m.capabilities.reasoning && <span className="badge">{t("chat.model.reasoning")}</span>}{m.capabilities.imageInput && <span className="badge">{t("chat.model.image")}</span>}{m.capabilities.tools && <span className="badge">{t("chat.model.tools")}</span>}{m.capabilities.contextWindow > 0 && <span className="badge">{fmtCtx.format(m.capabilities.contextWindow)}</span>}{(m.capabilities.cost.input > 0 || m.capabilities.cost.output > 0) && <span className="badge">{t("chat.model.cost", { input: fmtCost.format(m.capabilities.cost.input), output: fmtCost.format(m.capabilities.cost.output) })}</span>}</span></span>
              <Menu.RadioItemIndicator><Icon name="check" /></Menu.RadioItemIndicator>
            </Menu.RadioItem>)}</React.Fragment>)}
          </Menu.RadioGroup>
          {caps?.reasoning && <div className="chat-mthink"><span className="chat-grow">{t("chat.model.thinking")}</span><span data-testid="thinking-toggle"><Switch checked={think} disabled={disabled} onCheckedChange={(v) => { if (!locked.current && !pending.current) { localStorage.setItem(THINK_KEY, v ? "on" : "off"); setThink(v); } }} aria-label={t("chat.model.thinking")} /></span></div>}
          <Menu.Item className="mitem" onClick={() => go("providers")}>{t("composer.manageProviders")}</Menu.Item>
        </Menu.Popup></Menu.Positioner></Menu.Portal>
      </Menu.Root> : code ? <Tip label={t("chat.model.noneHint")}><button type="button" className="model" data-testid="model-trigger" disabled={disabled} onClick={() => go("providers")}>{t("chat.model.none")}<Icon name="chevron-down" size={12} /></button></Tip> : <button type="button" className="model" data-testid="model-trigger" style={{ justifySelf: "start" }} onClick={() => go("providers")}>{t("composer.addProvider")}</button>}
      <IconBtn type="button" icon="mic" label={t("composer.dictate")} className="round" disabled aria-disabled="true" />
      {busy ? <button type="button" className="send chat-stop" aria-label={t(code ? "chat.stop" : "composer.stop")} data-testid="stop" onClick={() => { if (!locked.current) onStop?.(); }}><Icon name="stop" size={16} /></button> : <Tip label={hasText ? t("composer.send") : t("composer.voice")} kbd={hasText && enter.value === true ? "↵" : undefined}>
        <button type="submit" className="send" disabled={disabled || reading || !hasText || !code && !current} aria-disabled={disabled || reading || !hasText || !code && !current} data-has-text={hasText ? "" : undefined} aria-label={hasText ? t("composer.send") : t("composer.voice")} data-testid="composer-send"><span className="swap"><Icon name="voice-wave" className="wave" /><Icon name="arrow-up" className="up" /></span></button>
      </Tip>}
    </form>
    {enter.value === null && <span className="composer-storage-error" role="status">{instructions}</span>}
  </div>;
}
