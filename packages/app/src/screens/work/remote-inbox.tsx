// Notifications: the bell popover (Tout / Mentions / Bots) over the signed-in owner's inbox and notifications (design notifications).
import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import type { WorkBotView } from "@cortex/schema";
import { api } from "../../api";
import { useQuery } from "../../state/live";
import { useNav } from "../../shell/nav";
import { useT } from "../../i18n";
import { isPreview } from "../../preview";
import { Icon, IconBtn, Tip } from "../../kit/ui";
import { Mascot } from "../../mascot/Mascot";
import { toolName } from "../../state/tool-label";
import { TabBar, Top, css, lookMascot, useAgo } from "./common";

const useSignedIn = () => {
  const connection = useQuery(() => api.connection.get(), []);
  return !isPreview() && connection.state === "ready" && connection.data.mode !== "local" && connection.data.signedIn;
};

export function InboxConnection({ local }: { local: React.ReactNode }) {
  const t = useT(), { entryKey } = useNav();
  if (!useSignedIn()) return local;
  return <>
    <Top title={t("work.home.title")}><NotificationBell /></Top>
    <div className="travail-notif-stage">
      <div className="travail-notif-bg" aria-hidden><div className="travail-board">{["todo", "doing", "review", "done"].map(c => <div key={c} className="travail-col" style={{ minHeight: 420 }}><div className="travail-col-head">{t(`work.col.${c}`)}</div></div>)}</div></div>
      <section className="popup travail-notif" role="dialog" aria-label={t("work.notif.title")}><NotificationPanel key={entryKey} /></section>
    </div>
  </>;
}

type Row = { id: string; kind: "notification" | "inbox"; tab: "mentions" | "bots" | "other"; who?: WorkBotView; title: string; at: string; unread: boolean; approval: boolean };

function useOwnerInbox() {
  const owner = useQuery(() => api.workBot.list(), []);
  const epoch = owner.state === "ready" ? owner.data.epoch : "";
  const snapshot = useQuery(async () => epoch ? { epoch, data: await api.workBot.inbox.snapshot(epoch) } : undefined, [epoch],
    e => e.type === "workInbox.changed" && e.properties.epoch === epoch);
  const data = snapshot.state === "ready" && snapshot.data?.epoch === epoch ? snapshot.data.data : undefined;
  return { owner, epoch, snapshot, data, bots: owner.state === "ready" ? owner.data.bots : [] };
}

export function NotificationBell() {
  const t = useT(), signedIn = useSignedIn(), { route, go } = useNav();
  if (!signedIn) return <IconBtn icon="bell" label={t("shell.notifications")} onClick={() => go("notifications")} />;
  return <SignedInBell open={route === "notifications" ? true : undefined} />;
}

function SignedInBell({ open }: { open?: boolean }) {
  const t = useT(), { data } = useOwnerInbox();
  const unread = (data?.notifications.items.filter(n => !n.read).length ?? 0) + (data?.items.filter(i => i.unread).length ?? 0);
  const button = <button className="ibtn" data-testid="notification-bell" aria-label={t("work.notif.bellLabel", { count: unread })} style={{ position: "relative" }}><Icon name="bell" size={16} />{unread > 0 && <span className="travail-bell-dot" />}</button>;
  if (open) return button;
  return <Popover.Root>
    <Tip label={t("work.notif.title")}><Popover.Trigger render={button} /></Tip>
    <Popover.Portal><Popover.Positioner side="bottom" align="end" sideOffset={6}><Popover.Popup className="popup travail-notif travail-notif-pop" data-testid="notification-popover"><NotificationPanel /></Popover.Popup></Popover.Positioner></Popover.Portal>
  </Popover.Root>;
}

function NotificationPanel() {
  const t = useT(), ago = useAgo(), { go } = useNav();
  const { epoch, snapshot, data, bots, owner } = useOwnerInbox();
  const [tab, setTab] = React.useState("all"), [busy, setBusy] = React.useState(false), [error, setError] = React.useState(false);
  React.useEffect(() => {
    if (!epoch) return;
    let live = true, token: string | undefined;
    void api.workBot.inbox.subscribe(epoch).then(r => { token = r.subscription; if (!live) void api.workBot.inbox.unsubscribe(epoch, token).catch(() => {}); }).catch(() => {});
    return () => { live = false; if (token) void api.workBot.inbox.unsubscribe(epoch, token).catch(() => {}); };
  }, [epoch]);
  const bot = (id?: string) => bots.find(b => b.id === id);
  const rows: Row[] = data ? [
    ...data.notifications.items.map(n => ({ id: n.id, kind: "notification" as const, tab: /mention/i.test(n.kind) ? "mentions" as const : n.mascot_id ? "bots" as const : "other" as const, who: bot(n.mascot_id), title: n.title || n.body, at: n.created_at, unread: !n.read, approval: false })),
    ...data.items.map(i => ({ id: i.id, kind: "inbox" as const, tab: "bots" as const, who: bot(i.mascot_id), title: i.kind === "approval" ? t("work.notif.approval", { tool: toolName(t, i.tool_name ?? "") }) : i.text ?? t("work.notif.message"), at: i.at, unread: i.unread, approval: i.kind === "approval" })),
  ].sort((a, b) => b.at.localeCompare(a.at)) : [];
  const count = (k?: Row["tab"]) => rows.filter(r => r.unread && (!k || r.tab === k)).length;
  const shown = rows.filter(r => tab === "all" || r.tab === tab);
  const act = async (action: () => Promise<unknown>) => {
    if (busy || !epoch) return;
    setBusy(true); setError(false);
    try { await action(); snapshot.reload(); } catch { setError(true); } finally { setBusy(false); }
  };
  const open = (r: Row) => {
    if (r.kind === "notification" && r.unread) void act(() => api.workBot.inbox.notificationRead(r.id, epoch));
    else if (r.kind === "inbox" && r.unread && !r.approval) void act(() => api.workBot.inbox.read({ epoch, read: { item_ids: [r.id] } }));
    if (r.approval) go("approvals");
    else if (r.who) go("bot", { source: "work-bot-api", id: r.who.id, epoch });
  };
  const failed = error || snapshot.state === "error" || owner.state === "error";
  return <>
    <div className="travail-notif-h">
      <span className="travail-grow">{t("work.notif.title")}</span>
      <button className="btn secondary" style={{ height: 28, boxShadow: "none" }} data-testid="notification-read-all" disabled={busy || !count()} onClick={() => void act(async () => { await api.workBot.inbox.readAllNotifications(epoch); await api.workBot.inbox.read({ epoch, read: { all: true } }); })}><Icon name="check" size={16} />{t("work.notif.markAll")}</button>
    </div>
    <TabBar label={t("work.notif.filter")} value={tab} onChange={setTab} items={[["all", t("work.notif.tab.all"), count()], ["mentions", t("work.notif.tab.mentions"), count("mentions")], ["bots", t("work.notif.tab.bots"), count("bots")]]} />
    <div className="travail-notif-l" aria-live="polite" data-testid="notification-list" data-owner-epoch={epoch}>
      {failed && <div className="banner err" role="alert" data-testid="notification-error">{t("work.notif.error")}<button className="btn secondary" onClick={() => { owner.reload(); snapshot.reload(); setError(false); }}>{t("common.retry")}</button></div>}
      {!data && !failed ? [0, 1, 2].map(i => <div key={i} className="travail-n-i" aria-busy="true"><span className="skel circle" style={{ width: 28, height: 28 }} /><span className="travail-grow"><span className="skel line" style={{ width: `${80 - i * 15}%` }} /><span className="skel line" style={{ width: "30%" }} /></span></div>)
        : data && !shown.length ? <div className="empty" style={{ padding: 24 }} data-testid="notification-empty"><Icon name="bell" size={16} /><p>{t(rows.length ? "work.notif.upToDate" : "work.notif.empty")}</p></div>
        : shown.map((r, i) => <button key={r.id} className="travail-n-i travail-rise" style={css(i)} data-testid="notification-row" data-kind={r.kind} data-unread={r.unread || undefined} disabled={busy} onClick={() => open(r)}>
          {r.who ? <Mascot cfg={lookMascot(r.who)} size={28} state={r.approval ? "waiting" : "idle"} /> : <span className="avatar-dot" style={{ width: 28, height: 28, borderRadius: 14, margin: 0 }}><Icon name="bell" size={16} /></span>}
          <span className="travail-grow"><span className="ttl">{r.who && <b>{r.who.name} </b>}{r.title}</span><span className="travail-meta">{ago(r.at)}</span></span>
          <span className="travail-unread" aria-label={r.unread ? t("work.notif.unread") : undefined} />
        </button>)}
    </div>
    <div className="travail-n-f"><button className="btn secondary" style={{ height: 28, boxShadow: "none" }} onClick={() => go("activity")}>{t("work.notif.allActivity")}</button><span className="travail-grow" /><button className="btn secondary" style={{ height: 28, boxShadow: "none" }} onClick={() => go("inbox")}>{t("work.inbox.title")}</button></div>
  </>;
}
