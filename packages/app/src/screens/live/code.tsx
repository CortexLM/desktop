import * as React from "react";
import { api } from "../../api";
import { useT } from "../../i18n";
import { useNav } from "../../shell/nav";
import { useQuery } from "../../state/live";
import { Icon } from "../../kit/ui";
import { Owned, Loaded, useOp, call, useContract, ContractError, s, when, type Row } from "./shared";

type Automation = Row & { id: string; name: string; enabled: boolean; trigger_kind: string; runs?: Row[] };
const TRIGGERS = ["manual", "cron", "pr_opened", "pr_pushed", "push"];

export function CodeAutomations() {
  const t = useT();
  return <Owned title={t("live.codeAutomations.title")}>{epoch => <AutomationList epoch={epoch} />}</Owned>;
}
function AutomationList({ epoch }: { epoch: string }) {
  const t = useT(), { go } = useNav(), c = useContract();
  const q = useOp<{ items: Automation[]; stats: Record<string, number> }>(epoch, "app.automations");
  const [name, setName] = React.useState(""), [prompt, setPrompt] = React.useState(""), [trigger, setTrigger] = React.useState("manual"), [schedule, setSchedule] = React.useState("");
  return <section data-testid="code-automations">
    <Loaded q={q}>{d => d && <>
      <p className="code-hint" data-testid="automation-stats">{t("live.codeAutomations.stats", { total: d.stats.total ?? 0, enabled: d.stats.enabled ?? 0, failed: d.stats.failed_7d ?? 0 })}</p>
      {!d.items.length && <p className="code-hint" data-testid="live-empty">{t("live.codeAutomations.empty")}</p>}
      <div className="list">{d.items.map(a => <button key={a.id} className="li" data-testid="automation-row" data-enabled={String(a.enabled)} onClick={() => go("code-automation", { id: a.id })}><Icon name="clock-loop" /><span className="grow"><b>{a.name}</b> · {t(`live.trigger.${a.trigger_kind}`)}</span><span className="code-meta">{a.enabled ? t("live.enabled") : t("live.paused")} · {s(a.last_status)}</span><Icon name="chevron-right" /></button>)}</div>
    </>}</Loaded>
    <form className="list" data-testid="automation-create" onSubmit={e => { e.preventDefault(); void c.run(async () => { const a = await call<Automation>(epoch, "app.automations.create", {}, { name: name.trim(), prompt: prompt.trim(), trigger_kind: trigger, enabled: true, ...(trigger === "cron" ? { schedule } : {}) }); go("code-automation", { id: a.id }); }); }}>
      <h2>{t("live.codeAutomations.new")}</h2>
      <label className="field">{t("live.name")}<input className="input" data-testid="automation-name" required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="field">{t("live.prompt")}<textarea className="input" data-testid="automation-prompt" required maxLength={8000} value={prompt} onChange={e => setPrompt(e.target.value)} /></label>
      <label className="field">{t("live.codeAutomations.trigger")}<select className="input" data-testid="automation-trigger" value={trigger} onChange={e => setTrigger(e.target.value)}>{TRIGGERS.map(k => <option key={k} value={k}>{t(`live.trigger.${k}`)}</option>)}</select></label>
      {trigger === "cron" && <label className="field">{t("live.schedule")}<input className="input" data-testid="automation-schedule" required value={schedule} placeholder="0 9 * * 1" onChange={e => setSchedule(e.target.value)} /></label>}
      <button className="btn primary" data-testid="automation-save" disabled={c.busy || !name.trim() || !prompt.trim()}>{t("live.create")}</button>
      <ContractError code={c.error} />
    </form>
  </section>;
}

export function CodeAutomation() {
  const t = useT(), { params } = useNav(), id = params.get("id") ?? "";
  return <Owned title={t("live.codeAutomation.title")}>{epoch => id ? <AutomationDetail epoch={epoch} id={id} /> : <AutomationList epoch={epoch} />}</Owned>;
}
function AutomationDetail({ epoch, id }: { epoch: string; id: string }) {
  const t = useT(), { go } = useNav(), c = useContract();
  const q = useOp<Automation>(epoch, "app.automation", { automation: id });
  return <Loaded q={q}>{a => a && <section data-testid="code-automation" data-automation-id={id}>
    <h1>{a.name}</h1><p className="code-hint">{t(`live.trigger.${a.trigger_kind}`)} {s(a.schedule)} · {s(a.repo)}</p><p>{s(a.prompt)}</p>
    <div className="ctx-bar">
      <button className="btn primary" data-testid="automation-run" disabled={c.busy} onClick={() => void c.run(() => call(epoch, "app.automation.run", { automation: id }, {}), q.reload)}>{t("live.runNow")}</button>
      <button className="btn secondary" data-testid="automation-toggle" disabled={c.busy} onClick={() => void c.run(() => call(epoch, "app.automation.update", { automation: id }, { enabled: !a.enabled }), q.reload)}>{t(a.enabled ? "live.pause" : "live.resume")}</button>
      <button className="btn secondary" data-testid="automation-remove" disabled={c.busy} onClick={() => { if (confirm(t("live.confirmRemove"))) void c.run(() => call(epoch, "app.automation.remove", { automation: id }), () => go("code-automations")); }}>{t("live.remove")}</button>
    </div>
    <ContractError code={c.error} />
    <h2>{t("live.history")}</h2>
    {!a.runs?.length ? <p className="code-hint" data-testid="live-empty">{t("live.codeAutomation.noRuns")}</p> : <div className="list">{a.runs.map(r => <div key={s(r.id)} className="li" data-testid="automation-run-row" data-status={s(r.status)}><span className="grow">{s(r.trigger)} · {s(r.status)}{r.detail ? ` · ${s(r.detail)}` : ""}</span>{!!r.session_id && <button className="btn secondary" onClick={() => go("code-session", { id: s(r.session_id) })}>{t("live.open")}</button>}<span className="code-meta">{when(r.started_at)}</span></div>)}</div>}
  </section>}</Loaded>;
}

export function CodeConnect() {
  const t = useT();
  return <Owned title={t("live.codeConnect.title")}>{epoch => <Connect epoch={epoch} />}</Owned>;
}
function Connect({ epoch }: { epoch: string }) {
  const t = useT(), c = useContract();
  const caps = useQuery(() => api.code.capabilities(), [epoch]);
  const repos = useQuery(() => api.code.repositories(epoch), [epoch]);
  return <section data-testid="code-connect">
    <Loaded q={caps}>{d => <p role="status" data-testid="code-connect-cloud" data-available={String(d.cloud.available)}>{t(d.cloud.available ? "live.codeConnect.cloudReady" : "live.codeConnect.cloudOff")}</p>}</Loaded>
    <Loaded q={repos}>{d => <>
      <p role="status" data-testid="code-connect-github" data-connected={String(d.githubConnected)}>{t(d.githubConnected ? "live.codeConnect.github" : "live.codeConnect.noGithub")}</p>
      {!d.githubConnected && <button className="btn primary" data-testid="code-connect-start" disabled={c.busy} onClick={() => void c.run(async () => { const r = await call<{ authorize_url: string }>(epoch, "app.github.start", {}, {}); window.cortex?.openExternal?.(r.authorize_url); })}>{t("live.codeConnect.connect")}</button>}
      <div className="list">{d.items.map(r => <div key={r.fullName} className="li" data-testid="code-connect-repo"><Icon name="git-branch" /><span className="grow">{r.fullName}</span><span className="code-meta">{r.private ? t("live.private") : t("live.public")}</span></div>)}</div>
    </>}</Loaded>
    <ContractError code={c.error} />
  </section>;
}
