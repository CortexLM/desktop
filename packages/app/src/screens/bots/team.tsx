// Bot team (roster, hierarchy, templates) and a Bot's settings (general, permissions, memory, usage).
import * as React from "react";
import { Slider } from "@base-ui/react/slider";
import type { Bot, PermissionRule, MemoryEntry } from "@cortex/schema";
import { Icon, IconBtn, Switch, Segmented, Tip, useToast } from "../../kit/ui";
import { Mascot, DEFAULT_MASCOT, type State } from "../../mascot/Mascot";
import { useVariant } from "../../registry";
import { useT } from "../../i18n";
import { useNav } from "../../shell/nav";
import { isPreview, useFixtures } from "../../preview";
import { api } from "../../api";
import { useBots, useQuery } from "../../state/live";
import { toConfig } from "./mascot-io";
import { css, NB, useGo, useDate, useMainBot, Top, Empty, Mono, type BotsFx, type TeamBot } from "../work/common";
import type { RosterFx, SettingsFx } from "./fixtures";

const PRESENCE: Record<State, string> = { idle: "", listening: "run", thinking: "run", working: "run", talking: "run", waiting: "wait", blocked: "err", done: "ok", asleep: "" };
const LIMIT = 50;

function BotTile({ b, i, onClick }: { b: TeamBot; i: number; onClick: () => void }) {
  const t = useT();
  const l = t(`bots.presence.${b.state}`);
  return (
    <button className="travail-bot" style={css(i)} onClick={onClick} aria-label={t("bots.roster.tileLabel", { name: b.cfg.name, role: b.role, presence: l, doing: b.doing })}>
      <span className="travail-pres"><span className="travail-dot" data-s={PRESENCE[b.state]} /></span>
      <Mascot cfg={b.cfg} state={b.state} size={56} />
      <span className="ttl">{b.cfg.name}</span>
      <span className="travail-bot-swap"><span>{b.role}</span><span>{b.doing}</span></span>
      <span className="travail-meta" style={{ marginTop: 2 }}>{l}</span>
    </button>
  );
}

/* ====================================================================== */
/* 10. Bot team                                                           */
/* ====================================================================== */
export function BotRoster() {
  const t = useT();
  const go = useGo();
  const toast = useToast();
  const preview = isPreview();
  const fxb = useFixtures<BotsFx & { roster: RosterFx }>("bots");
  const main = useMainBot();
  const bots = useBots();
  const date = useDate();
  const [v, setV] = useVariant("team");
  const [tpl, setTpl] = React.useState<number | null>(null);
  const TEAM = preview ? fxb.team ?? [] : [];
  const live: Bot[] = bots.state === "ready" ? bots.data : [];
  const full = preview && v === "limit";
  const count = preview ? (full ? LIMIT : TEAM.length + 1) : live.length;
  const R = fxb.roster;
  const tabs = preview ? <Segmented items={[t("bots.roster.team"), t("bots.roster.hierarchy")]} value={v === "hierarchy" ? t("bots.roster.hierarchy") : t("bots.roster.team")} onChange={(x) => setV(x === t("bots.roster.hierarchy") ? "hierarchy" : "team")} /> : null;
  const quota = <span className="travail-quota" title={t("bots.roster.quota", { count, max: LIMIT })}><span className="travail-meta">{t("bots.roster.quota", { count, max: LIMIT })}</span><span className="travail-meter" role="meter" aria-valuenow={count} aria-valuemin={0} aria-valuemax={LIMIT} aria-label={t("bots.roster.used")}><span className="travail-meter-i" data-full={full || undefined} data-warn={count > 40 || undefined} style={{ width: `${(count / LIMIT) * 100}%`, display: "block" }} /></span></span>;
  const cfg = main?.cfg ?? { name: "", ...DEFAULT_MASCOT };
  const chief = preview && (
    <button className="travail-chief travail-rise" onClick={() => go("bot")}>
      <Mascot cfg={{ ...cfg, hat: cfg.hat ?? "crown" }} state="working" size={64} track />
      <span className="travail-grow"><span className="ttl">{cfg.name}<span className="badge run">{t("bots.roster.chief")}</span></span><span className="sub">{t("bots.roster.chiefText", { doing: main?.doing ?? "" })}</span></span>
      <span className="travail-actions"><span className="travail-meta">{t("bots.roster.coordinates", { count: TEAM.length })}</span><Icon name="chevron-right" size={16} /></span>
    </button>
  );
  const newBot = () => (full ? toast.add({ title: t("bots.roster.limitReached", { max: LIMIT }), description: t("bots.roster.limitHint"), data: { icon: "info" } }) : preview ? setV("templates") : go("bot-new"));

  if (preview && v === "templates") return (<>
    <div className="content-top"><IconBtn icon="arrow-left" label={t("bots.roster.backToTeam")} onClick={() => setV("team")} /><span className="title">{t("bots.roster.newSpecialist")}</span><div className="spacer" />{quota}</div>
    <div className="page"><div className="travail-mid">
      <p className="travail-lede" style={{ marginTop: 6 }}>{t("bots.roster.tplLede")}</p>
      <div className="travail-cgrid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }} role="radiogroup" aria-label={t("bots.roster.templates")}>
        {R.templates.map(([x, d, r, acc, c], i) => (
          <button key={x} className="travail-tpl" style={css(i)} role="radio" aria-checked={tpl === i} data-on={tpl === i || undefined} onClick={() => setTpl(i)}>
            <Mascot cfg={c} state={tpl === i ? "listening" : "idle"} size={44} />
            <span className="travail-grow"><span className="ttl">{x}</span><span className="sub">{d}</span><span className="travail-tags">{[...new Set([r, ...acc])].map((y) => <span key={y} className="travail-tag">{y}</span>)}</span></span>
          </button>))}
        <button className="travail-tpl travail-bot-add" style={{ ...css(6), minHeight: 0, alignItems: "center" }} onClick={() => go("bot-new")}><span className="roster-add"><Icon name="plus" size={16} /></span><span className="travail-grow"><span className="ttl">{t("bots.roster.fromScratch")}</span><span className="sub">{t("bots.roster.fromScratchSub")}</span></span></button>
      </div>
      <div className="travail-actions end" style={{ marginTop: 20 }}><button className="btn secondary" onClick={() => setV("team")}>{t("common.cancel")}</button>
        <button className="btn primary" disabled={tpl == null} onClick={() => { toast.add({ title: t("bots.roster.toastCreated", { name: R.templates[tpl!][0] }), description: t("bots.roster.toastUnder", { name: cfg.name }), data: { icon: "bot" } }); go("bot-studio"); }}>{t("bots.roster.createCustomize")}</button></div>
    </div></div>
  </>);

  return (<>
    <Top title={t("bots.roster.title")}>{quota}<span style={{ width: 8 }} />{tabs}{tabs && <span style={{ width: 8 }} />}
      <Tip label={full ? t("bots.roster.limitReached", { max: LIMIT }) : t("bots.roster.newSpecialist")}><button className="btn primary" style={{ height: 28 }} aria-disabled={full} onClick={newBot}><Icon name="plus" size={16} />{t("bots.roster.newBot")}</button></Tip></Top>
    {!preview && bots.state === "ready" && !live.length ? (
      <Empty state="idle" title={t("bots.page.noneTitle")} text={t("bots.page.noneText")}><button className="btn primary" onClick={() => go("bot-new")}><Icon name="plus" size={16} />{t("bots.new.title")}</button></Empty>
    ) : !preview && bots.state === "error" ? (
      <Empty state="blocked" title={t("work.error.loadTitle")} text={t("work.error.loadText")}><button className="btn secondary" onClick={bots.reload}>{t("common.retry")}</button></Empty>
    ) : (
    <div className="page"><div className="travail-mid">
      {full && <div className="banner warn travail-banner"><Icon name="alert-triangle" size={16} /><span>{t("bots.roster.quota", { count: LIMIT, max: LIMIT })}</span><span className="grow">{t("bots.roster.limitText")}</span>
        <button className="btn secondary" onClick={() => toast.add({ title: R.moreSub, data: { icon: "archive" } })}>{t("bots.roster.seeInactive")}</button><button className="btn primary" onClick={() => go("pricing")}>{t("bots.roster.plans")}</button></div>}
      {chief}
      {preview && v === "hierarchy" ? (
        <div className="travail-tree" aria-label={t("bots.roster.hierarchyLabel")}>
          <div className="travail-node"><Mascot cfg={cfg} state="working" size={40} /><span className="ttl">{cfg.name}</span><span className="sub">{t("bots.roster.chief")}</span></div>
          <div className="travail-vline" />
          <div className="travail-branches" style={{ ["--l" as string]: "88px" }}>
            {TEAM.filter((b) => !b.lead).map((b) => { const subs = TEAM.filter((x) => x.lead === b.cfg.name); return (
              <div key={b.cfg.name} className="travail-branch">
                <Tip label={b.doing}><button className="travail-node" style={{ minWidth: 176 }}><Mascot cfg={b.cfg} state={b.state} size={40} /><span className="ttl">{b.cfg.name}</span><span className="sub">{b.role} · {t("bots.roster.botCount", { count: subs.length })}</span></button></Tip>
                <div className="travail-vline" />
                <div className="travail-subs">{subs.map((s) => <Tip key={s.cfg.name} label={s.doing}><button className="travail-node"><Mascot cfg={s.cfg} state={s.state} size={28} /><span style={{ display: "flex", flexDirection: "column" }}><span className="ttl">{s.cfg.name}</span><span className="sub">{s.role}</span></span><span className="travail-dot" data-s={PRESENCE[s.state]} style={{ marginLeft: "auto" }} /></button></Tip>)}</div>
              </div>); })}
          </div>
        </div>
      ) : <>
        <h3 className="h3">{preview ? t("bots.roster.specialists") : t("bots.roster.title")}<span className="travail-count">{preview ? (full ? LIMIT - 1 : TEAM.length) : live.length}</span></h3>
        <div className="travail-team">
          {preview ? TEAM.map((b, i) => <BotTile key={b.cfg.name} b={b} i={i} onClick={() => go("bot-settings")} />)
            : live.map((b, i) => <BotTile key={b.id} i={i} onClick={() => go("bot", "", { id: b.id })} b={{ cfg: toConfig(b), role: b.persona.split(/[.\n]/)[0] || t("bots.roster.createdOn", { date: date.date(b.time.created) }), state: "idle", doing: t("bots.roster.createdOn", { date: date.date(b.time.created) }) }} />)}
          {full && <div className="travail-bot" style={{ ...css(9), justifyContent: "center", color: "var(--t2)" }}><span className="ttl">{R.more}</span><span className="travail-meta">{R.moreSub}</span></div>}
          <button className="travail-bot travail-bot-add" style={css(10)} disabled={full} onClick={newBot}><span className="roster-add"><Icon name="plus" size={16} /></span><span className="ttl">{full ? t("bots.roster.limitShort") : t("bots.roster.newBot")}</span><span className="travail-meta">{full ? t("bots.roster.quotaShort", { count: LIMIT, max: LIMIT }) : preview ? t("bots.roster.fromTemplate") : t("bots.new.title")}</span></button>
        </div>
      </>}
    </div></div>)}
  </>);
}

/* ====================================================================== */
/* 11. Bot settings                                                       */
/* ====================================================================== */
const SECS: [string, string][] = [["general", "settings"], ["permissions", "shield-check"], ["memory", "key"], ["usage", "bolt"]];
type Act = "allow" | "ask" | "deny";
const LIVE_RULES: [string, string][] = [["bash", "terminal"], ["write", "edit"], ["edit", "edit"], ["webfetch", "globe"]];

export function BotSettings() {
  const t = useT();
  const go = useGo();
  const toast = useToast();
  const { params } = useNav();
  const preview = isPreview();
  const fxb = useFixtures<BotsFx & { settings: SettingsFx }>("bots");
  const S = fxb.settings;
  const main = useMainBot();
  const bots = useBots();
  const date = useDate();
  const id = params.get("id");
  const bot = bots.state === "ready" ? (id ? bots.data.find((b) => b.id === id) : bots.data[0]) : undefined;
  const memQ = useQuery<{ botID: string; entries: MemoryEntry[] | null } | null>(() => (bot && !preview
    ? api.bots.memory.list(bot.id).then((entries) => ({ botID: bot.id, entries })).catch(() => ({ botID: bot.id, entries: null }))
    : Promise.resolve(null)), [bot?.id]);
  const [v, setV] = useVariant("general");
  const [on, setOn] = React.useState(true);
  const [rules, setRules] = React.useState<Record<string, Act>>(() => Object.fromEntries((S?.rules ?? []).map((r) => [r[1], r[3]])));
  const [mem, setMem] = React.useState<string[]>(S?.memory ?? []);
  const [draft, setDraft] = React.useState<string | null>(null);
  const memoryWrite = React.useRef<symbol | null>(null);
  // Memory IDs are global: keep accepted deletions excluded when returning to a cached owner.
  const forgotten = React.useRef(new Set<string>());
  const [memoryBusy, setMemoryBusy] = React.useState(false);
  const [budget, setBudget] = React.useState(40);
  const [persona, setPersona] = React.useState("");
  // Same-screen Bot navigation must invalidate the previous owner's in-flight UI updates.
  React.useLayoutEffect(() => {
    memoryWrite.current = null; setMemoryBusy(false); setDraft(null);
    return () => { memoryWrite.current = null; };
  }, [bot?.id, preview]);
  React.useEffect(() => { if (bot) setPersona(bot.persona); }, [bot?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = preview ? main?.cfg.name ?? "" : bot?.name ?? "";
  const cfg = preview ? main!.cfg : bot ? toConfig(bot) : { name: "", ...DEFAULT_MASCOT };
  if (!preview && bots.state === "ready" && !bot) return (<>
    <div className="content-top"><IconBtn icon="arrow-left" label={t("bots.roster.backToTeam")} onClick={() => go("bot-roster")} /></div>
    <Empty state="idle" title={t("bots.page.noneTitle")} text={t("bots.page.noneText")}><button className="btn primary" onClick={() => go("bot-new")}><Icon name="plus" size={16} />{t("bots.new.title")}</button></Empty>
  </>);
  const update = (b: Parameters<typeof api.bots.update>[1]) => bot && api.bots.update(bot.id, b).then(bots.reload, () => toast.add({ title: t("work.error.save"), data: { icon: "alert-triangle" } }));
  const liveRules: Record<string, Act> = Object.fromEntries((bot?.permission ?? []).filter((r) => r.pattern === "*").map((r) => [r.tool, r.action]));
  const setLiveRule = (tool: string, action: Act) => { const rest = (bot?.permission ?? []).filter((r) => !(r.tool === tool && r.pattern === "*")); update({ permission: [...rest, { tool, pattern: "*", action } as PermissionRule] }); };
  const memory = memQ.state === "ready" && memQ.data?.botID === bot?.id ? memQ.data : null;
  const liveMem = memory?.entries?.filter((e) => !forgotten.current.has(e.id)) ?? [];
  const forget = (m: string) => { const i = mem.indexOf(m); setMem((xs) => xs.filter((x) => x !== m)); toast.add({ title: t("bots.toastForgotten"), description: m, data: { icon: "trash", undo: true, onUndo: () => setMem((xs) => [...xs.slice(0, i), m, ...xs.slice(i)]) } }); };
  const forgetLive = async (entries: MemoryEntry[], all = false) => {
    if (!bot || memoryWrite.current) return;
    entries = entries.filter((e) => e.botID === bot.id && !forgotten.current.has(e.id));
    if (!entries.length) return;
    const request = Symbol(); memoryWrite.current = request; setMemoryBusy(true);
    try {
      const results = await Promise.allSettled(entries.map((e) => api.bots.memory.delete(bot.id, e.id)));
      if (memoryWrite.current !== request) return;
      // Retire accepted IDs before unlocking; a delayed refresh cannot make them actionable again.
      results.forEach((r, i) => { if (r.status === "fulfilled") forgotten.current.add(entries[i].id); });
      memQ.reload();
      const failed = results.some((r) => r.status === "rejected");
      toast.add({ title: t(failed ? "system.memory.forgetFailed" : all ? "bots.set.toastWiped" : "bots.toastForgotten"), description: failed || all ? undefined : entries[0].content, data: { icon: failed ? "alert-triangle" : "trash" } });
    } finally { if (memoryWrite.current === request) { memoryWrite.current = null; setMemoryBusy(false); } }
  };
  const addLive = async (content: string) => {
    if (!bot || memoryWrite.current || !content.trim()) return;
    const request = Symbol(); memoryWrite.current = request; setMemoryBusy(true);
    try {
      await api.bots.memory.add(bot.id, content.trim());
      if (memoryWrite.current === request) { setDraft(null); memQ.reload(); }
    } catch {
      if (memoryWrite.current === request) toast.add({ title: t("work.error.save"), data: { icon: "alert-triangle" } });
    } finally { if (memoryWrite.current === request) { memoryWrite.current = null; setMemoryBusy(false); } }
  };
  const memCount = preview ? mem.length : liveMem.length;
  const tri = (label: string, value: Act | undefined, onPick: (a: Act) => void) => (
    <span className="travail-tri" role="radiogroup" aria-label={label}>{(["allow", "ask", "deny"] as Act[]).map((o) => <button key={o} role="radio" data-v={o} aria-checked={value === o} onClick={() => onPick(o)}>{t(`bots.set.rule.${o}`)}</button>)}</span>
  );
  return (<>
    <div className="content-top"><IconBtn icon="arrow-left" label={t("bots.roster.backToTeam")} onClick={() => go("bot-roster")} /><span className="title">{t("bots.set.title", { name })}</span>
      {preview && <button className="bot-pill" data-on={on || undefined} onClick={() => setOn(!on)}><i />{on ? t("bots.active") : t("bots.paused")}</button>}<div className="spacer" /></div>
    <div className="page"><div className="pg-set">
      <nav className="pg-nav" aria-label={t("bots.set.sections")}>{SECS.map(([s, ic]) => (preview || s !== "usage") && <button key={s} className="pg-nav-i" aria-current={v === s || undefined} onClick={() => setV(s)}><Icon name={ic} size={16} />{t(`bots.set.sec.${s}`)}</button>)}</nav>
      <div className="pg-panel" key={v}>
        {v === "general" && <>
          <h3 className="h3">{t("bots.set.identity")}</h3>
          <div className="list"><div className="li"><div className="travail-id travail-grow"><Mascot cfg={cfg} state={preview ? (on ? "working" : "asleep") : "idle"} size={56} track interactive /><span className="travail-grow"><span className="ttl" style={{ fontSize: 15 }}>{name}</span><span className="sub">{preview ? S.identity : t("bots.roster.createdOn", { date: bot ? date.date(bot.time.created) : "" })}</span></span></div><button className="btn secondary" onClick={() => go("bot-studio", "", bot && !preview ? { id: bot.id } : {})}><Icon name="edit" size={16} />{t("bots.customize")}</button></div></div>
          {!preview && bot && <>
            <h3 className="h3">{t("bots.set.persona")}</h3>
            <div className="list"><div className="li"><textarea className="travail-mem-in" style={{ height: 72, resize: "vertical", padding: 6 }} aria-label={t("bots.set.persona")} value={persona} onChange={(e) => setPersona(e.target.value)} onBlur={() => persona !== bot.persona && update({ persona })} /></div></div>
          </>}
          {preview && <>
            <h3 className="h3">{t("bots.set.channels")}</h3>
            <div className="list">{S.channels.map(([m, x, d, o]) => <label key={x} className="li"><Mono t={m} /><span className="grow"><div className="ttl">{x}</div><div className="sub">{d}</div></span><Switch defaultChecked={o} aria-label={t("bots.set.reachOn", { name, channel: x })} /></label>)}</div>
            <h3 className="h3">{t("bots.set.log")}</h3>
            <div className="list travail-log">{S.log.map(([w, x, ic]) => <div key={w} className="li" style={{ padding: "8px 14px" }}><Icon name={ic} size={16} /><span className="grow">{x}</span><span className="mono" style={{ color: "var(--t3)" }}>{w}</span></div>)}
              <button className="li travail-li" style={{ padding: "8px 14px", color: "var(--t2)" }} onClick={() => go("activity")}>{t("bots.set.fullLog")}<Icon name="chevron-right" size={16} /></button></div>
          </>}
          <h3 className="h3">{t("bots.set.danger")}</h3>
          <div className="list"><div className="li"><span className="grow"><div className="ttl">{preview ? t("bots.set.archive", { name }) : t("bots.set.delete", { name })}</div><div className="sub">{preview ? t("bots.set.archiveSub") : t("bots.set.deleteSub")}</div></span><button className="btn secondary pg-danger" onClick={() => { if (!preview && bot && confirm(t("bots.set.deleteConfirm", { name }))) api.bots.delete(bot.id).then(() => go("bot-roster"), () => {}); }}>{preview ? t("work.archive") : t("common.delete")}</button></div></div>
        </>}
        {v === "permissions" && <>
          <h3 className="h3">{t("bots.set.canDo", { name })}</h3>
          <div className="list">{preview ? S.rules.map(([ic, x, src]) => (
            <div key={x} className="li"><span className="li-ic"><Icon name={ic} size={16} /></span><span className="grow"><div className="ttl">{x}</div><div className="sub">{src}</div></span>
              {tri(x, rules[x], (o) => setRules({ ...rules, [x]: o }))}</div>))
            : LIVE_RULES.map(([tool, ic]) => (
            <div key={tool} className="li"><span className="li-ic"><Icon name={ic} size={16} /></span><span className="grow"><div className="ttl">{t(`bots.set.tool.${tool}`)}</div><div className="sub">{tool}</div></span>
              {tri(t(`bots.set.tool.${tool}`), liveRules[tool] ?? "ask", (o) => setLiveRule(tool, o))}</div>))}
          </div>
          {preview && <>
            <h3 className="h3">{t("bots.set.alwaysRules")}</h3>
            <div className="list">{S.alwaysRules.map(([x, d]) => <div key={x} className="li"><span className="grow"><div className="ttl">{x}</div><div className="sub">{d}</div></span><IconBtn icon="trash" label={t("bots.set.removeRule")} /></div>)}</div>
          </>}
        </>}
        {v === "memory" && <>
          <h3 className="h3" style={{ display: "flex" }}><span style={{ flex: 1 }}>{t("bots.set.remembers", { name })}{(preview || memory?.entries) && <span className="travail-count">{memCount}</span>}</span><button className="btn secondary" style={{ height: 24, padding: "0 8px", fontSize: 11 }} disabled={!preview && (!bot || !memory?.entries || memoryBusy || draft !== null)} onClick={() => { if (preview) setMem((m) => [...m, ""]); else if (bot && memory?.entries && !memoryWrite.current) setDraft(""); }}><Icon name="plus" size={16} />{t("bots.set.add")}</button></h3>
          {preview ? (mem.length ? <div className="list">{mem.map((m, i) => (
            <div key={i} className="li" style={{ padding: "6px 8px 6px 14px" }}><input className="travail-mem-in" aria-label={t("bots.set.memoryN", { n: i + 1 })} value={m} placeholder={t("bots.set.newMemory")} autoFocus={!m} onChange={(e) => setMem((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))} />
              <IconBtn icon="trash" label={t("bots.forget")} onClick={() => forget(m)} /></div>))}</div>
            : <Empty state="idle" title={t("bots.set.memEmptyTitle")} text={t("bots.set.memEmptyText", { name })} />)
          : bots.state === "error" || memory?.entries === null ? <Empty state="blocked" title={t("work.error.loadTitle")} text={t("work.error.loadText")}><button className="btn secondary" onClick={bots.state === "error" ? bots.reload : memQ.reload}>{t("common.retry")}</button></Empty>
          : !memory?.entries ? null : (liveMem.length || draft !== null ? <div className="list">{liveMem.map((m, i) => (
            <div key={m.id} className="li" style={{ padding: "6px 8px 6px 14px" }}><input className="travail-mem-in" aria-label={t("bots.set.memoryN", { n: i + 1 })} value={m.content} readOnly />
              <IconBtn icon="trash" label={t("bots.forget")} disabled={memoryBusy} onClick={() => forgetLive([m])} /></div>))}
            {draft !== null && <div className="li" style={{ padding: "6px 8px 6px 14px" }}><input className="travail-mem-in" aria-label={t("bots.set.memoryN", { n: liveMem.length + 1 })} value={draft} placeholder={t("bots.set.newMemory")} autoFocus readOnly={memoryBusy} aria-busy={memoryBusy} onChange={(e) => { if (!memoryWrite.current) setDraft(e.target.value); }} onBlur={() => addLive(draft)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addLive(draft); } if (e.key === "Escape" && !memoryWrite.current) setDraft(null); }} /></div>}
          </div> : <Empty cfg={cfg} state="idle" title={t("bots.set.memEmptyTitle")} text={t("bots.set.memEmptyLiveText", { name })} />)}
          <div className="list" style={{ marginTop: 24 }}>{preview && <label className="li"><span className="grow"><div className="ttl">{t("bots.set.learn")}</div><div className="sub">{t("bots.set.learnSub", { name })}</div></span><Switch defaultChecked aria-label={t("bots.set.learn")} /></label>}
            <div className="li"><span className="grow"><div className="ttl">{t("bots.set.forgetAll")}</div><div className="sub">{t("bots.set.forgetAllSub", { count: memCount })}</div></span><button className="btn secondary pg-danger" disabled={!memCount || (!preview && memoryBusy)} onClick={() => {
              if (preview) { const old = mem; setMem([]); toast.add({ title: t("bots.set.toastWiped"), data: { icon: "trash", undo: true, onUndo: () => setMem(old) } }); return; }
              if (bot && !memoryWrite.current && confirm(t("bots.set.forgetAllSub", { count: memCount }))) void forgetLive(liveMem, true);
            }}>{t("bots.set.forgetAll")}</button></div></div>
        </>}
        {v === "usage" && preview && <>
          <div className="travail-usage">{S.usage.map(([b, s], i) => <div key={i}><b>{b}</b><span>{i === 1 ? s.replace("{budget}", String(budget)) : s}</span></div>)}</div>
          <h3 className="h3">{t("bots.set.perDay")}</h3>
          <div className="list" style={{ paddingBottom: 10 }}><div className="travail-bars" aria-label={t("bots.set.last14")}>
            {[32, 48, 41, 66, 58, 12, 8, 54, 61, 47, 72, 69, 14, 36].map((n, i) => <div key={i}><i style={{ ...css(i), height: `${(n / 72) * 100}%` }} data-today={i === 13 || undefined} title={t("bots.set.actions", { count: n })} /><span>{t("bots.set.dayLetters").split(",")[(i + 3) % 7]}</span></div>)}
          </div></div>
          <h3 className="h3">{t("bots.set.budget")}</h3>
          <div className="list"><div className="li" style={{ gap: 16 }}>
            <Slider.Root value={budget} min={10} max={100} step={5} onValueChange={(x) => setBudget(x as number)} className="travail-slider" style={{ flex: 1 }}>
              <Slider.Control className="travail-slider" style={{ width: "100%" }}><Slider.Track className="travail-slider-t"><Slider.Indicator className="travail-slider-i" /><Slider.Thumb className="travail-slider-th" aria-label={t("bots.set.budgetLabel")} /></Slider.Track></Slider.Control>
            </Slider.Root>
            <span className="mono" style={{ width: 52, textAlign: "right", fontSize: 13 }}>{budget}{NB}€</span></div>
            <label className="li"><span className="grow"><div className="ttl">{t("bots.set.warn80")}</div><div className="sub">{t("bots.set.warn80Sub", { name })}</div></span><Switch defaultChecked aria-label={t("bots.set.warn80")} /></label></div>
          {S.spent / budget > 0.8 && <div className="banner warn" style={{ margin: "16px 0 0" }}><Icon name="alert-triangle" size={16} /><span className="grow" style={{ color: "var(--t1)" }}>{t("bots.set.budgetWarn", { pct: Math.round((S.spent / budget) * 100), name, budget })}</span></div>}
        </>}
      </div>
    </div></div>
  </>);
}
