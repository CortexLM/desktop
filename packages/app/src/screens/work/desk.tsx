// Inbox, approvals, activity, notifications and connectors.
import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import type { Permission, Session, Bot } from "@cortex/schema";
import { Icon, IconBtn, Switch, Pop, MItem, MSep, Tip, useToast } from "../../kit/ui";
import { Mascot, DEFAULT_MASCOT } from "../../mascot/Mascot";
import { useVariant } from "../../registry";
import { useT } from "../../i18n";
import { isPreview, useFixtures } from "../../preview";
import { api } from "../../api";
import { usePermissions, useSessions, useBots } from "../../state/live";
import { toolName } from "../../state/tool-label";
import { css, NB, useGo, useMainBot, useDate, Top, Empty, TabBar, Mono, Check, BotFace, type BotsFx } from "./common";
import type { WorkFx, Msg, Conn } from "./fixtures";

/* ====================================================================== */
/* 5. Inbox                                                               */
/* ====================================================================== */
const URG: [Msg["urg"], string][] = [["now", "err"], ["today", "wait"], ["later", ""]];

export function Inbox() {
  const t = useT();
  const go = useGo();
  const toast = useToast();
  const preview = isPreview();
  const fx = useFixtures<WorkFx>("work");
  const fxb = useFixtures<BotsFx>("bots");
  const main = useMainBot();
  const [v] = useVariant("normal");
  // Live: no inbox feed in the engine yet, so the honest state is the "all handled" one.
  const seed = preview && v !== "empty" ? fx.inbox ?? [] : [];
  const [items, setItems] = React.useState<Msg[]>(seed);
  const [out, setOut] = React.useState<number[]>([]);
  React.useEffect(() => { setItems(seed); setOut([]); }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = (m: Msg) => { setOut((o) => [...o, m.id]); setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== m.id)), 280); toast.add({ title: t("work.inbox.toastDone"), description: m.t, data: { icon: "check", undo: true, onUndo: () => { setOut((o) => o.filter((x) => x !== m.id)); setItems((xs) => (xs.some((x) => x.id === m.id) ? xs : [...xs, m].sort((a, b) => a.id - b.id))); } } }); };
  const name = (n: string) => (n === fxb.main?.name ? main?.cfg.name ?? n : n);
  const role = (n: string) => fxb.team?.find((b) => b.cfg.name === n)?.role ?? t("work.mainBot");
  return (<>
    <Top title={t("work.inbox.title")}>{items.length > 0 && <button className="btn secondary" style={{ height: 28 }} onClick={() => { setOut(items.map((x) => x.id)); setTimeout(() => setItems([]), 300); }}><Icon name="check" size={16} />{t("work.inbox.markAll")}</button>}</Top>
    {!items.length ? (
      <Empty state="done" title={t("work.inbox.emptyTitle")} text={t("work.inbox.emptyText")}>
        <div className="travail-actions"><button className="btn secondary" onClick={() => go("activity")}><Icon name="history" size={16} />{t("work.inbox.seeActivity")}</button><button className="btn secondary" onClick={() => go("work-home")}>{t("work.inbox.backToBoard")}</button></div>
      </Empty>
    ) : (
      <div className="page"><div className="travail-narrow">
        <p className="travail-lede" style={{ marginTop: 6 }}>{t("work.inbox.lede", { count: items.length })}</p>
        {URG.map(([u, s]) => { const xs = items.filter((m) => m.urg === u); const l = t(`work.inbox.urg.${u}`); return !xs.length ? null : (
          <section key={u} className="travail-sec" aria-label={l}>
            <h3 className="h3"><span className="travail-urg"><span className="travail-dot" data-s={s} />{l}<span className="travail-count">{xs.length}</span></span></h3>
            <div className="list">{xs.map((m, i) => (
              <article key={m.id} className="travail-inbox-i travail-rise" style={css(i)} data-out={out.includes(m.id) || undefined}>
                <BotFace name={m.bot} size={32} />
                <div className="travail-grow">
                  <span className="ttl"><span className="travail-ell">{m.t}</span></span>
                  <span className="sub">{m.d}</span>
                  <span className="travail-meta">{name(m.bot)} · {role(m.bot)} · {m.when}</span>
                  <div className="travail-actions">
                    <button className="btn primary" onClick={() => { const [id, vv] = m.to.split(":"); go(id, vv); }}>{m.act}</button>
                    <button className="btn secondary" onClick={() => done(m)}>{t("work.inbox.markDone")}</button>
                    <Pop trigger={<button className="ibtn" aria-label={t("work.moreOptions")}><Icon name="more-dots" size={16} /></button>}>
                      <MItem icon="clock-loop" onClick={() => toast.add({ title: t("work.inbox.toastRemind"), data: { icon: "bell" } })}>{t("work.inbox.remind")}</MItem><MItem icon="bot">{t("work.inbox.replyTo", { name: name(m.bot) })}</MItem><MSep /><MItem icon="archive" onClick={() => done(m)}>{t("work.archive")}</MItem>
                    </Pop>
                  </div>
                </div>
              </article>))}
            </div>
          </section>); })}
      </div></div>
    )}
  </>);
}

/* ====================================================================== */
/* 6. Approvals                                                           */
/* ====================================================================== */
type Ap = { id: string; bot: string; icon: string; kind: string; t: string; d: string; when: string };
const TOOL_ICON: Record<string, string> = { bash: "terminal", write: "edit", edit: "edit", webfetch: "globe", read: "file" };

export function Approvals() {
  return isPreview() ? <ApprovalsPreview /> : <ApprovalsLive />;
}

function ApprovalsLive() {
  const t = useT();
  const go = useGo();
  const toast = useToast();
  const date = useDate();
  const perms = usePermissions();
  const sessions = useSessions();
  const bots = useBots();
  const [gone, setGone] = React.useState<Record<string, "ok" | "no">>({});
  const [always, setAlways] = React.useState<Record<string, boolean>>({});
  const ss: Session[] = sessions.state === "ready" ? sessions.data : [];
  const bs: Bot[] = bots.state === "ready" ? bots.data : [];
  const list: Permission[] = perms.state === "ready" ? perms.data : [];
  const botOf = (p: Permission) => { const s = ss.find((x) => x.id === p.sessionID); return bs.find((b) => b.id === s?.botID); };
  const decide = (p: Permission, d: "ok" | "no") => {
    setGone((g) => ({ ...g, [p.id]: d }));
    api.permissions.reply(p.id, d === "no" ? "reject" : always[p.id] ? "always" : "once").then(
      () => toast.add({ title: d === "ok" ? t("work.appr.approved") : t("work.appr.denied"), description: toolName(t, p.tool), data: { icon: d === "ok" ? "check-circle" : "x-circle" } }),
      () => { setGone((g) => { const n = { ...g }; delete n[p.id]; return n; }); toast.add({ title: t("work.error.save"), data: { icon: "alert-triangle" } }); });
  };
  const left = list.filter((a) => !gone[a.id]).length;
  return (<>
    <Top title={t("work.toApprove")}><button className="btn secondary" style={{ height: 28 }} onClick={() => go("bot-settings", "permissions")}><Icon name="shield-check" size={16} />{t("work.appr.rules")}</button></Top>
    {perms.state === "loading" ? null : perms.state === "error" ? <Empty state="blocked" title={t("work.error.loadTitle")} text={t("work.error.loadText")}>
      <button className="btn secondary" onClick={perms.reload}>{t("common.retry")}</button>
    </Empty> : !left ? <Empty state="done" title={t("work.appr.emptyTitle")} text={t("work.appr.emptyText")} /> : (
      <div className="page"><div className="travail-narrow">
        <p className="travail-lede" style={{ marginTop: 6 }}>{t("work.appr.lede", { count: left })}</p>
        {list.map((p, i) => { const b = botOf(p); return (
          <div key={p.id} className="travail-appr travail-rise" style={css(i)} data-out={gone[p.id]}>
            <div><article className="travail-appr-card" aria-label={t("work.appr.cardLabel", { kind: toolName(t, p.tool), title: p.pattern })}>
              <span className="li-ic"><Icon name={TOOL_ICON[p.tool] ?? "key"} size={16} /></span>
              <div className="travail-grow">
                <span className="travail-meta" style={{ display: "flex", alignItems: "center", gap: 6 }}>{b && <BotFace name={b.id} size={16} bots={bs} />}{b ? `${b.name} · ` : ""}{toolName(t, p.tool)} · {date.short(p.time)}</span>
                <span className="ttl">{p.pattern}</span>
                <span className="sub">{p.input}</span>
                <div className="travail-actions">
                  <button className="btn primary" data-testid="approval-allow" onClick={() => decide(p, "ok")}><Icon name="check" size={16} />{t("work.appr.approve")}</button>
                  <button className="btn secondary" data-testid="approval-deny" onClick={() => decide(p, "no")}>{t("work.appr.deny")}</button>
                  <button className="btn secondary" onClick={() => go("work-task", "", { id: p.sessionID })}><Icon name="edit" size={16} />{t("work.appr.review")}</button>
                  <Check checked={!!always[p.id]} onChange={(c) => setAlways({ ...always, [p.id]: c })}>{t("work.appr.always")}</Check>
                </div>
              </div>
              {gone[p.id] && <span className={"badge travail-stamp " + (gone[p.id] === "ok" ? "ok" : "err")}><Icon name={gone[p.id] === "ok" ? "check" : "close"} size={16} />{gone[p.id] === "ok" ? t("work.appr.approved") : t("work.appr.denied")}</span>}
            </article></div>
          </div>); })}
      </div></div>
    )}
  </>);
}

function ApprovalsPreview() {
  const t = useT();
  const go = useGo();
  const toast = useToast();
  const fx = useFixtures<WorkFx>("work");
  const fxb = useFixtures<BotsFx>("bots");
  const main = useMainBot();
  const [v, setV] = useVariant("list");
  const [gone, setGone] = React.useState<Record<string, "ok" | "no">>({});
  const [always, setAlways] = React.useState<Record<string, boolean>>({});
  const [edit, setEdit] = React.useState(false);
  React.useEffect(() => { setGone({}); setEdit(false); }, [v]);
  const name = (n: string) => (n === fxb.main?.name ? main?.cfg.name ?? n : n);
  const APS: Ap[] = fx.approvals ?? [];
  const P = fx.payment;
  const decide = (a: Ap, d: "ok" | "no") => {
    setGone((g) => ({ ...g, [a.id]: d }));
    const desc = d === "ok" ? t("work.appr.toastOk", { kind: a.kind, name: name(a.bot) }) : t("work.appr.toastNo", { kind: a.kind, name: name(a.bot) });
    toast.add({ title: d === "ok" ? t("work.appr.approved") : t("work.appr.denied"), description: desc + (always[a.id] && d === "ok" ? t("work.appr.toastRule") : ""), data: { icon: d === "ok" ? "check-circle" : "x-circle", undo: true, onUndo: () => setGone((g) => { const n = { ...g }; delete n[a.id]; return n; }) } });
  };
  const pay = APS[1];
  const left = APS.filter((a) => !gone[a.id]).length;
  const maxBot = fxb.team?.find((b) => b.cfg.name === P.bot);

  if (v !== "list") {
    const res = v === "approved" ? "ok" : v === "denied" ? "no" : null;
    return (<>
      <div className="content-top"><IconBtn icon="arrow-left" label={t("work.appr.backToList")} onClick={() => setV("list")} /><span className="title">{pay?.kind}</span><div className="spacer" /><span className="travail-meta">{t("work.appr.position", { n: 2, total: 3 })}</span><IconBtn icon="arrow-left" label={t("work.appr.prev")} /><IconBtn icon="arrow-right" label={t("work.appr.next")} /></div>
      <div className="page"><div className="travail-mid travail-split2">
        <section className="travail-card travail-rise">
          {res ? <div className="travail-result">
            <Mascot cfg={maxBot?.cfg ?? { name: P.bot, ...DEFAULT_MASCOT }} state={res === "ok" ? "done" : "waiting"} size={72} />
            <h2>{res === "ok" ? P.okTitle : P.noTitle}</h2>
            <p>{res === "ok" ? P.okText : P.noText}</p>
            <div className="travail-actions" style={{ marginTop: 10 }}>{res === "ok" ? <button className="btn secondary" onClick={() => toast.add({ title: t("work.appr.toastTransferCancelled"), data: { icon: "x-circle" } })}>{P.cancelTransfer}</button> : <button className="btn secondary" onClick={() => setV("detail")}>{t("work.appr.reconsider")}</button>}<button className="btn primary" onClick={() => setV("list")}>{t("work.appr.nextRequest")}</button></div>
          </div> : <>
            <div className="travail-dlg-head"><BotFace name={P.bot} size={36} /><div><div style={{ fontWeight: 500 }}>{P.bot} · {maxBot?.role}</div><div className="travail-meta">{t("work.appr.received", { when: pay?.when ?? "" })}</div></div></div>
            <div className="travail-meta">{t("work.appr.amount")}</div>
            {edit ? <input className="input travail-amount" style={{ height: 44, width: 200 }} defaultValue={P.amount} aria-label={t("work.appr.amountLabel")} /> : <div className="travail-amount">{P.amount}{NB}€</div>}
            <dl className="travail-kv">{P.kv.map(([k, x], i) => <React.Fragment key={k}><dt>{k}</dt><dd className={i === 1 ? "mono" : undefined}>{x}</dd></React.Fragment>)}</dl>
            <div className="banner info" style={{ margin: "0 0 14px" }}><Icon name="shield-check" size={16} /><span className="grow" style={{ color: "var(--t1)" }}>{P.check}</span></div>
            <div className="travail-actions">
              <button className="btn primary" onClick={() => setV("approved")}><Icon name="check" size={16} />{t("work.appr.approve")}</button>
              <button className="btn secondary" onClick={() => setV("denied")}>{t("work.appr.deny")}</button>
              <button className="btn secondary" aria-pressed={edit} onClick={() => setEdit((e) => !e)}><Icon name="edit" size={16} />{edit ? t("work.appr.finish") : t("work.edit")}</button>
            </div>
            <div style={{ marginTop: 14 }}><Check checked={!!always.pay} onChange={(c) => setAlways({ ...always, pay: c })}>{P.alwaysRule}</Check></div>
          </>}
        </section>
        <section className="travail-card travail-rise" style={css(1)}>
          <h3 className="h3">{t("work.appr.attachment")}</h3>
          <div style={{ borderRadius: 10, background: "var(--sidebar-bg)", padding: 16, boxShadow: "var(--ring)", display: "grid", gap: 10 }} aria-label={t("work.appr.invoicePreview", { ref: P.invoice.ref })}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><b style={{ fontWeight: 600, fontSize: 13 }}>{P.invoice.vendor}</b><span className="mono">{P.invoice.ref}</span></div>
            <span className="travail-meta">{P.invoice.address}</span>
            {P.invoice.lines.map(([a, b]) => <div key={a} style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--line)", paddingTop: 8 }}><span>{a}</span><span className="mono">{b}{NB}€</span></div>)}
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--line)", paddingTop: 8, fontWeight: 500 }}><span>{P.invoice.totalLabel}</span><span className="mono">{P.amount}{NB}€</span></div>
          </div>
          <h3 className="h3" style={{ marginTop: 16 }}>{t("work.appr.why", { name: P.bot })}</h3>
          <p style={{ margin: 0, color: "var(--t2)", fontSize: 13, lineHeight: "20px" }}>{P.why}</p>
        </section>
      </div></div>
    </>);
  }

  return (<>
    <Top title={t("work.toApprove")}><button className="btn secondary" style={{ height: 28 }} onClick={() => go("bot-settings", "permissions")}><Icon name="shield-check" size={16} />{t("work.appr.rules")}</button></Top>
    {!left ? <Empty state="done" title={t("work.appr.emptyTitle")} text={t("work.appr.emptyText")}><button className="btn secondary" onClick={() => setGone({})}>{t("work.appr.reviewAgain")}</button></Empty> : (
      <div className="page"><div className="travail-narrow">
        <p className="travail-lede" style={{ marginTop: 6 }}>{t("work.appr.lede", { count: left })}</p>
        {APS.map((a, i) => (
          <div key={a.id} className="travail-appr travail-rise" style={css(i)} data-out={gone[a.id]}>
            <div><article className="travail-appr-card" aria-label={t("work.appr.cardLabel", { kind: a.kind, title: a.t })}>
              <span className="li-ic"><Icon name={a.icon} size={16} /></span>
              <div className="travail-grow">
                <span className="travail-meta" style={{ display: "flex", alignItems: "center", gap: 6 }}><BotFace name={a.bot} size={16} />{name(a.bot)} · {a.kind} · {a.when}</span>
                <span className="ttl">{a.t}</span>
                <span className="sub">{a.d}</span>
                <div className="travail-actions">
                  <button className="btn primary" data-testid="approval-allow" onClick={() => decide(a, "ok")}><Icon name="check" size={16} />{t("work.appr.approve")}</button>
                  <button className="btn secondary" data-testid="approval-deny" onClick={() => decide(a, "no")}>{t("work.appr.deny")}</button>
                  <button className="btn secondary" onClick={() => (a.id === "pay" ? setV("detail") : a.id === "mail" ? go("work-task", "approval") : toast.add({ title: t("work.appr.toastDraft"), data: { icon: "edit" } }))}><Icon name="edit" size={16} />{a.id === "pay" ? t("work.appr.review") : t("work.edit")}</button>
                  <Check checked={!!always[a.id]} onChange={(c) => setAlways({ ...always, [a.id]: c })}>{t("work.appr.always")}</Check>
                </div>
              </div>
              {gone[a.id] && <span className={"badge travail-stamp " + (gone[a.id] === "ok" ? "ok" : "err")}><Icon name={gone[a.id] === "ok" ? "check" : "close"} size={16} />{gone[a.id] === "ok" ? t("work.appr.approved") : t("work.appr.denied")}</span>}
            </article></div>
          </div>))}
      </div></div>
    )}
  </>);
}

/* ====================================================================== */
/* 7. Activity                                                            */
/* ====================================================================== */
const TYPES = ["all", "email", "routines", "tickets", "crm", "documents", "browsing", "errors"];

export function Activity() {
  const t = useT();
  const preview = isPreview();
  const fx = useFixtures<WorkFx>("work");
  const fxb = useFixtures<BotsFx>("bots");
  const main = useMainBot();
  const [v] = useVariant("timeline");
  const [who, setWho] = React.useState(v === "filtered" ? fxb.main?.name ?? "" : "");
  const [type, setType] = React.useState(v === "filtered" ? "email" : "all");
  React.useEffect(() => { setWho(v === "filtered" ? fxb.main?.name ?? "" : ""); setType(v === "filtered" ? "email" : "all"); }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = (n: string) => (n === fxb.main?.name ? main?.cfg.name ?? n : n);
  // Live: the engine has no activity journal yet; the honest state is the empty one.
  const src = preview ? fx.activity ?? [] : [];
  const days = src.map(([d, xs]) => [d, xs.filter((a) => (!who || a.bot === who) && (type === "all" || a.type === type))] as const).filter(([, xs]) => xs.length);
  const clear = () => { setWho(""); setType("all"); };
  const botNames = preview ? [fxb.main?.name ?? "", ...(fxb.team ?? []).map((b) => b.cfg.name).filter((n) => fx.activityBots.includes(n))] : [];
  return (<>
    <Top title={t("work.activity")}>
      {preview && <Pop align="end" trigger={<button className="btn secondary" style={{ height: 28 }}>{!who ? <Icon name="bot" size={16} /> : <BotFace name={who} size={16} state="idle" />}{!who ? t("work.allBots") : name(who)}<Icon name="chevron-down" size={16} /></button>}>
        {["", ...botNames].map((n) => <MItem key={n || "all"} onClick={() => setWho(n)}>{!n ? t("work.allBots") : name(n)}</MItem>)}
      </Pop>}
      <IconBtn icon="download" label={t("work.act.export")} disabled={!preview} />
    </Top>
    {!preview ? <Empty state="idle" title={t("work.act.liveEmptyTitle")} text={t("work.act.liveEmptyText")} /> :
    <div className="page"><div className="travail-narrow">
      <div className="travail-filters" role="group" aria-label={t("work.act.filterByType")}>
        {TYPES.map((x) => <button key={x} className="chip" aria-pressed={type === x} data-pressed={type === x || undefined} onClick={() => setType(x)}>{t(`work.act.type.${x}`)}</button>)}
      </div>
      {(who || type !== "all") && v !== "loading" && <div className="travail-filters" style={{ marginTop: -8 }}><span className="travail-meta">{t("work.act.summary", { count: days.reduce((n, [, xs]) => n + xs.length, 0), who: !who ? t("work.allBotsLower") : name(who), type: type === "all" ? t("work.act.allTypes") : t(`work.act.type.${type}`).toLowerCase() })}</span><button className="btn secondary" style={{ height: 24, padding: "0 8px", fontSize: 11 }} onClick={clear}>{t("work.act.clear")}</button></div>}
      {v === "loading" ? <div aria-busy="true" aria-label={t("work.act.loading")}>
        {[0, 1].map((d) => <div key={d}><div className="travail-day"><span className="skel title" style={{ width: 120 }} /></div><div className="travail-tline">
          {[0, 1, 2, 3].map((i) => <div key={i} className="travail-act"><span className="skel circle" style={{ position: "absolute", left: -35, width: 24, height: 24 }} /><span className="skel line" style={{ width: `${70 - i * 9}%` }} /><span style={{ flex: 1 }} /><span className="skel line" style={{ width: 36 }} /></div>)}
        </div></div>)}
      </div> : !days.length ? <Empty state="thinking" title={t("work.act.noneTitle")} text={t("work.act.noneText")}><button className="btn secondary" onClick={clear}>{t("work.act.clear")}</button></Empty>
      : days.map(([d, xs]) => (
        <section key={d} aria-label={d}>
          <h3 className="h3 travail-day">{d}</h3>
          <ol className="travail-tline" style={{ listStyle: "none", margin: "0 0 12px 15px" }}>
            {xs.map((a, i) => <li key={i} className="travail-act" style={css(i)}>
              <BotFace name={a.bot} size={24} /><Icon name={a.icon} size={16} style={a.type === "errors" ? { color: "var(--red)" } : undefined} />
              <span className="travail-grow"><b>{name(a.bot)}</b> · <b>{a.b}</b>{a.t}</span><span className="mono">{a.when}</span>
            </li>)}
          </ol>
        </section>))}
    </div></div>}
  </>);
}

/* ====================================================================== */
/* 8. Notifications (panel anchored under the bell)                      */
/* ====================================================================== */
export function Notifications() {
  const t = useT();
  const go = useGo();
  const preview = isPreview();
  const fx = useFixtures<WorkFx>("work");
  const fxb = useFixtures<BotsFx>("bots");
  const main = useMainBot();
  const [v, setV] = useVariant("unread");
  const [tab, setTab] = React.useState("all");
  // Live: no notification feed in the engine yet; the list is honestly empty.
  const NOTIFS = preview ? fx.notifications ?? [] : [];
  const [read, setRead] = React.useState<number[]>(v === "allread" ? NOTIFS.map((n) => n.id) : fx.readIds ?? []);
  React.useEffect(() => { setRead(v === "allread" ? NOTIFS.map((n) => n.id) : fx.readIds ?? []); }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  const xs = NOTIFS.filter((n) => tab === "all" || (tab === "mentions" ? n.kind === "mention" : n.kind === "bot"));
  const unread = (k?: string) => NOTIFS.filter((n) => !read.includes(n.id) && (!k || n.kind === k)).length;
  const who = (n: string) => (n === fxb.main?.name ? main?.cfg.name ?? n : n);
  const sets: [string, boolean][] = [["blocked", true], ["approval", true], ["taskDone", true], ["mention", true], ["routine", false]];
  const where: [string, boolean][] = [["inApp", true], ["system", true], ["digest", false]];
  return (<>
    <Top title={t("work.home.title")}><Tip label={t("work.notif.title")}><button className="ibtn" aria-label={t("work.notif.bellLabel", { count: unread() })} aria-expanded data-popup-open style={{ position: "relative" }}><Icon name="bell" size={16} />{unread() > 0 && <span style={{ position: "absolute", right: 5, top: 5, width: 7, height: 7, borderRadius: 4, background: "var(--blue)", boxShadow: "0 0 0 2px var(--content)" }} />}</button></Tip></Top>
    <div className="travail-notif-stage">
      <div className="travail-notif-bg" aria-hidden><div className="travail-board">{(["todo", "doing", "review", "done"]).map((c) => <div key={c} className="travail-col" style={{ minHeight: 420 }}><div className="travail-col-head">{t(`work.col.${c}`)}</div></div>)}</div></div>
      <section className="popup travail-notif" role="dialog" aria-label={t("work.notif.title")}>
        <div className="travail-notif-h">
          {v === "settings" ? <IconBtn icon="arrow-left" label={t("work.notif.back")} onClick={() => setV("unread")} /> : null}
          <span className="travail-grow">{v === "settings" ? t("work.notif.settings") : t("work.notif.title")}</span>
          {v !== "settings" && <button className="btn secondary" style={{ height: 28, boxShadow: "none" }} disabled={!unread()} onClick={() => setRead(NOTIFS.map((n) => n.id))}><Icon name="check" size={16} />{t("work.notif.markAll")}</button>}
          {v !== "settings" && <IconBtn icon="settings" label={t("work.notif.settings")} onClick={() => setV("settings")} />}
        </div>
        {v === "settings" ? <div className="travail-notif-l travail-n-set">
          <h3 className="h3" style={{ padding: "4px 10px 0" }}>{t("work.notif.when")}</h3>
          <div className="list" style={{ boxShadow: "none", background: "none" }}>
            {sets.map(([k, d]) => (
              <label key={k} className="li"><span className="grow ttl" style={{ fontSize: 12, fontWeight: 400 }}>{t(`work.notif.set.${k}`)}</span><Switch defaultChecked={d} aria-label={t(`work.notif.set.${k}`)} /></label>))}
          </div>
          <h3 className="h3" style={{ padding: "12px 10px 0" }}>{t("work.notif.where")}</h3>
          <div className="list" style={{ boxShadow: "none", background: "none" }}>
            {where.map(([k, d]) => (
              <label key={k} className="li"><span className="grow ttl" style={{ fontSize: 12, fontWeight: 400 }}>{t(`work.notif.where.${k}`)}</span><Switch defaultChecked={d} aria-label={t(`work.notif.where.${k}`)} /></label>))}
          </div>
          <label className="li" style={{ padding: "8px 10px" }}><span className="grow"><div className="ttl" style={{ fontSize: 12 }}>{t("work.notif.dnd")}</div><div className="sub">{t("work.notif.dndSub")}</div></span><Switch aria-label={t("work.notif.dnd")} /></label>
        </div> : <>
          <TabBar label={t("work.notif.filter")} value={tab} onChange={setTab} items={[["all", t("work.notif.tab.all"), unread()], ["mentions", t("work.notif.tab.mentions"), unread("mention")], ["bots", t("work.notif.tab.bots"), unread("bot")]]} />
          <div className="travail-notif-l" aria-live="polite">
            {!xs.length ? <div className="empty" style={{ padding: 24 }}><Icon name="bell" size={16} /><p>{t("work.notif.empty")}</p></div>
              : xs.map((n, i) => (
                <button key={n.id} className="travail-n-i travail-rise" style={css(i)} data-unread={!read.includes(n.id) || undefined} onClick={() => { setRead((r) => [...r, n.id]); go(n.to[0], n.to[1]); }}>
                  {n.initials ? <span className="avatar-dot" style={{ width: 28, height: 28, borderRadius: 14, margin: 0 }}>{n.initials}</span> : <BotFace name={n.who} size={28} />}
                  <span className="travail-grow"><span className="ttl"><b>{who(n.who)}</b>{n.t}</span><span className="travail-meta">{n.when}</span></span>
                  <span className="travail-unread" aria-label={read.includes(n.id) ? undefined : t("work.notif.unread")} />
                </button>))}
            {v === "allread" && <p className="travail-meta" style={{ textAlign: "center", padding: "10px 0 4px" }}>{t("work.notif.upToDate")}</p>}
          </div>
          <div className="travail-n-f"><button className="btn secondary" style={{ height: 28, boxShadow: "none" }} onClick={() => go("activity")}>{t("work.notif.allActivity")}</button><span className="travail-grow" /><button className="btn secondary" style={{ height: 28, boxShadow: "none" }} onClick={() => go("inbox")}>{t("work.inbox.title")}</button></div>
        </>}
      </section>
    </div>
  </>);
}

/* ====================================================================== */
/* 9. Connectors                                                          */
/* ====================================================================== */
const ST: Record<Conn["st"], string> = { on: "ok", re: "wait", err: "err", off: "" };

export function Connectors() {
  const t = useT();
  const go = useGo();
  const toast = useToast();
  const preview = isPreview();
  const fx = useFixtures<WorkFx>("work");
  const main = useMainBot();
  const fxb = useFixtures<BotsFx>("bots");
  const [v, setV] = useVariant("grid");
  // Live: connectors are not wired to the engine yet; the grid is honestly empty.
  const CONNS = preview ? fx.connectors ?? [] : [];
  const [conns, setConns] = React.useState(CONNS);
  const [cur, setCur] = React.useState<Conn | null>(null);
  const [phase, setPhase] = React.useState<"perms" | "link" | "ok" | "err">("perms");
  const [grant, setGrant] = React.useState<Record<string, boolean>>({});
  React.useEffect(() => {
    setConns(CONNS);
    if (v === "connecting" || v === "permissions") { setCur(CONNS[5] ?? null); setPhase(v === "connecting" ? "link" : "perms"); }
    else if (v === "error") { setCur(CONNS[3] ?? null); setPhase("err"); }
    else setCur(null);
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (phase !== "link" || !cur) return; const id = setTimeout(() => setPhase(v === "connecting" ? "link" : "ok"), 1600); return () => clearTimeout(id); }, [phase, cur, v]);
  const open = (c: Conn) => { setCur(c); setGrant({}); setPhase(c.st === "err" ? "err" : "perms"); };
  const finish = () => { if (!cur) return; setConns((xs) => xs.map((x) => (x.id === cur.id ? { ...x, st: "on" } : x))); toast.add({ title: t("work.conn.toastConnected", { name: cur.t }), description: t("work.conn.toastConnectedDesc", { name: main?.cfg.name ?? "" }), data: { icon: "link" } }); setCur(null); if (v !== "grid") setV("grid"); };
  const n = conns.filter((c) => c.st === "on").length;
  const errConn = conns.find((c) => c.st === "err");
  return (<>
    <Top title={t("work.conn.title")}>{preview && <span className="travail-meta" style={{ marginRight: 8 }}>{t("work.conn.count", { n, total: conns.length })}</span>}<IconBtn icon="search" label={t("work.conn.search")} disabled={!preview} /></Top>
    {!preview ? <Empty state="idle" title={t("work.conn.liveEmptyTitle")} text={t("work.conn.lede")}><button className="btn secondary" onClick={() => go("settings")}><Icon name="settings" size={16} />{t("work.conn.openSettings")}</button></Empty> :
    <div className="page"><div className="travail-mid">
      <p className="travail-lede" style={{ marginTop: 6 }}>{t("work.conn.lede")}</p>
      {errConn && <div className="banner err travail-banner"><Icon name="alert-triangle" size={16} /><span>{fx.connError.banner}</span><span className="grow">{fx.connError.bannerText.replace("{name}", main?.cfg.name ?? "")}</span><button className="btn secondary" onClick={() => open(errConn)}>{t("work.reconnect")}</button></div>}
      <h3 className="h3">{t("work.conn.connected")}</h3>
      <div className="travail-cgrid" style={{ marginBottom: 24 }}>{conns.filter((c) => c.st !== "off").map((c, i) => <ConnCard key={c.id} c={c} i={i} onOpen={open} />)}</div>
      <h3 className="h3">{t("work.conn.available")}</h3>
      <div className="travail-cgrid">{conns.filter((c) => c.st === "off").map((c, i) => <ConnCard key={c.id} c={c} i={i + 5} onOpen={open} />)}</div>
    </div></div>}
    <Dialog.Root open={!!cur} onOpenChange={(o) => { if (!o) { setCur(null); if (v !== "grid") setV("grid"); } }}>
      <Dialog.Portal><Dialog.Backdrop className="backdrop" /><Dialog.Popup className="dialog">
        {cur && <>
          <div className="travail-dlg-head"><Mono t={cur.mono} size="lg" /><div><Dialog.Title render={<h2 />}>{phase === "err" ? t("work.conn.reconnectName", { name: cur.t }) : t("work.conn.connectName", { name: cur.t })}</Dialog.Title><Dialog.Description render={<p />}>{cur.d}</Dialog.Description></div></div>
          {phase === "perms" && <>
            <h3 className="h3" style={{ marginBottom: 4 }}>{t("work.conn.asks")}</h3>
            <div className="travail-perms">{cur.perms.map(([ic, x, s], i) => (
              <label key={x} className="travail-perm"><Icon name={ic} size={16} /><span className="travail-grow"><span>{x}</span><span className="sub">{s}</span></span><Switch checked={grant[x] ?? i < 2} onCheckedChange={(c) => setGrant({ ...grant, [x]: c })} aria-label={x} /></label>))}</div>
            <div className="banner info" style={{ margin: "0 0 16px" }}><Icon name="shield-check" size={16} /><span className="grow" style={{ color: "var(--t1)" }}>{t("work.conn.safe")}</span></div>
            <div className="travail-actions end"><Dialog.Close className="btn secondary">{t("common.cancel")}</Dialog.Close><button className="btn primary" onClick={() => setPhase("link")}>{t("work.conn.allow")}</button></div>
          </>}
          {phase === "link" && <div aria-live="polite">
            <div className="travail-link"><Mono t="Co" size="lg" /><span className="travail-dots" aria-hidden><i /><i /><i /></span><Mono t={cur.mono} size="lg" /></div>
            <p style={{ textAlign: "center" }} className="thinking">{t("work.conn.linking", { name: cur.t })}</p>
            <div className="travail-actions end"><Dialog.Close className="btn secondary">{t("common.cancel")}</Dialog.Close></div>
          </div>}
          {phase === "ok" && <div className="travail-dlg-ok" aria-live="polite">
            <span className="travail-okic"><Icon name="check" size={16} /></span>
            <h2 style={{ marginTop: 8 }}>{t("work.conn.isConnected", { name: cur.t })}</h2>
            <p>{fx.connOk}</p>
            <div className="travail-actions"><button className="btn secondary" onClick={finish}>{t("work.later")}</button><button className="btn primary" onClick={finish}>{t("work.routines.create")}</button></div>
          </div>}
          {phase === "err" && <>
            <div className="banner err" style={{ margin: "0 0 14px" }}><Icon name="alert-triangle" size={16} /><span className="grow" style={{ color: "var(--t1)" }}>{fx.connError.detail}</span></div>
            <h3 className="h3" style={{ marginBottom: 4 }}>{t("work.conn.affected")}</h3>
            <div className="travail-perms">{fx.connError.affected.map(([b, s]) => <div key={b} className="travail-perm"><BotFace name={b} size={20} state="blocked" /><span className="travail-grow"><span>{b === fxb.main?.name ? main?.cfg.name : b}</span><span className="sub">{s}</span></span></div>)}</div>
            <div className="travail-actions end"><button className="btn secondary pg-danger" onClick={() => { setConns((xs) => xs.map((x) => (x.id === cur.id ? { ...x, st: "off" } : x))); setCur(null); }}>{t("work.conn.disconnect")}</button><span className="travail-grow" /><Dialog.Close className="btn secondary">{t("work.later")}</Dialog.Close><button className="btn primary" onClick={() => setPhase("link")}><Icon name="refresh" size={16} />{t("common.retry")}</button></div>
          </>}
        </>}
      </Dialog.Popup></Dialog.Portal>
    </Dialog.Root>
  </>);
}
function ConnCard({ c, i, onOpen }: { c: Conn; i: number; onOpen: (c: Conn) => void }) {
  const t = useT();
  return (
    <div className="travail-conn" style={css(i)}>
      <div className="travail-conn-top"><Mono t={c.mono} /><span className="travail-grow"><div className="ttl">{c.t}</div></span>{c.st !== "off" && <Pop align="end" trigger={<button className="ibtn" aria-label={t("work.conn.optionsOf", { name: c.t })}><Icon name="more-dots" size={16} /></button>}><MItem icon="settings" onClick={() => onOpen(c)}>{t("work.conn.permissions")}</MItem><MItem icon="refresh">{t("work.conn.sync")}</MItem><MSep /><MItem icon="close" danger>{t("work.conn.disconnect")}</MItem></Pop>}</div>
      <p>{c.d}</p>
      <div className="travail-conn-f">{c.st === "off" ? <span className="travail-meta">{t("work.conn.permCount", { count: c.perms.length })}</span> : <span className={"badge " + ST[c.st]}>{t(`work.conn.st.${c.st}`)}</span>}
        <button className={"btn " + (c.st === "on" ? "secondary" : "primary")} onClick={() => onOpen(c)}>{c.st === "off" ? t("work.conn.connect") : c.st === "on" ? t("work.conn.manage") : t("work.reconnect")}</button></div>
    </div>
  );
}
