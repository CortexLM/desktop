// Media viewers: image, code, audio, video and archive, with the "Ask about this file" panel.
import * as React from "react";
import { useNav } from "../../shell/nav";
import { Icon, IconBtn, Pop, MItem, MSep, Tip, useToast } from "../../kit/ui";
import { Mascot, DEFAULT_MASCOT, type State } from "../../mascot/Mascot";
import { useVariant } from "../../registry";
import { useT } from "../../i18n";
import { useFmt, useFx, type MediaAsk, type MediaMeta, type Seg, type ZipNode, type FilesFx } from "./shared";

const ci = (i: number) => ({ ["--i" as string]: i }) as React.CSSProperties;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/* ---------- Shared pieces ---------- */
type Meta = MediaMeta & { icon: string };

function Head({ f, ask, setAsk }: { f: Meta; ask: boolean; setAsk: (b: boolean) => void }) {
  const t = useT();
  const toast = useToast();
  const { go } = useNav();
  return (
    <div className="content-top medias-top">
      <span className="medias-fic" aria-hidden><Icon name={f.icon} size={16} /></span>
      <span className="title"><span className="medias-name">{f.name}</span><span className="medias-meta">{f.size} · {f.type}</span></span>
      <div className="spacer" />
      <IconBtn icon="download" label={t("files.head.download")} onClick={() => toast.add({ title: t("files.toast.download"), description: f.name, data: { icon: "download" } })} />
      <IconBtn icon="share" label={t("files.head.share")} onClick={() => go("share")} />
      <button className="btn secondary" aria-pressed={ask} onClick={() => setAsk(!ask)}><Icon name="sparkle-free" size={16} />{t("files.head.ask")}</button>
      <Pop align="end" trigger={<IconBtn icon="more-horizontal" label={t("files.head.moreShort")} />}>
        <MItem icon="link" onClick={() => toast.add({ title: t("files.toast.linkCopied"), data: { icon: "check" } })}>{t("files.menu.copyLink")}</MItem>
        <MItem icon="folder-open">{t("files.menu.showInFolder")}</MItem>
        <MItem icon="history">{t("files.menu.previousVersions")}</MItem>
        <MItem icon="info">{t("files.menu.properties")}</MItem>
        <MSep />
        <MItem icon="trash" danger>{t("files.menu.delete")}</MItem>
      </Pop>
    </div>
  );
}

type Msg = { me?: boolean; t: string };
// Collapsible side panel: preview mini-chat about the file.
function Ask({ f, ask, onClose }: { f: Meta; ask: MediaAsk; onClose: () => void }) {
  const t = useT();
  const bot = { name: useFx().bot, ...DEFAULT_MASCOT };
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const end = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [msgs, busy]);
  const send = (s: string) => {
    if (!s.trim() || busy) return;
    setMsgs((m) => [...m, { me: true, t: s.trim() }]); setQ(""); setBusy(true);
    const a = ask.answers[msgs.filter((m) => m.me).length % ask.answers.length];
    setTimeout(() => { setMsgs((m) => [...m, { t: a }]); setBusy(false); }, 900);
  };
  const st: State = busy ? "thinking" : msgs.length ? "talking" : "idle";
  return (
    <aside className="medias-ask" aria-label={t("files.ask.title")}>
      <div className="medias-ask-head"><Mascot cfg={bot} state={st} size={20} /><span className="medias-grow medias-ell">{t("files.ask.title")}</span><IconBtn icon="sidebar-right" label={t("files.ask.collapse")} onClick={onClose} /></div>
      <div className="medias-ask-thread" aria-live="polite">
        {!msgs.length && <div className="msg-bot-row"><Mascot cfg={bot} state="idle" size={22} /><div className="msg-bot">{t("files.ask.mediaHello", { file: f.name })}</div></div>}
        {msgs.map((m, i) => m.me ? <div key={i} className="msg-user">{m.t}</div>
          : <div key={i} className="msg-bot-row"><Mascot cfg={bot} state={i === msgs.length - 1 ? "talking" : "idle"} size={22} /><div className="msg-bot">{m.t}</div></div>)}
        {busy && <div className="msg-bot-row"><Mascot cfg={bot} state="thinking" size={22} /><div className="msg-bot thinking">{t("files.ask.readingFile")}</div></div>}
        <div ref={end} />
      </div>
      {!msgs.length && <div className="medias-ask-sugg">{ask.sugg.map((s, i) => <button key={s} className="medias-sugg medias-rise" style={ci(i)} onClick={() => send(s)}><Icon name="sparkle-free" size={16} />{s}</button>)}</div>}
      <form className="medias-ask-form" onSubmit={(e) => { e.preventDefault(); send(q); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("files.ask.placeholderThis")} aria-label={t("files.ask.placeholderThis")} />
        <button className="medias-send" disabled={!q.trim() || busy} aria-label={t("files.ask.send")}><Icon name="arrow-up" size={16} /></button>
      </form>
      <div className="medias-hint">{t("files.ask.disclaimer")}</div>
    </aside>
  );
}

function Viewer({ f, ask, children }: { f: Meta; ask: MediaAsk; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Head f={f} ask={open} setAsk={setOpen} />
      <div className="medias-body">
        <div className="medias-stage">{children}</div>
        {open && <Ask f={f} ask={ask} onClose={() => setOpen(false)} />}
      </div>
    </>
  );
}

/* ---------- 1. Image ---------- */
const ZOOMS = [0.5, 0.75, 1, 1.5, 2, 3, 4];

// Zoomable, pannable image (drag, wheel, keyboard).
function ZoomView({ src, alt, initZ = 1 }: { src: string; alt: string; initZ?: number }) {
  const t = useT();
  const [z, setZ] = React.useState(initZ);
  const [p, setP] = React.useState(initZ > 1 ? { x: 120, y: 60 } : { x: 0, y: 0 });
  const [drag, setDrag] = React.useState(false);
  const start = React.useRef({ x: 0, y: 0, px: 0, py: 0 });
  const ref = React.useRef<HTMLDivElement>(null);
  const bound = (q: { x: number; y: number }, zz = z) => {
    const r = ref.current?.getBoundingClientRect(); if (!r || zz <= 1) return { x: 0, y: 0 };
    const mx = (r.width * (zz - 1)) / 2, my = (r.height * (zz - 1)) / 2;
    return { x: clamp(q.x, -mx, mx), y: clamp(q.y, -my, my) };
  };
  const zoom = (n: number) => { const zz = clamp(n, 0.5, 4); setZ(zz); setP((q) => bound(q, zz)); };
  const step = (d: 1 | -1) => zoom(d > 0 ? ZOOMS.find((x) => x > z + 0.01) ?? 4 : [...ZOOMS].reverse().find((x) => x < z - 0.01) ?? 0.5);
  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    const f = (e: WheelEvent) => { e.preventDefault(); setZ((zz) => { const n = clamp(zz * (e.deltaY < 0 ? 1.1 : 0.9), 0.5, 4); setP((q) => bound(q, n)); return n; }); };
    el.addEventListener("wheel", f, { passive: false }); return () => el.removeEventListener("wheel", f);
  });
  const r = ref.current?.getBoundingClientRect();
  const vw = 100 / Math.max(z, 1), vx = r ? 50 - vw / 2 - (p.x / (r.width * z)) * 100 : 50 - vw / 2, vy = r ? 50 - vw / 2 - (p.y / (r.height * z)) * 100 : 50 - vw / 2;
  return (
    <>
      <div className="medias-bar">
        <Tip label={t("files.zoom.out")} kbd="−"><button className="ibtn medias-zbtn" aria-label={t("files.zoom.out")} onClick={() => step(-1)} disabled={z <= 0.5}>−</button></Tip>
        <span className="medias-zoomv" aria-live="polite">{t("files.pct", { n: Math.round(z * 100) })}</span>
        <Tip label={t("files.zoom.in")} kbd="+"><button className="ibtn medias-zbtn" aria-label={t("files.zoom.in")} onClick={() => step(1)} disabled={z >= 4}>+</button></Tip>
        <button className="btn secondary" onClick={() => { setZ(1); setP({ x: 0, y: 0 }); }}>{t("files.image.fit")}</button>
        <button className="btn secondary" onClick={() => zoom(2)}>{t("files.pct", { n: 200 })}</button>
        <div className="medias-grow" />
        <span className="medias-meta">{z > 1 ? t("files.image.panHint") : t("files.image.zoomHint")}</span>
      </div>
      <div ref={ref} className="medias-view" tabIndex={0} role="img" aria-label={t("files.image.aria", { alt, pct: t("files.pct", { n: Math.round(z * 100) }) })} data-drag={drag || undefined}
        onPointerDown={(e) => { if (z <= 1) return; e.currentTarget.setPointerCapture(e.pointerId); start.current = { x: e.clientX, y: e.clientY, px: p.x, py: p.y }; setDrag(true); }}
        onPointerMove={(e) => { if (drag) setP(bound({ x: start.current.px + e.clientX - start.current.x, y: start.current.py + e.clientY - start.current.y })); }}
        onPointerUp={() => setDrag(false)} onPointerCancel={() => setDrag(false)}
        onDoubleClick={() => (z > 1 ? (setZ(1), setP({ x: 0, y: 0 })) : zoom(2))}
        onKeyDown={(e) => {
          if (e.key === "+" || e.key === "=") step(1); else if (e.key === "-") step(-1); else if (e.key === "0") { setZ(1); setP({ x: 0, y: 0 }); }
          else if (e.key.startsWith("Arrow")) { e.preventDefault(); const d = 40; setP((q) => bound({ x: q.x + (e.key === "ArrowLeft" ? d : e.key === "ArrowRight" ? -d : 0), y: q.y + (e.key === "ArrowUp" ? d : e.key === "ArrowDown" ? -d : 0) })); }
        }}>
        <img src={src} alt="" style={{ translate: `${p.x}px ${p.y}px`, scale: String(z) }} />
        {z > 1 && <div className="medias-mini" style={{ backgroundImage: `url(${src})` }} aria-hidden><i style={{ left: `${vx}%`, top: `${vy}%`, width: `${vw}%`, height: `${vw}%` }} /></div>}
      </div>
    </>
  );
}

export function ImageScreen() {
  const t = useT();
  const fx = useFx().image;
  const [v] = useVariant("view");
  return (
    <Viewer f={{ ...fx, icon: "image" }} ask={fx.ask}>
      {v === "compare" ? <Compare /> : (
        <div className="medias-imgrow">
          <div className="medias-col" style={{ gap: 12 }} key={v}><ZoomView src="/img/ceramique.png" alt={fx.alt} initZ={v === "zoom" ? 2.5 : 1} /></div>
          {v !== "zoom" && <div className="medias-card medias-exif medias-rise" aria-label={t("files.image.exif")}>
            {fx.exif.map(([h, rows]) => <React.Fragment key={h}><h3>{h}</h3>{rows.map(([k, val]) => <div key={k} className="medias-kv"><span>{k}</span><span>{val}</span></div>)}</React.Fragment>)}
          </div>}
        </div>
      )}
    </Viewer>
  );
}

// Before / after: draggable handle (pointer or arrows).
function Compare() {
  const t = useT();
  const [x, setX] = React.useState(50);
  const [drag, setDrag] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const at = (cx: number) => { const r = ref.current!.getBoundingClientRect(); setX(clamp(((cx - r.left) / r.width) * 100, 0, 100)); };
  const src = "/img/ceramique.png";
  return (
    <>
      <div className="medias-bar">
        <span className="medias-meta">{t("files.image.retouch", { pct: t("files.pct", { n: 25 }) })}</span>
        <div className="medias-grow" />
        <button className="btn secondary" onClick={() => setX(50)}>{t("files.image.recenter")}</button>
        <button className="btn primary">{t("files.image.apply")}</button>
      </div>
      <div ref={ref} className="medias-cmp" data-drag={drag || undefined} style={{ ["--x" as string]: `${x}%` }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag(true); at(e.clientX); }}
        onPointerMove={(e) => drag && at(e.clientX)} onPointerUp={() => setDrag(false)} onPointerCancel={() => setDrag(false)}>
        <div className="medias-after" style={{ backgroundImage: `url(${src})` }} />
        <div className="medias-before" style={{ backgroundImage: `url(${src})` }} />
        <span className="medias-tag" style={{ left: 12 }}>{t("files.image.before")}</span>
        <span className="medias-tag" style={{ right: 12 }}>{t("files.image.after")}</span>
        <div className="medias-handle">
          <button className="medias-knob" role="slider" aria-label={t("files.image.slider")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(x)} aria-valuetext={t("files.image.sliderValue", { pct: t("files.pct", { n: Math.round(x) }) })}
            onKeyDown={(e) => { const d = e.shiftKey ? 10 : 2; if (e.key === "ArrowLeft") setX((v) => clamp(v - d, 0, 100)); if (e.key === "ArrowRight") setX((v) => clamp(v + d, 0, 100)); if (e.key === "Home") setX(0); if (e.key === "End") setX(100); }}>
            <Icon name="chevron-up-down" size={16} style={{ rotate: "90deg" }} />
          </button>
        </div>
      </div>
    </>
  );
}

/* ---------- 2. Code ---------- */
const KW = /\b(import|export|from|const|let|function|return|type|if|as|number|string)\b/;
// Simple highlighting: comments, strings, keywords, numbers.
function hl(line: string): React.ReactNode {
  const c = line.indexOf("//");
  if (c !== -1 && !line.slice(0, c).includes('"')) return <>{hl(line.slice(0, c))}<span className="medias-c">{line.slice(c)}</span></>;
  return line.split(/("[^"]*"|\b\d+(?:\.\d+)?\b|\b[a-z]+\b)/g).map((s, i) =>
    s.startsWith('"') ? <span key={i} className="medias-s">{s}</span>
      : /^\d/.test(s) ? <span key={i} className="medias-n">{s}</span>
      : KW.test(s) && s.match(KW)![0] === s ? <span key={i} className="medias-k">{s}</span> : s);
}

export function CodeScreen() {
  const t = useT();
  const fx = useFx().code;
  const [v] = useVariant("view");
  const [sel, setSel] = React.useState<number | null>(null);
  const [scroll, setScroll] = React.useState({ top: 0, h: 1 });
  const box = React.useRef<HTMLDivElement>(null);
  const diff = v === "diff";
  const rows: [string, string][] = diff ? fx.diff : fx.src.split("\n").map((l) => [" ", l]);
  const onScroll = () => { const el = box.current!; setScroll({ top: el.scrollTop / el.scrollHeight, h: el.clientHeight / el.scrollHeight }); };
  React.useEffect(onScroll, [v]);
  const add = fx.diff.filter((d) => d[0] === "+").length, del = fx.diff.filter((d) => d[0] === "-").length;
  let ln = diff ? 20 : 0;
  return (
    <Viewer f={{ ...fx, icon: "file-code" }} ask={fx.ask}>
      <div className="medias-bar" key={v}>
        {diff ? <><span className="badge ok">+{add}</span><span className="badge err">−{del}</span><span className="medias-meta">{fx.diffMeta}</span></>
          : <span className="medias-meta">{t("files.code.meta", { count: rows.length })}</span>}
        <div className="medias-grow" />
        <IconBtn icon="copy" label={t("files.code.copy")} />
        <IconBtn icon="diff" label={diff ? t("files.code.showFile") : t("files.code.compare")} />
      </div>
      <div className="medias-code medias-rise">
        <div ref={box} className="medias-lines" onScroll={onScroll} role="region" aria-label={t("files.code.contents", { name: fx.name })} tabIndex={0}>
          {rows.map(([d, l], i) => {
            if (d !== "-") ln++;
            return <div key={i} className="medias-ln" data-d={d === " " ? undefined : d} data-sel={sel === i || undefined} onClick={() => setSel(i)}>
              <b>{d === "-" ? "" : ln}</b>{diff && <em>{d.trim()}</em>}<span>{hl(l) || " "}</span>
            </div>;
          })}
        </div>
        <div className="medias-minimap" aria-hidden onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const el = box.current!; el.scrollTo({ top: ((e.clientY - r.top) / r.height) * el.scrollHeight - el.clientHeight / 2, behavior: "smooth" }); }}>
          {rows.map(([d, l], i) => <i key={i} data-d={d === " " ? undefined : d} style={{ width: `${Math.min(100, Math.max(4, l.length * 1.1))}%`, marginLeft: `${(l.length - l.trimStart().length) * 1.5}px` }} />)}
          <span className="medias-thumb" style={{ top: `calc(10px + ${scroll.top * 100}%)`, height: `${Math.min(100, scroll.h * 100)}%` }} />
        </div>
      </div>
    </Viewer>
  );
}

/* ---------- 3. Audio ---------- */
// Simulated playback: position in seconds, advances while `on`.
function usePlayer(dur: number, from = 0, run = false) {
  const [t, setT] = React.useState(from);
  const [on, setOn] = React.useState(run);
  React.useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setT((x) => { if (x + 0.25 >= dur) { setOn(false); return dur; } return x + 0.25; }), 250);
    return () => clearInterval(id);
  }, [on, dur]);
  return { t, on, seek: (s: number) => setT(clamp(s, 0, dur)), toggle: () => { if (t >= dur) setT(0); setOn((o) => !o); }, play: () => setOn(true) };
}

const AUDIO_DUR = 24 * 60 + 12;
// Deterministic waveform.
const WAVE = Array.from({ length: 140 }, (_, i) => 0.18 + 0.82 * Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.11) * 0.8 + Math.sin(i * 1.7) * 0.2));

function Who({ spk }: { spk: [string, string, string] }) {
  const [n, m, c] = spk;
  return <span className="medias-who"><span className="medias-av" data-c={c} aria-hidden>{m[0]}</span>{n}</span>;
}

function Wave({ t: pos, dur, onSeek }: { t: number; dur: number; onSeek: (s: number) => void }) {
  const t = useT();
  const pct = pos / dur;
  return (
    <div className="medias-wave" role="slider" tabIndex={0} aria-label={t("files.player.position")} aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(pos)} aria-valuetext={mmss(pos)}
      onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onSeek(((e.clientX - r.left) / r.width) * dur); }}
      onKeyDown={(e) => { if (e.key === "ArrowRight") onSeek(pos + 5); if (e.key === "ArrowLeft") onSeek(pos - 5); }}>
      {WAVE.map((h, i) => <i key={i} data-on={i / WAVE.length < pct || undefined} style={{ height: `${h * 100}%` }} />)}
      <span className="medias-playhead" style={{ left: `${pct * 100}%` }} />
    </div>
  );
}

export function AudioScreen() {
  const t = useT();
  const fx = useFx().audio;
  const SEGS = fx.segs, SPK = fx.speakers;
  const [v] = useVariant("playing");
  const live = v === "transcribing";
  const p = usePlayer(AUDIO_DUR, live ? 0 : 168, false);
  const [done, setDone] = React.useState(live ? 4 : SEGS.length);
  React.useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setDone((d) => Math.min(SEGS.length, d + 1)), 1800);
    return () => clearInterval(id);
  }, [live, SEGS.length]);
  const cur = SEGS.reduce((a, s, i) => (s.t <= p.t ? i : a), 0);
  return (
    <Viewer f={{ ...fx, icon: "voice-wave" }} ask={fx.ask}>
      <div className="medias-card medias-player medias-rise" key={v}>
        <Wave t={p.t} dur={AUDIO_DUR} onSeek={p.seek} />
        <div className="medias-ctl">
          <button className="medias-play" aria-label={p.on ? t("files.player.pause") : t("files.player.play")} onClick={p.toggle}><Icon name={p.on ? "pause" : "play"} size={16} /></button>
          <IconBtn icon="arrow-left" label={t("files.player.back15")} onClick={() => p.seek(p.t - 15)} />
          <IconBtn icon="arrow-right" label={t("files.player.fwd15")} onClick={() => p.seek(p.t + 15)} />
          <span className="medias-time">{mmss(p.t)} / {mmss(AUDIO_DUR)}</span>
          <div className="medias-grow" />
          <span className="medias-meta">{t("files.audio.speakers", { count: SPK.length, lang: fx.lang })}</span>
        </div>
      </div>
      <div className="medias-card medias-col medias-rise" style={ci(1)}>
        <div className="medias-colhead">
          <span className="medias-grow">{t("files.player.transcript")}</span>
          {live && done < SEGS.length ? <span className="badge run"><span className="spin" />{t("files.audio.transcribing", { pct: t("files.pct", { n: Math.round((done / SEGS.length) * 100) }) })}</span> : <span className="badge ok">{t("files.audio.done")}</span>}
          <IconBtn icon="copy" label={t("files.player.copyTranscript")} />
        </div>
        <div className="medias-trs">
          {SEGS.map((s, i) => i < done ? (
            <button key={i} className="medias-seg medias-rise" data-on={(i === cur && p.t > 0) || undefined} onClick={() => { p.seek(s.t); p.play(); }} aria-label={t("files.player.playAt", { time: mmss(s.t), who: SPK[s.who][0] })}>
              <span className="medias-ts">{mmss(s.t)}</span><span><Who spk={SPK[s.who]} /><p>{s.text}</p></span>
            </button>
          ) : i === done && live ? (
            <div key={i} className="medias-seg" data-pending><span className="medias-ts">{mmss(s.t)}</span><span><span className="skel line" style={{ width: 120 }} /><p className="thinking">{t("files.audio.pending")}</p></span></div>
          ) : null)}
        </div>
      </div>
    </Viewer>
  );
}

/* ---------- 4. Video ---------- */
const VID_DUR = 400;

export function VideoScreen() {
  const t = useT();
  const fx = useFx();
  const V = fx.video, CHAPS = V.chapters, VSEGS: Seg[] = V.segs, SPK = fx.audio.speakers;
  const [v] = useVariant("playing");
  const pause = v === "paused";
  const p = usePlayer(VID_DUR, pause ? 151 : 74, !pause);
  const ch = CHAPS.reduce((a, c, i) => (c.t <= p.t ? i : a), 0);
  const cur = VSEGS.reduce((a, s, i) => (s.t <= p.t ? i : a), -1);
  const jump = (s: number) => { p.seek(s); p.play(); };
  return (
    <Viewer f={{ ...V, icon: "play" }} ask={V.ask}>
      <div className="medias-video medias-rise" key={v}>
        {CHAPS.map((c, i) => <div key={c.img} className="medias-scene" style={{ backgroundImage: `url(/img/${c.img}.png)`, opacity: i === ch ? 1 : 0, scale: p.on && i === ch ? "1.04" : "1" }} aria-hidden />)}
        {!p.on && <button className="medias-bigplay" aria-label={t("files.player.play")} onClick={p.toggle}><Icon name="play" size={16} /></button>}
        <div className="medias-vctl">
          <button className="medias-play" aria-label={p.on ? t("files.player.pause") : t("files.player.play")} onClick={p.toggle}><Icon name={p.on ? "pause" : "play"} size={16} /></button>
          <span className="medias-time">{mmss(p.t)}</span>
          <div className="medias-track" role="slider" tabIndex={0} aria-label={t("files.player.position")} aria-valuemin={0} aria-valuemax={VID_DUR} aria-valuenow={Math.round(p.t)} aria-valuetext={`${mmss(p.t)}, ${CHAPS[ch].title}`}
            onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); p.seek(((e.clientX - r.left) / r.width) * VID_DUR); }}
            onKeyDown={(e) => { if (e.key === "ArrowRight") p.seek(p.t + 5); if (e.key === "ArrowLeft") p.seek(p.t - 5); }}>
            <span className="medias-fill" style={{ width: `${(p.t / VID_DUR) * 100}%` }} />
            {CHAPS.slice(1).map((c) => <span key={c.t} className="medias-mark" style={{ left: `${(c.t / VID_DUR) * 100}%` }} />)}
          </div>
          <span className="medias-time">{mmss(VID_DUR)}</span>
          <span className="medias-meta medias-ell" style={{ maxWidth: 200 }}>{CHAPS[ch].title}</span>
          <IconBtn icon="voice-wave" label={t("files.video.subtitles")} />
          <IconBtn icon="expand" label={t("files.video.fullscreen")} />
        </div>
      </div>
      <div className="medias-row2">
        {pause && <div className="medias-card medias-col medias-rise" style={ci(1)}>
          <div className="medias-colhead"><span className="medias-grow">{t("files.video.chapters")}</span><span className="medias-meta">{t("files.video.chaptersMeta", { count: CHAPS.length })}</span></div>
          <div className="medias-chaps">
            {CHAPS.map((c, i) => <button key={c.t} className="medias-chap" data-on={i === ch || undefined} onClick={() => jump(c.t)}>
              <span style={{ backgroundImage: `url(/img/${c.img}.png)` }} aria-hidden /><span className="ttl">{c.title}</span><span className="medias-meta">{mmss(c.t)}</span>
            </button>)}
          </div>
        </div>}
        <div className="medias-card medias-col medias-rise" style={ci(2)}>
          <div className="medias-colhead"><span className="medias-grow">{t("files.player.transcript")}</span><IconBtn icon="copy" label={t("files.player.copyTranscript")} /></div>
          <div className="medias-trs">
            {VSEGS.map((s, i) => <button key={i} className="medias-seg" data-on={i === cur || undefined} onClick={() => jump(s.t)} aria-label={t("files.player.playAt", { time: mmss(s.t), who: SPK[s.who][0] })}>
              <span className="medias-ts">{mmss(s.t)}</span><span><Who spk={SPK[s.who]} /><p>{s.text}</p></span>
            </button>)}
          </div>
        </div>
      </div>
    </Viewer>
  );
}

/* ---------- 5. Archive ---------- */
const sizeOf = (n: ZipNode): number => n.kb ?? (n.kids ?? []).reduce((s, k) => s + sizeOf(k), 0);
const countOf = (n: ZipNode): number => n.kids ? n.kids.reduce((s, k) => s + countOf(k), 0) : 1;
const ico = (n: string) => /\.(png|raf|svg)$/.test(n) ? "image" : /\.(md|txt|csv)$/.test(n) ? "file-code" : "file";

function useKb() {
  const t = useT();
  const { num } = useFmt();
  return (kb: number) => kb >= 1024 ? t("files.size.mb", { n: num(kb / 1024, 1) }) : t("files.size.kb", { n: kb });
}

function Tree({ nodes, depth, open, toggle, sel, pick, total, path = "" }: { nodes: ZipNode[]; depth: number; open: Set<string>; toggle: (p: string) => void; sel: string; pick: (p: string, n: ZipNode) => void; total: number; path?: string }) {
  const fmt = useKb();
  return <>{nodes.map((n) => {
    const p = path + "/" + n.name, isOpen = open.has(p), sz = sizeOf(n);
    return <React.Fragment key={p}>
      <button className="medias-node" style={{ paddingLeft: 8 + depth * 18 }} aria-expanded={n.kids ? isOpen : undefined} data-sel={sel === p || undefined}
        onClick={() => (n.kids ? toggle(p) : pick(p, n))}>
        {n.kids ? <Icon name="chevron-right" size={16} className="medias-chev" /> : <span style={{ width: 16, flexShrink: 0 }} />}
        <Icon name={n.kids ? (isOpen ? "folder-open" : "folder") : ico(n.name)} size={16} />
        <span className="medias-grow medias-ell">{n.name}</span>
        {n.kids && <span className="medias-meta">{countOf(n)}</span>}
        <span className="medias-size" aria-hidden><i style={{ width: `${Math.max(4, (sz / total) * 100 * 2)}%` }} /></span>
        <span className="medias-meta" style={{ width: 52, textAlign: "right" }}>{fmt(sz)}</span>
      </button>
      {n.kids && isOpen && <Tree nodes={n.kids} depth={depth + 1} open={open} toggle={toggle} sel={sel} pick={pick} total={total} path={p} />}
    </React.Fragment>;
  })}</>;
}

export function ZipScreen() {
  const t = useT();
  const Z: FilesFx["zip"] = useFx().zip;
  const TREE = Z.tree;
  const fmt = useKb();
  const [v] = useVariant("tree");
  const ex = v === "extracting";
  const toast = useToast();
  const [open, setOpen] = React.useState(() => new Set([`/${TREE[1].name}`, `/${TREE[3].name}`]));
  const [sel, setSel] = React.useState<[string, ZipNode]>([`/${TREE[3].name}/${TREE[3].kids![1].name}`, TREE[3].kids![1]]);
  const [pct, setPct] = React.useState(ex ? 38 : 0);
  React.useEffect(() => {
    if (!ex) return;
    const id = setInterval(() => setPct((x) => Math.min(100, x + 3)), 400);
    return () => clearInterval(id);
  }, [ex]);
  const total = TREE.reduce((s, n) => s + sizeOf(n), 0);
  const files = TREE.reduce((s, n) => s + countOf(n), 0);
  React.useEffect(() => { if (ex && pct >= 100) toast.add({ title: t("files.zip.extracted"), description: t("files.zip.extractedTo", { count: files, path: Z.extractedTo }), data: { icon: "check" } }); }, [ex, pct >= 100]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (p: string) => setOpen((s) => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n; });
  const all = (nodes: ZipNode[], path = ""): string[] => nodes.flatMap((n) => n.kids ? [path + "/" + n.name, ...all(n.kids, path + "/" + n.name)] : []);
  const [, node] = sel;
  return (
    <Viewer f={{ ...Z, icon: "archive" }} ask={Z.ask}>
      <div className="medias-bar">
        <span className="medias-meta">{t("files.zip.meta", { count: files, raw: fmt(total), packed: Z.size })}</span>
        <div className="medias-grow" />
        <button className="btn secondary" onClick={() => setOpen(new Set(open.size ? [] : all(TREE)))}>{open.size ? t("files.zip.collapseAll") : t("files.zip.expandAll")}</button>
        <button className="btn primary" disabled={ex && pct < 100}><Icon name="download" size={16} />{t("files.zip.extractAll")}</button>
      </div>
      {ex && <div className="medias-card medias-extract medias-rise" role="status">
        <div className="medias-ctl"><span className="medias-grow">{pct < 100 ? t("files.zip.extracting", { n: Math.round((pct / 100) * files), total: files }) : t("files.zip.extractDone")}</span><span className="medias-time">{t("files.pct", { n: pct })}</span>
          {pct < 100 ? <button className="btn secondary" style={{ height: 28 }}>{t("files.cancel")}</button> : <button className="btn secondary" style={{ height: 28 }}><Icon name="folder-open" size={16} />{t("files.zip.openFolder")}</button>}</div>
        <div className="medias-prog" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("files.zip.extraction")}><div style={{ width: `${pct}%` }} /></div>
        <span className="medias-meta medias-ell">{pct < 100 ? t("files.zip.progressLine", { file: `${Z.extractingFile}${21 + (pct % 10)}.raf`, done: fmt(Math.round(total * pct / 100)), total: fmt(total) }) : Z.extractedTo}</span>
      </div>}
      <div className="medias-row2">
        <div className="medias-card medias-tree medias-rise" style={ci(1)}>
          <div className="medias-colhead"><Icon name="archive" size={16} /><span className="medias-grow medias-ell">{Z.name}</span></div>
          <div className="medias-tree-list" role="group" aria-label={t("files.zip.contents")}><Tree nodes={TREE} depth={0} open={open} toggle={toggle} sel={sel[0]} pick={(p, n) => setSel([p, n])} total={total} /></div>
          <div className="medias-sum"><div><span className="medias-meta">{t("files.zip.files")}</span><b>{files}</b></div><div><span className="medias-meta">{t("files.zip.uncompressed")}</span><b>{fmt(total)}</b></div><div><span className="medias-meta">{t("files.zip.compression")}</span><b>{t("files.pct", { n: Math.round((1 - 31.8 * 1024 / total) * 100) })}</b></div></div>
        </div>
        <div className="medias-card medias-preview medias-rise" style={ci(2)} key={sel[0]}>
          <div className="medias-colhead"><Icon name={ico(node.name)} size={16} /><span className="medias-grow medias-ell">{node.name}</span><span className="medias-meta">{fmt(node.kb ?? 0)}</span><IconBtn icon="download" label={t("files.zip.extractOne", { name: node.name })} /></div>
          {node.text ? <pre>{node.text}</pre> : node.img ? <div className="medias-pimg" role="img" aria-label={node.name} style={{ backgroundImage: `url(/img/${node.img}.png)` }} />
            : <div className="empty"><h2>{t("files.zip.noPreview")}</h2><p>{t("files.zip.noPreviewBody")}</p></div>}
        </div>
      </div>
    </Viewer>
  );
}
