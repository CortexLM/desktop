import * as React from "react";
import type { BotCopyDecline, BotCopyPreview, BotCopyResult, WorkBotView } from "@cortex/schema";
import { api } from "../../api";
import { useQuery } from "../../state/live";
import { useT } from "../../i18n";

export function BotCopy({ epoch, id, bots, owns }: { epoch: string; id?: string; bots: WorkBotView[]; owns(): boolean }) {
  const t = useT();
  const status = useQuery(async () => id ? api.workBot.copyStatus(id, epoch) : undefined, [id, epoch]);
  const inbox = useQuery(async () => !id ? api.workBot.copyInbox(epoch) : [], [id, epoch]);
  const [email, setEmail] = React.useState(""), [selected, setSelected] = React.useState("");
  const [target, setTarget] = React.useState(""), [result, setResult] = React.useState<BotCopyResult>();
  const [declined, setDeclined] = React.useState<BotCopyDecline>();
  const preview = useQuery(async () => selected ? { id: selected, data: await api.workBot.copyPreview(selected, epoch) } : undefined, [selected, epoch]);
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState(false);
  const pending = React.useRef(false), mounted = React.useRef(true);
  React.useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const current = () => mounted.current && owns();
  const mutate = async (action: () => Promise<void>) => {
    if (pending.current || !current()) return;
    pending.current = true; setBusy(true); setError(false);
    try { await action(); if (current()) { status.reload(); inbox.reload(); } }
    catch { if (current()) setError(true); }
    finally { pending.current = false; if (current()) setBusy(false); }
  };
  const data: BotCopyPreview | undefined = preview.state === "ready" && preview.data?.id === selected ? preview.data.data : undefined;
  return <section className="travail-panel bot-copy" data-testid="bot-copy">
    <h2>{t(id ? "workBot.copy.owner" : "workBot.copy.inbox")}</h2>
    <p>{t("workBot.copy.independent")}</p>
    {(error || status.state === "error" || inbox.state === "error" || preview.state === "error") && <div className="banner err" role="alert">{t("workBot.copy.unavailable")}</div>}
    <button className="btn secondary" onClick={() => { status.reload(); inbox.reload(); preview.reload(); }}>{t("workBot.reconnect")}</button>
    {id ? status.state === "ready" && status.data ? <>
      <p role="status" data-testid="bot-copy-active">{t(status.data.active ? "workBot.copy.active" : "workBot.copy.inactive")}</p>
      {status.data.active ? <>
        <form onSubmit={e => { e.preventDefault(); void mutate(async () => { await api.workBot.copyInvite(id, { epoch, email }); if (current()) setEmail(""); }); }}>
          <label className="field">{t("workBot.copy.email")}<input className="input" type="email" data-testid="bot-copy-email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
          <button className="btn primary" data-testid="bot-copy-invite" disabled={busy || !email.trim()}>{t("workBot.copy.invite")}</button>
        </form>
        <ul data-testid="bot-copy-owner-invites">{status.data.invites.map(invite => <li key={invite.id} data-invite-id={invite.id}>{invite.email_normalized}</li>)}</ul>
        <button className="btn secondary" data-testid="bot-copy-revoke" disabled={busy} onClick={() => void mutate(async () => { await api.workBot.copyRevoke(id, epoch); })}>{t("workBot.copy.revoke")}</button>
        <p>{t("workBot.copy.revokeNote")}</p>
      </> : <button className="btn primary" data-testid="bot-copy-create" disabled={busy} onClick={() => void mutate(async () => { await api.workBot.copyCreate(id, { epoch }); })}>{t("workBot.copy.create")}</button>}
    </> : <p role="status">{t("workBot.loading")}</p> : <>
      {inbox.state === "ready" && !inbox.data.length && <p data-testid="bot-copy-empty">{t("workBot.copy.empty")}</p>}
      {inbox.state === "ready" && inbox.data.map(invite => <button className="btn secondary" disabled={busy} key={invite.id} data-testid="bot-copy-preview" data-invite-id={invite.id} onClick={() => { setSelected(invite.id); setResult(undefined); setDeclined(undefined); setTarget(""); }}>{invite.name}</button>)}
      {data && !result && <article data-testid="bot-copy-preview-data">
        <h3>{data.name}</h3><p>{data.description}</p><p>{data.label}</p>
        <p>{t("workBot.copy.credentials")}</p><p>{data.plugins.join(", ")}</p><p>{data.skills.join(", ")}</p>
        {[...data.routines, ...(data.routine ? [data.routine] : [])].map((routine, index) => <section key={index}><h4>{routine.name}</h4><p>{routine.prompt}</p><p>{routine.body}</p><p>{routine.schedule}</p><p>{t("workBot.copy.paused")}</p></section>)}
        {data.kind === "routine" && <label className="field">{t("workBot.copy.target")}<select className="input" data-testid="bot-copy-target" value={target} onChange={e => setTarget(e.target.value)}><option value="">{t("workBot.copy.defaultTarget")}</option>{bots.map(bot => <option key={bot.id} value={bot.id}>{bot.name}</option>)}</select></label>}
        <button className="btn primary" data-testid="bot-copy-accept" disabled={busy} onClick={() => void mutate(async () => { const accepted = await api.workBot.copyAccept(selected, { epoch, ...(target ? { mascot_id: target } : {}) }); if (current()) setResult(accepted); })}>{t("workBot.copy.accept")}</button>
        <button className="btn secondary" data-testid="bot-copy-decline" disabled={busy} aria-describedby="bot-copy-decline-note" onClick={() => void mutate(async () => { const decision = await api.workBot.copyDecline(selected, epoch); if (current()) { setDeclined(decision); setSelected(""); setTarget(""); } })}>{t("workBot.copy.decline")}</button>
        <p id="bot-copy-decline-note">{t("workBot.copy.declineNote")}</p>
      </article>}
      {result && <div role="status" data-testid="bot-copy-accepted"><p>{t("workBot.copy.accepted")}</p><p>{t("workBot.copy.credentials")}</p><p>{result.reconnect_plugins.join(", ")}</p></div>}
      {declined && <div role="status" data-testid="bot-copy-declined" data-invite-id={declined.id}><p>{t("workBot.copy.declined")}</p><time dateTime={declined.declined_at}>{declined.declined_at}</time></div>}
    </>}
  </section>;
}
