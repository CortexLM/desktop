import * as React from "react";
import type { WorkActivity } from "@cortex/schema";
import { api } from "../../api";
import { useQuery, onEvent } from "../../state/live";
import { readHash, useNav } from "../../shell/nav";
import { useT } from "../../i18n";
import { isPreview } from "../../preview";
import { Icon, MItem, Pop } from "../../kit/ui";
import { DEFAULT_MASCOT, Mascot } from "../../mascot/Mascot";
import { css, Top, useDate } from "./common";

export function ActivityConnection({ local }: { local: React.ReactNode }) {
  const connection = useQuery(() => api.connection.get(), []), { entryKey, params } = useNav();
  return !isPreview() && connection.state === "ready" && connection.data.mode !== "local" && connection.data.signedIn ? <RemoteActivity key={`${entryKey}:${params.get("epoch")}`} /> : local;
}

const ICON: Record<string, string> = { ask_user: "bot", video_ready: "camera" };

function RemoteActivity() {
  const t = useT(), date = useDate(), { entryKey } = useNav();
  const owner = useQuery(() => api.workBot.list(), []);
  const epoch = owner.state === "ready" ? owner.data.epoch : "", bots = owner.state === "ready" ? owner.data.bots : [];
  const [picked, setPicked] = React.useState(""), botID = bots.some(bot => bot.id === picked) ? picked : bots[0]?.id ?? "";
  const feed = useQuery(async () => epoch && botID ? { epoch, botID, items: await api.workBot.activity.list(botID, epoch) } : undefined, [epoch, botID]);
  const reload = feed.reload, [stream, setStream] = React.useState("connecting");
  const mounted = React.useRef(true), current = React.useRef({ epoch, botID }); current.current = { epoch, botID };
  React.useEffect(() => () => { mounted.current = false; }, []);
  React.useEffect(() => {
    if (!epoch || !botID) return;
    let live = true, token: string | undefined;
    setStream("connecting");
    const owns = () => live && mounted.current && readHash().entryKey === entryKey && current.current.epoch === epoch && current.current.botID === botID;
    const off = onEvent(event => {
      if (event.type !== "workActivity.changed" || event.properties.epoch !== epoch || event.properties.botID !== botID || !owns()) return;
      if (event.properties.state !== "changed") setStream(event.properties.state);
      reload();
    });
    // ponytail: process-local hints only; every hint and reconnect re-reads a fresh owner page, no since cursor or replay.
    void api.workBot.activity.subscribe(botID, epoch).then(result => { token = result.subscription; if (!live) void api.workBot.activity.unsubscribe(epoch, token).catch(() => {}); else reload(); }).catch(() => { if (owns()) setStream("disconnected"); });
    return () => { live = false; off(); if (token) void api.workBot.activity.unsubscribe(epoch, token).catch(() => {}); };
  }, [epoch, botID, entryKey, reload]);
  const items = feed.state === "ready" && feed.data?.epoch === epoch && feed.data.botID === botID ? feed.data.items : undefined;
  const bot = bots.find(b => b.id === botID), days = new Map<string, WorkActivity[]>();
  items?.forEach(item => { const day = new Date(item.at).toDateString(); days.set(day, [...(days.get(day) ?? []), item]); });
  const text = (item: WorkActivity) => item.opaque ? t("workActivity.opaque") : item.kind === "ask_user" ? t("workActivity.askUser", { widget: t(`workActivity.widget.${item.widget}`) }) : item.kind === "video_ready" ? t("workActivity.videoReady", { title: item.title || t("workActivity.untitled") }) : t("workActivity.opaque");
  return <>
    <Top title={t("work.activity")}>
      <Pop align="end" width={280} trigger={<button className="btn secondary travail-act-picker" data-testid="work-activity-bot" disabled={!bots.length} aria-label={bot?.name ?? t("work.allBots")}>
        <span aria-hidden>{bot ? <Mascot cfg={{ name: bot.name, ...DEFAULT_MASCOT }} size={16} state="idle" /> : <Icon name="bot" size={16} />}</span><span>{bot?.name ?? t("workBot.loading")}</span><Icon name="chevron-down" size={16} />
      </button>}>
        {bots.map(b => <MItem key={b.id} icon={b.id === botID ? "check" : undefined} onClick={() => setPicked(b.id)}>{b.name}</MItem>)}
      </Pop>
    </Top>
    <div className="page"><div className="travail-narrow travail-activity-live" data-testid="remote-work-activity" data-owner-epoch={epoch} data-bot-id={botID}>
      <p className="travail-lede">{t("workActivity.scope")}</p>
      <p className="travail-meta" data-testid="work-activity-stream" data-state={stream}>{t(`workInbox.stream.${stream}`)} {t("workActivity.streamNote")}</p>
      {(feed.state === "error" || owner.state === "error") && <div className="banner err" role="alert" data-testid="work-activity-error">{t("workActivity.error")}</div>}
      {owner.state === "ready" && !bots.length ? <p role="status">{t("workActivity.noBots")}</p>
        : !items ? feed.state !== "error" && <p role="status" aria-busy="true">{t("workBot.loading")}</p>
        : !items.length ? <p role="status" data-testid="work-activity-empty">{t("workActivity.empty")}</p>
        : [...days].map(([day, entries]) => <section key={day} aria-label={date.day(Date.parse(entries[0].at))}>
          <h3 className="h3 travail-day">{date.day(Date.parse(entries[0].at))}</h3>
          <ol className="travail-tline">{entries.map((item, i) => <li key={item.id} className="travail-act travail-act-live" style={css(i)} data-testid="work-activity-row" data-kind={item.kind} data-opaque={item.opaque}>
            <span aria-hidden><Mascot cfg={{ name: bot?.name ?? "", ...DEFAULT_MASCOT }} size={24} state="idle" /></span>
            <Icon name={item.opaque ? "info" : ICON[item.kind] ?? "info"} size={16} />
            <span className="travail-grow"><b>{bot?.name}</b> · {text(item)}{item.opaque && <span className="travail-meta mono">{item.kind}</span>}</span>
            <time className="mono" dateTime={item.at}>{date.time(Date.parse(item.at))}</time>
          </li>)}</ol>
        </section>)}
    </div></div>
  </>;
}
