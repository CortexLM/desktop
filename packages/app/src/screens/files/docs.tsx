// Document viewers (PDF, slides, document, spreadsheet) and the upload screen.
import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { Progress } from "@base-ui/react/progress";
import { useNav } from "../../shell/nav";
import { Icon, IconBtn, Tip, Pop, MItem, MSep, useToast } from "../../kit/ui";
import { Mascot, DEFAULT_MASCOT, type MascotConfig } from "../../mascot/Mascot";
import { useVariant } from "../../registry";
import { useT } from "../../i18n";
import { isPreview } from "../../preview";
import { api } from "../../api";
import { useBots } from "../../state/live";
import { answerOf, useFmt, useFx, type AskFx, type Msg, type PPage, type Slide, type Cmt, type Sheet, type Cell } from "./shared";

const css = (o: Record<string, string | number>) => o as React.CSSProperties;

/* ---------------------------------------------------------------- shared */
type Kind = "pdf" | "pptx" | "docx" | "xlsx";

/** Mascot of the preview bot (fixtures) or of the first live bot. */
function useBotCfg(): MascotConfig {
  const t = useT();
  const fx = useFx();
  const bots = useBots();
  const b = !isPreview() && bots.state === "ready" ? bots.data[0] : undefined;
  return b ? { name: b.name, ...(b.mascot as Omit<MascotConfig, "name">) } : { name: isPreview() ? fx.bot : t("files.brand"), ...DEFAULT_MASCOT };
}

function FileHead({ kind, name, meta, side, onSide, extra }: { kind: Kind; name: string; meta: string; side: boolean; onSide: () => void; extra?: React.ReactNode }) {
  const t = useT();
  const toast = useToast();
  const { go } = useNav();
  return (
    <div className="content-top fichiers-top">
      <span className="fichiers-ftype" data-k={kind} aria-hidden>{kind.toUpperCase().slice(0, 3)}</span>
      <span className="fichiers-fname fichiers-grow"><span className="ttl fichiers-ell">{name}</span><span className="fichiers-meta">{meta}</span></span>
      {extra}
      <IconBtn icon="download" label={t("files.head.download")} onClick={() => toast.add({ title: t("files.toast.download"), description: name, data: { icon: "download" } })} />
      <IconBtn icon="share" label={t("files.head.share")} onClick={() => go("share")} />
      <button className={"btn secondary fichiers-ask"} data-on={side || undefined} aria-pressed={side} onClick={onSide}><Icon name="sparkle-free" />{t("files.head.ask")}</button>
      <Pop align="end" trigger={<button className="ibtn" aria-label={t("files.head.more")}><Icon name="more-dots" /></button>}>
        <MItem icon="edit">{t("files.menu.rename")}</MItem><MItem icon="folder">{t("files.menu.move")}</MItem><MItem icon="history">{t("files.menu.versions")}</MItem><MItem icon="link">{t("files.menu.copyLink")}</MItem><MSep />
        <MItem icon="trash" danger onClick={() => toast.add({ title: t("files.toast.deleted"), description: name, data: { icon: "trash", undo: true } })}>{t("files.menu.delete")}</MItem>
      </Pop>
    </div>
  );
}

// "Ask about this file" panel: preview mini-chat with the bot.
function AskPanel({ file, ask, seed, onClose }: { file: string; ask: AskFx; seed?: Msg[]; onClose: () => void }) {
  const t = useT();
  const bot = useBotCfg();
  const [msgs, setMsgs] = React.useState<Msg[]>(seed ?? []);
  const [q, setQ] = React.useState("");
  const end = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { setMsgs(seed ?? []); }, [seed]);
  React.useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [msgs]);
  const send = (s: string) => {
    if (!s.trim()) return;
    setMsgs((m) => [...m, { u: s }, { st: "thinking" }]);
    setQ("");
    setTimeout(() => setMsgs((m) => [...m.slice(0, -1), { b: answerOf(ask)(s), st: "talking" }]), 1100);
  };
  return (
    <aside className="fichiers-side" aria-label={t("files.ask.title")}>
      <div className="fichiers-side-in">
        <div className="fichiers-side-h"><Mascot cfg={bot} state="idle" size={20} /><span className="fichiers-grow fichiers-ell">{t("files.ask.title")}</span><IconBtn icon="close" label={t("files.ask.close")} onClick={onClose} /></div>
        <div className="fichiers-side-t">
          {msgs.length === 0 && <div className="fichiers-hello fichiers-rise"><Mascot cfg={bot} state="listening" size={44} /><b>{t("files.ask.hello", { bot: bot.name, file })}</b><span>{t("files.ask.helloSub")}</span></div>}
          {msgs.map((m, i) => m.u ? <div key={i} className="msg-user">{m.u}</div>
            : <div key={i} className="msg-bot-row"><Mascot cfg={bot} state={m.st ?? "idle"} size={20} /><div className="msg-bot fichiers-grow">{m.b ? m.b.split("\n").map((p, j) => <p key={j}>{p}</p>) : <span className="thinking">{t("files.ask.reading", { bot: bot.name })}</span>}</div></div>)}
          {msgs.length === 0 && <div className="fichiers-sugg">{ask.sugg.map((s, i) => <button key={s} className="fichiers-rise" style={css({ "--i": i })} onClick={() => send(s)}><Icon name="sparkle-free" />{s}</button>)}</div>}
          <div ref={end} />
        </div>
        <div className="fichiers-side-c">
          <form onSubmit={(e) => { e.preventDefault(); send(q); }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("files.ask.placeholder")} aria-label={t("files.ask.placeholder")} />
            <button className="fichiers-send" type="submit" aria-label={t("files.ask.send")} disabled={!q.trim()}><Icon name="arrow-up" /></button>
          </form>
        </div>
      </div>
    </aside>
  );
}

function Viewer({ kind, name, meta, tools, children, ask, seed, sideOpen = false, extra }: {
  kind: Kind; name: string; meta: string; tools?: React.ReactNode; children: React.ReactNode; ask: AskFx; seed?: Msg[]; sideOpen?: boolean; extra?: React.ReactNode;
}) {
  const t = useT();
  const [side, setSide] = React.useState(sideOpen);
  React.useEffect(() => setSide(sideOpen), [sideOpen]);
  return (
    <div className="fichiers-root">
      <FileHead kind={kind} name={name} meta={meta} side={side} onSide={() => setSide((s) => !s)} extra={extra} />
      {tools && <div className="fichiers-tools" role="toolbar" aria-label={t("files.tools")}>{tools}</div>}
      <div className="fichiers-body" data-side={side || undefined}>
        <div className="fichiers-main">{children}</div>
        <div inert={!side || undefined} style={{ display: "contents" }}><AskPanel file={name} ask={ask} seed={seed} onClose={() => setSide(false)} /></div>
      </div>
    </div>
  );
}

// ← → on the keyboard (outside text fields).
function useArrows(prev: () => void, next: () => void) {
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable || e.metaKey || e.ctrlKey) return;
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); }
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); next(); }
    };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  });
}

/* ================================================================ 1. PDF */
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const countIn = (s: string, q: string) => (q ? norm(s).split(norm(q)).length - 1 : 0);
const pageText = (p: PPage) => [p.h, ...p.p].join(" ");

// Highlights q in s; `cur` = global rank of the active hit, `base` = rank of this block's first hit.
function Hl({ s, q, base, cur }: { s: string; q: string; base: number; cur: number }) {
  if (!q) return <>{s}</>;
  const n = norm(s), k = norm(q), out: React.ReactNode[] = [];
  let i = 0, j = 0;
  for (let at = n.indexOf(k); at >= 0; at = n.indexOf(k, at + k.length)) {
    out.push(s.slice(i, at));
    out.push(<mark key={at} data-cur={base + j === cur || undefined}>{s.slice(at, at + k.length)}</mark>);
    i = at + k.length; j++;
  }
  out.push(s.slice(i));
  return <>{out}</>;
}

const ZOOMS = [0.75, 1, 1.25, 1.5];

function Zoom({ z, setZ, fit }: { z: number; setZ: (z: number) => void; fit: () => void }) {
  const t = useT();
  const i = ZOOMS.indexOf(z);
  return (<>
    <Tip label={t("files.zoom.out")} kbd="⌘−"><button className="ibtn fichiers-glyph" aria-label={t("files.zoom.out")} disabled={i === 0} onClick={() => setZ(ZOOMS[Math.max(0, i - 1)])}>−</button></Tip>
    <button className="fichiers-zoom" aria-label={t("files.zoom.fit")} onClick={fit}>{t("files.pct", { n: Math.round(z * 100) })}</button>
    <Tip label={t("files.zoom.in")} kbd="⌘+"><button className="ibtn fichiers-glyph" aria-label={t("files.zoom.in")} disabled={i === ZOOMS.length - 1} onClick={() => setZ(ZOOMS[Math.min(ZOOMS.length - 1, i + 1)])}>+</button></Tip>
    <IconBtn icon="expand" label={t("files.zoom.fit")} onClick={fit} />
  </>);
}

function PageNum({ n, total, set, unit = "page" }: { n: number; total: number; set: (n: number) => void; unit?: "page" | "slide" }) {
  const t = useT();
  const [v, setV] = React.useState(String(n + 1));
  React.useEffect(() => setV(String(n + 1)), [n]);
  const commit = () => { const x = parseInt(v, 10); if (x >= 1 && x <= total) set(x - 1); else setV(String(n + 1)); };
  return (<span className="fichiers-pnum">
    <IconBtn icon="arrow-left" label={t(`files.${unit}.prev`)} kbd="←" disabled={n === 0} onClick={() => set(n - 1)} />
    <input value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, ""))} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} aria-label={t(`files.${unit}.number`)} inputMode="numeric" />
    <span>{t("files.page.of", { total })}</span>
    <IconBtn icon="arrow-right" label={t(`files.${unit}.next`)} kbd="→" disabled={n === total - 1} onClick={() => set(n + 1)} />
  </span>);
}

function PdfState({ v, onRetry }: { v: string; onRetry: () => void }) {
  const t = useT();
  const fx = useFx();
  const [pw, setPw] = React.useState(""), [bad, setBad] = React.useState(0);
  if (v === "loading") return (
    <div className="fichiers-scroll" aria-busy="true" aria-label={t("files.pdf.loading")}>
      <div className="fichiers-page" style={{ display: "grid", gap: 12 }}>
        <span className="skel title" style={{ width: "55%" }} /><span className="skel line" style={{ width: "35%" }} /><span style={{ height: 16 }} />
        {[92, 100, 86, 97, 60, 0, 100, 94, 72].map((w, i) => w ? <span key={i} className="skel line" style={{ width: w + "%" }} /> : <span key={i} style={{ height: 8 }} />)}
        <span className="skel" style={{ height: 140, marginTop: 8 }} />
      </div>
    </div>);
  if (v === "protected") return (
    <div className="fichiers-state">
      <span className="fichiers-badge"><Icon name="key" /></span>
      <h2>{t("files.pdf.protected.title")}</h2>
      <p>{fx.pdf.protectedBody}</p>
      <form className={"fichiers-pw" + (bad ? " fichiers-shake" : "")} key={bad} onSubmit={(e) => { e.preventDefault(); setBad((b) => b + 1); }}>
        <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={t("files.pdf.protected.placeholder")} aria-label={t("files.pdf.protected.aria")} aria-invalid={bad > 0} aria-describedby="fichiers-pw-err" autoFocus />
        <button className="btn primary" type="submit" disabled={!pw}>{t("files.pdf.protected.open")}</button>
      </form>
      <span className="fichiers-pw-err" id="fichiers-pw-err" role="alert">{bad ? t("files.pdf.protected.wrong") : ""}</span>
    </div>);
  return (
    <div className="fichiers-state">
      <span className="fichiers-badge"><Icon name="alert-triangle" /></span>
      <h2>{t("files.pdf.corrupt.title")}</h2>
      <p>{t("files.pdf.corrupt.body")}</p>
      <div style={{ display: "flex", gap: 8 }}><button className="btn secondary" onClick={onRetry}><Icon name="refresh" />{t("files.retry")}</button><button className="btn secondary"><Icon name="download" />{t("files.pdf.corrupt.original")}</button></div>
      <span className="fichiers-meta mono">{t("files.pdf.corrupt.code")}</span>
    </div>);
}

export function FilePdf() {
  const t = useT();
  const fx = useFx().pdf;
  const PDF = fx.pages, SEL = fx.selection;
  const [v, setV] = useVariant("reading");
  const toast = useToast();
  const init = (x: string) => ({ page: x === "selection" || x === "search" ? 1 : 0, q: x === "search" ? fx.search : "", sel: x === "selection", seed: x === "summary" ? fx.summary : undefined, side: x === "summary" });
  const [page, setPage] = React.useState(init(v).page);
  const [z, setZ] = React.useState(1);
  const [q, setQ] = React.useState(init(v).q);
  const [cur, setCur] = React.useState(0);
  const [sel, setSel] = React.useState(init(v).sel);
  const [notes, setNotes] = React.useState(true);
  const [seed, setSeed] = React.useState<Msg[] | undefined>(init(v).seed);
  const [side, setSide] = React.useState(init(v).side);
  const scroll = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { const s = init(v); setPage(s.page); setQ(s.q); setCur(0); setSel(s.sel); setSeed(s.seed); setSide(s.side); setZ(1); }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (n: number) => { setPage(Math.max(0, Math.min(PDF.length - 1, n))); setSel(false); scroll.current?.scrollTo({ top: 0 }); };
  const blocked = ["loading", "protected", "corrupt"].includes(v);
  useArrows(() => !blocked && go(page - 1), () => !blocked && go(page + 1));

  const hits = PDF.map((pp) => countIn(pageText(pp), q));
  const total = hits.reduce((a, b) => a + b, 0);
  const jump = (d: number) => {
    if (!total) return;
    const c = (cur + d + total) % total; setCur(c);
    let acc = 0; for (let i = 0; i < hits.length; i++) { if (c < acc + hits[i]) { if (i !== page) go(i); break; } acc += hits[i]; }
  };
  const act = (what: "explain" | "summarize" | "quote") => {
    setSel(false); setSide(true);
    setSeed([{ u: t("files.pdf.actPrompt", { action: t(`files.pdf.act.${what}`), text: SEL }) }, { st: "talking", b: fx.act[what] }]);
  };
  const p = PDF[page];
  // Global rank of each block's first hit (title, then paragraphs) on the shown page.
  const blocks = [p.h, ...p.p];
  const offs: number[] = [hits.slice(0, page).reduce((x, y) => x + y, 0)];
  blocks.forEach((s) => offs.push(offs[offs.length - 1] + countIn(s, q)));
  const tools = (<>
    <Zoom z={z} setZ={setZ} fit={() => setZ(1.25)} />
    <span className="fichiers-sep" />
    <PageNum n={page} total={PDF.length} set={go} />
    <span className="fichiers-sep" />
    <Tip label={t("files.pdf.annotations")}><button className="ibtn" aria-label={t("files.pdf.annotations")} aria-pressed={notes} data-on={notes || undefined} onClick={() => setNotes((x) => !x)}><Icon name="edit" /></button></Tip>
    <IconBtn icon="pin" label={t("files.pdf.addNote")} onClick={() => toast.add({ title: t("files.pdf.noteAdded"), description: t("files.pdf.pageN", { n: page + 1 }), data: { icon: "pin" } })} />
    <span className="fichiers-grow" />
    <label className="fichiers-find"><Icon name="search" />
      <input value={q} onChange={(e) => {
        const n = e.target.value; setQ(n);
        // First hit from the current page on, else from the start.
        const h = PDF.map((pp) => countIn(pageText(pp), n)), first = h.findIndex((x, i) => x > 0 && i >= page), at = first >= 0 ? first : h.findIndex((x) => x > 0);
        setCur(at >= 0 ? h.slice(0, at).reduce((a, b) => a + b, 0) : 0); if (at >= 0 && at !== page) go(at);
      }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); jump(e.shiftKey ? -1 : 1); } if (e.key === "Escape") setQ(""); }} placeholder={t("files.pdf.search")} aria-label={t("files.pdf.search")} />
      {q && <span className="fichiers-meta" aria-live="polite">{total ? t("files.pdf.hitOf", { n: cur + 1, total }) : t("files.pdf.noHit")}</span>}
      {q && <><IconBtn icon="arrow-up" label={t("files.pdf.prevHit")} disabled={!total} onClick={() => jump(-1)} /><IconBtn icon="chevron-down" label={t("files.pdf.nextHit")} disabled={!total} onClick={() => jump(1)} /></>}
    </label>
  </>);

  return (
    <Viewer kind="pdf" name={fx.name} meta={fx.meta} tools={blocked ? undefined : tools} ask={fx.ask} seed={seed} sideOpen={side}>
      {blocked ? <PdfState v={v} onRetry={() => setV("loading")} /> : (<>
        <nav className="fichiers-thumbs" aria-label={t("files.pdf.pages")}>
          {PDF.map((pp, i) => (
            <button key={i} className="fichiers-thumb" data-on={i === page || undefined} aria-current={i === page ? "page" : undefined} aria-label={hits[i] ? t("files.pdf.thumbHits", { n: i + 1, count: hits[i] }) : t("files.pdf.pageN", { n: i + 1 })} onClick={() => go(i)}>
              <span className="fichiers-mini"><i className="h" data-hit={(q && countIn(pp.h, q) > 0) || undefined} />{pp.p.map((s, j) => <i key={j} data-hit={(q && countIn(s, q) > 0) || undefined} style={{ width: `${70 + ((i * 7 + j * 13) % 30)}%` }} />)}{pp.chart && <i className="b" />}<i style={{ width: "50%" }} /></span>
              {i + 1}
            </button>))}
        </nav>
        <div className="fichiers-scroll" ref={scroll}>
          {v === "summary" && <div className="fichiers-sumcard"><div className="fichiers-sumcard-h"><Icon name="sparkle-free" />{t("files.pdf.summaryBy")}<span className="fichiers-grow" /><span className="fichiers-meta">{t("files.pdf.pagesRead", { count: 12 })}</span></div>
            <ul>{fx.summaryPoints.map((s) => <li key={s}>{s}</li>)}</ul></div>}
          <article className="fichiers-page" key={page} style={css({ "--z": z })} aria-label={t("files.pdf.pageN", { n: page + 1 })}>
            {page === 0 ? <><div className="fichiers-kicker">{fx.kicker}</div><h1><Hl s={p.h} q={q} base={offs[0]} cur={cur} /></h1></> : <h2 style={{ marginTop: 0 }}><Hl s={p.h} q={q} base={offs[0]} cur={cur} /></h2>}
            {p.p.map((s, i) => page === 1 && i === 1 && sel ? (
              <p key={i}>
                <Popover.Root open={sel} onOpenChange={setSel}>
                  <Popover.Trigger nativeButton={false} render={<span className="fichiers-sel" />}>{SEL}</Popover.Trigger>
                  <Popover.Portal><Popover.Positioner side="top" align="start" sideOffset={6}><Popover.Popup className="popup fichiers-bubble" initialFocus={false}>
                    {([["explain", "info"], ["summarize", "sparkle-free"], ["quote", "copy"]] as const).map(([l, ic]) => <button key={l} onClick={() => act(l)}><Icon name={ic} />{t(`files.pdf.act.${l}`)}</button>)}
                  </Popover.Popup></Popover.Positioner></Popover.Portal>
                </Popover.Root>{s.slice(SEL.length)}</p>
            ) : <p key={i} onMouseUp={() => { if (page === 1 && i === 1 && getSelection()?.toString()) setSel(true); }}><Hl s={s} q={q} base={offs[i + 1]} cur={cur} /></p>)}
            {p.chart && <><div className="fichiers-chart" role="img" aria-label={t("files.pdf.chart")}>{p.chart.map((h, i) => <i key={i} style={css({ "--h": h + "%" })} />)}</div><div className="fichiers-chart-l">{fx.months.map((m) => <span key={m}>{m}</span>)}</div></>}
            {notes && fx.notes[page]?.map((n, i) => (
              <Popover.Root key={i}>
                <Popover.Trigger className="fichiers-note" style={{ top: n.y }} aria-label={t("files.pdf.noteBy", { who: n.who })} openOnHover delay={120}>{n.who[0]}</Popover.Trigger>
                <Popover.Portal><Popover.Positioner side="right" sideOffset={8}><Popover.Popup className="popup fichiers-notepop"><b>{n.who}</b><span>{n.t}</span></Popover.Popup></Popover.Positioner></Popover.Portal>
              </Popover.Root>))}
            <div className="fichiers-foot">{page + 1} / {PDF.length}</div>
          </article>
        </div>
      </>)}
    </Viewer>
  );
}

/* ================================================================ 2. Slides */
function SlideView({ s, i, big }: { s: Slide; i: number; big?: boolean }) {
  const t = useT();
  return (
    <div className="fichiers-slide" data-k={s.k} data-big={big || undefined} aria-label={t("files.slide.aria", { n: i + 1, title: s.t })} role="img">
      {s.img && s.k !== "split" && <span className="fichiers-slide-bg" style={{ backgroundImage: `url(/img/${s.img}.png)` }} />}
      <div className="fichiers-slide-in">
        {s.k === "stat" ? <><span className="fichiers-slide-k">{s.t}</span><span className="fichiers-slide-big">{s.s}</span></> : <><h3>{s.t}</h3>{s.s && <p>{s.s}</p>}</>}
        {s.b && <ul>{s.b.map((x) => <li key={x}>{x}</li>)}</ul>}
      </div>
      {s.k === "split" && <span className="fichiers-slide-side" style={{ backgroundImage: `url(/img/${s.img}.png)` }} />}
      <span className="fichiers-slide-n">{i + 1}</span>
    </div>
  );
}

export function FilePptx() {
  const t = useT();
  const fx = useFx().pptx;
  const SLIDES = fx.slides;
  const [v, setV] = useVariant("editing");
  const [i, setI] = React.useState(0);
  const [notes, setNotes] = React.useState(true);
  const list = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { setI(0); }, [v]);
  const set = (n: number) => setI(Math.max(0, Math.min(SLIDES.length - 1, n)));
  const conv = v === "converting";
  useArrows(() => !conv && set(i - 1), () => !conv && set(i + 1));
  React.useEffect(() => { list.current?.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: "nearest" }); }, [i]);
  React.useEffect(() => {
    if (v !== "presenting") return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setV("editing"); if (e.key === " ") { e.preventDefault(); set(i + 1); } };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  });
  const s = SLIDES[i];
  const tools = (<>
    <PageNum n={i} total={SLIDES.length} set={set} unit="slide" />
    <span className="fichiers-sep" />
    <Tip label={t("files.pptx.list")}><button className="ibtn" aria-label={t("files.pptx.listView")} aria-pressed={v !== "grid"} data-on={v !== "grid" || undefined} onClick={() => setV("editing")}><Icon name="file" /></button></Tip>
    <Tip label={t("files.pptx.grid")}><button className="ibtn" aria-label={t("files.pptx.gridView")} aria-pressed={v === "grid"} data-on={v === "grid" || undefined} onClick={() => setV("grid")}><Icon name="projects" /></button></Tip>
    <Tip label={t("files.pptx.notes")}><button className="ibtn" aria-label={t("files.pptx.notes")} aria-pressed={notes} data-on={notes || undefined} onClick={() => setNotes((x) => !x)}><Icon name="compose" /></button></Tip>
    <span className="fichiers-grow" />
    <button className="btn primary" onClick={() => setV("presenting")}><Icon name="play" />{t("files.pptx.present")}</button>
  </>);

  if (v === "presenting") return (
    <div className="fichiers-root fichiers-show" role="dialog" aria-label={t("files.pptx.presentMode")}>
      <div className="fichiers-show-stage" onClick={() => set(i + 1)}><SlideView s={s} i={i} big key={i} /></div>
      <div className="fichiers-show-bar">
        <IconBtn icon="arrow-left" label={t("files.slide.prev")} kbd="←" disabled={i === 0} onClick={() => set(i - 1)} />
        <span className="fichiers-meta">{i + 1} / {SLIDES.length}</span>
        <IconBtn icon="arrow-right" label={t("files.slide.next")} kbd="→" disabled={i === SLIDES.length - 1} onClick={() => set(i + 1)} />
        <span className="fichiers-sep" />
        <button className="btn secondary" onClick={() => setV("editing")}><Icon name="close" />{t("files.pptx.exit")}<kbd className="fichiers-kbd">{t("files.pptx.esc")}</kbd></button>
      </div>
    </div>);

  return (
    <Viewer kind="pptx" name={fx.name} meta={fx.meta} tools={conv ? undefined : tools} ask={fx.ask}>
      {conv ? (
        <div className="fichiers-state">
          <span className="fichiers-badge"><span className="spin" style={{ width: 16, height: 16 }} /></span>
          <h2>{t("files.pptx.conv.title")}</h2>
          <p>{t("files.pptx.conv.body", { count: SLIDES.length })}</p>
          <Progress.Root value={62} className="fichiers-prog" aria-label={t("files.pptx.conv.aria")}><Progress.Track className="fichiers-prog-t"><Progress.Indicator className="fichiers-prog-i" /></Progress.Track></Progress.Root>
          <span className="fichiers-meta">{t("files.pptx.conv.status", { n: 11, total: SLIDES.length, s: 20 })}</span>
          <button className="btn secondary" onClick={() => setV("editing")}>{t("files.cancel")}</button>
        </div>
      ) : v === "grid" ? (
        <div className="fichiers-grid">{SLIDES.map((x, n) => <button key={n} className="fichiers-gcell fichiers-rise" style={css({ "--i": Math.min(n, 10) })} data-on={n === i || undefined} onClick={() => { setI(n); setV("editing"); }} aria-label={t("files.slide.open", { n: n + 1 })}><SlideView s={x} i={n} /><span className="fichiers-ell">{x.t}</span></button>)}</div>
      ) : (<>
        <nav className="fichiers-thumbs fichiers-sthumbs" aria-label={t("files.pptx.slides")} ref={list}>
          {SLIDES.map((x, n) => <button key={n} data-i={n} className="fichiers-thumb fichiers-sthumb" data-on={n === i || undefined} aria-current={n === i ? "page" : undefined} onClick={() => set(n)}><span className="fichiers-meta">{n + 1}</span><SlideView s={x} i={n} /></button>)}
        </nav>
        <div className="fichiers-stage">
          <div className="fichiers-stage-c"><SlideView s={s} i={i} big key={i} /></div>
          {notes && <div className="fichiers-notes"><span className="fichiers-meta">{t("files.pptx.notes")}</span><p>{s.n ?? t("files.pptx.noNotes")}</p></div>}
        </div>
      </>)}
    </Viewer>
  );
}

/* ================================================================ 3. Document */
// Text with or without revision marks. `tc` = track changes visible.
function Ins({ tc, who, children }: { tc: boolean; who: string; children: React.ReactNode }) {
  const t = useT();
  return tc ? <ins className="fichiers-ins" title={t("files.docx.insBy", { who })}>{children}</ins> : <>{children}</>;
}
function Del({ tc, who, children }: { tc: boolean; who: string; children: React.ReactNode }) {
  const t = useT();
  return tc ? <del className="fichiers-del" title={t("files.docx.delBy", { who })}>{children}</del> : null;
}

export function FileDocx() {
  const t = useT();
  const fx = useFx().docx;
  const { eur } = useFmt();
  const D = fx.doc, who = fx.author;
  const [v] = useVariant("reading");
  const toast = useToast();
  const [z, setZ] = React.useState(1);
  const [tc, setTc] = React.useState(v === "tracked");
  const [cm, setCm] = React.useState(v === "comments");
  const [cmts, setCmts] = React.useState<Cmt[]>(fx.comments);
  const [act, setAct] = React.useState(1);
  const [reply, setReply] = React.useState("");
  React.useEffect(() => { setTc(v === "tracked"); setCm(v === "comments"); setCmts(fx.comments); setAct(1); setZ(1); }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  const anchor = (id: number, children: React.ReactNode) => cm && cmts.some((c) => c.id === id && !c.done)
    ? <span className="fichiers-canchor" data-on={act === id || undefined} onClick={() => setAct(id)}>{children}</span> : <>{children}</>;
  const tools = (<>
    <Zoom z={z} setZ={setZ} fit={() => setZ(1.25)} />
    <span className="fichiers-sep" />
    <Tip label={t("files.docx.track")}><button className="btn secondary fichiers-tbtn" aria-pressed={tc} data-on={tc || undefined} onClick={() => setTc((x) => !x)}><Icon name="diff" />{t("files.docx.changes")}<span className="fichiers-count">3</span></button></Tip>
    <Tip label={t("files.docx.comments")}><button className="btn secondary fichiers-tbtn" aria-pressed={cm} data-on={cm || undefined} onClick={() => setCm((x) => !x)}><Icon name="mentions" />{t("files.docx.comments")}<span className="fichiers-count">{cmts.filter((c) => !c.done).length}</span></button></Tip>
    {tc && <><span className="fichiers-sep" />
      <button className="btn secondary fichiers-tbtn" onClick={() => { setTc(false); toast.add({ title: t("files.docx.accepted"), description: t("files.docx.revisions", { count: 3, who }), data: { icon: "check", undo: true } }); }}><Icon name="check" />{t("files.docx.acceptAll")}</button>
      <button className="btn secondary fichiers-tbtn" onClick={() => { setTc(false); toast.add({ title: t("files.docx.rejected"), data: { icon: "close", undo: true } }); }}><Icon name="close" />{t("files.docx.rejectAll")}</button></>}
  </>);
  const [o1, o2, o3] = D.obj, [d1, d2, d3] = D.deliv;
  return (
    <Viewer kind="docx" name={fx.name} meta={fx.meta} tools={tools} ask={fx.ask}>
      <div className="fichiers-scroll">
        <div className="fichiers-docrow">
          <article className="fichiers-page fichiers-a4" style={css({ "--z": z })} aria-label={t("files.pdf.pageN", { n: 1 })}>
            <div className="fichiers-kicker">{D.kicker}</div>
            <h1>{D.title}</h1>
            <p>{D.intro}</p>
            <h2>{D.h1}</h2>
            <ul>
              <li>{o1}</li>
              <li>{anchor(2, o2)}</li>
              <li>{o3.pre}<Del tc={tc} who={who}>{o3.del}</Del><Ins tc={tc} who={who}>{tc ? " " + o3.ins : o3.ins}</Ins>{o3.post}</li>
            </ul>
            <h2>{D.h2}</h2>
            <ol>
              <li>{d1}</li>
              <li>{anchor(1, <>{d2.pre}<Del tc={tc} who={who}>{d2.del}</Del><Ins tc={tc} who={who}>{tc ? " " + d2.ins : d2.ins}</Ins></>)}</li>
              <li>{d3.text}<Ins tc={tc} who={who}>{tc ? d3.ins : ""}</Ins></li>
            </ol>
            <h2>{D.h3}</h2>
            {anchor(3, <table className="fichiers-table">
              <thead><tr><th>{D.table.head[0]}</th><th>{D.table.head[1]}</th><th className="num">{D.table.head[2]}</th></tr></thead>
              <tbody>
                {D.table.rows.map(([a, b, n]) => <tr key={a}><td>{a}</td><td>{b}</td><td className="num">{eur(n)}</td></tr>)}
                <tr className="tot"><td>{D.table.total}</td><td /><td className="num">{eur(D.table.rows.reduce((s, r) => s + r[2], 0))}</td></tr>
              </tbody>
            </table>)}
            <p className="fichiers-small">{D.contact}</p>
            <div className="fichiers-foot">1 / 4</div>
          </article>
          {cm && <aside className="fichiers-cmts" aria-label={t("files.docx.comments")}>
            {cmts.map((c, i) => (
              <div key={c.id} className="fichiers-cmt fichiers-rise" style={css({ "--i": i })} data-on={act === c.id || undefined} data-done={c.done || undefined} onClick={() => setAct(c.id)}>
                <div className="fichiers-cmt-h"><span className="fichiers-av">{c.who.split(" ").map((w) => w[0]).join("")}</span><span className="fichiers-grow"><b>{c.who}</b><span className="fichiers-meta">{c.at}</span></span>
                  <IconBtn icon="check" label={c.done ? t("files.docx.reopen") : t("files.docx.resolve")} onClick={(e) => { e.stopPropagation(); setCmts((x) => x.map((y) => y.id === c.id ? { ...y, done: !y.done } : y)); }} /></div>
                <p>{c.t}</p>
                {act === c.id && !c.done && <form className="fichiers-reply" onSubmit={(e) => { e.preventDefault(); if (!reply.trim()) return; toast.add({ title: t("files.docx.replied"), description: c.who, data: { icon: "check" } }); setReply(""); }}>
                  <input className="input" value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t("files.docx.reply")} aria-label={t("files.docx.replyTo", { who: c.who })} onClick={(e) => e.stopPropagation()} />
                </form>}
              </div>))}
          </aside>}
        </div>
      </div>
    </Viewer>
  );
}

/* ================================================================ 4. Spreadsheet */
const COLS = "ABCDEF";

export function FileXlsx() {
  const t = useT();
  const fx = useFx().xlsx;
  const { num, eur } = useFmt();
  const SHEETS = fx.sheets;
  const [v] = useVariant("data");
  const [sh, setSh] = React.useState(0);
  const init = (x: string) => x === "range" || x === "chart" ? { a: [1, 1] as const, b: [2, 8] as const } : { a: [1, 3] as const, b: [1, 3] as const };
  const [a, setA] = React.useState<readonly [number, number]>(init(v).a);
  const [b, setB] = React.useState<readonly [number, number]>(init(v).b);
  const [drag, setDrag] = React.useState(false);
  const [chart, setChart] = React.useState(v === "chart");
  const [fixed, setFixed] = React.useState(false);
  React.useEffect(() => { const s = init(v); setA(s.a); setB(s.b); setSh(0); setChart(v === "chart"); setFixed(false); }, [v]);
  React.useEffect(() => { const up = () => setDrag(false); addEventListener("mouseup", up); return () => removeEventListener("mouseup", up); }, []);
  const S: Sheet = SHEETS[sh];
  const errs = v === "errors" && !fixed && sh === 0;
  const [c0, c1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])], [r0, r1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
  const ref = (c: number, r: number) => `${COLS[c]}${r + 1}`;
  const multi = c0 !== c1 || r0 !== r1;
  const range = multi ? `${ref(c0, r0)}:${ref(c1, r1)}` : ref(a[0], a[1]);
  const val = (c: number, r: number): Cell => (r === 0 ? S.head[c] : S.rows[r - 1]?.[c]) ?? "";
  const nums: number[] = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const x = val(c, r); if (typeof x === "number" && r > 0) nums.push(x); }
  const sum = nums.reduce((x, y) => x + y, 0);
  const cur = val(a[0], a[1]);
  const formula = S.f?.[ref(a[0], a[1])] ?? (typeof cur === "number" ? String(cur) : cur);
  const move = (dc: number, dr: number, ext: boolean) => {
    const n = [Math.max(0, Math.min(5, (ext ? b : a)[0] + dc)), Math.max(0, Math.min(S.rows.length, (ext ? b : a)[1] + dr))] as const;
    if (ext) setB(n); else { setA(n); setB(n); }
  };
  const fmtN = (x: number) => (sh === 0 ? eur(x) : num(x));
  const tools = (<>
    <span className="fichiers-cref mono" aria-label={t("files.xlsx.activeCell")}>{range}</span>
    <span className="fichiers-fx" aria-hidden>{t("files.xlsx.fx")}</span>
    <input className="fichiers-formula mono" value={String(formula)} readOnly aria-label={t("files.xlsx.formula")} />
    <span className="fichiers-sep" />
    <button className="btn secondary fichiers-tbtn" aria-pressed={chart} data-on={chart || undefined} onClick={() => setChart((x) => !x)}><Icon name="sparkle-free" />{t("files.xlsx.chart")}</button>
  </>);
  return (
    <Viewer kind="xlsx" name={fx.name} meta={fx.meta} tools={tools} ask={fx.ask}>
      <div className="fichiers-xl">
        {errs && <div className="banner warn fichiers-xbanner" role="status"><Icon name="alert-triangle" /><span>{t("files.xlsx.errTitle", { count: 3 })}</span><span className="grow">{t("files.xlsx.errBody")}</span><button className="btn secondary" onClick={() => setFixed(true)}><Icon name="sparkle-free" />{t("files.xlsx.fix")}</button></div>}
        <div className="fichiers-xbody">
          <div className="fichiers-gridwrap" tabIndex={0} role="grid" aria-label={t("files.xlsx.sheet", { name: S.name })} aria-rowcount={S.rows.length + 1}
            onKeyDown={(e) => { const d = ({ ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] } as Record<string, number[]>)[e.key]; if (d) { e.preventDefault(); e.stopPropagation(); move(d[0], d[1], e.shiftKey); } }}>
            <table className="fichiers-sheet">
              <thead><tr><th className="fichiers-corner" />{COLS.split("").map((c, i) => <th key={c} data-on={(i >= c0 && i <= c1) || undefined} scope="col">{c}</th>)}</tr></thead>
              <tbody>{[S.head, ...S.rows].map((row, r) => (
                <tr key={r}><th scope="row" data-on={(r >= r0 && r <= r1) || undefined}>{r + 1}</th>
                  {row.map((x, c) => {
                    const inR = c >= c0 && c <= c1 && r >= r0 && r <= r1, isAct = c === a[0] && r === a[1], e = errs ? fx.errs[ref(c, r)] : undefined;
                    const show = e && ref(c, r) === "D8" ? t("files.xlsx.refError") : e && ref(c, r) === "B6" ? "" : typeof x === "number" ? (c === 0 || sh === 1 ? num(x) : eur(x)) : x;
                    return <td key={c} role="gridcell" aria-selected={inR} data-sel={(inR && multi) || undefined} data-act={isAct || undefined} data-head={r === 0 || undefined} data-tot={(sh === 0 && r === S.rows.length) || undefined}
                      data-num={typeof x === "number" || undefined} data-neg={(typeof x === "number" && x < 0) || undefined} data-err={e ? true : undefined} title={e}
                      onMouseDown={(ev) => { if (ev.shiftKey) setB([c, r]); else { setA([c, r]); setB([c, r]); } setDrag(true); }} onMouseEnter={() => drag && setB([c, r])}>{show}</td>;
                  })}</tr>))}
                {Array.from({ length: 14 }, (_, i) => <tr key={"e" + i}><th scope="row">{S.rows.length + 2 + i}</th>{COLS.split("").map((c) => <td key={c} />)}</tr>)}
              </tbody>
            </table>
          </div>
          {chart && sh === 0 && <XChart sheet={SHEETS[0]} />}
        </div>
        <div className="fichiers-sheets" role="tablist" aria-label={t("files.xlsx.sheets")}>
          {SHEETS.map((s, i) => <button key={s.name} role="tab" aria-selected={i === sh} data-on={i === sh || undefined} className="fichiers-stab" onClick={() => { setSh(i); setA([1, 1]); setB([1, 1]); }}>{s.name}</button>)}
          <IconBtn icon="plus" label={t("files.xlsx.newSheet")} />
          <span className="fichiers-grow" />
          {nums.length > 1 && <span className="fichiers-meta fichiers-stats" aria-live="polite">{t("files.xlsx.stats", { sum: fmtN(sum), avg: fmtN(Math.round(sum / nums.length)), count: nums.length })}</span>}
        </div>
      </div>
    </Viewer>
  );
}

function XChart({ sheet }: { sheet: Sheet }) {
  const t = useT();
  const rows = sheet.rows.slice(0, 8), max = 10000, H = 160;
  return (
    <figure className="fichiers-xchart" aria-label={t("files.xlsx.chartAria")}>
      <figcaption><Icon name="sparkle-free" /><span className="fichiers-grow">{t("files.xlsx.chartTitle")}</span><span className="fichiers-meta">{t("files.xlsx.chartBy")}</span></figcaption>
      <svg viewBox={`0 0 ${rows.length * 44 + 10} ${H + 34}`} role="img" aria-hidden>
        {[0, 0.5, 1].map((k) => <line key={k} x1="0" x2={rows.length * 44 + 10} y1={H - k * H + 4} y2={H - k * H + 4} stroke="var(--line)" />)}
        {rows.map((r, i) => {
          const p = (r[1] as number) / max * H, e = (r[2] as number) / max * H, x = 10 + i * 44;
          return (<g key={i} className="fichiers-bar" style={css({ "--i": i })}>
            <rect x={x} y={H - p + 4} width="14" height={p} rx="2" fill="var(--subtle)" />
            <rect x={x + 16} y={H - e + 4} width="14" height={e} rx="2" fill={(r[3] as number) < 0 ? "var(--red)" : "var(--blue)"} />
            <text x={x + 15} y={H + 22} textAnchor="middle" fontSize="11" fill="var(--t2)">{String(r[0]).split(" ")[0].slice(0, 6)}</text>
          </g>);
        })}
      </svg>
      <div className="fichiers-legend"><span><i style={{ background: "var(--subtle)" }} />{t("files.xlsx.planned")}</span><span><i style={{ background: "var(--blue)" }} />{t("files.xlsx.committed")}</span><span><i style={{ background: "var(--red)" }} />{t("files.xlsx.over")}</span></div>
    </figure>
  );
}

/* ================================================================ 5. Upload */
type UpErr = { k: "type" | "size" | "limit" | "connection"; ext?: string; size?: number; pct?: number };
type Up = { id: number; name: string; size: number; pct: number; err?: UpErr; file?: File; url?: string; mime?: string };
const MAX_FILES = 10, MAX_MB = 50;
const OK_EXT = ["pdf", "docx", "pptx", "xlsx", "csv", "txt", "md", "png", "jpg", "jpeg", "webp", "mp3", "mp4", "zip"];
const ext = (n: string) => n.split(".").pop()?.toLowerCase() ?? "";
const check = (name: string, size: number, count: number): UpErr | undefined =>
  !OK_EXT.includes(ext(name)) ? { k: "type", ext: ext(name) } : size > MAX_MB * 1e6 ? { k: "size", size } : count >= MAX_FILES ? { k: "limit" } : undefined;
const fileRoute = (n: string) => ({ pdf: "file-pdf", pptx: "file-pptx", docx: "file-docx", xlsx: "file-xlsx", csv: "file-xlsx", png: "file-image", jpg: "file-image", jpeg: "file-image", webp: "file-image", mp3: "file-audio", mp4: "file-video", zip: "file-zip", md: "file-code", txt: "file-code" } as Record<string, string>)[ext(n)];

/** Model for a new chat: first model of the first enabled provider with a key (else any enabled one). */
// ponytail: no default-model setting in the engine yet; switch to it when Settings stores one.
async function pickModel() {
  const ps = await api.providers.list();
  const p = ps.find((x) => x.enabled && x.hasKey) ?? ps.find((x) => x.enabled);
  if (!p) return undefined;
  const m = (await api.catalog.models(p.providerID))[0];
  return m && { providerID: p.providerID, modelID: m.id };
}

export function Upload() {
  const t = useT();
  const preview = isPreview();
  const all = useFx();
  const fx = preview ? all.upload : undefined;
  const { num } = useFmt();
  const [v] = useVariant("empty");
  const { go } = useNav();
  const toast = useToast();
  const bot = useBotCfg();
  const seedUps = (x: string): Up[] => !fx ? [] : (x === "uploading" ? fx.demo : x === "done" ? fx.demo.map((u) => ({ ...u, pct: 100 })) : x === "errors" ? fx.errors : [])
    .map((u, i) => ({ ...u, id: i + 1, err: u.err && { k: u.err, ext: ext(u.name), size: u.size, pct: u.pct } }));
  const [ups, setUps] = React.useState<Up[]>(() => seedUps(v));
  const [over, setOver] = React.useState(v === "dragging");
  const depth = React.useRef(0);
  const nextId = React.useRef(100);
  const input = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { setUps(seedUps(v)); setOver(v === "dragging"); depth.current = 0; }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  // Preview: simulated progress up to 100.
  React.useEffect(() => {
    if (!preview || !ups.some((u) => !u.err && u.pct < 100)) return;
    const id = setInterval(() => setUps((x) => x.map((u) => u.err || u.pct >= 100 ? u : { ...u, pct: Math.min(100, u.pct + 3 + (u.id % 5)) })), 160);
    return () => clearInterval(id);
  }, [ups, preview]);
  const patch = (id: number, p: Partial<Up>) => setUps((x) => x.map((u) => (u.id === id ? { ...u, ...p } : u)));
  // Live: the file is read in the renderer; progress is the real read progress.
  const read = (u: Up) => {
    const r = new FileReader();
    r.onprogress = (e) => e.lengthComputable && patch(u.id, { pct: Math.min(99, Math.round((e.loaded / e.total) * 100)) });
    r.onload = () => patch(u.id, { pct: 100, url: r.result as string, mime: u.file!.type || "application/octet-stream" });
    r.onerror = () => patch(u.id, { err: { k: "connection", pct: u.pct } });
    r.readAsDataURL(u.file!);
  };
  const add = (files: { name: string; size: number; file?: File }[]) => {
    const fresh: Up[] = [];
    setUps((x) => {
      let n = x.filter((u) => !u.err).length; const out = [...x];
      for (const f of files) {
        const err = check(f.name, f.size, n); if (!err) n++;
        const u: Up = { id: nextId.current++, name: f.name, size: f.size, pct: 0, err, file: f.file };
        out.push(u); if (!err && f.file) fresh.push(u);
      }
      return out;
    });
    queueMicrotask(() => fresh.forEach(read));
  };
  const askAbout = async (u: Up) => {
    try {
      const model = await pickModel();
      if (!model || !u.url) { toast.add({ title: t("files.upload.noModel"), data: { icon: "alert-triangle" } }); return; }
      const s = await api.sessions.create({ kind: "chat", model, title: u.name });
      await api.sessions.prompt(s.id, { parts: [{ type: "text", text: t("files.upload.askPrompt", { name: u.name }) }, { type: "file", mime: u.mime!, filename: u.name, url: u.url }] });
      go("chat", { id: s.id });
    } catch {
      toast.add({ title: t("files.upload.askFailed"), data: { icon: "alert-triangle" } });
    }
  };
  const mb = (b: number) => b >= 1e9 ? t("files.size.gb", { n: num(b / 1e9, 1) }) : b >= 1e6 ? t("files.size.mb", { n: num(b / 1e6, 1) }) : t("files.size.kb", { n: Math.max(1, Math.round(b / 1e3)) });
  const errText = (e: UpErr) => e.k === "type" ? t("files.upload.err.type", { ext: e.ext ?? "" }) : e.k === "size" ? t("files.upload.err.size", { max: MAX_MB, size: mb(e.size ?? 0) })
    : e.k === "limit" ? t("files.upload.err.limit", { max: MAX_FILES }) : t("files.upload.err.connection", { pct: t("files.pct", { n: e.pct ?? 0 }) });
  const valid = ups.filter((u) => !u.err), done = valid.filter((u) => u.pct >= 100).length, errs = ups.filter((u) => u.err).length;
  const full = valid.length >= MAX_FILES;
  const busy = valid.some((u) => u.pct < 100);
  const dz = {
    onDragEnter: (e: React.DragEvent) => { e.preventDefault(); depth.current++; setOver(true); },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = full ? "none" : "copy"; },
    onDragLeave: () => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setOver(false); },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); depth.current = 0; setOver(false); add([...e.dataTransfer.files].map((f) => ({ name: f.name, size: f.size, file: f }))); },
  };
  return (
    <div className="fichiers-root" {...dz}>
      <div className="content-top"><span className="title">{t("files.upload.title")}</span><div className="spacer" />
        <span className="fichiers-meta" style={{ marginRight: 8 }}>{t("files.upload.count", { n: valid.length, max: MAX_FILES, size: MAX_MB })}</span>
        {/* ponytail: live mode has no project store yet, so "Add to project" stays disabled there. */}
        <button className="btn primary" disabled={!preview || !done || busy} data-dim={!done || busy || undefined} onClick={() => { toast.add({ title: t("files.upload.added", { count: done }), description: t("files.upload.toProject", { project: fx?.project ?? "" }), data: { icon: "check" } }); go("project"); }}>{t("files.upload.addToProject")}</button>
      </div>
      <div className="page fichiers-upage">
        <div className="fichiers-uwrap">
          {full && <div className="banner warn fichiers-ubanner" role="status"><Icon name="alert-triangle" /><span>{t("files.upload.limit")}</span><span className="grow">{t("files.upload.limitBody", { max: MAX_FILES })}</span></div>}
          <div className="fichiers-drop" data-testid="upload-dropzone" data-over={over || undefined} data-full={full || undefined} data-compact={ups.length > 0 || undefined}>
            <span className="fichiers-drop-ic">{over ? <Mascot cfg={bot} state="listening" size={44} /> : <Icon name="paperclip" />}</span>
            <b>{over ? (full ? t("files.upload.limit") : t("files.upload.release")) : t("files.upload.drop")}</b>
            {!over && <span>{t("files.upload.formats", { max: MAX_MB })}</span>}
            {!over && <div className="fichiers-drop-act">
              <button className="btn secondary" disabled={full} onClick={() => input.current?.click()}><Icon name="folder-open" />{t("files.upload.browse")}</button>
              <button className="btn secondary" disabled={full || !preview} onClick={() => fx && add(fx.drive)}><span className="fichiers-mono" aria-hidden>{t("files.upload.driveGlyph")}</span>{t("files.upload.drive")}</button>
            </div>}
            <input ref={input} data-testid="upload-input" type="file" multiple hidden onChange={(e) => { add([...(e.target.files ?? [])].map((f) => ({ name: f.name, size: f.size, file: f }))); e.target.value = ""; }} />
          </div>
          {ups.length === 0 ? (
            <p className="fichiers-uhint">{t("files.upload.hint", { bot: bot.name })}</p>
          ) : (<>
            <div className="fichiers-uhead"><span className="fichiers-grow">{busy ? t("files.upload.sending", { done, total: valid.length }) : t("files.upload.ready", { count: done })}{errs ? t("files.upload.refused", { count: errs }) : ""}</span>
              {errs > 0 && <button className="btn secondary fichiers-tbtn" onClick={() => setUps((x) => x.filter((u) => !u.err))}>{t("files.upload.removeRefused")}</button>}</div>
            <ul className="list fichiers-ulist" aria-live="polite">
              {ups.map((u, i) => {
                const r = fileRoute(u.name), ok = !u.err && u.pct >= 100;
                return (<li key={u.id} className="li fichiers-urow fichiers-rise" style={css({ "--i": Math.min(i, 8) })} data-err={u.err ? true : undefined}>
                  <span className="fichiers-ftype" data-k={ext(u.name)} aria-hidden>{ext(u.name).toUpperCase().slice(0, 3)}</span>
                  <span className="grow"><span className="ttl fichiers-ell" style={{ display: "block" }}>{u.name}</span>
                    {u.err ? <span className="fichiers-uerr">{errText(u.err)}</span>
                      : u.pct < 100 ? <Progress.Root value={u.pct} className="fichiers-uprog" aria-label={t("files.upload.sendingOne", { name: u.name })}><Progress.Track className="fichiers-prog-t"><Progress.Indicator className="fichiers-prog-i" /></Progress.Track><span className="fichiers-meta">{t("files.upload.progress", { done: mb(u.size * u.pct / 100), total: mb(u.size), pct: t("files.pct", { n: u.pct }) })}</span></Progress.Root>
                      : <span className="sub">{t("files.upload.readBy", { size: mb(u.size), bot: bot.name })}</span>}</span>
                  {ok && <span className="badge ok"><Icon name="check" />{t("files.upload.readyBadge")}</span>}
                  {u.err?.k === "connection" && preview && <button className="btn secondary fichiers-tbtn" onClick={() => patch(u.id, { err: undefined })}><Icon name="refresh" />{t("files.retry")}</button>}
                  {ok && (preview ? r && <IconBtn icon="arrow-right" label={t("files.upload.open", { name: u.name })} onClick={() => go(r)} />
                    : <IconBtn icon="sparkle-free" label={t("files.upload.ask", { name: u.name })} onClick={() => askAbout(u)} />)}
                  <IconBtn icon={u.pct < 100 && !u.err ? "stop" : "close"} label={u.pct < 100 && !u.err ? t("files.upload.cancel", { name: u.name }) : t("files.upload.remove", { name: u.name })} onClick={() => setUps((x) => x.filter((y) => y.id !== u.id))} />
                </li>);
              })}
            </ul>
          </>)}
        </div>
      </div>
    </div>
  );
}
