// Signed-in Chat tools (designs "deep-research", "image-gen", "search-results", "temp-chat") on the trunk turn route.
// A turn is admitted through main (`turn.start` / `turn.continue`); the backend keeps generating after admission and the
// screen follows the stored conversation. The model picks web search and image tools; Deep Research is an explicit request.
import * as React from "react";
import type { ChatFeatureCall, ChatTurnAdmission, ChatTurnBody } from "@cortex/schema";
import { api } from "../../api";
import { useT } from "../../i18n";
import { Icon, IconBtn } from "../../kit/ui";
import { Composer } from "../../components/composer";
import { Mascot, COLORS, type MascotConfig } from "../../mascot/Mascot";
import { useNav } from "../../shell/nav";
import { useQuery } from "../../state/live";
import { BotRow, css, useBotCfg } from "./shared";

type Citation = { url?: string; title?: string; domain?: string };
type Plan = { title: string; questions: string[]; outline?: string[] };
type GeneratedImage = { file_id?: string; library_file_ids?: string[]; retention?: string };
type Message = { id: string; role: string; text: string; finish_reason?: string; citations?: Citation[]; generated_images?: GeneratedImage[]; research_plan?: Plan };

const call = async <T,>(epoch: string, op: ChatFeatureCall["op"], params: Record<string, string> = {}, body?: ChatTurnBody) =>
  (await api.code.chatFeature({ epoch, op, params, ...(body ? { body } : {}) })).data as T;

/** The conversation this tool page follows (`c` in the route) and its stored messages, re-read until the answer settles. */
function useToolThread(epoch: string) {
  const { route, params, go } = useNav();
  const conversation = params.get("c") ?? "";
  const [items, setItems] = React.useState<{ id: string; list: Message[] } | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [tick, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    if (!epoch || !conversation) return;
    let live = true, timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const list = (await call<{ items: Message[] }>(epoch, "messages", { conversation })).items;
        if (!live) return;
        setItems({ id: conversation, list }); setFailed(false);
        const last = list.at(-1);
        // ponytail: polls stored history; a resumable event stream per tool page replaces this when the IPC carries SSE.
        if (!last || last.role !== "assistant" || !last.finish_reason) timer = setTimeout(load, 1500);
      } catch { if (live) setFailed(true); }
    };
    void load();
    return () => { live = false; clearTimeout(timer); };
  }, [epoch, conversation, tick]);
  const send = async (body: ChatTurnBody) => {
    if (!epoch || busy) return false;
    setBusy(true); setFailed(false);
    try {
      const ids = await call<ChatTurnAdmission>(epoch, conversation ? "turn.continue" : "turn.start", conversation ? { conversation } : {}, body);
      if (ids.conversation_id === conversation) bump(); else go(route, { c: ids.conversation_id });
      return true;
    } catch { setFailed(true); return false; } finally { setBusy(false); }
  };
  const list = items && items.id === conversation ? items.list : conversation ? null : [];
  const last = list?.at(-1);
  const waiting = busy || (!!list && list.length > 0 && (last?.role !== "assistant" || !last.finish_reason));
  return { conversation, list, failed, busy, waiting, send, reset: () => go(route), retry: bump };
}

function ErrorNote({ onRetry }: { onRetry?: () => void }) {
  const t = useT();
  return <div className="chat-err" role="alert" data-testid="chat-tool-error"><Icon name="alert-triangle" /><span className="chat-grow"><b>{t("chat.err.generic.title")}</b><span>{t("chat.tools.error")}</span></span>
    {onRetry && <button className="btn secondary" onClick={onRetry}>{t("common.retry")}</button>}</div>;
}

function Top({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="content-top"><span className="title">{title}</span>{children}</div>;
}

function Hero({ state, title, lead, cfg, children }: { state: "idle" | "waiting"; title: string; lead: string; cfg?: MascotConfig; children: React.ReactNode }) {
  const bot = useBotCfg();
  return <div className="home" data-testid="chat-tool-empty">
    <div className="chat-hero"><Mascot cfg={cfg ?? bot} state={state} size={72} track interactive /></div>
    <h1>{title}</h1><p className="chat-lead">{lead}</p>{children}
  </div>;
}

function Dock({ placeholder, onSend, disabled, children }: { placeholder: string; onSend: (text: string) => Promise<boolean>; disabled?: boolean; children?: React.ReactNode }) {
  const t = useT();
  return <div className="dock">{children}<Composer placeholder={placeholder} onSend={onSend} disabled={disabled} hideModel testId="chat-tool" /><span className="hint">{t("chat.hint")}</span></div>;
}

const inline = (text: string) => text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g).map((x, i) =>
  /^\*\*.+\*\*$/.test(x) ? <b key={i}>{x.slice(2, -2)}</b> : /^`.+`$/.test(x) ? <code key={i}>{x.slice(1, -1)}</code> : /^\*.+\*$/.test(x) ? <i key={i}>{x.slice(1, -1)}</i> : x);
const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

function Prose({ text }: { text: string }) {
  const lines = text.split("\n"), out: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    if (!l.trim()) continue;
    if (/^\s*\|/.test(l) && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1] ?? "") && (lines[i + 1] ?? "").includes("-")) {
      const head = cells(l), rows: string[][] = [];
      for (i += 2; i < lines.length && /^\s*\|/.test(lines[i]!); i++) rows.push(cells(lines[i]!));
      i--;
      out.push(<div key={i} className="chat-tool-table"><table><thead><tr>{head.map((c, k) => <th key={k}>{inline(c)}</th>)}</tr></thead>
        <tbody>{rows.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    const h = /^#{1,6}\s+(.*)$/.exec(l), li = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(l);
    out.push(h ? <h4 key={i}>{inline(h[1]!)}</h4> : li ? <p key={i} className="chat-tool-li">{inline(li[1]!)}</p> : /^\s*---+\s*$/.test(l) ? null : <p key={i}>{inline(l)}</p>);
  }
  return <>{out}</>;
}

function Sources({ list }: { list: Citation[] }) {
  const seen = new Set<string>();
  const rows = list.filter((c) => c.url && /^https:\/\//.test(c.url) && !seen.has(c.url) && seen.add(c.url));
  return rows.length ? <div className="chat-cards" data-testid="chat-tool-sources">{rows.slice(0, 5).map((c, i) => <a key={c.url} className="chat-rcard" href={c.url} target="_blank" rel="noreferrer" style={css({ "--i": i })}>
    <span className="chat-src-site"><span className="chat-fav" aria-hidden style={{ width: 16, height: 16 }}>{(c.domain || new URL(c.url!).hostname)[0]}</span>{c.domain || new URL(c.url!).hostname}</span>
    <span className="chat-src-t">{c.title || c.url}</span></a>)}</div> : null;
}

/* ---------------- Web search */
export function SearchTool({ epoch }: { epoch: string }) {
  const t = useT();
  const th = useToolThread(epoch);
  const ask = (q: string) => th.send({ message: q });
  const first = th.list?.find((m) => m.role === "user");
  return <>
    <Top title={first ? first.text : t("chat.screen.search-results")}>{th.conversation && <><div className="spacer" /><IconBtn icon="compose" label={t("chat.newChat")} onClick={th.reset} /></>}</Top>
    {!th.conversation ? <Hero state="idle" title={t("chat.tools.search.title")} lead={t("chat.tools.search.lead")}>
      {th.failed && <ErrorNote />}<Composer placeholder={t("chat.tools.search.placeholder")} onSend={ask} disabled={!epoch} hideModel testId="chat-tool" />
    </Hero> : <>
      <div className="thread"><div className="thread-inner chat-sr" data-testid="chat-tool-thread">
        {th.list?.map((m) => m.role === "user" ? <div key={m.id} className="msg-user">{m.text}</div>
          : !m.finish_reason ? <BotRow key={m.id} st="working"><span className="thinking">{t("chat.tools.search.working")}</span>
            <div className="chat-cards">{[0, 1, 2, 3].map((i) => <div key={i} className="chat-rcard" aria-hidden><span className="skel line" style={{ width: "50%" }} /><span className="skel line" /></div>)}</div></BotRow>
          : <BotRow key={m.id} st="done"><Sources list={m.citations ?? []} /><div data-testid="chat-tool-answer"><Prose text={m.text} /></div></BotRow>)}
        {th.failed && <ErrorNote onRetry={th.retry} />}
      </div></div>
      <Dock placeholder={t("chat.search.followUp")} onSend={ask} disabled={th.waiting} />
    </>}
  </>;
}

/* ---------------- Deep research */
function PlanCard({ plan, onStart, busy }: { plan: Plan; onStart: (p: Plan) => void; busy: boolean }) {
  const t = useT();
  const [questions, setQuestions] = React.useState(plan.questions);
  const [editing, setEditing] = React.useState(false);
  const valid = questions.length > 0 && questions.every((q) => q.trim());
  return <><p>{t("chat.deep.planIntro")}</p>
    <div className="card chat-plan" data-testid="chat-research-plan">
      <div className="chat-plan-h"><Icon name="globe" /><b>{plan.title}</b></div>
      <ol className="chat-steps">{questions.map((q, i) => <li key={i}>{editing ? <input className="input" value={q} aria-label={t("chat.deep.step", { n: i + 1 })} onChange={(e) => setQuestions((l) => l.map((x, k) => k === i ? e.target.value : x))} /> : q}</li>)}</ol>
      <div className="chat-plan-f"><span className="chat-meta">{t("chat.tools.research.estimate")}</span><div className="spacer" />
        <button className="btn secondary" disabled={busy} onClick={() => setEditing((e) => !e)}>{editing ? t("chat.deep.finish") : t("chat.deep.editPlan")}</button>
        <button className="btn primary" data-testid="chat-research-start" disabled={busy || !valid} onClick={() => onStart({ ...plan, questions: questions.map((q) => q.trim()) })}>{t("chat.deep.start")}</button></div>
    </div></>;
}

export function ResearchTool({ epoch }: { epoch: string }) {
  const t = useT();
  const th = useToolThread(epoch);
  const list = th.list ?? [];
  const answers = list.filter((m) => m.role === "assistant");
  const last = answers.at(-1);
  const plan = [...answers].reverse().find((m) => m.research_plan)?.research_plan;
  const running = !!last && !last.finish_reason && answers.length > 1;
  const done = !!last?.finish_reason && !!last.text.trim() && answers.length > 1;
  const start = (p: Plan) => void th.send({ message: p.title, research: { action: "run", plan: { title: p.title, questions: p.questions, ...(p.outline ? { outline: p.outline } : {}) } } });
  const heads = done ? last!.text.split("\n").flatMap((l) => /^#{1,3}\s+(.*)$/.exec(l)?.[1]?.replace(/\*\*/g, "") ?? []) : [];
  return <>
    <Top title={t("chat.screen.deep-research")}>
      {running && <span className="badge run"><span className="spin" />{t("chat.deep.running")}</span>}{done && <span className="badge ok">{t("chat.deep.done")}</span>}
      {th.conversation && <><div className="spacer" /><IconBtn icon="compose" label={t("chat.newChat")} onClick={th.reset} /></>}
    </Top>
    {!th.conversation ? <Hero state="idle" title={t("chat.tools.research.title")} lead={t("chat.tools.research.lead")}>
      {th.failed && <ErrorNote />}<Composer placeholder={t("chat.tools.research.placeholder")} onSend={(m) => th.send({ message: m, research: { action: "plan" } })} disabled={!epoch} hideModel testId="chat-tool" />
    </Hero> : done ? <div className="chat-report" data-testid="chat-research-report">
      <nav className="chat-toc" aria-label={t("chat.deep.tocLabel")}><div className="h3">{t("chat.deep.toc")}</div>{heads.map((h, i) => <span key={i} className="chat-toc-i"><span className="chat-num">{i + 1}</span>{h}</span>)}</nav>
      <article className="chat-rep"><h1>{plan?.title}</h1><Sources list={last!.citations ?? []} /><Prose text={last!.text} /></article>
    </div> : <>
      <div className="thread"><div className="thread-inner" data-testid="chat-tool-thread">
        {list[0] && <div className="msg-user">{list[0].text}</div>}
        {running && plan ? <BotRow st="working"><div className="card chat-plan" data-testid="chat-research-running">
          <div className="chat-plan-h"><b>{plan.title}</b></div>
          <div className="chat-prog-track"><span className="chat-prog-ind chat-tool-indeterminate" /></div>
          <ol className="chat-steps">{plan.questions.map((q, i) => <li key={i}>{q}</li>)}</ol>
          <div className="chat-plan-f"><span className="chat-meta">{t("chat.deep.closeOk")}</span></div></div></BotRow>
          : plan && last?.finish_reason ? <BotRow st="waiting"><PlanCard plan={plan} onStart={start} busy={th.busy} /></BotRow>
          : last?.finish_reason ? <BotRow st="done"><Prose text={last.text} /></BotRow>
          : <BotRow st="thinking"><span className="thinking">{t("chat.tools.research.planning")}</span></BotRow>}
        {th.failed && <ErrorNote onRetry={th.retry} />}
      </div></div>
    </>}
  </>;
}

/* ---------------- Images */
function LibraryImage({ epoch, id, i }: { epoch: string; id: string; i: number }) {
  const t = useT();
  const img = useQuery(() => call<{ url: string }>(epoch, "file.content", { file: id }), [epoch, id]);
  return <div className="chat-gtile" style={css({ "--i": i })} data-testid="chat-image-tile">
    {img.state === "ready" ? <><span className="chat-gimg chat-gimg-live" role="img" aria-label={t("chat.search.image", { n: i + 1 })} style={{ backgroundImage: `url("${img.data.url}")` }} />
      <div className="chat-gact"><a className="ibtn" href={img.data.url} download={`cortex-${id}.png`} aria-label={t("chat.image.download")}><Icon name="download" /></a></div></>
      : <span className="chat-gshim" />}
  </div>;
}

const FORMATS: [string, string][] = [["square", "1:1"], ["landscape", "3:2"], ["portrait", "2:3"], ["wide", "16:9"]];

export function ImagesTool({ epoch }: { epoch: string }) {
  const t = useT();
  const th = useToolThread(epoch);
  const [fmt, setFmt] = React.useState("landscape");
  const recent = useQuery(async () => epoch ? (await call<{ items: { id: string }[] }>(epoch, "library.images")).items : [], [epoch]);
  const ratio = FORMATS.find((f) => f[0] === fmt)![1];
  const send = (prompt: string) => th.send({ message: t("chat.tools.image.ask", { format: t(`chat.image.fmt.${fmt}`, { ratio }), prompt }) });
  const chips = <div className="chat-fmts" role="group" aria-label={t("chat.image.format")}>{FORMATS.map(([id, r]) => <button key={id} className="chip" aria-pressed={fmt === id} data-pressed={fmt === id || undefined} onClick={() => setFmt(id)}><span className="chat-ratio" data-f={r} />{t(`chat.image.fmt.${id}`, { ratio: r })}</button>)}</div>;
  const ids = (m: Message) => (m.generated_images ?? []).flatMap((g) => g.retention === "retained" ? [...new Set([g.file_id, ...(g.library_file_ids ?? [])])].filter((x): x is string => !!x) : []);
  return <>
    <Top title={t("chat.screen.image-gen")}>{th.conversation && <><div className="spacer" /><IconBtn icon="compose" label={t("chat.newChat")} onClick={th.reset} /></>}</Top>
    {!th.conversation ? <div className="thread"><div className="thread-inner chat-tool-images">
      <Hero state="idle" title={t("chat.tools.image.title")} lead={t("chat.tools.image.lead")}>
        {th.failed && <ErrorNote />}{chips}<Composer placeholder={t("chat.image.placeholder")} onSend={send} disabled={!epoch} hideModel testId="chat-tool" />
      </Hero>
      {recent.state === "ready" && recent.data.length > 0 && <section data-testid="chat-image-recent"><h3 className="h3">{t("chat.tools.image.recent")}</h3>
        <div className="chat-gen" data-fmt="square">{recent.data.map((f, i) => <LibraryImage key={f.id} epoch={epoch} id={f.id} i={i} />)}</div></section>}
    </div></div> : <>
      <div className="thread"><div className="thread-inner" data-testid="chat-tool-thread">
        {th.list?.map((m) => m.role === "user" ? <div key={m.id} className="msg-user">{m.text}</div>
          : !m.finish_reason ? <BotRow key={m.id} st="working"><span className="thinking">{t("chat.image.creating", { count: 1 })}</span>
            <div className="chat-gen" data-fmt={fmt}><div className="chat-gtile"><span className="chat-gshim" /></div></div></BotRow>
          : ids(m).length ? <BotRow key={m.id} st="done"><div className="chat-gen" data-fmt={fmt} data-testid="chat-image-result">{ids(m).map((id, i) => <LibraryImage key={id} epoch={epoch} id={id} i={i} />)}</div><Prose text={m.text} /></BotRow>
          : <BotRow key={m.id} st="blocked"><div className="chat-err warn" data-testid="chat-image-refused"><Icon name="shield-check" /><span className="chat-grow"><b>{t("chat.tools.image.none")}</b><span>{m.text}</span></span></div></BotRow>)}
        {th.failed && <ErrorNote onRetry={th.retry} />}
      </div></div>
      <Dock placeholder={t("chat.image.placeholder")} onSend={send} disabled={th.waiting}>{chips}</Dock>
    </>}
  </>;
}

/* ---------------- Temporary chat */
export function TempTool({ epoch }: { epoch: string }) {
  const t = useT();
  const { go } = useNav();
  const th = useToolThread(epoch);
  const bot = useBotCfg();
  const ghost: MascotConfig = { ...bot, color: COLORS.find((c) => c[0] === "slate")![1], glasses: "sunglasses" };
  const send = (message: string) => th.send(th.conversation ? { message } : { message, temporary: true });
  return <>
    <Top title={t("chat.screen.temp-chat")}><span className="badge chat-ghost"><Icon name="clock-loop" size={12} />{t("chat.temp.notSaved")}</span><div className="spacer" /><button className="btn secondary" onClick={() => go("home")}>{t("chat.temp.leave")}</button></Top>
    <div className="banner info chat-banner chat-tool-banner" role="note"><Icon name="info" /><span className="grow">{t("chat.temp.banner")}</span></div>
    {!th.conversation ? <Hero state="idle" cfg={ghost} title={t("chat.screen.temp-chat")} lead={t("chat.temp.lead")}>
      {th.failed && <ErrorNote />}<Composer placeholder={t("chat.temp.placeholder")} onSend={send} disabled={!epoch} hideModel testId="chat-tool" />
    </Hero> : <>
      <div className="thread"><div className="thread-inner" data-testid="chat-tool-thread">
        {th.list?.map((m) => m.role === "user" ? <div key={m.id} className="msg-user">{m.text}</div>
          : <BotRow key={m.id} cfg={ghost} st={m.finish_reason ? "idle" : "thinking"}>{m.finish_reason ? <div data-testid="chat-tool-answer"><Prose text={m.text} /></div> : <span className="thinking">{t("chat.thinking")}</span>}</BotRow>)}
        {th.failed && <ErrorNote onRetry={th.retry} />}
      </div></div>
      <Dock placeholder={t("chat.temp.placeholder")} onSend={send} disabled={th.waiting} />
    </>}
  </>;
}
