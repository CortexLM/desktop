import * as React from "react";
import type { WorkJob } from "@cortex/schema";
import { api } from "../../api";
import { useT } from "../../i18n";
import { ContractError, useContract } from "../code/contract-panels";

type Bot = { epoch: string; bot: string };

export function LiveJobControls({ epoch, bot, job, reload }: Bot & { job: WorkJob; reload: () => void }) {
  const t = useT(), c = useContract();
  const act = (op: "bot.task.pause" | "bot.task.resume" | "bot.task.retry") => void c.run(() => api.code.contract({ epoch, op, params: { bot, task: job.id }, body: {} }), reload);
  return <span className="ctx-bar" data-testid="work-job-controls">
    {["queued", "running"].includes(job.status) && <button className="btn secondary" data-testid="work-job-pause" disabled={c.busy} onClick={() => act("bot.task.pause")}>{t("workBot.contract.pause")}</button>}
    {job.status === "paused" && <button className="btn secondary" data-testid="work-job-resume" disabled={c.busy} onClick={() => act("bot.task.resume")}>{t("workBot.contract.resume")}</button>}
    {["failed", "cancelled"].includes(job.status) && <button className="btn secondary" data-testid="work-job-retry" disabled={c.busy} onClick={() => act("bot.task.retry")}>{t("workBot.contract.retry")}</button>}
    <LiveDrafts epoch={epoch} bot={bot} job={job} reload={reload} />
    <ContractError code={c.error} />
  </span>;
}

// ponytail: draft ids are read from the task result payload; add a drafts list route if results stop echoing tool output.
const draftIds = (job: WorkJob) => [...new Set([...JSON.stringify(job.result ?? "").matchAll(/draft_id\\?"\s*:\s*\\?"([0-9a-f-]{36})/g)].map(m => m[1]!))];

function LiveDrafts({ epoch, bot, job, reload }: Bot & { job: WorkJob; reload: () => void }) {
  const t = useT(), c = useContract(), task = job.id;
  const [site, setSite] = React.useState(""), [user, setUser] = React.useState(""), [pass, setPass] = React.useState("");
  const [outcome, setOutcome] = React.useState<Record<string, string>>({});
  const draft = (id: string, op: "bot.draft.send" | "bot.draft.cancel") => void c.run(() => api.code.contract({ epoch, op, params: { bot, task, draft: id }, body: {} }), () => { setOutcome(o => ({ ...o, [id]: op === "bot.draft.send" ? "sent" : "cancelled" })); reload(); });
  return <span data-testid="work-job-drafts">
    {draftIds(job).map(id => <span key={id} className="li" data-testid="work-draft" data-draft-id={id}>
      <button className="btn primary" data-testid="work-draft-send" disabled={c.busy || !!outcome[id]} onClick={() => draft(id, "bot.draft.send")}>{t("workBot.contract.draftSend")}</button>
      <button className="btn secondary" data-testid="work-draft-cancel" disabled={c.busy || !!outcome[id]} onClick={() => draft(id, "bot.draft.cancel")}>{t("workBot.contract.draftCancel")}</button>
      {outcome[id] && <span className="code-meta" data-testid="work-draft-outcome">{t(`workBot.contract.draft.${outcome[id]}`)}</span>}
    </span>)}
    {["running", "paused"].includes(job.status) && <form className="li" onSubmit={e => { e.preventDefault(); void c.run(() => api.code.contract({ epoch, op: "bot.credentials", params: { bot, task }, body: { site, username: user, password: pass } }), () => { setPass(""); setOutcome(o => ({ ...o, credentials: "credentials" })); }); }}>
      <input className="input" data-testid="work-cred-site" aria-label={t("workBot.contract.site")} value={site} onChange={e => setSite(e.target.value)} />
      <input className="input" data-testid="work-cred-user" autoComplete="off" aria-label={t("workBot.contract.username")} value={user} onChange={e => setUser(e.target.value)} />
      <input className="input" data-testid="work-cred-pass" type="password" autoComplete="off" aria-label={t("workBot.contract.password")} value={pass} onChange={e => setPass(e.target.value)} />
      <button className="btn secondary" data-testid="work-cred-send" disabled={c.busy || !site || !user || !pass}>{t("workBot.contract.credentials")}</button>
      {outcome.credentials && <span className="code-meta" data-testid="work-cred-outcome">{t("workBot.contract.draft.credentials")}</span>}
    </form>}
    <ContractError code={c.error} />
  </span>;
}

export function LiveBotControls({ epoch, bot, paused, reload }: Bot & { paused: boolean; reload: () => void }) {
  const t = useT(), c = useContract(), [controller, setController] = React.useState<string>();
  const takeover = (action: "take" | "release") => void c.run(async () => setController(String(((await api.code.contract({ epoch, op: "bot.takeover", params: { bot }, body: action === "take" ? { action, confirm: true } : { action } })).data as { controller: string }).controller)));
  return <div className="ctx-bar" data-testid="work-bot-controls">
    <button className="btn secondary" data-testid="work-bot-pause-toggle" disabled={c.busy} onClick={() => void c.run(() => api.code.contract({ epoch, op: "bot.status", params: { bot }, body: { status: paused ? "active" : "paused" } }), reload)}>{t(paused ? "workBot.contract.activate" : "workBot.contract.pauseBot")}</button>
    <button className="btn secondary" data-testid="work-bot-takeover" disabled={c.busy || controller === "user"} onClick={() => { if (confirm(t("workBot.contract.takeoverConfirm"))) takeover("take"); }}>{t("workBot.contract.takeover")}</button>
    <button className="btn secondary" data-testid="work-bot-release" disabled={c.busy || controller !== "user"} onClick={() => takeover("release")}>{t("workBot.contract.release")}</button>
    {controller && <span className="code-meta" data-testid="work-bot-controller">{controller}</span>}
    <ContractError code={c.error} />
  </div>;
}

export function LiveApprovalTransfer({ epoch, approval, done }: { epoch: string; approval: string; done: () => void }) {
  const t = useT(), c = useContract(), [to, setTo] = React.useState("");
  return <form className="li" data-testid="approval-transfer" onSubmit={e => { e.preventDefault(); void c.run(() => api.code.contract({ epoch, op: "bot.approval.transfer", params: { approval }, body: { to_user_id: to.trim() } }), done); }}>
    <input className="input grow" data-testid="approval-transfer-to" aria-label={t("workBot.contract.transferTo")} value={to} onChange={e => setTo(e.target.value)} />
    <button className="btn secondary" data-testid="approval-transfer-send" disabled={c.busy || !to.trim()}>{t("workBot.contract.transfer")}</button>
    <ContractError code={c.error} />
  </form>;
}
