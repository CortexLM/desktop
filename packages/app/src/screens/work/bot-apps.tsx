import * as React from "react";
import { ToolRuleInput, AppApprovalMode, type AppConnection, type AppCatalog, type OwnedConnectors, type ToolRules, type EffectiveToolPolicy } from "@cortex/schema";
import { api } from "../../api";
import { useT } from "../../i18n";

export function BotApps({ epoch, id, owns }: { epoch: string; id: string; owns(): boolean }) {
  const t = useT();
  const [catalog, setCatalog] = React.useState<AppCatalog>(), [connections, setConnections] = React.useState<AppConnection[]>([]);
  const [connectors, setConnectors] = React.useState<OwnedConnectors>(), [rules, setRules] = React.useState<ToolRules>(), [policy, setPolicy] = React.useState<EffectiveToolPolicy>();
  const [query, setQuery] = React.useState(""), [draft, setDraft] = React.useState<{ slug: string; connected: boolean; chat: boolean; bot: boolean; approval_mode: AppConnection["approval_mode"] }>();
  const [rule, setRule] = React.useState({ effect: "require_approval", match_kind: "tool", match_value: "", reason: "" });
  const [error, setError] = React.useState(false), [busy, setBusy] = React.useState(false), [ready, setReady] = React.useState(false);
  const mounted = React.useRef(true), pending = React.useRef(false), sequence = React.useRef(0);
  const current = () => mounted.current && owns();
  async function load(q = query) {
    const token = ++sequence.current;
    try {
      const [apps, account, storedRules, effective] = await Promise.all([api.workBot.appCatalog({ epoch, q }), api.workBot.appConnections(epoch), api.workBot.toolRules(id, epoch), api.workBot.toolPolicy(id, epoch)]);
      // Account reads reconcile provider state; Bot gates must observe the committed result.
      const bots = await api.workBot.appConnectors(id, epoch);
      if (current() && token === sequence.current) { setCatalog(apps); setConnections(account.items); setConnectors(bots); setRules(storedRules); setPolicy(effective); setReady(true); }
    } catch { if (current() && token === sequence.current) setError(true); }
  }
  React.useEffect(() => { mounted.current = true; void load(""); return () => { mounted.current = false; sequence.current++; }; }, [epoch, id]); // eslint-disable-line react-hooks/exhaustive-deps
  async function mutate(action: () => Promise<void>) {
    if (!current() || pending.current) return;
    pending.current = true; setBusy(true); setError(false);
    try { await action(); if (current()) await load(); }
    catch { if (current()) setError(true); }
    finally { pending.current = false; if (current()) setBusy(false); }
  }
  return <section className="travail-panel bot-apps" data-testid="bot-apps">
    <h2>{t("workBot.apps.title")}</h2><p>{t("workBot.apps.boundary")}</p>
    {error && <div className="banner err" role="alert">{t("workBot.apps.error")}</div>}
    <form className="bot-apps-search" onSubmit={e => { e.preventDefault(); setError(false); void load(); }}><label className="field">{t("workBot.apps.search")}<input className="input" value={query} onChange={e => setQuery(e.target.value)} maxLength={200} /></label><button className="btn secondary" disabled={busy}>{t("workBot.apps.refresh")}</button></form>
    {!ready && <p role="status">{t("workBot.loading")}</p>}
    {catalog && <p data-testid="bot-apps-catalog-state">{t(`workBot.apps.source.${catalog.source}`)}</p>}
    {ready && !connections.length && <p data-testid="bot-apps-empty">{t("workBot.apps.empty")}</p>}
    {connections.map(connection => { const connector = connectors?.items.find(item => item.id === connection.id); return <article className="bot-apps-row" key={connection.id} data-testid="bot-app-connection" data-connection-id={connection.id}>
      <div className="travail-grow"><h3>{catalog?.items.find(app => app.slug === connection.slug)?.name ?? connection.slug}</h3><p role="status">{t(`workBot.apps.status.${connection.status}`)}</p><p>{t(`workBot.apps.mode.${connection.approval_mode}`)}</p>{connector?.blocked_reason && <p className="banner warn" role="status" data-testid="bot-app-blocked" data-reason={connector.blocked_reason}>{t(`workBot.apps.blocked.${connector.blocked_reason}`)}</p>}{!connector && <p role="status" data-testid="bot-app-blocked" data-reason="unlisted">{t("workBot.apps.blocked.unlisted")}</p>}</div>
      {connector?.blocked_reason === "account_off" && <button className="btn secondary" data-testid="bot-app-allow-bot" disabled={busy} onClick={() => setDraft({ slug: connection.slug, connected: true, ...connection.surfaces, bot: true, approval_mode: connection.approval_mode })}>{t("workBot.apps.allowBot")}</button>}
      <label><input type="checkbox" data-testid="bot-app-enable" checked={connector?.bot_enabled ?? false} disabled={busy || !connector || !!connector.blocked_reason} onChange={e => { const enabled = e.target.checked; void mutate(async () => { await api.workBot.appEnable(id, connection.id, { epoch, enabled }); }); }} />{t("workBot.apps.enable")}</label>
      <button className="btn secondary" data-testid="bot-app-preferences" disabled={busy} onClick={() => setDraft({ slug: connection.slug, connected: true, ...connection.surfaces, approval_mode: connection.approval_mode })}>{t("workBot.apps.preferences")}</button>
      {connection.status === "pending" && <button className="btn secondary" data-testid="bot-app-authorize" disabled={busy} onClick={() => void mutate(async () => { await api.workBot.appAuthorize(connection.slug, epoch); })}>{t("workBot.apps.authorize")}</button>}
      <button className="btn secondary" data-testid="bot-app-revoke" disabled={busy} onClick={() => void mutate(async () => { await api.workBot.appRevoke(connection.slug, epoch); if (current()) setDraft(undefined); })}>{t("workBot.apps.revoke")}</button>
    </article>; })}
    <h3>{t("workBot.apps.catalog")}</h3><div className="bot-apps-catalog">{catalog?.items.filter(app => !connections.some(connection => connection.slug === app.slug)).map(app => <article key={app.slug}><h4>{app.name}</h4><p>{app.description}</p><p>{t("workBot.apps.tools", { count: app.tool_count })}</p><button className="btn secondary" data-testid="bot-app-choose" disabled={busy} onClick={() => setDraft({ slug: app.slug, connected: false, chat: true, bot: true, approval_mode: "changes" })}>{t("workBot.apps.connect")}</button></article>)}</div>
    {draft && <form className="bot-apps-consent" data-testid="bot-app-consent" onSubmit={e => { e.preventDefault(); void mutate(async () => { const body = { epoch, surfaces: { chat: draft.chat, bot: draft.bot }, approval_mode: draft.approval_mode }; if (draft.connected) await api.workBot.appConsent(draft.slug, body); else await api.workBot.appConnect(draft.slug, body); if (current()) setDraft(undefined); }); }}>
      <h3>{t("workBot.apps.consent")}</h3><p>{t("workBot.apps.consentNote")}</p>
      <label><input type="checkbox" data-testid="bot-app-chat" checked={draft.chat} onChange={e => setDraft({ ...draft, chat: e.target.checked })} />{t("workBot.apps.chat")}</label>
      <label><input type="checkbox" data-testid="bot-app-bot" checked={draft.bot} onChange={e => setDraft({ ...draft, bot: e.target.checked })} />{t("workBot.apps.bot")}</label>
      <label className="field">{t("workBot.apps.approval")}<select className="input" data-testid="bot-app-mode" value={draft.approval_mode} onChange={e => setDraft({ ...draft, approval_mode: AppApprovalMode.parse(e.target.value) })}>{AppApprovalMode.options.map(mode => <option key={mode} value={mode}>{t(`workBot.apps.mode.${mode}`)}</option>)}</select></label>
      <button className="btn secondary" type="button" data-testid="bot-app-cancel" disabled={busy} onClick={() => setDraft(undefined)}>{t("workBot.apps.cancel")}</button><button className="btn primary" data-testid="bot-app-save" disabled={busy || !draft.chat && !draft.bot}>{t("workBot.apps.apply")}</button>
    </form>}
    <h2>{t("workBot.rules.title")}</h2><p>{t("workBot.rules.boundary")}</p>
    <form className="bot-apps-rule-form" onSubmit={e => { e.preventDefault(); void mutate(async () => { const body = ToolRuleInput.parse({ epoch, ...rule }); const stored = await api.workBot.toolRuleSet(id, body); if (current()) setRules(stored); }); }}>
      <label className="field">{t("workBot.rules.effect")}<select className="input" data-testid="bot-rule-effect" value={rule.effect} onChange={e => setRule({ ...rule, effect: e.target.value })}>{["always_allow", "require_approval", "deny"].map(effect => <option key={effect} value={effect}>{t(`workBot.rules.effect.${effect}`)}</option>)}</select></label>
      <label className="field">{t("workBot.rules.kind")}<select className="input" data-testid="bot-rule-kind" value={rule.match_kind} onChange={e => setRule({ ...rule, match_kind: e.target.value })}>{["tool", "connector", "category"].map(kind => <option key={kind} value={kind}>{t(`workBot.rules.kind.${kind}`)}</option>)}</select></label>
      <label className="field">{t("workBot.rules.match")}<input className="input" data-testid="bot-rule-match" required maxLength={120} value={rule.match_value} onChange={e => setRule({ ...rule, match_value: e.target.value })} /></label>
      <label className="field">{t("workBot.rules.reason")}<input className="input" data-testid="bot-rule-reason" maxLength={200} value={rule.reason} onChange={e => setRule({ ...rule, reason: e.target.value })} /></label>
      <button className="btn primary" data-testid="bot-rule-save" disabled={busy || !rule.match_value.trim()}>{t("workBot.rules.save")}</button>
    </form>
    {rules && !rules.items.length && <p data-testid="bot-rules-empty">{t("workBot.rules.empty")}</p>}
    {rules?.items.map(item => <article className="bot-apps-row" key={item.id} data-testid="bot-tool-rule" data-rule-id={item.id}><div className="travail-grow"><b>{item.match_value}</b><p>{t(`workBot.rules.effect.${item.effect}`)} · {t(`workBot.rules.kind.${item.match_kind}`)}</p><p>{item.reason}</p></div><button className="btn secondary" data-testid="bot-rule-remove" disabled={busy} onClick={() => void mutate(async () => { await api.workBot.toolRuleRemove(id, item.id, epoch); })}>{t("workBot.rules.remove")}</button></article>)}
    {!!policy?.admin_rules.length && <section><h3>{t("workBot.rules.organization")}</h3>{policy.admin_rules.map(item => <p key={item.id}>{item.match_value} · {t(`workBot.rules.effect.${item.effect}`)}</p>)}</section>}
  </section>;
}
