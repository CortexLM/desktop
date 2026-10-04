// Web search results and deep research (designs "search-results", "deep-research"). Preview only.
import * as React from "react";
import { Progress } from "@base-ui/react/progress";
import { Composer } from "../../components/composer";
import { Gel, Icon, IconBtn, Pop, MItem, Segmented, useToast } from "../../kit/ui";
import { Mascot, type State } from "../../mascot/Mascot";
import { useVariant } from "../../registry";
import { useT } from "../../i18n";
import { isPreview } from "../../preview";
import { Actions, BotRow, Cite, Fav, Unavailable, css, useBotCfg, useFx, useTicker } from "./shared";

const v3 = (ns: string, l: [string, string][]): [string, string, string][] => l.map(([id, d]) => [id, `chat.variant.${ns}.${id}`, d]);
export const SEARCH_VARIANTS = v3("search", [["results", "resultats"], ["loading", "chargement"], ["empty", "vide"]]);
export const DEEP_VARIANTS = v3("deep", [["plan", "plan"], ["running", "encours"], ["done", "termine"], ["cancelled", "annule"]]);

function EmptyBot({ state }: { state: State }) { const bot = useBotCfg(); return <Mascot cfg={bot} state={state} size={80} track interactive />; }

export function SearchResults() {
  const [v] = useVariant("results");
  if (!isPreview()) return <Unavailable feature="search-results" />;
  return <SearchIn key={v} v={v} />;
}

function SearchIn({ v }: { v: string }) {
  const t = useT();
  const fx = useFx();
  const s = fx.search;
  const SRC = fx.sources;
  const tabs = [t("chat.search.tab.answer"), t("chat.search.tab.images"), t("chat.search.tab.sources")];
  const [tab, setTab] = React.useState(tabs[0]);
  const [n] = useTicker(14, 200, 2, v === "loading");
  const toast = useToast();
  const imgs = ["atelier", "ceramique", "marche", "crepuscule", "prairie", "lagon", "aube", "montagne"];
  return (<>
    <div className="content-top"><span className="title">{s.q}</span><div className="spacer" />{v === "results" && <Segmented items={tabs} value={tab} onChange={setTab} />}<IconBtn icon="share" label={t("chat.act.share")} /></div>
    <div className="thread"><div className="thread-inner chat-sr">
      <div className="msg-user">{s.q}</div>
      {v === "loading" && <BotRow st="working">
        <div className="chat-search"><div className="chat-search-h"><span className="thinking">{t("chat.search.searching", { count: 14 })}</span><span className="chat-meta">{t("chat.search.progress", { n, total: 14 })}</span></div>
          <div className="chat-favs">{SRC.slice(0, n).map((x) => <span key={x.site} className="chat-fav-pop"><Fav s={x} /></span>)}</div></div>
        <div className="chat-cards">{[0, 1, 2, 3].map((i) => <div key={i} className="chat-rcard" aria-hidden><span className="skel line" style={{ width: "50%" }} /><span className="skel line" /><span className="skel line" style={{ width: "70%" }} /></div>)}</div>
        <div className="chat-skel"><span className="skel line" /><span className="skel line" style={{ width: "92%" }} /><span className="skel line" style={{ width: "74%" }} /></div>
      </BotRow>}
      {v === "empty" && <div className="empty chat-empty">
        <EmptyBot state="waiting" />
        <h2>{t("chat.search.emptyTitle")}</h2>
        <p>{s.emptyBody}</p>
        <div className="chips">{(s.chips as string[]).map((c) => <button key={c} className="chip" onClick={() => toast.add({ title: t("chat.search.newSearch"), description: c, data: { icon: "search" } })}>{c}</button>)}</div>
        <button className="btn secondary"><Icon name="refresh" size={16} />{t("common.retry")}</button>
      </div>}
      {v === "results" && tab === tabs[0] && <BotRow>
        <div className="chat-cards">{SRC.slice(8, 12).map((x, i) => <a key={x.site} className="chat-rcard" href="#" onClick={(e) => e.preventDefault()} style={css({ "--i": i })}><span className="chat-src-site"><Fav s={x} size={16} />{x.site}</span><span className="chat-src-t">{x.t}</span></a>)}
          <button className="chat-rcard more" onClick={() => setTab(tabs[2])}><span className="chat-favs tight">{SRC.slice(4, 8).map((x) => <Fav key={x.site} s={x} size={16} />)}</span><span className="chat-src-t">{t("chat.search.more", { count: 10 })}</span></button></div>
        <p>{s.p1}<Cite n={9} tail="." /></p>
        <div className="chat-imgs">{imgs.slice(0, 4).map((m, i) => <button key={m} className="chat-img" style={{ backgroundImage: `url(/img/${m}.png)`, ...css({ "--i": i }) }} aria-label={t("chat.search.image", { n: i + 1 })} onClick={() => setTab(tabs[1])} />)}</div>
        <h4>{s.h}</h4>
        <ul className="chat-ul">{(s.items as string[]).map((x, i) => <li key={x}>{x}<Cite n={[1, 14, 8][i]} /></li>)}</ul>
        <p>{s.p2}<Cite n={10} tail="." /></p>
        <h4>{t("chat.search.related")}</h4>
        <div className="chat-related">{(s.related as string[]).map((q) => <button key={q} className="chat-relq"><span>{q}</span><Icon name="plus" size={16} /></button>)}</div>
        <Actions />
      </BotRow>}
      {v === "results" && tab === tabs[1] && <div className="chat-imggrid">{imgs.map((m, i) => <figure key={m} style={css({ "--i": i })}><button className="chat-img" style={{ backgroundImage: `url(/img/${m}.png)` }} aria-label={t("chat.search.openImage", { n: i + 1 })} /><figcaption><Fav s={SRC[i]} size={16} />{SRC[i].site}</figcaption></figure>)}</div>}
      {v === "results" && tab === tabs[2] && <div className="list chat-srclist">{SRC.map((x, i) => <a key={x.site} className="li" href="#" onClick={(e) => e.preventDefault()}><span className="chat-num">{i + 1}</span><Fav s={x} size={24} /><span className="grow"><span className="ttl">{x.t}</span><span className="sub">{x.site} · {x.date}</span></span></a>)}</div>}
    </div></div>
    {v !== "empty" && <div className="dock"><Composer placeholder={t("chat.search.followUp")} /><span className="hint">{t("chat.hint")}</span></div>}
  </>);
}

export function DeepResearch() {
  const [v, setV] = useVariant("plan");
  if (!isPreview()) return <Unavailable feature="deep-research" />;
  return <DeepIn key={v} v={v} setV={setV} />;
}

function DeepIn({ v, setV }: { v: string; setV: (v: string) => void }) {
  const t = useT();
  const fx = useFx();
  const d = fx.deep;
  const SRC = fx.sources;
  const toast = useToast();
  const [plan, setPlan] = React.useState<string[]>(d.plan);
  const [editing, setEditing] = React.useState(false);
  const [p] = useTicker(100, 400, 42, v === "running");
  const read = 23 + Math.floor((p - 42) / 3);
  const step = Math.min(4, Math.floor(p / 20));
  const toc: string[] = d.toc;
  const go = (id: string) => document.getElementById("chat-r-" + id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const formats = [t("chat.canvas.pdf"), t("chat.canvas.word"), t("chat.deep.gdocs")];
  return (<>
    <div className="content-top"><span className="title">{t("chat.screen.deep-research")}</span>
      {v === "running" && <span className="badge run"><span className="spin" />{t("chat.deep.running")}</span>}{v === "done" && <span className="badge ok">{t("chat.deep.done")}</span>}{v === "cancelled" && <span className="badge err">{t("chat.deep.cancelledBadge")}</span>}
      <div className="spacer" />
      {v === "done" && <Pop align="end" trigger={<button className="btn secondary chat-run"><Icon name="download" size={16} />{t("chat.canvas.export")}</button>}>{formats.map((f) => <MItem key={f} icon="download" onClick={() => toast.add({ title: t("chat.deep.exported"), description: f, data: { icon: "download" } })}>{f}</MItem>)}</Pop>}
      <IconBtn icon="share" label={t("chat.act.share")} />
    </div>
    {v === "done" ? (
      <div className="chat-report">
        <nav className="chat-toc" aria-label={t("chat.deep.tocLabel")}><div className="h3">{t("chat.deep.toc")}</div>{toc.map((x, i) => <button key={x} className="chat-toc-i" onClick={() => go(String(i))}><span className="chat-num">{i + 1}</span>{x}</button>)}</nav>
        <article className="chat-rep">
          <div className="chat-rep-meta"><EmptyBot state="done" /><span>{d.meta}</span></div>
          <h1>{d.topic}</h1>
          {toc.map((x, i) => <section key={x} id={"chat-r-" + i}><h2>{i + 1}. {x}</h2><p>{d.body[i]}<Cite n={[5, 5, 3, 3, 14, 6, 2][i]} /></p></section>)}
        </article>
      </div>
    ) : v === "cancelled" ? (
      <div className="empty">
        <EmptyBot state="asleep" />
        <h2>{t("chat.deep.cancelled")}</h2>
        <p>{t("chat.deep.cancelledBody", { count: 23 })}</p>
        <div className="chat-row"><button className="btn secondary" onClick={() => setV("done")}>{t("chat.deep.partial")}</button><button className="btn primary" onClick={() => setV("running")}><Icon name="refresh" size={16} />{t("chat.deep.resume")}</button></div>
      </div>
    ) : (
      <div className="thread"><div className="thread-inner">
        <div className="msg-user">{d.q}</div>
        <BotRow st={v === "plan" ? "waiting" : "working"}>
          {v === "plan" ? <>
            <p>{t("chat.deep.planIntro")}</p>
            <div className="card chat-plan">
              <div className="chat-plan-h"><Gel name="recherche-web" size={20} /><b>{d.topic}</b></div>
              <ol className="chat-steps">{plan.map((s, i) => <li key={i}>{editing ? <input className="input" value={s} aria-label={t("chat.deep.step", { n: i + 1 })} onChange={(e) => setPlan((pl) => pl.map((x, k) => (k === i ? e.target.value : x)))} /> : s}</li>)}</ol>
              <div className="chat-plan-f"><span className="chat-meta">{t("chat.deep.estimate")}</span><div className="spacer" /><button className="btn secondary" onClick={() => setEditing((e) => !e)}>{editing ? t("chat.deep.finish") : t("chat.deep.editPlan")}</button><button className="btn primary" onClick={() => setV("running")}>{t("chat.deep.start")}</button></div>
            </div>
          </> : <div className="card chat-plan">
            <div className="chat-plan-h"><b>{d.topic}</b><div className="spacer" /><span className="chat-meta">{t("chat.deep.remaining", { count: Math.max(1, Math.round((100 - p) / 11)) })}</span></div>
            <Progress.Root value={p} className="chat-prog" aria-label={t("chat.deep.progress")}><Progress.Track className="chat-prog-track"><Progress.Indicator className="chat-prog-ind" /></Progress.Track></Progress.Root>
            <ol className="chat-steps live">{(d.plan as string[]).map((s, i) => <li key={i} data-s={i < step ? "done" : i === step ? "now" : "todo"}><span className="chat-dot">{i < step ? <Icon name="check" size={12} /> : i === step ? <span className="spin" /> : null}</span>{s}</li>)}</ol>
            <div className="chat-read"><span className="chat-favs tight">{SRC.slice(0, 6).map((s) => <Fav key={s.site} s={s} size={16} />)}</span><span>{t("chat.deep.read", { count: read })}</span><span className="chat-sep" /><span className="thinking">{t("chat.deep.reading", { site: SRC[read % 14].site })}</span></div>
            <div className="chat-plan-f"><span className="chat-meta">{t("chat.deep.closeOk")}</span><div className="spacer" /><button className="btn secondary" onClick={() => setV("cancelled")}>{t("chat.deep.stop")}</button></div>
          </div>}
        </BotRow>
      </div></div>
    )}
    {v !== "done" && <div className="dock"><Composer placeholder={v === "running" ? t("chat.deep.addInstruction") : t("chat.reply")} /><span className="hint">{t("chat.hint")}</span></div>}
  </>);
}
