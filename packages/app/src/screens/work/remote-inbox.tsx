import * as React from "react";
import { api } from "../../api";
import { useQuery, onEvent } from "../../state/live";
import { readHash, useNav } from "../../shell/nav";
import { useT } from "../../i18n";
import { isPreview } from "../../preview";
import { Top } from "./common";

export function InboxConnection({ local }: { local: React.ReactNode }) {
  const connection = useQuery(() => api.connection.get(), []), { entryKey, params } = useNav();
  return !isPreview() && connection.state === "ready" && connection.data.mode !== "local" && connection.data.signedIn ? <RemoteInbox key={`${entryKey}:${params.get("epoch")}`} /> : local;
}

function RemoteInbox() {
  const t = useT(), { go, entryKey } = useNav();
  const owner = useQuery(() => api.workBot.list(), []);
  const epoch = owner.state === "ready" ? owner.data.epoch : "";
  const snapshot = useQuery(async () => epoch ? { epoch, data: await api.workBot.inbox.snapshot(epoch) } : undefined, [epoch]);
  const reloadSnapshot = snapshot.reload;
  const [tab, setTab] = React.useState<"inbox" | "notifications">("inbox"), [filter, setFilter] = React.useState("unread"), [query, setQuery] = React.useState("");
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState(false), [updated, setUpdated] = React.useState<number>(), [stream, setStream] = React.useState("connecting");
  const mounted = React.useRef(true), pending = React.useRef<symbol | undefined>(undefined), subscription = React.useRef<string | undefined>(undefined);
  const currentEpoch = React.useRef(epoch); currentEpoch.current = epoch;
  React.useEffect(() => () => { mounted.current = false; }, []);
  React.useEffect(() => { pending.current = undefined; setBusy(false); setError(false); setUpdated(undefined); setStream("connecting"); }, [epoch]);
  const owns = () => mounted.current && readHash().entryKey === entryKey && currentEpoch.current === epoch && owner.state === "ready" && owner.data.epoch === epoch;
  React.useEffect(() => {
    if (!epoch) return;
    let live = true;
    const off = onEvent(event => {
      if (event.type !== "workInbox.changed" || !live || event.properties.epoch !== epoch || currentEpoch.current !== epoch || !mounted.current || readHash().entryKey !== entryKey) return;
      if (event.properties.state !== "changed") setStream(event.properties.state);
      reloadSnapshot();
    });
    void api.workBot.inbox.subscribe(epoch).then(result => {
      if (!live) { void api.workBot.inbox.unsubscribe(epoch, result.subscription).catch(() => {}); return; }
      subscription.current = result.subscription;
      // ponytail: process-local stream only; reconnect starts fresh and always re-reads durable state.
      reloadSnapshot();
    }).catch(() => { if (live) setStream("disconnected"); });
    return () => { live = false; off(); const token = subscription.current; subscription.current = undefined; if (token) void api.workBot.inbox.unsubscribe(epoch, token).catch(() => {}); };
  }, [epoch, entryKey, reloadSnapshot]);
  const refresh = async () => {
    if (!mounted.current || readHash().entryKey !== entryKey) return;
    owner.reload();
    if (!owns()) return;
    const token = subscription.current; subscription.current = undefined;
    if (token) await api.workBot.inbox.unsubscribe(epoch, token);
    snapshot.reload(); setStream("connecting");
    try { const result = await api.workBot.inbox.subscribe(epoch); if (owns()) { subscription.current = result.subscription; snapshot.reload(); } else await api.workBot.inbox.unsubscribe(epoch, result.subscription); }
    catch { if (owns()) setStream("disconnected"); }
  };
  const mutate = async (action: () => Promise<number | void>) => {
    if (pending.current || !owns()) return;
    const token = Symbol(); pending.current = token; setBusy(true); setError(false); setUpdated(undefined);
    try { const count = await action(); if (owns()) { setUpdated(count === undefined ? undefined : count); snapshot.reload(); } }
    catch { if (owns()) setError(true); }
    finally { if (pending.current === token) pending.current = undefined; if (owns()) setBusy(false); }
  };
  const data = epoch && snapshot.state === "ready" && snapshot.data?.epoch === epoch ? snapshot.data.data : undefined;
  const bots = owner.state === "ready" ? owner.data.bots : [];
  const botName = (id: string) => bots.find(bot => bot.id === id)?.name ?? t("workInbox.unknownBot");
  const inboxUnread = data?.items.filter(item => item.unread).length ?? 0, notificationUnread = data?.notifications.items.filter(item => !item.read).length ?? 0;
  const matches = (unread: boolean, approval: boolean, text: string) => (filter === "all" || filter === "unread" && unread || filter === "read" && !unread || filter === "approvals" && approval) && text.toLocaleLowerCase().includes(query.toLocaleLowerCase());
  const inboxRows = data?.items.filter(item => matches(item.unread, item.kind === "approval", `${item.text ?? item.tool_name ?? item.kind} ${botName(item.mascot_id)}`)) ?? [];
  const notificationRows = data?.notifications.items.filter(item => matches(!item.read, false, `${item.title} ${item.body}`)) ?? [];
  return <>
    <Top title={t("workInbox.title")}><button className="btn secondary" data-testid="work-inbox-refresh" disabled={!epoch || busy} onClick={() => void refresh()}>{t("workBot.reconnect")}</button><button className="btn secondary" data-testid="work-inbox-read-all" disabled={busy || !data} onClick={() => void mutate(async () => { if (tab === "inbox") return (await api.workBot.inbox.read({ epoch, read: { all: true } })).updated; await api.workBot.inbox.readAllNotifications(epoch); })}>{t("workInbox.readAll")}</button></Top>
    <div className="page"><div className="travail-mid remote-inbox" data-testid="remote-work-inbox" data-owner-epoch={epoch}>
      {(error || snapshot.state === "error" || owner.state === "error") && <div className="banner err" role="alert" data-testid="work-inbox-error">{t("workInbox.unconfirmed")}</div>}
      <div className="work-inbox-controls"><div className="btnrow" role="group" aria-label={t("workInbox.sections")}><button className="btn secondary" data-testid="work-inbox-tab" aria-pressed={tab === "inbox"} onClick={() => { setTab("inbox"); setFilter("unread"); }}>{t("workInbox.inboxCount", { count: inboxUnread })}</button><button className="btn secondary" data-testid="work-notifications-tab" aria-pressed={tab === "notifications"} onClick={() => { setTab("notifications"); setFilter("unread"); }}>{t("workInbox.notificationCount", { count: notificationUnread })}</button></div>
        <label>{t("workInbox.filter")}<select className="input" data-testid="work-inbox-filter" value={filter} onChange={event => setFilter(event.target.value)}>{["unread", "all", "read", ...(tab === "inbox" ? ["approvals"] : [])].map(value => <option key={value} value={value}>{t(`workInbox.filter.${value}`)}</option>)}</select></label><label>{t("workInbox.search")}<input className="input" data-testid="work-inbox-search" value={query} onChange={event => setQuery(event.target.value)} /></label>
      </div>
      <p className="travail-meta" data-testid="work-inbox-stream" data-state={stream}>{t(`workInbox.stream.${stream}`)} {t("workInbox.streamNote")}</p><p className="travail-meta">{t("workInbox.windowNote")}</p>
      {updated !== undefined && <p role="status" data-testid="work-inbox-updated" data-updated={updated}>{t("workInbox.updated", { count: updated })}</p>}
      {!data && owner.state !== "error" && snapshot.state !== "error" ? <p role="status">{t("workBot.loading")}</p> : <div className="list" aria-label={t(tab === "inbox" ? "workInbox.inbox" : "workInbox.notifications")}>
        {tab === "inbox" ? inboxRows.map(item => <div className="li work-inbox-row" key={item.id} data-testid="work-inbox-row" data-item-id={item.id} data-unread={item.unread} data-kind={item.kind}>
          <div className="grow"><div className="ttl">{botName(item.mascot_id)} · {item.kind}</div><p>{item.kind === "approval" ? item.tool_name : item.text ?? item.kind}</p><span className="sub">{item.at}</span></div><span className="badge">{t(item.unread ? "workInbox.filter.unread" : "workInbox.filter.read")}</span>
          <div className="btnrow">{item.kind === "approval" ? <button className="btn secondary" data-testid="work-inbox-approval" disabled={!bots.some(bot => bot.id === item.mascot_id)} onClick={() => go("bot", { id: item.mascot_id, epoch })}>{t("workInbox.reviewApproval")}</button> : <button className="btn secondary" data-testid="work-inbox-mark" disabled={busy} onClick={() => void mutate(async () => (await api.workBot.inbox.read({ epoch, read: { item_ids: [item.id], unread: !item.unread } })).updated)}>{t(item.unread ? "workInbox.markRead" : "workInbox.markUnread")}</button>}
          <button className="btn secondary" data-testid="work-inbox-open" disabled={!bots.some(bot => bot.id === item.mascot_id)} onClick={() => go("bot", { id: item.mascot_id, epoch })}>{t("workInbox.openBot")}</button></div>
        </div>) : notificationRows.map(item => <div className="li work-inbox-row" key={item.id} data-testid="work-notification-row" data-item-id={item.id} data-read={item.read}>
          <div className="grow"><div className="ttl">{item.title}</div><p>{item.body}</p><span className="sub">{item.kind} · {item.created_at}</span></div><span className="badge">{t(item.read ? "workInbox.filter.read" : "workInbox.filter.unread")}</span><div className="btnrow"><button className="btn secondary" data-testid="work-notification-mark" disabled={busy || item.read} onClick={() => void mutate(async () => { await api.workBot.inbox.notificationRead(item.id, epoch); })}>{t("workInbox.markRead")}</button></div>
        </div>)}
        {data && !(tab === "inbox" ? inboxRows.length : notificationRows.length) && <p className="li" data-testid="work-inbox-empty">{t("workInbox.empty")}</p>}
      </div>}
      {data && <p className="travail-meta" data-testid="work-inbox-working">{t("workInbox.working", { count: data.working_mascot_ids.length })}</p>}
    </div></div>
  </>;
}
