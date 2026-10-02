// Live composer: same markup as components/composer.tsx, with the configured models,
// capability badges, the thinking toggle and real file attachments.
import * as React from "react";
import { Menu } from "@base-ui/react/menu";
import type { ModelInfo, ModelRef } from "@cortex/schema";
import { Icon } from "../../icons/Icon";
import { IconBtn, Tip, Switch } from "../../kit/ui";
import { Composer, type ComposerAttachment } from "../../components/composer";
import { api } from "../../api";
import { useQuery } from "../../state/live";
import { isPreview } from "../../preview";
import { useT } from "../../i18n";
import { StopBtn } from "./shared";

const MODEL_KEY = "cortex.model";
const THINK_KEY = "cortex.thinking";
export type SendOptions = { model: ModelRef; reasoning?: boolean };
export type LiveModels = ReturnType<typeof useModels>;

/** Models of every enabled provider that has a key. */
export function useModels() {
  const q = useQuery(async () => {
    const providers = (await api.providers.list()).filter((p) => p.enabled && p.hasKey);
    const lists = await Promise.all(providers.map((p) => api.catalog.models(p.providerID).catch(() => [] as ModelInfo[])));
    return lists.flat();
  }, [], (e) => e.type.startsWith("provider."));
  const [sel, setSel] = React.useState<string>(() => localStorage.getItem(MODEL_KEY) ?? "");
  const models = q.state === "ready" ? q.data : [];
  const key = (m: ModelInfo) => `${m.providerID}/${m.id}`;
  const current = models.find((m) => key(m) === sel) ?? models[0];
  const pick = (k: string) => { localStorage.setItem(MODEL_KEY, k); setSel(k); };
  return { state: q.state, models, current, pick, key };
}

const fmtCtx = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));
const fmtCost = (n: number) => `$${+n.toFixed(2)}`;
const readFile = (f: File) => new Promise<ComposerAttachment>((ok, ko) => {
  const r = new FileReader();
  r.onload = () => ok({ name: f.name, mime: f.type || "application/octet-stream", dataUrl: String(r.result) });
  r.onerror = () => ko(r.error);
  r.readAsDataURL(f);
});

type Props = {
  placeholder?: string;
  onSend: (text: string, attachments: ComposerAttachment[], opts: SendOptions) => void;
  /** Called when send is attempted but no provider is configured. */
  onNoModel?: () => void;
  busy?: boolean;
  onStop?: () => void;
  live?: LiveModels;
};

export function ModelComposer(p: Props) {
  if (isPreview()) return <Composer placeholder={p.placeholder} />;
  return <LiveComposer {...p} />;
}

function LiveComposer({ placeholder, onSend, onNoModel, busy, onStop, live }: Props) {
  const t = useT();
  const own = useModels();
  const { models, current, pick, key } = live ?? own;
  const [text, setText] = React.useState("");
  const [files, setFiles] = React.useState<ComposerAttachment[]>([]);
  const [think, setThink] = React.useState(() => localStorage.getItem(THINK_KEY) !== "off");
  const fileRef = React.useRef<HTMLInputElement>(null);
  const caps = current?.capabilities;
  const ph = placeholder ?? t("composer.placeholder");
  const setThinking = (v: boolean) => { localStorage.setItem(THINK_KEY, v ? "on" : "off"); setThink(v); };

  const send = () => {
    if (!text.trim() || busy) return;
    if (!current) { onNoModel?.(); return; }
    const reasoning = caps?.reasoning ? think : undefined;
    onSend(text.trim(), caps?.imageInput ? files : files.filter((f) => !f.mime.startsWith("image/")), { model: { providerID: current.providerID, modelID: current.id }, reasoning });
    setText(""); setFiles([]);
  };
  const add = async (list: FileList | null) => {
    if (!list) return;
    const read = await Promise.all([...list].map(readFile));
    setFiles((f) => [...f, ...read]);
  };
  const groups = [...new Set(models.map((m) => m.providerID))];

  return (
    <div className="chat-box">
      {files.length > 0 && <div className="chat-attach">{files.map((f, i) => (
        <div key={i} className="chat-att">
          {f.mime.startsWith("image/") ? <span className="chat-att-img" style={{ backgroundImage: `url(${f.dataUrl})` }} /> : <span className="chat-att-ic"><Icon name="file" /></span>}
          <span className="chat-att-txt"><span className="ttl">{f.name}</span><span className="sub">{f.mime}</span></span>
          <IconBtn icon="close" label={t("chat.att.remove", { name: f.name })} size={16} className="chat-att-x" onClick={() => setFiles((x) => x.filter((_, k) => k !== i))} />
        </div>
      ))}</div>}
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input ref={fileRef} type="file" multiple hidden data-testid="attach-input" accept={caps?.imageInput ? undefined : "application/pdf,text/*"} onChange={(e) => { add(e.currentTarget.files); e.currentTarget.value = ""; }} />
        <Menu.Root>
          <Menu.Trigger render={<button type="button" className="ibtn round" aria-label={t("composer.add")}><Icon name="plus" /></button>} />
          <Menu.Portal><Menu.Positioner sideOffset={6} side="top" align="start"><Menu.Popup className="popup">
            <Menu.Item className="mitem" onClick={() => fileRef.current?.click()}><Icon name="paperclip" /><span>{t("composer.addFiles")}</span></Menu.Item>
            {caps?.imageInput
              ? <Menu.Item className="mitem" onClick={() => { if (fileRef.current) { fileRef.current.accept = "image/*"; fileRef.current.click(); fileRef.current.accept = ""; } }}><Icon name="image" /><span>{t("chat.model.attachImage")}</span></Menu.Item>
              : <Tip label={t("chat.model.noImage")} side="right"><Menu.Item className="mitem" disabled aria-disabled style={{ opacity: 0.45 }}><Icon name="image" /><span>{t("chat.model.attachImage")}</span></Menu.Item></Tip>}
          </Menu.Popup></Menu.Positioner></Menu.Portal>
        </Menu.Root>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={ph} aria-label={ph} data-testid="composer-input" />
        <Menu.Root>
          <Menu.Trigger className="model" type="button" data-testid="model-trigger">{current?.name ?? t("chat.model.none")}<Icon name="chevron-down" size={12} /></Menu.Trigger>
          <Menu.Portal><Menu.Positioner sideOffset={6} align="end" side="top"><Menu.Popup className="popup" style={{ width: 320, maxHeight: 420, overflow: "auto" }}>
            {models.length === 0 && <div className="chat-mgroup">{t("chat.model.noneHint")}</div>}
            <Menu.RadioGroup value={current ? key(current) : ""} onValueChange={(v) => pick(v as string)}>
              {groups.map((g) => (
                <React.Fragment key={g}>
                  <div className="chat-mgroup">{g}</div>
                  {models.filter((m) => m.providerID === g).map((m) => {
                    const c = m.capabilities;
                    return (
                      <Menu.RadioItem key={key(m)} value={key(m)} closeOnClick className="mitem" style={{ padding: "7px 10px" }} data-testid="model-option">
                        <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 500 }}>{m.name}</span>
                          <span className="chat-mbadges">
                            {c.reasoning && <span className="badge run">{t("chat.model.reasoning")}</span>}
                            {c.imageInput && <span className="badge ok">{t("chat.model.image")}</span>}
                            {c.tools && <span className="badge wait">{t("chat.model.tools")}</span>}
                            {c.contextWindow > 0 && <span className="badge">{fmtCtx(c.contextWindow)}</span>}
                            {(c.cost.input > 0 || c.cost.output > 0) && <span className="badge">{t("chat.model.cost", { input: fmtCost(c.cost.input), output: fmtCost(c.cost.output) })}</span>}
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
                <span data-testid="thinking-toggle"><Switch checked={think} onCheckedChange={setThinking} aria-label={t("chat.model.thinking")} /></span>
              </div>
            )}
          </Menu.Popup></Menu.Positioner></Menu.Portal>
        </Menu.Root>
        {busy ? <StopBtn onStop={onStop} /> : (
          <Tip label={t("composer.send")} kbd="↵">
            <button type="submit" className="send" data-has-text={text ? "" : undefined} aria-label={t("composer.send")} data-testid="composer-send">
              <span className="swap"><Icon name="voice-wave" className="wave" /><Icon name="arrow-up" className="up" /></span>
            </button>
          </Tip>
        )}
      </form>
    </div>
  );
}
