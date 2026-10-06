import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import type { WorkChannel, WorkBotView } from "@cortex/schema";
import { api } from "../../api";
import { useQuery } from "../../state/live";
import { useNav, readHash } from "../../shell/nav";
import { useT } from "../../i18n";
import { Icon } from "../../kit/ui";
import { isPreview } from "../../preview";
import "./work.css";

export function ChannelConnection() {
  const t = useT(), { entryKey, params } = useNav();
  const connection = useQuery(() => api.connection.get(), []);
  return !isPreview() && connection.state === "ready" && connection.data.mode !== "local" && connection.data.signedIn
    ? <ChannelOwner key={`${entryKey}:${params.get("epoch")}`} />
    : <div className="page"><p role="status">{t("workChannels.signIn")}</p></div>;
}

function ChannelOwner() {
  const owner = useQuery(() => api.workBot.list(), []);
  const [epoch, setEpoch] = React.useState("");
  React.useEffect(() => { if (owner.state === "ready") setEpoch(owner.data.epoch); }, [owner]);
  return <OwnedChannels key={epoch} epoch={epoch} bots={owner.state === "ready" && owner.data.epoch === epoch ? owner.data.bots : []} ready={owner.state === "ready" && owner.data.epoch === epoch} refreshOwner={owner.reload} />;
}

function OwnedChannels({ epoch, bots, ready, refreshOwner }: { epoch: string; bots: WorkBotView[]; ready: boolean; refreshOwner: () => void }) {
  const t = useT(), { entryKey, go } = useNav();
  const list = useQuery(async () => epoch ? { epoch, items: await api.workBot.channels.list(epoch) } : undefined, [epoch]);
  const [query, setQuery] = React.useState(""), [editor, setEditor] = React.useState<WorkChannel | "new">(), [deleting, setDeleting] = React.useState(false);
  const [name, setName] = React.useState(""), [members, setMembers] = React.useState<string[]>([]), [changedMembers, setChangedMembers] = React.useState(false);
  const [busy, setBusy] = React.useState(false), [issue, setIssue] = React.useState("");
  const mounted = React.useRef(true), pending = React.useRef(false), current = React.useRef({ epoch, ready });
  current.current = { epoch, ready };
  React.useEffect(() => () => { mounted.current = false; }, []);
  const owns = () => mounted.current && readHash().entryKey === entryKey && current.current.epoch === epoch;
  const available = ready && !!epoch && list.state === "ready" && list.data?.epoch === epoch;
  const rows = available ? list.data!.items.filter(row => row.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())) : [];
  const memberName = (id: string) => bots.find(bot => bot.id === id)?.name ?? t("workChannels.unlistedMember");
  const refresh = () => { refreshOwner(); list.reload(); };
  const mutate = async (action: () => Promise<void>) => {
    if (pending.current || !owns() || !current.current.ready || !available) return;
    pending.current = true; setBusy(true); setIssue("");
    try { await action(); }
    catch (error) {
      if (owns()) setIssue(error && typeof error === "object" && "code" in error && ["not_found", "conflict", "invalid_request", "provider_auth_failed"].includes(String(error.code)) ? String(error.code) : "generic");
    } finally { pending.current = false; if (owns()) setBusy(false); }
  };
  const open = (id: string) => void mutate(async () => {
    const row = await api.workBot.channels.get(id, epoch);
    if (owns()) { setName(row.name); setMembers([...row.members]); setChangedMembers(false); setEditor(row); setDeleting(false); }
  });
  const save = () => void mutate(async () => {
    if (!editor || !name.trim() || [...name.trim()].length > 80) return;
    const channel = editor === "new"
      ? await api.workBot.channels.create({ epoch, channel: { name: name.trim(), members } })
      : await api.workBot.channels.update(editor.id, { epoch, channel: { name: name.trim(), ...(changedMembers ? { members } : {}) } });
    const stored = await api.workBot.channels.get(channel.id, epoch);
    if (owns()) { setEditor(stored); setName(stored.name); setMembers([...stored.members]); setChangedMembers(false); list.reload(); }
  });
  const remove = () => void mutate(async () => {
    if (!editor || editor === "new") return;
    await api.workBot.channels.remove(editor.id, epoch);
    if (owns()) { setEditor(undefined); setDeleting(false); list.reload(); }
  });
  return <>
    <div className="content-top"><button className="btn secondary" onClick={() => go("work-home")}>{t("workChannels.bots")}</button><span className="title">{t("workChannels.title")}</span><div className="spacer" /><button className="btn secondary" data-testid="work-channels-refresh" disabled={busy} onClick={refresh}>{t("workBot.reconnect")}</button><button className="btn primary" data-testid="work-channels-new" disabled={!available || busy} onClick={() => { setEditor("new"); setName(""); setMembers([]); setChangedMembers(false); setIssue(""); setDeleting(false); }}>{t("workChannels.new")}</button></div>
    <div className="page"><section className="work-channels" data-testid="remote-work-channels" data-owner-epoch={epoch}>
      <div className="work-channels-heading"><div><h1>{t("workChannels.heading")}</h1><p>{t("workChannels.note")}</p></div><label>{t("workChannels.search")}<input className="input" type="search" data-testid="work-channels-search" value={query} disabled={!available} onChange={event => setQuery(event.target.value)} /></label></div>
      {(!ready || list.state === "error") && <p className="banner err" role="alert">{t("workChannels.readError")}</p>}
      {!epoch || list.state === "loading" ? <p role="status">{t("workBot.loading")}</p> : <div className="work-channels-list" aria-label={t("workChannels.title")}>
        {rows.map(row => <button key={row.id} className="work-channel-row" data-testid="work-channel-row" data-channel-id={row.id} disabled={busy} onClick={() => open(row.id)}><Icon name="mentions" /><span className="grow"><strong>{row.name}</strong><span className="sub">{row.members.map(memberName).join(" · ") || t("workChannels.noMembers")}</span></span><span className="sub">{t("workChannels.memberCount", { count: row.members.length })}</span><Icon name="chevron-right" /></button>)}
        {available && !rows.length && <p data-testid="work-channels-empty">{t("workChannels.empty")}</p>}
      </div>}
      {available && <p className="travail-meta" role="status">{t("workChannels.count", { count: rows.length })}</p>}
      {issue && !editor && <p role="alert">{t(`workChannels.error.${issue}`)}</p>}
      <Dialog.Root open={!!editor} onOpenChange={open => { if (!open && !busy) { setEditor(undefined); setDeleting(false); } }}>
        <Dialog.Portal><Dialog.Backdrop className="backdrop work-channel-backdrop" /><Dialog.Popup className="dialog work-channel-dialog" data-testid="work-channel-editor">
          <Dialog.Title render={<h2 />}>{t(editor === "new" ? "workChannels.new" : "workChannels.edit")}</Dialog.Title><Dialog.Description>{t("workChannels.editorNote")}</Dialog.Description>
          <form onSubmit={event => { event.preventDefault(); save(); }}>
            <fieldset disabled={busy || !available}><label className="field">{t("workChannels.name")}<input className="input" data-testid="work-channel-name" value={name} maxLength={80} /* ponytail: UTF-16 units, so astral names cap below 80 code points; count code points via onBeforeInput if needed */ required aria-invalid={[...name.trim()].length > 80} aria-describedby="work-channel-name-count" onChange={event => setName(event.target.value)} /><span id="work-channel-name-count" className="sub" data-testid="work-channel-name-count" role={[...name.trim()].length > 80 ? "alert" : undefined}>{t([...name.trim()].length > 80 ? "workChannels.nameTooLong" : "workChannels.nameCount", { count: [...name.trim()].length, max: 80 })}</span></label>
              <fieldset className="work-channel-members"><legend>{t("workChannels.members")}</legend>
                {[...new Set([...bots.map(bot => bot.id), ...members])].map(id => <label className="work-channel-choice" key={id}><input type="checkbox" data-testid="work-channel-member" data-bot-id={id} checked={members.includes(id)} onChange={event => { setMembers(previous => event.target.checked ? [...previous, id] : previous.filter(member => member !== id)); setChangedMembers(true); }} /><span>{memberName(id)}</span></label>)}
                {!bots.length && !members.length && <p>{t("workChannels.noMembers")}</p>}
              </fieldset>
            </fieldset>
            <p className="travail-meta" data-testid="work-channel-selected" role="status">{t("workChannels.selected", { count: members.length })}</p>
            {!available && <p role="status">{t("workChannels.suspended")} <button className="btn secondary" type="button" onClick={refresh}>{t("workBot.reconnect")}</button></p>}
            {issue && <p className="banner err" role="alert" data-testid="work-channel-error">{t(`workChannels.error.${issue}`)}</p>}
            <footer className="work-channel-footer"><button className="btn secondary" type="button" disabled={busy} onClick={() => { setEditor(undefined); setDeleting(false); }}>{t("workChannels.close")}</button>{editor && editor !== "new" && <button className="btn secondary" type="button" data-testid="work-channel-remove" disabled={busy || !available} onClick={() => setDeleting(true)}>{t("workChannels.remove")}</button>}<button className="btn primary" data-testid="work-channel-save" disabled={busy || !available || !name.trim() || [...name.trim()].length > 80}>{t(editor === "new" ? "workChannels.create" : "workChannels.save")}</button></footer>
          </form>
          {deleting && <div className="work-channel-delete"><p>{t("workChannels.deleteNote")}</p><button className="btn secondary" data-testid="work-channel-delete-confirm" disabled={busy || !available} onClick={remove}>{t("workChannels.confirmRemove")}</button><button className="btn secondary" disabled={busy} onClick={() => setDeleting(false)}>{t("workChannels.keep")}</button></div>}
        </Dialog.Popup></Dialog.Portal>
      </Dialog.Root>
    </section></div>
  </>;
}
