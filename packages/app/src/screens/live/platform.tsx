import * as React from "react";
import { api } from "../../api";
import { useT, useI18n } from "../../i18n";
import { useNav } from "../../shell/nav";
import { useQuery } from "../../state/live";
import { Icon } from "../../kit/ui";
import { Connection } from "../system/settings";
import { RemoteBoundary } from "../chat/remote-chat";
import { Owned, Loaded, useOp, call, useContract, ContractError, s, when, type Row } from "./shared";

export function ConnectionScreen() {
  const t = useT(), { go } = useNav();
  const instance = useQuery(async () => (await api.connection.get()).mode === "local" ? undefined : api.connection.probe(), []);
  return <>
    <div className="content-top"><span className="title">{t("live.connection.title")}</span><div className="spacer" /><button className="btn secondary" onClick={() => go("remote-login")}>{t("live.connection.signIn")}</button></div>
    <div className="page" data-testid="connection-screen"><Connection />
      {instance.state === "ready" && instance.data && <p role="status" data-testid="connection-probe" data-status={instance.data.status}>{t("live.connection.probe", { status: instance.data.status })}</p>}
    </div>
  </>;
}

type Provider = { id: string; name: string; configured: boolean; model_count: number; env: string[]; api?: string; doc?: string };
export function Providers() {
  const t = useT();
  return <Owned title={t("live.providers.title")}>{epoch => <ProviderList epoch={epoch} />}</Owned>;
}
function ProviderList({ epoch }: { epoch: string }) {
  const t = useT(), { go } = useNav();
  const q = useOp<{ items: Provider[]; source: string }>(epoch, "app.providers");
  const [f, setF] = React.useState("");
  return <Loaded q={q} empty={d => !d?.items.length}>{d => <section data-testid="providers">
    <p className="code-hint" data-testid="providers-source">{t("live.providers.source", { source: s(d!.source) })}</p>
    <input className="input" type="search" aria-label={t("live.search")} placeholder={t("live.search")} value={f} onChange={e => setF(e.target.value)} />
    <div className="list">{d!.items.filter(p => p.name.toLowerCase().includes(f.toLowerCase())).map(p => <button key={p.id} className="li" data-testid="provider-row" data-provider-id={p.id} onClick={() => go("provider-detail", { id: p.id })}><span className="grow"><b>{p.name}</b></span><span className="code-meta">{t("live.providers.models", { count: p.model_count })} · {p.configured ? t("live.providers.configured") : t("live.providers.notConfigured")}</span><Icon name="chevron-right" /></button>)}</div>
  </section>}</Loaded>;
}

export function ProviderDetail() {
  const t = useT(), { params } = useNav(), id = params.get("id") ?? "";
  return <Owned title={t("live.providerDetail.title")}>{epoch => <ProviderBody epoch={epoch} id={id} />}</Owned>;
}
function ProviderBody({ epoch, id }: { epoch: string; id: string }) {
  const t = useT();
  const q = useOp<Provider>(epoch, "app.provider", { provider: id }, !id);
  if (!id) return <p className="code-hint" data-testid="live-empty">{t("live.providerDetail.pick")}</p>;
  return <Loaded q={q}>{p => p && <section data-testid="provider-detail" data-provider-id={p.id}>
    <h1>{p.name}</h1>
    <p role="status" data-testid="provider-configured" data-configured={String(p.configured)}>{p.configured ? t("live.providers.configured") : t("live.providers.notConfigured")}</p>
    <p>{t("live.providers.models", { count: p.model_count })}</p>
    <p className="code-hint">{t("live.providerDetail.operator")}</p>
    <div className="list">{p.env.map(k => <div key={k} className="li"><Icon name="key" /><code className="grow">{k}</code></div>)}</div>
  </section>}</Loaded>;
}

type Model = { slug: string; display_name: string; context_tokens?: number; supports_reasoning: boolean; supports_tools: boolean; supports_vision: boolean; is_preview: boolean; kind?: string };
export function Models() {
  const t = useT();
  return <Owned title={t("live.models.title")}>{epoch => <ModelList epoch={epoch} />}</Owned>;
}
type RegistryModel = { id: string; name: string; configured: boolean; capabilities: { reasoning: boolean; tools: boolean; image: boolean; context_tokens: number } };
function ModelList({ epoch }: { epoch: string }) {
  const t = useT();
  const q = useQuery(async () => {
    const [cloud, registry] = await Promise.all([call<{ items: Model[] }>(epoch, "app.models"), call<{ items: RegistryModel[] }>(epoch, "app.registry.models").catch(() => ({ items: [] }))]);
    return [...cloud.items, ...registry.items.map(m => ({ slug: m.id, display_name: m.name, context_tokens: m.capabilities.context_tokens, supports_reasoning: m.capabilities.reasoning, supports_tools: m.capabilities.tools, supports_vision: m.capabilities.image, is_preview: false, configured: m.configured }))];
  }, [epoch]);
  const { locale } = useI18n();
  // Users read context as document length: ~500 tokens per printed page, rounded to two significant digits.
  const pages = (tokens: number) => { const count = Math.max(1, Number(Math.round(tokens / 500).toPrecision(2))); return { count, pages: new Intl.NumberFormat(locale).format(count) }; };
  const cap = (on: boolean, k: string, icon: string, tone: string) => on ? <span className={`badge ${tone}`} data-cap={k} key={k}><Icon name={icon} size={12} />{t(`live.models.${k}`)}</span> : null;
  return <Loaded q={q} empty={d => !d.length}>{d => <div className="list" data-testid="models">{d.map(m => <div key={m.slug} className="li systeme-model" data-testid="model-row" data-slug={m.slug}>
    <span className="grow"><div className="ttl">{m.display_name}</div><div className="sub" data-testid="model-context">{m.context_tokens ? t("live.models.pages", pages(m.context_tokens)) : t("live.models.contextUnknown")}</div></span>
    {cap(m.supports_reasoning, "reasoning", "brain", "run")}{cap(m.supports_vision, "vision", "image", "ok")}{cap(m.supports_tools, "tools", "wrench", "wait")}{m.is_preview && <span className="badge wait" data-cap="preview">{t("live.models.preview")}</span>}
  </div>)}</div>}</Loaded>;
}

type Me = { email: string; display_name?: string; plan_slug: string; is_guest: boolean };
/** Signed-in Profile (design ProfileScreen): identity and plan from `/v1/me`. */
export function LiveProfile() {
  const t = useT();
  return <Owned title={t("system.profile.title")}>{epoch => <ProfileBody epoch={epoch} />}</Owned>;
}
function ProfileBody({ epoch }: { epoch: string }) {
  const t = useT(), { go } = useNav();
  const q = useOp<Me>(epoch, "app.me");
  return <Loaded q={q}>{me => {
    if (!me) return null;
    const name = me.display_name || me.email.split("@")[0] || t("system.profile.guest");
    const initials = name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toLocaleUpperCase()).join("");
    const planKey = `system.pricing.plan.${me.plan_slug}.name`;
    const plan = me.is_guest ? t("system.profile.guest") : t("system.profile.planName", { plan: t(planKey) === planKey ? me.plan_slug : t(planKey) });
    return <div className="systeme-narrow" data-testid="profile-live">
      <div className="systeme-prof"><span className="systeme-bigav" aria-hidden>{initials}</span>
        <div><h1 data-testid="profile-name">{name}</h1><div className="sub" data-testid="profile-email">{[me.email, plan].filter(Boolean).join(" · ")}</div></div></div>
      <h3 className="h3">{t("system.profile.plan")}</h3>
      <div className="list"><div className="li"><span className="grow"><div className="ttl" data-testid="profile-plan">{plan}</div></span><button type="button" className="btn primary" onClick={() => go("pricing")}>{t("system.profile.seePlans")}</button></div></div>
      <h3 className="h3" style={{ marginTop: 24 }}>{t("system.profile.tab.delete")}</h3>
      <div className="list"><div className="li"><span className="grow"><div className="ttl">{t("system.settings.sec.account")}</div><div className="sub">{t("system.profile.manage")}</div></span><button type="button" className="btn secondary" onClick={() => go("settings", { section: "account" })}>{t("system.profile.manageAction")}</button></div></div>
    </div>;
  }}</Loaded>;
}

export function ModelPicker() {
  const t = useT();
  return <Owned title={t("live.modelPicker.title")}>{epoch => <PickerBody epoch={epoch} />}</Owned>;
}
function PickerBody({ epoch }: { epoch: string }) {
  const t = useT(), c = useContract();
  const models = useQuery(() => api.code.models(), [epoch]);
  const settings = useQuery(() => api.code.settings(epoch), [epoch]);
  return <section data-testid="model-picker">
    <Loaded q={settings} empty={d => !d.models.length}>{d => <label className="field">{t("live.modelPicker.default")}<select className="input" data-testid="model-picker-select" value={d.defaultModel ?? ""} disabled={c.busy} onChange={e => { const v = e.target.value; void c.run(() => api.code.setDefaultModel(epoch, v), settings.reload); }}>
      <option value="">{t("live.modelPicker.none")}</option>
      {d.models.map(m => <option key={m.ref} value={m.ref}>{m.name}</option>)}
    </select></label>}</Loaded>
    {settings.state === "ready" && <p role="status" data-testid="model-picker-stored">{t("live.modelPicker.stored", { model: settings.data.defaultModel || t("live.modelPicker.none") })}</p>}
    <Loaded q={models} empty={d => !d.models.length}>{d => <div className="list">{d.models.map(m => <div key={m.slug} className="li" data-testid="model-picker-row"><span className="grow">{m.name}</span>{(["reasoning", "vision", "tools"] as const).map(k => <span key={k} className="chip" data-cap={k} data-value={String(m[k])}>{t(`live.models.${k}`)}: {t(m[k] === "unknown" ? "live.unknown" : m[k] ? "live.yes" : "live.no")}</span>)}</div>)}</div>}</Loaded>
    <ContractError code={c.error} />
  </section>;
}

export function ToolApproval() {
  const t = useT(), { params } = useNav();
  return <Owned title={t("live.toolApproval.title")}>{epoch => <Approvals epoch={epoch} pick={params.get("id") ?? ""} />}</Owned>;
}
function Approvals({ epoch, pick }: { epoch: string; pick: string }) {
  const t = useT(), c = useContract();
  const convs = useOp<{ items: { id: string; title?: string }[] }>(epoch, "app.conversations");
  const [conv, setConv] = React.useState(pick);
  const q = useOp<{ items: (Row & { id: string; decision?: string; tool_name: string; summary?: string; exact_action_preview?: string })[] }>(epoch, "app.permissions", { conversation: conv }, !conv);
  const decide = (prompt: string, decision: string) => void c.run(() => call(epoch, "app.permission.decide", { conversation: conv, prompt }, { decision }), q.reload);
  return <section data-testid="tool-approval">
    <Loaded q={convs}>{d => d && <label className="field">{t("live.toolApproval.conversation")}<select className="input" data-testid="tool-approval-conversation" value={conv} onChange={e => setConv(e.target.value)}><option value="">{t("live.toolApproval.choose")}</option>{d.items.map(x => <option key={x.id} value={x.id}>{x.title || x.id}</option>)}</select></label>}</Loaded>
    {conv && <Loaded q={q} empty={d => !d?.items.length}>{d => <div className="list">{d!.items.map(p => <div key={p.id} className="li" data-testid="tool-approval-row" data-decision={s(p.decision)}><Icon name="shield-check" /><span className="grow"><b>{p.tool_name}</b> {s(p.summary)}<br /><code>{s(p.exact_action_preview)}</code></span>
      {p.decision ? <span className="code-meta">{s(p.decision)}</span> : <>{(["allow", "always", "deny"] as const).map(k => <button key={k} className={k === "allow" ? "btn primary" : "btn secondary"} data-testid={`tool-approval-${k}`} disabled={c.busy} onClick={() => decide(p.id, k)}>{t(`live.toolApproval.${k}`)}</button>)}</>}
      <span className="code-meta">{when(p.created_at)}</span></div>)}</div>}</Loaded>}
    <ContractError code={c.error} />
  </section>;
}

export function RemoteChatScreen() {
  const t = useT();
  return <RemoteBoundary local={<Owned title={t("live.remoteChat.title")}>{() => null}</Owned>} />;
}
