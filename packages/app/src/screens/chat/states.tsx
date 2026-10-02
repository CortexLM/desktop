// Conversation states (design "chat-states"): preview-only walkthrough of every state.
import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { Progress } from "@base-ui/react/progress";
import { Composer } from "../../components/composer";
import { Gel, Icon, IconBtn, Tip, Pop, MItem, useToast } from "../../kit/ui";
import { Mascot } from "../../mascot/Mascot";
import { useNav } from "../../shell/nav";
import { useVariant } from "../../registry";
import { useT } from "../../i18n";
import { isPreview } from "../../preview";
import { Actions, Att, BotRow, Box, ChatFrame, Cite, Fav, Paras, Reasoning, Unavailable, css, useBotCfg, useCopy, useFx, useStream, useTicker } from "./shared";

type P = { onNew: () => void };

function Prev() {
  const p = useFx().states.prev;
  return (<>
    <div className="chat-ucol"><div className="msg-user">{p.user}</div>
      <div className="chat-ufiles">{p.files.map(([n, m]: string[]) => <Att key={n} name={n} meta={m} />)}</div></div>
    <BotRow><p>{p.bot}</p></BotRow>
  </>);
}

function VSending({ onNew }: P) {
  const t = useT();
  const s = useFx().states;
  return (
    <ChatFrame onNew={onNew} dock={<Box mode="sending" placeholder={t("chat.sendingPh")} />}>
      <Prev />
      <div className="chat-ucol"><div className="msg-user">{s.q}</div><span className="chat-status"><span className="spin" />{t("chat.sendingStatus")}</span></div>
    </ChatFrame>
  );
}

function VThinking({ onNew }: P) {
  const s = useFx().states;
  const [k] = useTicker(s.reason.length, 900, 1);
  const [secs] = useTicker(99, 1000, 4);
  return (
    <ChatFrame onNew={onNew} dock={<Box mode="busy" />}>
      <div className="msg-user">{s.budget.q}</div>
      <BotRow><Reasoning secs={12} steps={s.budget.steps} /><p>{s.budget.a}</p><Actions /></BotRow>
      <div className="msg-user">{s.q}</div>
      <BotRow st="thinking"><Reasoning live secs={secs} steps={s.reason.slice(0, k)} defaultOpen /></BotRow>
    </ChatFrame>
  );
}

function VStream({ onNew, stopped }: P & { stopped?: boolean }) {
  const t = useT();
  const s = useFx().states;
  const st = useStream(s.answer, { from: stopped ? 190 : 0, run: !stopped });
  const halted = !st.on && !st.done;
  return (
    <ChatFrame onNew={onNew} dock={<Box mode={st.on ? "busy" : "idle"} onStop={st.stop} />}>
      <Prev />
      <div className="msg-user">{s.q}</div>
      <BotRow st={st.on ? "talking" : halted ? "waiting" : "idle"}>
        <Paras text={st.shown} caret={st.on} />
        {halted && <div className="chat-note"><Icon name="stop" size={12} />{t("chat.stopped")}<button className="chat-link" onClick={st.start}>{t("chat.continue")}</button></div>}
        {!st.on && <Actions text={st.shown} />}
      </BotRow>
    </ChatFrame>
  );
}

function VSearching({ onNew }: P) {
  const t = useT();
  const fx = useFx();
  const [n] = useTicker(14, 260, 3);
  const done = n >= 14;
  return (
    <ChatFrame onNew={onNew} dock={<Box mode="busy" />}>
      <div className="msg-user">{fx.states.market}</div>
      <BotRow st="working">
        <div className="chat-search">
          <div className="chat-search-h">{done ? <span>{t("chat.search.found", { count: 14 })}</span> : <span className="thinking">{t("chat.search.searching", { count: 14 })}</span>}<span className="chat-meta">{t("chat.search.progress", { n, total: 14 })}</span></div>
          <div className="chat-favs">{fx.sources.slice(0, n).map((s) => <Tip key={s.site} label={s.site}><span className="chat-fav-pop" tabIndex={0}><Fav s={s} /></span></Tip>)}</div>
          <div className="steps-log">
            {fx.states.queries.map((q: string, i: number) => <div key={q} className="log" style={css({ animationDelay: `${i * 60}ms` })}><Icon name="search" size={16} />{t("chat.search.query", { q })}</div>)}
            <div className="log" data-last><span className="spin" />{t("chat.search.reading", { site: fx.sources[Math.min(n, 13)].site })}</div>
          </div>
        </div>
      </BotRow>
    </ChatFrame>
  );
}

function SourcesSide({ active, onPick, onClose }: { active: number; onPick: (n: number) => void; onClose: () => void }) {
  const t = useT();
  const src = useFx().sources;
  return (
    <aside className="chat-side" aria-label={t("chat.sources")}>
      <div className="pane-head"><span className="chat-side-t">{t("chat.sources")}</span><span className="chat-meta">6</span><div className="spacer" /><IconBtn icon="close" label={t("chat.closeSources")} onClick={onClose} /></div>
      <div className="chat-side-list">
        {src.slice(0, 6).map((s, i) => (
          <button key={s.site} className="chat-src" data-active={active === i + 1 || undefined} onClick={() => onPick(i + 1)} style={css({ "--i": i })}>
            <span className="chat-src-site"><Fav s={s} size={16} />{s.site}<span className="chat-num">{i + 1}</span></span>
            <span className="chat-src-t">{s.t}</span><span className="chat-src-d">{s.d}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function VSources({ onNew }: P) {
  const t = useT();
  const fx = useFx();
  const a = fx.states.cited;
  const [open, setOpen] = React.useState(true);
  const [act, setAct] = React.useState(1);
  const pick = (n: number) => { setAct(n); setOpen(true); };
  return (
    <ChatFrame onNew={onNew} onSources={() => setOpen((o) => !o)} side={open && <SourcesSide active={act} onPick={setAct} onClose={() => setOpen(false)} />}>
      <div className="msg-user">{fx.states.market}</div>
      <BotRow>
        <p>{a[0]}<Cite n={1} onPick={pick} tail="," />{a[1]}<Cite n={2} onPick={pick} tail="." /></p>
        <p>{a[2]}<Cite n={6} onPick={pick} tail="." /> {a[3]}<Cite n={4} onPick={pick} tail="." /></p>
        <p>{a[4]}<Cite n={3} onPick={pick} tail="." /></p>
        <button className="chat-srcbtn" onClick={() => setOpen(true)}><span className="chat-favs tight">{fx.sources.slice(0, 4).map((s) => <Fav key={s.site} s={s} size={16} />)}</span>{t("chat.sourcesCount", { count: 6 })}</button>
        <Actions />
      </BotRow>
    </ChatFrame>
  );
}

function VRich({ onNew }: P) {
  const t = useT();
  const r = useFx().states.rich;
  const copy = useCopy();
  return (
    <ChatFrame onNew={onNew}>
      <div className="msg-user">{r.q}</div>
      <BotRow>
        <h3 className="chat-h">{r.title}</h3>
        <p>{r.intro}</p>
        <ul className="chat-ul">{r.items.map(([b, d]: string[]) => <li key={b}><b>{b}</b> — {d}</li>)}</ul>
        <h4>{r.h.table}</h4>
        <div className="chat-table" role="region" aria-label={r.tableLabel} tabIndex={0}>
          <table>
            <thead><tr>{r.head.map((h: string, i: number) => <th key={h} className={i > 0 && i < 4 ? "num" : undefined}>{h}</th>)}</tr></thead>
            <tbody>{r.rows.map((row: string[], k: number) => <tr key={row[0]}><td>{row[0]}</td><td className="num">{row[1]}</td><td className="num">{row[2]}</td><td className="num"><b>{row[3]}</b></td><td>{k === 2 ? <span className="badge wait">{row[4]}</span> : row[4]}</td></tr>)}</tbody>
          </table>
        </div>
        <h4>{r.h.calc}</h4>
        <div className="code"><div className="code-head"><span>{r.file}</span><IconBtn icon="copy" label={t("chat.copyCode")} onClick={() => copy(r.code, t("chat.toast.codeCopied"))} /></div><pre>{r.code}</pre></div>
        <h4>{r.h.roi}</h4>
        <div className="chat-math" role="math" aria-label={r.mathLabel}>
          <i>{r.math.roi}</i> = <span className="chat-frac"><span><i>{r.math.rev}</i><sub>{r.math.sub}</sub> − <i>{r.math.c}</i></span><span><i>{r.math.c}</i></span></span> = <span className="chat-frac"><span>{r.math.num}</span><span>{r.math.den}</span></span> ≈ {r.math.res}
        </div>
        <p>{r.outro}</p>
        <Actions />
      </BotRow>
    </ChatFrame>
  );
}

function VTool({ onNew }: P) {
  const t = useT();
  const o = useFx().states.tool;
  const [p] = useTicker(18, 280, 5);
  const done = p >= 18;
  const s = useStream(o.answer, { run: false });
  React.useEffect(() => { if (done) s.start(); }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <ChatFrame onNew={onNew} dock={<Box mode={done && !s.on ? "idle" : "busy"} onStop={s.stop} />}>
      <div className="chat-ucol"><div className="chat-ufiles"><Att name={o.file} meta={o.meta} /></div>
        <div className="msg-user">{o.q}</div></div>
      <BotRow st={done ? (s.on ? "talking" : "idle") : "working"}>
        <div className="chat-tool" data-done={done || undefined}>
          <span className="li-ic"><Icon name="file" /></span>
          <div className="chat-grow">
            <div className="chat-tool-h">{done ? <span>{t("chat.tool.done")}</span> : <span className="thinking">{t("chat.tool.reading", { file: o.file })}</span>}{done ? <span className="badge ok"><Icon name="check" size={12} />{t("chat.tool.pages", { count: 18 })}</span> : <span className="chat-meta">{t("chat.tool.page", { n: p, total: 18 })}</span>}</div>
            <Progress.Root value={(p / 18) * 100} className="chat-prog" aria-label={t("chat.tool.progress")}><Progress.Track className="chat-prog-track"><Progress.Indicator className="chat-prog-ind" /></Progress.Track></Progress.Root>
            <div className="chat-tool-sub">{done ? o.extracted : t("chat.tool.extracting", { n: p })}</div>
          </div>
        </div>
        {done && <Paras text={s.shown} caret={s.on} />}
      </BotRow>
    </ChatFrame>
  );
}

function VAttachments({ onNew }: P) {
  const t = useT();
  const a = useFx().states.files;
  const [files, setFiles] = React.useState(["pdf", "img", "up", "err"]);
  const [pct] = useTicker(100, 70, 38);
  const rm = (k: string) => setFiles((f) => f.filter((x) => x !== k));
  const attach = files.length ? <>
    {files.includes("pdf") && <Att name={a.pdf[0]} meta={a.pdf[1]} onRemove={() => rm("pdf")} />}
    {files.includes("img") && <Att name={a.img[0]} meta={a.img[1]} img="/img/atelier.png" onRemove={() => rm("img")} />}
    {files.includes("up") && <Att name={a.up[0]} meta={pct < 100 ? t("chat.att.sending", { pct }) : a.up[1]} pct={pct < 100 ? pct : undefined} onRemove={() => rm("up")} />}
    {files.includes("err") && <Att name={a.err[0]} meta={a.err[1]} err onRemove={() => rm("err")} />}
  </> : undefined;
  return (
    <ChatFrame onNew={onNew} dock={<Box attach={attach} placeholder={t("chat.att.placeholder")} />}>
      <Prev />
    </ChatFrame>
  );
}

function Versions({ i, n, onI }: { i: number; n: number; onI: (i: number) => void }) {
  const t = useT();
  return (
    <span className="chat-vers" role="group" aria-label={t("chat.versions")}>
      <IconBtn icon="chevron-right" label={t("chat.prevVersion")} size={12} className="chat-flip" disabled={i === 0} onClick={() => onI(i - 1)} />
      <span className="chat-meta" aria-live="polite">{i + 1}/{n}</span>
      <IconBtn icon="chevron-right" label={t("chat.nextVersion")} size={12} disabled={i === n - 1} onClick={() => onI(i + 1)} />
    </span>
  );
}

function EditableUser({ versions: init, editing: e0 = false }: { versions: string[]; editing?: boolean }) {
  const t = useT();
  const [vers, setVers] = React.useState(init);
  const [i, setI] = React.useState(init.length - 1);
  const [editing, setEditing] = React.useState(e0);
  const [draft, setDraft] = React.useState(init[init.length - 1]);
  const copy = useCopy();
  if (editing) return (
    <form className="chat-edit" onSubmit={(e) => { e.preventDefault(); if (!draft.trim()) return; setVers((v) => [...v, draft.trim()]); setI(vers.length); setEditing(false); }}>
      <textarea className="input" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={t("chat.edit.label")} autoFocus rows={2}
        onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
      <div className="chat-edit-f"><span className="chat-meta">{t("chat.edit.note")}</span><div className="spacer" /><button type="button" className="btn secondary" onClick={() => setEditing(false)}>{t("common.cancel")}</button><button className="btn primary" disabled={!draft.trim()}>{t("composer.send")}</button></div>
    </form>
  );
  return (
    <div className="chat-ucol">
      <div className="msg-user" key={i}>{vers[i]}</div>
      <div className="chat-uact">
        {vers.length > 1 && <Versions i={i} n={vers.length} onI={setI} />}
        <IconBtn icon="copy" label={t("chat.act.copy")} size={16} onClick={() => copy(vers[i], t("chat.toast.messageCopied"))} />
        <IconBtn icon="edit" label={t("chat.edit.edit")} size={16} onClick={() => { setDraft(vers[i]); setEditing(true); }} />
      </div>
    </div>
  );
}

function VEdited({ onNew }: P) {
  const e = useFx().states.edit;
  return (
    <ChatFrame onNew={onNew}>
      <EditableUser versions={e.v1} />
      <BotRow><p>{e.a}</p><Actions /></BotRow>
      <EditableUser versions={e.v2} editing />
    </ChatFrame>
  );
}

function VRegen({ onNew }: P) {
  const t = useT();
  const s = useFx().states;
  const REGEN: string[] = s.regen;
  const [vers, setVers] = React.useState(REGEN.slice(0, 2));
  const [i, setI] = React.useState(1);
  const [busy, setBusy] = React.useState(false);
  const regen = (k: number) => {
    setBusy(true);
    setTimeout(() => { setVers((v) => { const n = [...v, k === 1 ? REGEN[2] : REGEN[v.length % 3]]; setI(n.length - 1); return n; }); setBusy(false); }, 1100);
  };
  const opts: [string, string][] = [["refresh", t("chat.regen.retry")], ["collapse", t("chat.regen.shorter")], ["expand", t("chat.regen.longer")], ["globe", t("chat.regen.noWeb")]];
  return (
    <ChatFrame onNew={onNew}>
      <Prev />
      <div className="msg-user">{s.q}</div>
      <BotRow st={busy ? "thinking" : "idle"}>
        {busy ? <span className="thinking">{t("chat.regen.busy")}</span> : <p key={i} className="chat-swap">{vers[i]}</p>}
        <Actions text={vers[i]} extra={<>
          <Pop side="bottom" trigger={<button className="ibtn" aria-label={t("chat.act.regen")} disabled={busy}><Icon name="refresh" /></button>}>
            {opts.map(([ic, l], k) => <MItem key={l} icon={ic} onClick={() => regen(k)}>{l}</MItem>)}
          </Pop>
          <Versions i={i} n={vers.length} onI={setI} />
        </>} />
      </BotRow>
    </ChatFrame>
  );
}

function VError({ onNew }: P) {
  const t = useT();
  const s = useFx().states;
  const [st, setSt] = React.useState<"err" | "retry" | "ok">("err");
  const str = useStream(s.answer, { run: false });
  const retry = () => { setSt("retry"); setTimeout(() => { setSt("ok"); str.start(); }, 1300); };
  return (
    <ChatFrame onNew={onNew} dock={<Box mode={st === "retry" || str.on ? "busy" : "idle"} onStop={str.stop} />}>
      <Prev />
      <div className="msg-user">{s.q}</div>
      <BotRow st={st === "err" ? "blocked" : st === "retry" ? "thinking" : str.on ? "talking" : "idle"}>
        {st === "err" && <div className="chat-err" role="alert">
          <Icon name="alert-triangle" />
          <div className="chat-grow"><b>{t("chat.err.network.title")}</b><span>{t("chat.err.network.body")}</span></div>
          <button className="btn secondary" onClick={retry}><Icon name="refresh" size={16} />{t("common.retry")}</button>
        </div>}
        {st === "retry" && <span className="thinking">{t("chat.err.retrying")}</span>}
        {st === "ok" && <><Paras text={str.shown} caret={str.on} />{!str.on && <Actions text={s.answer} />}</>}
      </BotRow>
    </ChatFrame>
  );
}

function VLimit({ onNew }: P) {
  const t = useT();
  const s = useFx().states;
  const { go } = useNav();
  return (
    <ChatFrame onNew={onNew} banner={
      <div className="banner warn chat-banner" role="status"><Icon name="clock-loop" /><span>{t("chat.limit.title", { plan: t("composer.model.pro"), time: s.limitTime })}</span><span className="grow">{t("chat.limit.body", { model: t("composer.model.fast") })}</span><button className="btn secondary" onClick={() => go("pricing")}>{t("chat.limit.cta")}</button></div>
    } dock={<Composer placeholder={t("chat.limit.placeholder", { model: t("composer.model.fast") })} models={[t("composer.model.fast"), t("composer.model.thinking")]} />}>
      <Prev />
      <div className="msg-user">{s.q}</div>
      <BotRow><span className="chat-tag"><Icon name="bolt" size={12} />{t("chat.limit.tag", { model: t("composer.model.fast") })}</span><Paras text={s.regen[0]} /><Actions /></BotRow>
    </ChatFrame>
  );
}

function VLong({ onNew }: P) {
  const t = useT();
  const l = useFx().states.long;
  const ref = React.useRef<HTMLDivElement>(null);
  const [away, setAway] = React.useState(false);
  const check = () => { const el = ref.current; if (el) setAway(el.scrollHeight - el.scrollTop - el.clientHeight > 80); };
  React.useLayoutEffect(() => { if (ref.current) { ref.current.scrollTop = 260; check(); } }, []);
  return (
    <ChatFrame onNew={onNew} threadRef={ref} onScroll={check}
      float={<button className="chat-bottom" data-hide={!away || undefined} aria-label={t("chat.toBottom")} tabIndex={away ? 0 : -1} onClick={() => ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" })}><Icon name="arrow-up" size={16} style={{ rotate: "180deg" }} />{t("chat.toBottom")}</button>}>
      <div className="msg-user">{l.q}</div>
      <BotRow>
        <h3 className="chat-h">{l.title}</h3>
        {l.sections.map(([h, p]: string[]) => <React.Fragment key={h}><h4>{h}</h4><p>{p}</p><p>{l.note}</p></React.Fragment>)}
        <Actions />
      </BotRow>
    </ChatFrame>
  );
}

function VFeedback({ onNew }: P) {
  const t = useT();
  const s = useFx().states;
  const toast = useToast();
  const copy = useCopy();
  const reasons = ["inaccurate", "outdated", "tooLong", "ignored", "tone", "other"].map((k) => t(`chat.fb.${k}`));
  const [open, setOpen] = React.useState(false);
  const [vote, setVote] = React.useState<"" | "up" | "down">("down");
  const [why, setWhy] = React.useState<string[]>([reasons[1]]);
  React.useEffect(() => { const x = setTimeout(() => setOpen(true), 60); return () => clearTimeout(x); }, []);
  const thanks = t("chat.fb.thanks");
  return (
    <ChatFrame onNew={onNew}>
      <Prev />
      <div className="msg-user">{s.q}</div>
      <BotRow>
        <Paras text={s.regen[0]} />
        <div className="msg-actions">
          <IconBtn icon="copy" label={t("chat.act.copy")} onClick={() => copy(s.regen[0], t("chat.toast.answerCopied"))} />
          <IconBtn icon="thumb-up" label={t("chat.act.good")} aria-pressed={vote === "up"} data-on={vote === "up" || undefined} onClick={() => { setVote("up"); setOpen(false); toast.add({ title: thanks, data: { icon: "check" } }); }} />
          <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger className="ibtn" aria-label={t("chat.act.bad")} aria-pressed={vote === "down"} data-on={vote === "down" || undefined} onClick={() => setVote("down")}><Icon name="thumb-down" /></Popover.Trigger>
            <Popover.Portal><Popover.Positioner side="bottom" align="start" sideOffset={6}><Popover.Popup className="popup chat-fb">
              <Popover.Title className="chat-fb-t">{t("chat.fb.title")}</Popover.Title>
              <div className="chat-fb-chips" role="group" aria-label={t("chat.fb.reasons")}>
                {reasons.map((r) => <button key={r} className="chip" aria-pressed={why.includes(r)} data-pressed={why.includes(r) || undefined} onClick={() => setWhy((w) => (w.includes(r) ? w.filter((x) => x !== r) : [...w, r]))}>{r}</button>)}
              </div>
              <textarea className="input chat-fb-txt" placeholder={t("chat.fb.placeholder")} aria-label={t("chat.fb.comment")} />
              <div className="chat-fb-f"><span className="chat-meta">{t("chat.fb.note")}</span><button className="btn primary" disabled={!why.length} onClick={() => { setOpen(false); toast.add({ title: thanks, description: why.join(", "), data: { icon: "check" } }); }}>{t("composer.send")}</button></div>
            </Popover.Popup></Popover.Positioner></Popover.Portal>
          </Popover.Root>
          <IconBtn icon="refresh" label={t("chat.act.regen")} />
        </div>
      </BotRow>
    </ChatFrame>
  );
}

function VEmpty({ setV }: { setV: (v: string) => void }) {
  const t = useT();
  const fx = useFx();
  const bot = useBotCfg();
  return (<>
    <div className="content-top"><span className="title">{t("chat.newChat")}</span><div className="spacer" /><IconBtn icon="history" label={t("chat.screen.temp-chat")} onClick={() => location.assign("#/temp-chat")} /></div>
    <div className="home">
      <div className="chat-hero"><Mascot cfg={bot} state="idle" size={64} track interactive /></div>
      <h1>{t("chat.home.title")}</h1>
      <Composer placeholder={t("composer.placeholder")} onSend={() => setV("sending")} />
      <div className="suggestions">{fx.states.suggestions.map(([g, s]: string[], i: number) => <button key={s} className="suggestion" style={css({ "--i": i })} onClick={() => setV("sending")}><Gel name={g} size={20} />{s}</button>)}</div>
    </div>
  </>);
}

export const CHAT_STATE_VARIANTS: [string, string, string][] = [
  ["sending", "envoi"], ["thinking", "reflexion"], ["streaming", "streaming"], ["searching", "recherche"], ["sources", "sources"],
  ["rich", "riche"], ["tool", "outil"], ["attachments", "pieces"], ["edited", "edition"], ["regenerating", "regeneration"],
  ["error", "erreur"], ["limit", "limite"], ["stopped", "arrete"], ["long", "longue"], ["feedback", "feedback"], ["empty", "vide"],
].map(([id, d]) => [id, `chat.variant.states.${id}`, d]);

export function ChatStates() {
  const [v, setV] = useVariant("sending");
  if (!isPreview()) return <Unavailable feature="chat-states" />;
  const p = { onNew: () => setV("empty") };
  const map: Record<string, React.ReactNode> = {
    sending: <VSending {...p} />, thinking: <VThinking {...p} />, streaming: <VStream {...p} />, searching: <VSearching {...p} />, sources: <VSources {...p} />,
    rich: <VRich {...p} />, tool: <VTool {...p} />, attachments: <VAttachments {...p} />, edited: <VEdited {...p} />, regenerating: <VRegen {...p} />,
    error: <VError {...p} />, limit: <VLimit {...p} />, stopped: <VStream {...p} stopped />, long: <VLong {...p} />, feedback: <VFeedback {...p} />, empty: <VEmpty setV={setV} />,
  };
  return <React.Fragment key={v}>{map[v] ?? map.sending}</React.Fragment>;
}
