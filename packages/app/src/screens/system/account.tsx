// First launch, sign-in, pricing and profile.
import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import type { RemoteAuthInput, RemoteAuthState } from "@cortex/schema";
import { Icon, Switch, Segmented, Tip, useToast } from "../../kit/ui";
import { Mascot } from "../../mascot/Mascot";
import { navigation, readHash, useNav } from "../../shell/nav";
import { useVariant } from "../../registry";
import { useT } from "../../i18n";
import { isPreview } from "../../preview";
import { api } from "../../api";
import { useQuery } from "../../state/live";
import { Top, BotEmpty, useFx, useBotCfg, css, setTheme, currentThemePref, NB } from "./common";

/* ---------- Onboarding ---------- */
const DONE_KEY = "cortex.onboarding.done";
const STEPS = ["welcome", "theme", "apps", "bot"] as const;

export function OnboardingScreen() {
  const t = useT();
  const { go } = useNav();
  const fx = useFx();
  const bot = useBotCfg();
  const preview = isPreview();
  const [v, setV] = useVariant("1");
  const step = Math.min(3, Math.max(0, (parseInt(v) || 1) - 1));
  // Progress feeds the sidebar "Getting started" card (read by the shell).
  const done = preview ? 1 : Number(localStorage.getItem(DONE_KEY) ?? 0);
  const record = (n: number) => { if (!preview && n > Number(localStorage.getItem(DONE_KEY) ?? 0)) localStorage.setItem(DONE_KEY, String(n)); };
  const setStep = (s: number) => { record(s); setV(String(s + 1)); };
  const [theme, setThemeState] = React.useState(currentThemePref);
  const [apps, setApps] = React.useState([true, true, false, false]);
  const appRows = preview ? fx.onboarding.apps : (["mail", "calendar", "storage", "team"] as const).map((k) => [t(`system.onb.app.${k}.mono`), t(`system.onb.app.${k}.title`), t(`system.onb.app.${k}.desc`)] as [string, string, string]);
  const label = t(`system.onb.step.${STEPS[step]}`);
  return (<>
    <div className="content-top"><div className="spacer" /><button className="btn systeme-skip" onClick={() => { record(step + 1); go("home"); }}>{t("system.onb.skip")}</button></div>
    <div className="onb">
      <div className="steps" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step + 1} aria-label={t("system.onb.progress", { n: step + 1, label })}>
        {STEPS.map((s, i) => <i key={s} className="step" data-current={i === step || undefined} data-done={i < step || undefined} />)}
      </div>
      <div className="onb-card systeme-onb-card" key={step}>
        {step === 0 && <>
          <Mascot cfg={bot} state="done" size={120} track interactive />
          <h1>{t("system.onb.welcomeTitle")}</h1>
          <p>{t("system.onb.welcomeText")}</p>
          <div className="list" style={{ width: "100%", textAlign: "left" }}>
            {([["compose", "chat"], ["folder", "projects"], ["bot", "bot"]] as const).map(([ic, k]) => (
              <div key={k} className="li"><span className="li-ic"><Icon name={ic} /></span><span className="grow"><div className="ttl">{t(`system.onb.feat.${k}.title`)}</div><div className="sub">{t(`system.onb.feat.${k}.desc`)}</div></span></div>))}
          </div>
        </>}
        {step === 1 && <>
          <h1>{t("system.onb.themeTitle")}</h1>
          <p>{t("system.onb.themeText")}</p>
          <div className="systeme-themes" role="radiogroup" aria-label={t("system.theme.label")}>
            {(["system", "light", "dark"] as const).map((x) => (
              <button key={x} role="radio" aria-checked={theme === x} className="systeme-theme" onClick={() => { setThemeState(x); setTheme(x); }}>
                <span className="pg-prev" data-v={x}><i /><b /></span><span className="systeme-theme-l"><span className="radio" />{t(`system.theme.${x}`)}</span></button>))}
          </div>
        </>}
        {step === 2 && <>
          <h1>{t("system.onb.appsTitle")}</h1>
          <p>{t("system.onb.appsText")}</p>
          <div className="list systeme-apps">
            {appRows.map(([m, ti, d], i) => (
              <label key={m} className="li"><span className="systeme-mono" aria-hidden>{m}</span><span className="grow"><div className="ttl">{ti}</div><div className="sub">{d}</div></span>
                <Switch checked={apps[i]} onCheckedChange={(x) => setApps((a) => a.map((y, j) => (j === i ? x : y)))} aria-label={ti} /></label>))}
          </div>
          <button className="systeme-textbtn" style={{ marginTop: 12 }} onClick={() => go("connectors")}>{preview ? t("system.onb.allConnectors", { count: fx.onboarding.connectors }) : t("system.onb.allConnectorsLive")}</button>
        </>}
        {step === 3 && <>
          <Mascot cfg={bot} state="waiting" size={120} track interactive />
          <h1>{t("system.onb.botTitle")}</h1>
          <p>{t("system.onb.botText", { name: bot.name })}</p>
          <button className="btn primary big" onClick={() => { record(5); go("bot-new"); }}><Icon name="bot" />{t("system.onb.createBot")}</button>
          <button className="systeme-textbtn" style={{ marginTop: 12 }} onClick={() => { record(4); go("home"); }}>{t("system.onb.later")}</button>
        </>}
      </div>
      <div className="onb-foot systeme-onb-foot">
        {step > 0 ? <button className="btn secondary" onClick={() => setV(String(step))}><Icon name="arrow-left" />{t("system.back")}</button> : <span />}
        <span className="systeme-onb-meta">{t("system.onb.meta", { done: Math.max(1, done), label })}</span>
        {step < 3 ? <button className="btn primary" onClick={() => setStep(step + 1)}>{step === 0 ? t("system.onb.start") : t("system.onb.continue")}<Icon name="arrow-right" /></button> : <span />}
      </div>
    </div>
  </>);
}

/* ---------- Sign-in ---------- */
function Otp({ value, onChange, err, disabled }: { value: string; onChange: (v: string) => void; err?: boolean; disabled?: boolean }) {
  const t = useT();
  const [focus, setFocus] = React.useState(true);
  return (
    <div className="systeme-otp" data-err={err || undefined}>
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className="systeme-cell" aria-hidden data-filled={value[i] ? "" : undefined} data-cur={(focus && i === Math.min(value.length, 5)) || undefined}>
          {value[i] ?? (focus && i === value.length ? <span className="systeme-caret" /> : "")}
        </span>))}
      <input value={value} disabled={disabled} autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} aria-label={t("system.login.codeLabel")} aria-invalid={err || undefined}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        onPaste={(e) => { e.preventDefault(); onChange(e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)); }} />
    </div>
  );
}

export function LoginScreen() {
  const t = useT();
  const { go, entryKey } = useNav();
  const toast = useToast();
  const fx = useFx();
  const bot = useBotCfg();
  const preview = isPreview();
  const [variant, setV] = useVariant("email");
  const [auth, setAuth] = React.useState<RemoteAuthState | null>(null);
  const [authError, setAuthError] = React.useState("");
  const request = React.useRef<symbol | null>(null);
  const startedCandidate = React.useRef<{ origin: string; candidate: string } | null>(null);
  const v = preview ? variant : auth?.status === "signed_in" ? "signed-in" : auth?.status === "code_sent" ? "code" : auth?.status === "verify_email" || auth?.status === "mfa_challenge" ? auth.status : auth && auth.status !== "signed_out" ? "unavailable" : "email";
  const seed = (x: string) => (preview ? (x === "error" ? fx.login.bad : x === "loading" ? fx.login.good : "") : "");
  const [email, setEmail] = React.useState(preview ? fx.login.email : "");
  const [code, setCode] = React.useState(seed(v));
  const [busy, setBusy] = React.useState(v === "loading");
  React.useLayoutEffect(() => {
    if (preview) return;
    const changed = () => {
      if (readHash().entryKey !== entryKey) request.current = null;
      else setBusy(false);
    };
    navigation.addEventListener("currententrychange", changed);
    return () => navigation.removeEventListener("currententrychange", changed);
  }, [entryKey, preview]);
  const continuationValid = v === "verify_email" ? code.trim().length >= 1 && code.trim().length <= 128 : /^\d{6}$/.test(code);
  React.useEffect(() => { if (preview) { setCode(seed(v)); setBusy(v === "loading"); } }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadAuth = React.useCallback(() => {
    const owner = Symbol(); request.current = owner; setBusy(true); setAuthError("");
    api.connection.auth.get().then((state) => {
      if (request.current !== owner) return;
      setAuth(state); setEmail(state.email ?? ""); setCode("");
    }, () => { if (request.current === owner) setAuthError("system.auth.failed"); }).finally(() => {
      if (request.current === owner) { request.current = null; setBusy(false); }
    });
  }, []);
  React.useEffect(() => {
    if (!preview) loadAuth();
    return () => { request.current = null; };
  }, [preview, loadAuth]);
  type FormInput = RemoteAuthInput extends infer Input ? Input extends { action: string } ? Omit<Input, "owner" | "origin" | "candidate"> : never : never;
  const submit = async (input: FormInput, leave = false) => {
    if (!preview && readHash().entryKey !== entryKey) return;
    if (input.action !== "cancel" && (request.current || !auth)) return;
    const owner = Symbol(); request.current = owner; setBusy(true); setAuthError("");
    try {
      if (input.action === "cancel") {
        const target = startedCandidate.current ?? (auth?.owner && auth.candidate ? { origin: auth.owner.origin, candidate: auth.candidate } : null);
        if (!target) { if (leave) go("home"); return; }
        const state = await api.connection.auth.submit({ action: "cancel", ...target });
        if (request.current !== owner) return;
        startedCandidate.current = null;
        setAuth(state); setCode("");
        if (leave) go("home");
        return;
      }
      let captured = auth;
      if (input.action === "email") {
        const connection = await api.connection.get();
        if (request.current !== owner) return;
        if (connection.mode === "local") {
          await api.connection.set({ mode: "cloud", signedIn: false });
          if (request.current !== owner) return;
        }
        if (connection.mode === "local" || !captured?.owner) captured = await api.connection.auth.get();
        if (request.current !== owner) return;
      }
      if (!captured?.owner) { setAuthError("system.auth.failed"); return; }
      if (input.action === "email" || input.action === "local") startedCandidate.current = { origin: captured.owner.origin, candidate: captured.owner.revision };
      const state = await api.connection.auth.submit(input.action === "logout" ? input : { ...input, owner: captured.owner });
      if (request.current !== owner) return;
      startedCandidate.current = null;
      setAuth(state); setCode("");
      if (state.email) setEmail(state.email);
      if (leave) go("home");
    } catch {
      if (request.current === owner) {
        setAuthError(input.action === "email" ? "system.auth.sendFailed" : "system.auth.failed");
        const state = await api.connection.auth.get().catch(() => null);
        if (request.current === owner && state) {
          startedCandidate.current = null;
          if (state.owner?.revision !== auth?.owner?.revision || state.owner?.origin !== auth?.owner?.origin) setCode("");
          setAuth(state);
          if (state.email) setEmail(state.email);
        }
      }
    } finally {
      if (request.current === owner) { request.current = null; setBusy(false); }
    }
  };
  const unavailable = () => toast.add({ title: t("system.unavailable"), description: t("system.auth.optionUnavailable"), data: { icon: "alert-triangle" } });
  React.useEffect(() => {
    if (!preview || v !== "code" || code.length < 6) return;
    setBusy(true);
    const tm = setTimeout(() => { setBusy(false); if (code === fx.login.good) go("onboarding"); else setV("error"); }, 900);
    return () => clearTimeout(tm);
  }, [code, v]); // eslint-disable-line react-hooks/exhaustive-deps
  const providers = (
    <div className="systeme-providers">
      {(["google", "apple", "microsoft"] as const).map((m) => <button key={m} className="systeme-prov" onClick={preview ? undefined : unavailable}><i aria-hidden>{t(`system.login.${m}Mono`)}</i>{t(`system.login.${m}`)}</button>)}
    </div>
  );
  return (<>
    <div className="content-top"><div className="spacer" /><button className="btn secondary" onClick={() => go("about")}>{t("system.login.help")}</button></div>
    <div className="systeme-center">
      <div className="systeme-login" key={v === "loading" || v === "error" ? "code" : v}>
        {v === "email" && <>
          <span className="systeme-logo" aria-hidden />
          <h1>{t("system.login.title")}</h1>
          <p className="systeme-lead">{t("system.login.lead")}</p>
          <form onSubmit={(e) => { e.preventDefault(); if (preview) setV("code"); else void submit({ action: "email", email: email.trim() }); }}>
            <div className="field"><label htmlFor="systeme-em">{t("system.login.email")}</label><input id="systeme-em" className="input" type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy || (!preview && !auth)} onChange={(e) => setEmail(e.target.value)} /></div>
            <button className="btn primary big" disabled={!email.includes("@") || busy || (!preview && !auth)}>{busy && <span className="spin" />}{t("system.login.getCode")}</button>
          </form>
          <div className="systeme-or">{t("system.login.or")}</div>
          {providers}
          <button className="systeme-prov" style={{ marginTop: 8 }} onClick={preview ? undefined : unavailable}><Icon name="key" />{t("system.login.sso")}</button>
          <p className="systeme-legal">{t("system.login.legalA")} <button className="systeme-textbtn">{t("system.login.terms")}</button> {t("system.login.legalB")} <button className="systeme-textbtn">{t("system.login.privacy")}</button>{t("system.login.legalC")}</p>
        </>}
        {(v === "code" || v === "error" || v === "loading") && <>
          <span className="li-ic" style={{ margin: "0 auto", width: 44, height: 44, borderRadius: 14 }}><Icon name="mail" size={20} /></span>
          <h1>{t("system.login.checkTitle")}</h1>
          <p className="systeme-lead">{t("system.login.checkLead")} <b style={{ fontWeight: 500, color: "var(--t1)", overflowWrap: "anywhere" }}>{email}</b>.</p>
          <form onSubmit={(e) => { e.preventDefault(); if (!preview && code.length === 6) void submit({ action: "code", code }); }}>
            <Otp value={code} onChange={(x) => { setCode(x); setAuthError(""); if (v === "error") setV("code"); }} err={v === "error" || !!authError} disabled={busy} />
            {v === "error" && <p className="systeme-err" role="alert"><Icon name="alert-triangle" size={16} />{t("system.login.wrong", { count: 2 })}</p>}
            <div className="systeme-otp-meta" aria-live="polite">{busy ? <span className="thinking">{t("system.login.verifying")}</span> : <>{t("system.login.notReceived", { nb: NB })} <button type="button" className="systeme-textbtn" onClick={preview ? undefined : () => void submit({ action: "email", email })}>{t("system.login.resend")}</button>{preview && <> · {t("system.login.resendIn", { time: "0:42" })}</>}</>}</div>
            <button className="btn primary big" disabled={code.length < 6 || busy} onClick={preview ? () => setV(code === fx.login?.good ? "loading" : "error") : undefined}>{busy ? <><span className="spin" />{t("system.login.signingIn")}</> : t("system.onb.continue")}</button>
          </form>
          <button className="systeme-textbtn" style={{ marginTop: 16, alignSelf: "center" }} onClick={() => { if (preview) setV("email"); else void submit({ action: "cancel" }); }}>{t("system.login.otherEmail")}</button>
        </>}
        {!preview && (v === "verify_email" || v === "mfa_challenge") && <>
          <span className="systeme-logo" aria-hidden />
          <h1>{t(v === "verify_email" ? "system.auth.verifyEmailTitle" : "system.auth.mfaTitle")}</h1>
          <p className="systeme-lead">{t(v === "verify_email" ? "system.auth.verifyEmailLead" : "system.auth.mfaLead", { email: auth?.email ?? "" })}</p>
          <form onSubmit={(e) => { e.preventDefault(); if (continuationValid) void submit({ action: v === "verify_email" ? "verify_email" : "mfa", code: v === "verify_email" ? code.trim() : code }); }}>
            {v === "verify_email" ? <div className="field">
              <label htmlFor="systeme-verification">{t("system.auth.verifyEmailCodeLabel")}</label>
              <input id="systeme-verification" className="input" autoFocus autoComplete="one-time-code" required value={code} disabled={busy} aria-invalid={!!authError} aria-describedby="systeme-verification-hint" onChange={(e) => { setCode(e.target.value); setAuthError(""); }} />
              <p id="systeme-verification-hint" className="systeme-lead">{t("system.auth.verifyEmailCodeHint")}</p>
            </div> : <Otp value={code} onChange={(value) => { setCode(value); setAuthError(""); }} err={!!authError} disabled={busy} />}
            <button className="btn primary big" disabled={busy || !continuationValid}>{busy && <span className="spin" />}{t("system.auth.verifyContinue")}</button>
          </form>
          <button className="btn secondary big" onClick={() => void submit({ action: "cancel" })}>{t("system.auth.restart")}</button>
        </>}
        {v === "signed-in" && <>
          <span className="systeme-logo" aria-hidden /><h1>{t("system.auth.signedIn")}</h1>
          <p className="systeme-lead">{t("system.auth.sessionOnly")}</p>
          <button className="btn primary big" onClick={() => go("home")}>{t("system.onb.continue")}</button>
          <button className="btn secondary big" style={{ marginTop: 8 }} onClick={() => go("settings", { section: "connection" })}>{t("system.auth.settings")}</button>
        </>}
        {v === "unavailable" && <>
          <span className="systeme-logo" aria-hidden /><h1>{t("system.unavailable")}</h1>
          <p className="systeme-lead">{t("system.auth.continuationUnavailable")}</p>
          <button className="btn secondary big" onClick={() => void submit({ action: "cancel" })}>{t("system.login.otherEmail")}</button>
        </>}
        {!preview && authError && <p className="systeme-err" role="alert"><Icon name="alert-triangle" size={16} />{t(authError)}</p>}
        {!preview && !auth && authError && <button className="btn secondary" disabled={busy} onClick={loadAuth}>{t("common.retry")}</button>}
        {!preview && v !== "signed-in" && <button className="systeme-textbtn" style={{ marginTop: 16, alignSelf: "center" }} onClick={() => void submit({ action: "cancel" }, true)}>{t("common.cancel")}</button>}
        {v === "locked" && <>
          <Mascot cfg={bot} state="blocked" size={96} interactive />
          <h1>{t("system.login.lockedTitle")}</h1>
          <p className="systeme-lead">{t("system.login.lockedText", { email, nb: NB })}</p>
          <button className="btn primary big"><Icon name="mail" />{t("system.login.unlockLink")}</button>
          <button className="btn secondary big" style={{ marginTop: 8 }} onClick={() => go("about")}>{t("system.login.support")}</button>
          <p className="systeme-legal">{t("system.login.notYou", { nb: NB })}</p>
        </>}
      </div>
    </div>
  </>);
}

/* ---------- Pricing ---------- */
type Plan = { id: "free" | "plus" | "pro" | "team"; m: number; y: number; feats: number; pop?: boolean; per?: boolean };
const PLANS: Plan[] = [
  { id: "free", m: 0, y: 0, feats: 4 },
  { id: "plus", m: 9, y: 7, feats: 5 },
  { id: "pro", m: 24, y: 20, feats: 5, pop: true },
  { id: "team", m: 30, y: 25, feats: 5, per: true },
];
// Comparison table: row key → per-plan value (true = included, false = not, string = i18n key suffix or literal).
const CMP: [string, [string, (string | boolean)[]][]][] = [
  ["models", [["fast", [true, true, true, true]], ["thinking", ["perDay30", "unlimited", "unlimited", "unlimited"]], ["proModel", [false, false, true, true]], ["deep", [false, "perMonth5", "perMonth100", "perMonth200"]]]],
  ["create", [["images", [false, "perDay50", "perDay200", "perDay200"]], ["files", ["mb10", "mb100", "mb500", "gb1"]], ["canvas", [true, true, true, true]]]],
  ["organize", [["projects", ["#1", "#10", "unlimitedPl", "unlimitedPl"]], ["bots", ["#—", "#1", "#3", "#10"]], ["memory", ["basic", "extended", "extended", "extended"]], ["code", [false, false, true, true]]]],
  ["team", [["shared", [false, false, false, true]], ["sso", [false, false, false, true]], ["audit", [false, false, false, true]]]],
];

export function PricingScreen() {
  const t = useT();
  const toast = useToast();
  const fx = useFx();
  const preview = isPreview();
  const [v, setV] = useVariant("plans");
  const [bill, setBill] = React.useState<"monthly" | "yearly">("yearly");
  const [busy, setBusy] = React.useState(false);
  const yearly = bill === "yearly";
  const pro = PLANS[2];
  const eur = (n: number) => t("system.pricing.eur", { n, nb: NB });
  const price = (p: Plan) => (yearly ? p.y : p.m);
  const name = (p: Plan) => t(`system.pricing.plan.${p.id}.name`);
  const cell = (x: string | boolean) => x === true ? <Icon name="check" size={16} /> : x === false ? <span aria-label={t("system.pricing.notIncluded")}>—</span> : x.startsWith("#") ? x.slice(1) : t(`system.pricing.v.${x}`);
  return (<>
    <Top title={t("system.pricing.title")}>
      {(v === "payment" || v === "confirmed") && <button className="btn secondary" onClick={() => setV("plans")}><Icon name="arrow-left" />{t("system.pricing.allPlans")}</button>}
    </Top>
    <div className="page"><div className="systeme-mid" style={{ maxWidth: 1080 }}>
      {(v === "plans" || v === "compare") && <>
        <div className="page-title" style={{ justifyContent: "center", marginBottom: 6 }}>{t("system.pricing.headline")}</div>
        <p style={{ textAlign: "center", color: "var(--t2)", margin: "0 0 18px" }}>{t("system.pricing.current")}</p>
        <div className="systeme-bill"><Segmented items={[t("system.pricing.monthly"), t("system.pricing.yearly")]} value={t(`system.pricing.${bill}`)} onChange={(x) => setBill(x === t("system.pricing.yearly") ? "yearly" : "monthly")} /><span className="systeme-save" aria-live="polite">{yearly ? t("system.pricing.twoMonths") : t("system.pricing.save", { nb: NB })}</span></div>
        <div className="systeme-tabs" role="tablist" style={{ justifyContent: "center" }}>
          {(["plans", "compare"] as const).map((id) => <button key={id} role="tab" aria-selected={v === id} className="systeme-tab" onClick={() => setV(id)}>{t(`system.pricing.tab.${id}`)}</button>)}
        </div>
      </>}
      {v === "plans" && <div className="systeme-plans">
        {PLANS.map((p, i) => (
          <div key={p.id} className="systeme-plan" style={css(i)} data-pop={p.pop || undefined}>
            <h3>{name(p)}{p.pop && <span className="badge run">{t("system.pricing.popular")}</span>}{p.id === "free" && <span className="badge ok">{t("system.pricing.currentBadge")}</span>}</h3>
            <div className="systeme-desc">{t(`system.pricing.plan.${p.id}.desc`)}</div>
            <div className="systeme-price"><b key={bill + p.id}>{eur(price(p))}</b><span>{t("system.pricing.perMonth")}</span></div>
            <div className="systeme-per">{p.m ? (yearly ? t(p.per ? "system.pricing.billedYearlyMember" : "system.pricing.billedYearly", { amount: eur(p.y * 12) }) : t(p.per ? "system.pricing.billedMonthlyMember" : "system.pricing.billedMonthly")) : t("system.pricing.noCard")}</div>
            <button className={"btn " + (p.pop ? "primary" : "secondary")} disabled={p.id === "free"} onClick={() => (p.id === "team" ? toast.add({ title: t("system.pricing.requestSent"), description: t("system.pricing.requestSentDesc"), data: { icon: "mail" } }) : setV("payment"))}>{t(`system.pricing.plan.${p.id}.cta`)}</button>
            <ul className="systeme-feats">{Array.from({ length: p.feats }, (_, j) => { const f = t(`system.pricing.plan.${p.id}.f${j}`); return <li key={j}>{j === 0 && i > 0 ? <span style={{ color: "var(--t2)" }}>{f}</span> : <><Icon name="check" size={16} />{f}</>}</li>; })}</ul>
          </div>))}
      </div>}
      {v === "compare" && <table className="systeme-table systeme-rise">
        <thead><tr><th scope="col"><span className="systeme-sr">{t("system.pricing.feature")}</span></th>{PLANS.map((p) => <th key={p.id} scope="col" data-cur={p.id === "free" || undefined}>{name(p)}<div style={{ fontWeight: 400, fontSize: 11, color: "var(--t2)" }}><span key={bill}>{eur(price(p))} {t("system.pricing.perMonth")}</span></div></th>)}</tr></thead>
        <tbody>{CMP.map(([g, rows]) => <React.Fragment key={g}>
          <tr className="systeme-grp"><th colSpan={5} scope="colgroup">{t(`system.pricing.g.${g}`)}</th></tr>
          {rows.map(([f, vals]) => <tr key={f}><th scope="row">{t(`system.pricing.r.${f}`)}</th>{vals.map((x, i) => <td key={i}>{cell(x)}</td>)}</tr>)}
        </React.Fragment>)}</tbody>
      </table>}
      {v === "payment" && <div className="systeme-pay systeme-rise">
        <form className="systeme-card" onSubmit={(e) => {
          e.preventDefault();
          // ponytail: no billing route in the engine; live checkout reports that honestly.
          if (!preview) { toast.add({ title: t("system.unavailable"), description: t("system.pricing.unavailable"), data: { icon: "alert-triangle" } }); return; }
          setBusy(true); setTimeout(() => { setBusy(false); setV("confirmed"); }, 1400);
        }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 500 }}>{t("system.pricing.payment")}</h2>
          <div className="field"><label htmlFor="systeme-cn">{t("system.pricing.cardNumber")}</label><div className="systeme-card-in"><input id="systeme-cn" className="input" inputMode="numeric" autoComplete="cc-number" defaultValue={preview ? fx.pricing.card : ""} /><span className="badge ok"><Icon name="shield-check" size={12} />{t("system.pricing.secure")}</span></div></div>
          <div className="systeme-2">
            <div className="field"><label htmlFor="systeme-ce">{t("system.pricing.expiry")}</label><input id="systeme-ce" className="input" autoComplete="cc-exp" placeholder={t("system.pricing.expiryPh")} defaultValue={preview ? fx.pricing.exp : ""} /></div>
            <div className="field"><label htmlFor="systeme-cc">{t("system.pricing.cvc")}</label><input id="systeme-cc" className="input" autoComplete="cc-csc" inputMode="numeric" maxLength={4} defaultValue={preview ? "•••" : ""} /></div>
          </div>
          <div className="field"><label htmlFor="systeme-cname">{t("system.pricing.holder")}</label><input id="systeme-cname" className="input" autoComplete="cc-name" defaultValue={preview ? fx.user.name : ""} /></div>
          <div className="field"><label htmlFor="systeme-cvat">{t("system.pricing.vat")}</label><input id="systeme-cvat" className="input" placeholder={t("system.pricing.vatPh")} /></div>
          <button className="btn primary big" disabled={busy} aria-busy={busy}>{busy ? <><span className="spin" />{t("system.pricing.paying")}</> : t("system.pricing.pay", { amount: eur(pro.y * 12) })}</button>
          <p style={{ color: "var(--t2)", fontSize: 11, margin: "10px 0 0", textAlign: "center" }}>{t("system.pricing.renews")}</p>
        </form>
        <div className="systeme-card systeme-summary">
          <h3 className="h3" style={{ margin: 0 }}>{t("system.pricing.summary")}</h3>
          <div className="systeme-line"><span>{t("system.pricing.proYearly")}</span><b>{eur(pro.y * 12)}</b></div>
          <div className="systeme-line"><span>{t("system.pricing.discount")}</span><span>−{eur((pro.m - pro.y) * 12)}</span></div>
          <div className="systeme-line"><span>{t("system.pricing.vatIncl", { nb: NB })}</span><span>{eur((pro.y * 12) / 6)}</span></div>
          <div className="systeme-line systeme-total"><b>{t("system.pricing.total")}</b><b>{eur(pro.y * 12)}</b></div>
          <ul className="systeme-feats" style={{ marginTop: 6 }}>{[1, 2, 3, 4].map((j) => <li key={j}><Icon name="check" size={16} />{t(`system.pricing.plan.pro.f${j}`)}</li>)}</ul>
        </div>
      </div>}
      {v === "confirmed" && <ProConfirmed />}
    </div></div>
  </>);
}

function ProConfirmed() {
  const t = useT();
  const { go } = useNav();
  const fx = useFx();
  const bot = useBotCfg();
  return (
    <div className="empty" style={{ minHeight: 520 }}>
      <Mascot cfg={bot} state="done" size={96} interactive />
      <h2>{t("system.pricing.welcomePro")}</h2>
      <p>{t("system.pricing.confirmedText", { email: fx.user?.email ?? "", name: bot.name })}</p>
      <div style={{ display: "flex", gap: 8 }}><button className="btn primary" onClick={() => go("home")}>{t("system.onb.start")}</button><button className="btn secondary" onClick={() => go("profile")}>{t("system.pricing.invoice")}</button></div>
    </div>
  );
}

/* ---------- Profile and account ---------- */
function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT();
  const fx = useFx();
  const [txt, setTxt] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const word = t("system.profile.deleteWord");
  const ok = txt.trim() === word;
  const p = fx.profile;
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setTxt(""); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="backdrop" />
        <Dialog.Popup className="dialog" role="alertdialog">
          <Dialog.Title>{t("system.profile.deleteTitle", { nb: NB })}</Dialog.Title>
          <Dialog.Description>{t("system.profile.deleteDesc", { chats: p.chats, projects: p.projects, memories: p.memories })}</Dialog.Description>
          <form onSubmit={(e) => { e.preventDefault(); if (ok) { setBusy(true); setTimeout(() => { setBusy(false); onOpenChange(false); }, 1200); } }}>
            <div className="field"><label htmlFor="systeme-del">{t("system.profile.typeToConfirm")} <span className="mono" style={{ fontSize: 12 }}>{word}</span></label>
              <input id="systeme-del" className="input" value={txt} onChange={(e) => setTxt(e.target.value)} autoComplete="off" spellCheck={false} aria-invalid={(txt.length > 0 && !ok) || undefined} /></div>
            <div className="systeme-actions"><Dialog.Close className="btn secondary" type="button">{t("system.common.cancel")}</Dialog.Close>
              <button className="btn systeme-btn-danger" disabled={!ok || busy}>{busy ? <><span className="spin" />{t("system.profile.deleting")}</> : t("system.profile.deleteBtn")}</button></div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ProfileScreen() {
  const t = useT();
  const { go } = useNav();
  const conn = useQuery(() => api.connection.get(), []);
  if (isPreview()) return <ProfilePreview />;
  // Live: the account lives in Cortex Cloud; without a signed-in connection there is no profile to show.
  return (<>
    <Top title={t("system.profile.title")} />
    {conn.state === "loading" ? null : <BotEmpty title={t("system.profile.signedOutTitle")} text={t("system.profile.signedOutText")}>
      <button className="btn primary" onClick={() => go("login")}>{t("system.login.title")}</button>
    </BotEmpty>}
  </>);
}

function ProfilePreview() {
  const t = useT();
  const { go } = useNav();
  const toast = useToast();
  const fx = useFx();
  const u = fx.user, p = fx.profile;
  const [v, setV] = useVariant("profile");
  const [twofa, setTwofa] = React.useState(true);
  const [sessions, setSessions] = React.useState(p.sessions);
  const [del, setDel] = React.useState(v === "delete");
  React.useEffect(() => setDel(v === "delete"), [v]);
  return (<>
    <Top title={t("system.profile.title")} />
    <div className="page"><div className="systeme-narrow">
      <div className="systeme-prof">
        <span className="systeme-bigav">{u.initials}<Tip label={t("system.profile.photo")}><button aria-label={t("system.profile.photo")}><Icon name="image" size={12} /></button></Tip></span>
        <div><h1>{u.name}</h1><div className="sub">{u.email} · {t("system.profile.planFree")}</div></div>
      </div>
      <div className="systeme-tabs" role="tablist">{(["profile", "security", "delete"] as const).map((id) => <button key={id} role="tab" aria-selected={v === id} className="systeme-tab" onClick={() => setV(id)}>{t(`system.profile.tab.${id}`)}</button>)}</div>
      <div key={v} className="systeme-rise" role="tabpanel">
        {v === "profile" && <form onSubmit={(e) => { e.preventDefault(); toast.add({ title: t("system.profile.saved"), data: { icon: "check-circle" } }); }}>
          <div className="systeme-2">
            <div className="field"><label htmlFor="systeme-fn">{t("system.profile.first")}</label><input id="systeme-fn" className="input" defaultValue={u.first} autoComplete="given-name" /></div>
            <div className="field"><label htmlFor="systeme-ln">{t("system.profile.last")}</label><input id="systeme-ln" className="input" defaultValue={u.last} autoComplete="family-name" /></div>
          </div>
          <div className="field"><label htmlFor="systeme-pem">{t("system.profile.email")}</label><div className="systeme-inline"><input id="systeme-pem" className="input" type="email" defaultValue={u.email} autoComplete="email" /><span className="badge ok"><Icon name="check" size={12} />{t("system.profile.verified")}</span></div></div>
          <div className="field"><label htmlFor="systeme-role">{t("system.profile.what")}</label><input id="systeme-role" className="input" defaultValue={u.role} /><span style={{ color: "var(--t2)", fontSize: 11 }}>{t("system.profile.whatHint")}</span></div>
          <h3 className="h3" style={{ marginTop: 20 }}>{t("system.profile.plan")}</h3>
          <div className="list"><div className="li"><span className="grow"><div className="ttl">{t("system.profile.planFree")}</div><div className="sub">{t("system.profile.planFreeDesc")}</div></span><button type="button" className="btn primary" onClick={() => go("pricing")}>{t("system.profile.seePlans")}</button></div></div>
          <div className="systeme-actions"><button className="btn primary">{t("system.common.save")}</button></div>
        </form>}
        {v === "security" && <>
          <h3 className="h3">{t("system.profile.twofa")}</h3>
          <div className="list">
            <label className="li"><span className="li-ic"><Icon name="shield-check" /></span><span className="grow"><div className="ttl">{t("system.profile.authApp")}</div><div className="sub">{twofa ? t("system.profile.on", { since: p.twofaSince }) : t("system.profile.offHint")}</div></span><Switch checked={twofa} onCheckedChange={setTwofa} aria-label={t("system.profile.twofa")} /></label>
            <div className="li"><span className="li-ic"><Icon name="key" /></span><span className="grow"><div className="ttl">{t("system.profile.passkeys")}</div><div className="sub">{p.passkeys}</div></span><button className="btn secondary">{t("system.add")}</button></div>
            {twofa && <div className="li" style={{ display: "block" }}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><span className="grow"><div className="ttl">{t("system.profile.backup")}</div><div className="sub">{t("system.profile.backupDesc", { count: p.codes.length })}</div></span><button className="btn secondary" onClick={() => toast.add({ title: t("system.profile.codesCopied"), data: { icon: "copy" } })}><Icon name="copy" />{t("system.common.copy")}</button></div>
              <div className="systeme-codes" aria-label={t("system.profile.backup")}>{p.codes.map((c) => <span key={c}>{c}</span>)}</div></div>}
          </div>
          <h3 className="h3">{t("system.profile.sessions", { n: sessions.length })}</h3>
          <div className="list">{sessions.map(([ic, d, l, w, cur]) => (
            <div key={d} className="li"><span className="li-ic"><Icon name={ic} /></span><span className="grow"><div className="ttl">{d}</div><div className="sub">{l} · {w}</div></span>
              {cur ? <span className="badge ok"><span className="systeme-dot" />{t("system.profile.thisDevice")}</span> : <button className="btn secondary" onClick={() => { setSessions((s) => s.filter((x) => x[1] !== d)); toast.add({ title: t("system.profile.sessionClosed"), description: d, data: { icon: "check-circle" } }); }}>{t("system.profile.signOut")}</button>}</div>))}</div>
          {sessions.length > 1 && <button className="btn secondary systeme-danger" style={{ marginTop: 12 }} onClick={() => setSessions((s) => s.filter((x) => x[4]))}>{t("system.profile.signOutOthers")}</button>}
        </>}
        {v === "delete" && <>
          <h3 className="h3">{t("system.profile.data")}</h3>
          <div className="list" style={{ marginBottom: 24 }}><div className="li"><span className="grow"><div className="ttl">{t("system.profile.export")}</div><div className="sub">{t("system.profile.exportDesc")}</div></span><button className="btn secondary" onClick={() => toast.add({ title: t("system.settings.exportStarted"), description: t("system.settings.exportStartedDesc"), data: { icon: "download" } })}><Icon name="download" />{t("system.settings.exportBtn")}</button></div></div>
          <div className="systeme-zone"><h3>{t("system.profile.deleteZone")}</h3><p>{t("system.profile.deleteZoneText")}</p>
            <ul><li>{t("system.profile.lose1", { chats: p.chats, projects: p.projects })}</li><li>{t("system.profile.lose2", { files: p.files })}</li><li>{t("system.profile.lose3")}</li></ul>
            <button className="btn systeme-btn-danger" onClick={() => setDel(true)}>{t("system.profile.deleteOpen")}</button></div>
        </>}
      </div>
    </div></div>
    <DeleteAccountDialog open={del} onOpenChange={setDel} />
  </>);
}
