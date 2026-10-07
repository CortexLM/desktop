// Image generation, sharing and temporary chat (designs "image-gen", "share", "temp-chat"). Preview only.
import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Radio } from "@base-ui/react/radio";
import { Slider } from "@base-ui/react/slider";
import { Composer } from "../../components/composer";
import { Icon, IconBtn, Switch, useToast } from "../../kit/ui";
import { Mascot, COLORS, type MascotConfig } from "../../mascot/Mascot";
import { useNav } from "../../shell/nav";
import { useVariant } from "../../registry";
import { useT } from "../../i18n";
import { isPreview } from "../../preview";
import { LiveChatFeature } from "./live-features";
import { Actions, BotRow, Box, NB, Unavailable, css, useBotCfg, useCopy, useFx, useTicker } from "./shared";

const v3 = (ns: string, l: [string, string][]): [string, string, string][] => l.map(([id, d]) => [id, `chat.variant.${ns}.${id}`, d]);
export const IMAGE_VARIANTS = v3("image", [["generating", "generation"], ["results", "resultats"], ["editing", "edition"], ["refused", "refus"]]);
export const SHARE_VARIANTS = v3("share", [["settings", "reglages"], ["created", "cree"], ["disabled", "desactive"]]);
export const TEMP_VARIANTS = v3("temp", [["empty", "vide"], ["active", "encours"]]);

/* ---------------- Image generation */
const FORMATS: [string, string][] = [["square", "1:1"], ["landscape", "3:2"], ["portrait", "2:3"], ["wide", "16:9"]];
const IMGS = ["ceramique", "atelier", "marche", "prairie"];

export function ImageGen() {
  const [v, setV] = useVariant("generating");
  if (!isPreview()) return <LiveChatFeature feature="image-gen" local={<Unavailable feature="image-gen" />} />;
  return <ImageIn key={v} v={v} setV={setV} />;
}

function ImageIn({ v, setV }: { v: string; setV: (v: string) => void }) {
  const t = useT();
  const fx = useFx().image;
  const toast = useToast();
  const [fmt, setFmt] = React.useState("landscape");
  const [p] = useTicker(100, 50, 0, v === "generating");
  const done = v !== "generating" || p >= 100;
  return (<>
    <div className="content-top"><span className="title">{fx.title}</span><div className="spacer" /><IconBtn icon="folder" label={t("chat.image.library")} /><IconBtn icon="compose" label={t("chat.newChat")} kbd="⌘N" /></div>
    {v === "editing" ? <ImageEdit onDone={() => setV("results")} /> : (
      <div className="thread"><div className="thread-inner">
        <div className="msg-user">{v === "refused" ? fx.refusedQ : fx.prompt}</div>
        {v === "refused" ? <BotRow st="blocked">
          <div className="chat-err warn"><Icon name="shield-check" /><div className="chat-grow"><b>{t("chat.image.refusedTitle")}</b><span>{t("chat.image.refusedBody")}</span></div></div>
          <p>{t("chat.image.instead")}</p>
          <div className="chat-related">{(fx.alternatives as string[]).map((q) => <button key={q} className="chat-relq" onClick={() => setV("generating")}><span>{q}</span><Icon name="arrow-right" size={16} /></button>)}</div>
          <a className="chat-link" href="#/about">{t("chat.image.rules")}</a>
        </BotRow> : <BotRow st={done ? "done" : "working"}>
          {done ? <p>{t("chat.image.ready", { ratio: "3:2" })}</p> : <div className="chat-tool-h"><span className="thinking">{t("chat.image.creating", { count: 4 })}</span><span className="chat-meta">{p}{NB}%</span></div>}
          <div className="chat-gen" data-fmt={fmt}>
            {IMGS.map((m, i) => {
              const q = Math.min(100, Math.max(0, p * 1.15 - i * 6));
              const blur = done ? 0 : 26 * (1 - q / 100);
              return (
                <div key={m} className="chat-gtile" style={css({ "--i": i })}>
                  <span className="chat-gimg" style={{ backgroundImage: `url(/img/${m}.png)`, filter: `blur(${blur.toFixed(1)}px) saturate(${done ? 1 : 0.4 + q / 170})` }} />
                  {!done && <span className="chat-gshim" />}
                  {done && <div className="chat-gact">
                    <IconBtn icon="download" label={t("chat.image.download")} onClick={() => toast.add({ title: t("chat.image.downloaded"), description: `${fx.fileBase}-${i + 1}.png`, data: { icon: "download" } })} />
                    <IconBtn icon="edit" label={t("chat.image.editZone")} onClick={() => setV("editing")} />
                    <IconBtn icon="refresh" label={t("chat.image.variants")} onClick={() => setV("generating")} />
                  </div>}
                </div>
              );
            })}
          </div>
          {done && <Actions />}
        </BotRow>}
      </div></div>
    )}
    {v !== "editing" && <div className="dock">
      <div className="chat-fmts" role="group" aria-label={t("chat.image.format")}>{FORMATS.map(([id, r]) => <button key={id} className="chip" aria-pressed={fmt === id} data-pressed={fmt === id || undefined} onClick={() => setFmt(id)}><span className="chat-ratio" data-f={r} />{t(`chat.image.fmt.${id}`, { ratio: r })}</button>)}</div>
      <Box mode={done ? "idle" : "busy"} placeholder={t("chat.image.placeholder")} model={t("chat.image.model")} />
      <span className="hint">{t("chat.hint")}</span>
    </div>}
  </>);
}

function ImageEdit({ onDone }: { onDone: () => void }) {
  const t = useT();
  const fx = useFx().image;
  const toast = useToast();
  const cv = React.useRef<HTMLCanvasElement>(null);
  const ctx = React.useRef<CanvasRenderingContext2D | null>(null);
  const last = React.useRef<[number, number] | null>(null);
  const [size, setSize] = React.useState(32);
  const [has, setHas] = React.useState(true);
  const [ask, setAsk] = React.useState<string>(fx.editAsk);
  const [busy, setBusy] = React.useState(false);
  const line = (a: [number, number], b: [number, number], w: number) => { const g = ctx.current; if (!g) return; g.lineWidth = w; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); };
  React.useEffect(() => {
    const c = cv.current; if (!c) return;
    const r = c.getBoundingClientRect(); c.width = r.width * 2; c.height = r.height * 2;
    const g = c.getContext("2d"); if (!g) return;
    g.scale(2, 2); g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = getComputedStyle(c).getPropertyValue("--blue").trim() || "#3b82f6";
    ctx.current = g;
    const W = r.width, H = r.height;
    [[0.56, 0.42, 0.66, 0.4], [0.55, 0.5, 0.68, 0.5], [0.56, 0.58, 0.67, 0.6]].forEach(([a, b, c2, d]) => line([W * a, H * b], [W * c2, H * d], 34));
  }, []);
  const pos = (e: React.PointerEvent): [number, number] => { const r = cv.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const clear = () => { const c = cv.current; ctx.current?.clearRect(0, 0, c?.width ?? 0, c?.height ?? 0); setHas(false); };
  return (
    <div className="chat-edit-img">
      <div className="chat-tools" role="toolbar" aria-label={t("chat.image.tools")}>
        <span className="chat-tool-l"><Icon name="edit" size={16} />{t("chat.image.brush")}</span>
        <Slider.Root value={size} onValueChange={(x) => setSize(x as number)} min={8} max={80} className="chat-slider" aria-label={t("chat.image.brushSize")}>
          <Slider.Control className="chat-sl-ctl"><Slider.Track className="chat-sl-track"><Slider.Indicator className="chat-sl-ind" /><Slider.Thumb className="chat-sl-thumb" aria-label={t("chat.image.brushSize")} /></Slider.Track></Slider.Control>
        </Slider.Root>
        <span className="chat-meta mono">{t("chat.image.px", { size })}</span>
        <button className="btn secondary" onClick={clear} disabled={!has}><Icon name="trash" size={16} />{t("chat.image.clear")}</button>
        <div className="spacer" />
        <button className="btn secondary" onClick={onDone}>{t("common.cancel")}</button>
      </div>
      <div className="chat-stage">
        <div className="chat-canvas-img" style={{ backgroundImage: "url(/img/ceramique.png)" }}>
          <canvas ref={cv} className="chat-mask" aria-label={t("chat.image.maskLabel")} style={{ cursor: "crosshair" }}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); last.current = pos(e); line(last.current, last.current, size); setHas(true); }}
            onPointerMove={(e) => { if (!last.current) return; const p = pos(e); line(last.current, p, size); last.current = p; }}
            onPointerUp={() => { last.current = null; }} />
          {busy && <div className="chat-busy"><span className="thinking">{t("chat.image.editingZone")}</span></div>}
        </div>
      </div>
      <form className="chat-box chat-edit-ask" onSubmit={(e) => { e.preventDefault(); setBusy(true); setTimeout(() => { setBusy(false); clear(); toast.add({ title: t("chat.image.zoneEdited"), description: t("chat.image.zoneEditedBody"), data: { icon: "check" } }); }, 1400); }}>
        <div className="composer">
          <Icon name="sparkle-free" className="chat-i1" />
          <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder={has ? t("chat.image.askZone") : t("chat.image.paintFirst")} aria-label={t("chat.image.zoneLabel")} />
          <button className="send" aria-label={t("chat.apply")} disabled={!has || !ask.trim() || busy} data-dim={!has || !ask.trim() || undefined}><Icon name="arrow-up" /></button>
        </div>
      </form>
    </div>
  );
}

/* ---------------- Share */
export function Share() {
  const [v, setV] = useVariant("settings");
  if (!isPreview()) return <LiveChatFeature feature="share" local={<Unavailable feature="share" />} />;
  return <ShareIn key={v} v={v} setV={setV} />;
}

function ShareIn({ v, setV }: { v: string; setV: (v: string) => void }) {
  const t = useT();
  const fx = useFx().share;
  const [open, setOpen] = React.useState(true);
  const [access, setAccess] = React.useState(v === "created" ? "link" : "private");
  const [copied, setCopied] = React.useState(false);
  const [named, setNamed] = React.useState(true);
  const copy = useCopy();
  const toast = useToast();
  const off = v === "disabled";
  const url: string = fx.url;
  const opts: [string, string, string, string][] = [
    ["private", "user", t("chat.share.private"), t("chat.share.privateSub")],
    ["link", "link", t("chat.share.link"), t("chat.share.linkSub")],
    ["team", "projects", fx.team, fx.teamSub],
  ];
  return (<>
    <div className="content-top"><span className="title">{fx.title}</span><div className="spacer" /><button className="btn secondary chat-run" onClick={() => setOpen(true)}><Icon name="share" size={16} />{t("chat.act.share")}</button></div>
    <div className="thread"><div className="thread-inner">
      <div className="msg-user">{fx.user}</div>
      <BotRow>{(fx.bot as string[]).map((p) => <p key={p}>{p}</p>)}</BotRow>
    </div></div>
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal><Dialog.Backdrop className="backdrop" /><Dialog.Popup className="dialog chat-share">
        <div className="chat-share-h"><Dialog.Title>{t("chat.share.title")}</Dialog.Title><Dialog.Close className="ibtn" aria-label={t("common.close")}><Icon name="close" /></Dialog.Close></div>
        <Dialog.Description>{v === "created" ? t("chat.share.createdDesc") : t("chat.share.desc", { title: fx.title })}</Dialog.Description>
        {off && <div className="banner warn chat-banner0" role="status"><Icon name="shield-check" /><span className="grow">{t("chat.share.disabledBanner", { org: fx.org })}</span></div>}
        <div className="chat-prev" aria-label={t("chat.share.preview")}>
          <div className="chat-prev-u">{fx.previewUser}</div>
          <div className="chat-prev-b"><span /><span /><span style={{ width: "60%" }} /></div>
          <div className="chat-prev-m"><span>{fx.title}</span><span className="chat-meta">{named ? `${fx.owner} · ` : ""}{t("chat.share.messages", { count: 12 })}</span></div>
        </div>
        {v === "created" ? <>
          <div className="field"><label htmlFor="chat-url">{t("chat.share.publicLink")}</label>
            <div className="chat-url"><input id="chat-url" className="input mono" readOnly value={"https://" + url} onFocus={(e) => e.currentTarget.select()} />
              <button className="btn primary" data-copied={copied || undefined} onClick={() => { copy("https://" + url, t("chat.share.linkCopied")); setCopied(true); setTimeout(() => setCopied(false), 1800); }}><span className="chat-swapic"><Icon name={copied ? "check" : "copy"} size={16} key={String(copied)} /></span>{copied ? t("chat.share.copied") : t("chat.act.copy")}</button></div>
          </div>
          <label className="chat-switch-row"><span className="chat-grow"><span className="ttl">{t("chat.share.showName")}</span><span className="sub">{t("chat.share.showNameSub")}</span></span><Switch checked={named} onCheckedChange={setNamed} aria-label={t("chat.share.showName")} /></label>
          <div className="chat-share-f"><button className="btn secondary pg-danger" onClick={() => { toast.add({ title: t("chat.share.linkDeleted"), description: t("chat.share.linkDeletedBody"), data: { icon: "trash" } }); setV("settings"); }}>{t("chat.share.deleteLink")}</button><div className="spacer" /><Dialog.Close className="btn secondary">{t("chat.share.done")}</Dialog.Close></div>
        </> : <>
          <RadioGroup value={access} onValueChange={(x) => setAccess(x as string)} className="chat-access" aria-label={t("chat.share.access")} disabled={off}>
            {opts.map(([id, ic, ttl, s]) => (
              <label key={id} className="chat-acc" data-off={(off && id !== "private") || undefined}>
                <span className="li-ic"><Icon name={ic} /></span><span className="chat-grow"><span className="ttl">{ttl}</span><span className="sub">{s}</span></span>
                <Radio.Root value={id} className="chat-radio" disabled={off && id !== "private"}><Radio.Indicator className="chat-radio-i" /></Radio.Root>
              </label>
            ))}
          </RadioGroup>
          <div className="chat-share-f"><span className="chat-meta">{off ? t("chat.share.askAdmin") : t("chat.share.noFiles")}</span><div className="spacer" />
            {off ? <button className="btn secondary" onClick={() => toast.add({ title: t("chat.share.requestSent"), description: fx.admin, data: { icon: "mail" } })}>{t("chat.share.requestAccess")}</button>
              : <button className="btn primary" disabled={access === "private"} onClick={() => setV("created")}><Icon name="link" size={16} />{t("chat.share.create")}</button>}
          </div>
        </>}
      </Dialog.Popup></Dialog.Portal>
    </Dialog.Root>
  </>);
}

/* ---------------- Temporary chat */
type Extra = { u: string; b?: string };
export function TempChat() {
  const [v] = useVariant("empty");
  if (!isPreview()) return <LiveChatFeature feature="temp-chat" local={<Unavailable feature="temp-chat" />} />;
  return <TempIn key={v} v={v} />;
}

function TempIn({ v }: { v: string }) {
  const t = useT();
  const fx = useFx().temp;
  const bot = useBotCfg();
  const { go } = useNav();
  const ghost: MascotConfig = { ...bot, color: COLORS.find((c) => c[0] === "slate")![1], glasses: "sunglasses" };
  const [msgs, setMsgs] = React.useState<Extra[]>(v === "active" ? [{ u: fx.q, b: fx.a }] : []);
  const send = (text: string) => { setMsgs((m) => [...m, { u: text }]); setTimeout(() => setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, b: fx.short } : x))), 1200); };
  const ph = t("chat.temp.placeholder");
  return (<>
    <div className="content-top"><span className="title">{t("chat.screen.temp-chat")}</span><span className="badge chat-ghost"><Icon name="clock-loop" size={12} />{t("chat.temp.notSaved")}</span><div className="spacer" /><button className="btn secondary chat-run" onClick={() => go("chat-states")}>{t("chat.temp.leave")}</button></div>
    <div className="banner info chat-banner" role="note"><Icon name="info" /><span>{t("chat.screen.temp-chat")}</span><span className="grow">{t("chat.temp.banner")}</span></div>
    {msgs.length === 0 ? (
      <div className="home">
        <div className="chat-hero"><Mascot cfg={ghost} state="idle" size={72} track interactive /></div>
        <h1>{t("chat.screen.temp-chat")}</h1>
        <p className="chat-lead">{t("chat.temp.lead")}</p>
        <Composer placeholder={ph} onSend={send} />
      </div>
    ) : (<>
      <div className="thread"><div className="thread-inner">
        {msgs.map((m, i) => <React.Fragment key={i}><div className="msg-user">{m.u}</div>
          {m.b ? <BotRow cfg={ghost}><p>{m.b}</p><Actions text={m.b} /></BotRow> : <BotRow cfg={ghost} st="thinking"><span className="thinking">{t("chat.thinking")}</span></BotRow>}</React.Fragment>)}
      </div></div>
      <div className="dock"><Composer placeholder={ph} onSend={send} /><span className="hint">{t("chat.temp.hint")}</span></div>
    </>)}
  </>);
}
