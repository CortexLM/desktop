import * as React from "react";
import { CortexApiError } from "@cortex/client";
import type { Bot } from "@cortex/schema";
import { api } from "../../api";
import { useI18n, useT } from "../../i18n";
import { Icon, IconBtn, MItem, Pop } from "../../kit/ui";
import { DEFAULT_MASCOT, Mascot } from "../../mascot/Mascot";
import { isPreview } from "../../preview";
import { navigation, readHash, useNav } from "../../shell/nav";
import { onEvent, type Load } from "../../state/live";
import { toConfig } from "../bots/mascot-io";
import { css, Empty, Top, useDate, useGo } from "./common";

type Outcome = "completed" | "failed" | "interrupted";
type ActivityRow = { sessionID: string; messageID: string; botID: string; title: string; completed: number; outcome: Outcome };
const order = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const liveRoute = () => !isPreview() && readHash().route !== "gallery";

function useActivity() {
  const { params, route } = useNav();
  const permitted = route === "activity" && !params.has("preview") && !params.has("shot");
  const [load, setLoad] = React.useState<Load<{ rows: ActivityRow[]; bots: Bot[] }>>({ state: "loading" });
  const owner = React.useRef<{ seq: number; queued: boolean } | null>(null);
  const deleted = React.useRef(new Set<string>());
  const reload = React.useCallback(() => {
    const request = owner.current;
    if (!request || !liveRoute()) return;
    request.seq++;
    if (request.queued) return;
    request.queued = true;
    queueMicrotask(async () => {
      request.queued = false;
      const seq = request.seq;
      const current = () => owner.current === request && request.seq === seq && liveRoute();
      if (!current()) return;
      setLoad((value) => value.state === "ready" ? value : { state: "loading" });
      try {
        const [sessions, bots] = await Promise.all([api.sessions.list({ kind: "bot" }), api.bots.list()]);
        if (!current()) return;
        // ponytail: 40 bounds history fan-out, not list/transcript bytes; replace with server summaries for larger history.
        const roots = sessions.filter((s) => s.kind === "bot" && s.botID && !s.parentID && !deleted.current.has(s.id))
          .sort((a, b) => b.time.updated - a.time.updated || order(b.id, a.id)).slice(0, 40);
        const histories = await Promise.all(roots.map(async (s) => {
          try { return (await api.sessions.messages(s.id)).findLast(({ info }) => info.role === "assistant" && Number.isFinite(info.time.completed))?.info; }
          catch (error) { if (error instanceof CortexApiError && error.status === 404) return null; throw error; }
        }));
        if (!current()) return;
        const missing = histories.flatMap((message, i) => message === null ? [roots[i].id] : []);
        if (missing.length) {
          const refreshed = await api.sessions.list({ kind: "bot" });
          if (!current()) return;
          if (missing.some((id) => refreshed.some((s) => s.id === id))) throw new Error();
          missing.forEach((id) => deleted.current.add(id));
        }
        const rows = histories.flatMap((message, i): ActivityRow[] => {
          const session = roots[i];
          if (deleted.current.has(session.id)) return [];
          return message ? [{ sessionID: session.id, messageID: message.id, botID: session.botID!, title: session.title, completed: message.time.completed!, outcome: !message.error ? "completed" : message.error.code === "aborted" ? "interrupted" : "failed" }] : [];
        }).sort((a, b) => b.completed - a.completed || order(a.sessionID, b.sessionID) || order(a.messageID, b.messageID));
        setLoad({ state: "ready", data: { rows, bots } });
      } catch { if (current()) setLoad({ state: "error", code: "internal" }); }
    });
  }, []);
  React.useLayoutEffect(() => {
    let live: boolean | undefined;
    const sync = () => {
      const next = liveRoute();
      if (next === live) return;
      live = next; owner.current = null;
      // Actual preview departure invalidates reads without replacing the outgoing tree.
      if (!next || !permitted) return;
      setLoad({ state: "loading" }); owner.current = { seq: 0, queued: false }; reload();
    };
    const off = onEvent((event) => {
      if (event.type === "session.deleted") {
        deleted.current.add(event.properties.sessionID);
        if (owner.current && liveRoute()) setLoad((value) => value.state === "ready" ? { ...value, data: { ...value.data, rows: value.data.rows.filter((row) => row.sessionID !== event.properties.sessionID) } } : value);
        reload();
      } else if ((event.type === "session.created" || event.type === "session.updated") && event.properties.session.kind === "bot" && event.properties.session.botID && !event.properties.session.parentID
        || event.type === "message.updated" && event.properties.message.role === "assistant" && Number.isFinite(event.properties.message.time.completed)) reload();
    });
    navigation.addEventListener("currententrychange", sync);
    sync();
    return () => { owner.current = null; off(); navigation.removeEventListener("currententrychange", sync); };
  }, [permitted, reload]);
  return { ...load, reload };
}

export function ActivityLive() {
  const t = useT(), date = useDate(), go = useGo();
  const { locale } = useI18n();
  const feed = useActivity();
  const [who, setWho] = React.useState("");
  const [type, setType] = React.useState("all");
  const rows = feed.state === "ready" ? feed.data.rows : [];
  const options = feed.state === "ready" ? [...new Set([...rows.map((row) => row.botID), ...(who ? [who] : [])])].sort(order).map((id) => {
    const bot = feed.data.bots.find((b) => b.id === id);
    const name = bot?.name ?? t("work.act.missingBot");
    return { id, name, cfg: bot ? toConfig(bot) : { name, ...DEFAULT_MASCOT } };
  }) : [];
  const label = (id: string) => {
    const option = options.find((b) => b.id === id)!;
    const duplicates = options.filter((b) => b.name === option.name);
    return duplicates.length > 1 ? `${option.name} (${(duplicates.findIndex((b) => b.id === id) + 1).toLocaleString(locale)})` : option.name;
  };
  const selected = options.find((b) => b.id === who);
  const caption = selected ? label(selected.id) : t("work.allBots");
  const filtered = rows.filter((row) => (!who || row.botID === who) && (type === "all" || row.outcome !== "completed"));
  const days = new Map<string, ActivityRow[]>();
  filtered.forEach((row) => { const day = new Date(row.completed).toDateString(); days.set(day, [...(days.get(day) ?? []), row]); });
  const clear = () => { setWho(""); setType("all"); };
  return <>
    <Top title={t("work.activity")}>
      <Pop align="end" width={280} trigger={<button className="btn secondary travail-act-picker" disabled={feed.state !== "ready"} aria-label={caption} title={caption}>
        <span aria-hidden>{selected ? <Mascot cfg={selected.cfg} size={16} state="idle" /> : <Icon name="bot" size={16} />}</span><span>{caption}</span><Icon name="chevron-down" size={16} />
      </button>}>
        <MItem icon={!who ? "check" : "bot"} onClick={() => setWho("")}>{t("work.allBots")}</MItem>
        {options.map((b) => <MItem key={b.id} icon={who === b.id ? "check" : undefined} onClick={() => setWho(b.id)}><span className="travail-act-bot-label"><span aria-hidden><Mascot cfg={b.cfg} size={16} state="idle" /></span><span>{label(b.id)}</span></span></MItem>)}
      </Pop>
      <IconBtn icon="download" label={t("work.act.export")} disabled />
    </Top>
    <div className="page"><div className="travail-narrow travail-activity-live">
      <p className="travail-lede">{t("work.act.recentScope")}</p>
      <div className="travail-filters" role="group" aria-label={t("work.act.filterByType")}>
        {["all", "errors"].map((value) => <button key={value} className="chip" aria-pressed={type === value} data-pressed={type === value || undefined} onClick={() => setType(value)}>{t(`work.act.type.${value}`)}</button>)}
        {(who || type !== "all") && <button className="btn secondary" onClick={clear}>{t("work.act.clear")}</button>}
      </div>
      {feed.state === "loading" ? <div aria-busy="true" role="status" aria-label={t("work.act.loading")}>
        {[0, 1].map((day) => <div key={day}><div className="travail-day"><span className="skel title" style={{ width: 120 }} /></div><div className="travail-tline">
          {[0, 1, 2, 3].map((i) => <div key={i} className="travail-act"><span className="skel circle" style={{ position: "absolute", left: -35, width: 24, height: 24 }} /><span className="skel line" style={{ width: `${70 - i * 9}%` }} /></div>)}
        </div></div>)}
      </div> : feed.state === "error" ? <Empty cfg={{ name: "", ...DEFAULT_MASCOT }} state="blocked" title={t("work.error.loadTitle")} text={t("work.error.loadText")}><button className="btn secondary" onClick={feed.reload}>{t("common.retry")}</button></Empty>
        : !filtered.length ? <Empty cfg={{ name: "", ...DEFAULT_MASCOT }} title={t("work.act.recentEmptyTitle")} text={t("work.act.recentEmptyText")} />
          : [...days].map(([day, entries]) => <section key={day} aria-label={date.day(entries[0].completed)}>
            <h3 className="h3 travail-day">{date.day(entries[0].completed)}</h3>
            <ol className="travail-tline">{entries.map((row, i) => <li key={row.sessionID}><button className="travail-act travail-act-live" style={css(i)} onClick={() => { if (liveRoute()) go("work-task", "", { id: row.sessionID }); }}>
              <span aria-hidden><Mascot cfg={options.find((b) => b.id === row.botID)!.cfg} size={24} state="idle" /></span>
              <Icon name={row.outcome === "completed" ? "check-circle" : row.outcome === "interrupted" ? "pause" : "alert-triangle"} size={16} style={row.outcome === "completed" ? undefined : { color: "var(--red)" }} />
              <span className="travail-grow"><b>{label(row.botID)}</b> · <b>{row.title || t("shell.nav.untitled")}</b><span className="travail-meta">{t(`work.act.${row.outcome}`)}</span></span>
              <time className="mono" dateTime={new Date(row.completed).toISOString()}>{date.time(row.completed)}</time>
            </button></li>)}</ol>
          </section>)}
    </div></div>
  </>;
}
