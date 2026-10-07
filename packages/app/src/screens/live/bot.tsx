import * as React from "react";
import type { WorkBotView } from "@cortex/schema";
import { api } from "../../api";
import { useT } from "../../i18n";
import { useNav } from "../../shell/nav";
import { useQuery } from "../../state/live";
import { Icon } from "../../kit/ui";
import { BotCopy } from "../work/bot-copy";
import { LiveBotControls } from "../work/contract-panels";
import { Owned, Loaded, useOp, call, useContract, ContractError, s, when, type Row } from "./shared";

const useBots = () => useQuery(() => api.workBot.list(), []);

export function BotChannel() {
  const t = useT(), { params, go } = useNav(), id = params.get("id") ?? "";
  return <Owned title={t("live.botChannel.title")} actions={<button className="btn secondary" onClick={() => go("bot-channels")}>{t("live.botChannel.all")}</button>}>{epoch => <ChannelThread epoch={epoch} id={id} />}</Owned>;
}

function ChannelThread({ epoch, id }: { epoch: string; id: string }) {
  const t = useT(), { go } = useNav(), c = useContract(), bots = useBots();
  const list = useQuery(() => api.workBot.channels.list(epoch), [epoch]);
  const channel = useOp<{ id: string; name: string; members: string[] }>(epoch, "app.channel", { channel: id }, !id);
  const messages = useOp<{ items: { id: string; from_id?: string; text: string; at?: string }[] }>(epoch, "app.channel.messages", { channel: id }, !id);
  const [text, setText] = React.useState(""), [sent, setSent] = React.useState<number>();
  const name = (bid?: string) => (bots.state === "ready" ? bots.data.bots.find(b => b.id === bid)?.name : undefined) ?? t("live.botChannel.you");
  if (!id) return <Loaded q={list} empty={d => !d.length}>{rows => <div className="list" data-testid="channel-pick">{rows.map(r => <button key={r.id} className="li" onClick={() => go("bot-channel", { id: r.id })}><Icon name="mentions" /><span className="grow">{r.name}</span><Icon name="chevron-right" /></button>)}</div>}</Loaded>;
  return <section data-testid="bot-channel" data-channel-id={id}>
    <Loaded q={channel}>{ch => ch && <><h1>{ch.name}</h1><p className="code-hint">{t("live.botChannel.members", { count: ch.members.length })} · {ch.members.map(name).join(", ")}</p></>}</Loaded>
    <Loaded q={messages}>{m => m && <div className="list" data-testid="channel-messages">{!m.items.length && <p className="code-hint" data-testid="live-empty">{t("live.botChannel.empty")}</p>}{m.items.map(x => <div key={x.id} className="li" data-testid="channel-message"><b>{name(x.from_id)}</b><span className="grow">{x.text}</span><span className="code-meta">{when(x.at)}</span></div>)}</div>}</Loaded>
    <form className="ctx-bar" onSubmit={e => { e.preventDefault(); const body = text.trim(); if (body) void c.run(async () => { const r = await call<{ delivered: number }>(epoch, "app.channel.send", { channel: id }, { text: body }); setSent(r.delivered); setText(""); }, messages.reload); }}>
      <input className="input grow" data-testid="channel-input" aria-label={t("live.botChannel.message")} placeholder={t("live.botChannel.message")} value={text} maxLength={4000} onChange={e => setText(e.target.value)} />
      <button className="btn primary" data-testid="channel-send" disabled={c.busy || !text.trim()}>{t("live.botChannel.send")}</button>
    </form>
    {sent !== undefined && <p role="status" data-testid="channel-delivered">{t("live.botChannel.delivered", { count: sent })}</p>}
    <ContractError code={c.error} />
  </section>;
}

// The trunk has no Bot room route yet: the screen says so instead of inventing a room.
export function BotRoom() {
  const t = useT(), { go } = useNav();
  return <>
    <div className="content-top"><span className="title">{t("live.botRoom.title")}</span></div>
    <div className="page"><div className="empty" data-testid="bot-room-unavailable"><h2>{t("live.botRoom.unavailable")}</h2><p>{t("live.botRoom.unavailableBody")}</p><button className="btn secondary" onClick={() => go("bot-channel")}>{t("live.botRoom.channels")}</button></div></div>
  </>;
}

export function BotInvites() {
  const t = useT();
  return <Owned title={t("live.botInvites.title")}>{epoch => <InviteList epoch={epoch} />}</Owned>;
}
function InviteList({ epoch }: { epoch: string }) {
  const t = useT(), { go } = useNav(), inbox = useQuery(() => api.workBot.copyInbox(epoch), [epoch]);
  return <Loaded q={inbox} empty={d => !d.length}>{rows => <div className="list" data-testid="bot-invites">{rows.map(r => <button key={r.id} className="li" data-testid="bot-invite-row" onClick={() => go("bot-invite", { id: r.id })}><Icon name={r.kind === "routine" ? "clock-loop" : "bot"} /><span className="grow"><b>{r.name}</b> · {t(`live.botInvites.kind.${r.kind}`)}</span><span className="code-meta">{when(r.created_at)}</span><Icon name="chevron-right" /></button>)}</div>}</Loaded>;
}

export function BotInvite() {
  const t = useT(), { params } = useNav(), id = params.get("id") ?? "";
  return <Owned title={t("live.botInvite.title")}>{epoch => <OwnedInvite epoch={epoch} id={id} />}</Owned>;
}
function OwnedInvite({ epoch, id }: { epoch: string; id: string }) {
  const bots = useBots(), alive = React.useRef(true);
  React.useEffect(() => () => { alive.current = false; }, []);
  if (bots.state !== "ready") return null;
  return <div data-testid="bot-invite" data-invite-id={id}><BotCopy epoch={epoch} bots={bots.data.bots} owns={() => alive.current} /></div>;
}

export function BotShare() {
  const t = useT(), { params } = useNav();
  const [token, setToken] = React.useState(params.get("token") ?? "");
  return <Owned title={t("live.botShare.title")}>{epoch => <section data-testid="bot-share">
    <label className="field">{t("live.botShare.token")}<input className="input" data-testid="bot-share-token" value={token} onChange={e => setToken(e.target.value.trim())} /></label>
    {/^[0-9a-f]{1,128}$/i.test(token) ? <SharePreview key={token} epoch={epoch} token={token} /> : <p className="code-hint">{t("live.botShare.hint")}</p>}
  </section>}</Owned>;
}
function SharePreview({ epoch, token }: { epoch: string; token: string }) {
  const t = useT(), c = useContract(), q = useOp<Row & { plugins: string[]; skills: string[] }>(epoch, "app.share.preview", { token });
  const [done, setDone] = React.useState<Row>();
  return <Loaded q={q}>{p => p && <article data-testid="bot-share-preview"><h2>{s(p.name)}</h2><p>{s(p.description)}</p><p className="code-hint">{t("live.botShare.independent")}</p>
    <p>{t("live.botShare.plugins")}: {p.plugins.join(", ") || "—"}</p><p>{t("live.botShare.skills")}: {p.skills.join(", ") || "—"}</p>
    {done ? <p role="status" data-testid="bot-share-cloned">{t("live.botShare.cloned")}</p> : <button className="btn primary" data-testid="bot-share-clone" disabled={c.busy} onClick={() => void c.run(async () => setDone(await call<Row>(epoch, "app.share.clone", { token }, {})))}>{t("live.botShare.clone")}</button>}
    <ContractError code={c.error} /></article>}</Loaded>;
}

export function BotComputer() {
  const t = useT(), { params } = useNav();
  return <Owned title={t("live.botComputer.title")}>{epoch => <Computer epoch={epoch} pick={params.get("id") ?? ""} />}</Owned>;
}
function Computer({ epoch, pick }: { epoch: string; pick: string }) {
  const t = useT(), bots = useBots(), c = useContract();
  const [bot, setBot] = React.useState(pick);
  React.useEffect(() => { if (!bot && bots.state === "ready" && bots.data.bots[0]) setBot(bots.data.bots[0].id); }, [bot, bots]);
  const q = useOp<Row>(epoch, "app.computer", { bot }, !bot);
  const act = (action: string) => void c.run(() => call(epoch, "app.computer.lifecycle", { bot }, { action }), q.reload);
  return <section data-testid="bot-computer">
    <BotPicker bots={bots.state === "ready" ? bots.data.bots : []} value={bot} set={setBot} />
    {bots.state === "ready" && !bots.data.bots.length && <p className="code-hint" data-testid="live-empty">{t("live.botComputer.noBots")}</p>}
    {bot && <Loaded q={q}>{m => m && <div className="list"><div className="li" data-testid="computer-status" data-status={s(m.status)}><Icon name="cpu" /><span className="grow"><b>{t("live.botComputer.status")}</b> {s(m.status)} · {s(m.provider)} · {s(m.region)}</span><span className="code-meta">{m.live ? t("live.botComputer.live") : s(m.offline_reason) || t("live.botComputer.offline")}</span></div>
      <div className="ctx-bar">{["resume", "hibernate", "stop"].map(a => <button key={a} className="btn secondary" data-testid={`computer-${a}`} disabled={c.busy} onClick={() => act(a)}>{t(`live.botComputer.${a}`)}</button>)}</div>
      <LiveBotControls epoch={epoch} bot={bot} paused={bots.state === "ready" && bots.data.bots.find(b => b.id === bot)?.status === "paused"} reload={bots.reload} />
    </div>}</Loaded>}
    <ContractError code={c.error} />
  </section>;
}

export function BotPicker({ bots, value, set }: { bots: WorkBotView[]; value: string; set(v: string): void }) {
  const t = useT();
  return <label className="field">{t("live.bot")}<select className="input" data-testid="live-bot-pick" value={value} onChange={e => set(e.target.value)}><option value="">{t("live.chooseBot")}</option>{bots.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>;
}

export function BotCompanion() {
  const t = useT();
  return <Owned title={t("live.botCompanion.title")}>{epoch => <Companion epoch={epoch} />}</Owned>;
}
function Companion({ epoch }: { epoch: string }) {
  const t = useT(), { go } = useNav();
  const devices = useOp<{ items: (Row & { revoked: boolean })[] }>(epoch, "app.devices");
  const pending = useQuery(() => api.workBot.pendingApprovals(epoch), [epoch]);
  return <section data-testid="bot-companion"><p className="code-hint">{t("live.botCompanion.note")}</p>
    <h2>{t("live.botCompanion.devices")}</h2>
    <Loaded q={devices} empty={d => !d?.items.length}>{d => <div className="list">{d!.items.map(x => <div key={s(x.id)} className="li" data-testid="companion-device"><Icon name="smartphone" /><span className="grow">{s(x.label)} · {s(x.platform)}</span><span className="code-meta">{x.revoked ? t("live.botCompanion.revoked") : when(x.last_seen_at)}</span></div>)}</div>}</Loaded>
    <h2>{t("live.botCompanion.decisions")}</h2>
    <Loaded q={pending} empty={d => !d.items.length}>{d => <div className="list">{d.items.map(x => <button key={x.id} className="li" data-testid="companion-pending" onClick={() => go("approvals")}><Icon name="shield-check" /><span className="grow">{x.tool_name}</span><span className="code-meta">{when(x.created_at)}</span></button>)}</div>}</Loaded>
  </section>;
}

export function BotCreate({ first }: { first: boolean }) {
  const t = useT();
  return <Owned title={t(first ? "live.botCreate.firstTitle" : "live.botCreate.title")}>{epoch => <Create epoch={epoch} first={first} />}</Owned>;
}
const LOOKS = ["meadow", "teal", "terracotta", "amber", "plum", "slate"] as const;
function Create({ epoch, first }: { epoch: string; first: boolean }) {
  const t = useT(), { go } = useNav(), c = useContract(), bots = useBots();
  const [name, setName] = React.useState(""), [description, setDescription] = React.useState(""), [look, setLook] = React.useState<(typeof LOOKS)[number]>("meadow");
  return <form className="list" data-testid="bot-create" onSubmit={e => { e.preventDefault(); if (bots.state === "ready" && name.trim()) void c.run(async () => { const r = await api.workBot.create({ epoch: bots.data.epoch, config: { name: name.trim(), description: description.trim(), label: "", look, shape: "dots" } }); go("bot", { source: "work-bot-api", id: r.bot.id, epoch }); }); }}>
    <h1>{t(first ? "live.botCreate.firstHeading" : "live.botCreate.heading")}</h1><p className="code-hint">{t("live.botCreate.note")}</p>
    {first && bots.state === "ready" && bots.data.bots.length > 0 && <p role="status" data-testid="bot-create-existing">{t("live.botCreate.existing", { count: bots.data.bots.length })}</p>}
    <label className="field">{t("live.botCreate.name")}<input className="input" data-testid="bot-create-name" required maxLength={60} value={name} onChange={e => setName(e.target.value)} /></label>
    <label className="field">{t("live.botCreate.description")}<textarea className="input" data-testid="bot-create-description" maxLength={500} value={description} onChange={e => setDescription(e.target.value)} /></label>
    <label className="field">{t("live.botCreate.look")}<select className="input" data-testid="bot-create-look" value={look} onChange={e => setLook(e.target.value as (typeof LOOKS)[number])}>{LOOKS.map(l => <option key={l} value={l}>{t(`live.look.${l}`)}</option>)}</select></label>
    <button className="btn primary" data-testid="bot-create-submit" disabled={c.busy || !name.trim() || bots.state !== "ready"}>{t("live.botCreate.submit")}</button>
    <ContractError code={c.error} />
  </form>;
}
