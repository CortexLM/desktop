// Local browser: pair the Cortex Chrome extension and manage the tabs the user shared. Page text never reaches this screen.
import * as React from "react";
import { bridge, type BrowserState } from "../../api";
import { useT } from "../../i18n";
import { Icon } from "../../kit/ui";
import { Page, Empty } from "./extras";

const R = "workspace-extras";
const PAIRING_MINUTES = 5;
const EMPTY: BrowserState = { listening: false, connected: false, tabs: [] };

/** Live bridge state: initial read, pushes from main, and a refresh when a pairing code expires. */
export function useBrowserState() {
  const api = bridge()?.browser;
  const [state, setState] = React.useState<BrowserState | undefined>(api ? undefined : EMPTY);
  React.useEffect(() => {
    if (!api) return;
    let live = true;
    void api.status().then(s => live && setState(s), () => live && setState(EMPTY));
    const off = api.onChange(s => live && setState(s));
    // The extension's long poll keeps `connected` fresh; this catches silence after it goes away.
    const tick = setInterval(() => void api.status().then(s => live && setState(s), () => {}), 15_000);
    return () => { live = false; off(); clearInterval(tick); };
  }, [api]);
  const expiresAt = state?.pairing?.expiresAt;
  React.useEffect(() => {
    if (!api || !expiresAt) return;
    const timer = setTimeout(() => void api.status().then(setState, () => {}), Math.max(0, expiresAt - Date.now()) + 50);
    return () => clearTimeout(timer);
  }, [api, expiresAt]);
  return { state, api };
}

export function Browser() {
  const t = useT(), { state, api } = useBrowserState();
  const [copied, setCopied] = React.useState(false);
  const mode = !state ? "loading" : !state.listening ? "noHost" : state.connected ? "connected" : state.pairing ? "waiting" : "off";
  const badge = mode === "connected" ? "ok" : mode === "waiting" ? "wait" : mode === "noHost" ? "err" : "";
  const code = state?.pairing?.code;
  const copy = async () => { if (!code) return; try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked: the code stays visible */ } };
  return <Page title={t("extras.browser.title")}>
    <h1>{t("extras.browser.h1")}</h1><p className={`${R}-lead`}>{t("extras.browser.lead")}</p>
    {state && <section className={`${R}-conn`} data-testid="browser-status" data-mode={mode}>
      <div className={`${R}-conn-head`}>
        <span className={`${R}-conn-icon`}><Icon name={mode === "connected" ? "check-circle" : "globe"} /></span>
        <div className={`${R}-grow`}><h2>{t(`extras.browser.status.${mode === "waiting" ? "waiting" : mode === "connected" ? "connected" : mode === "noHost" ? "noHost" : "off"}`)}</h2>
          <p>{t(mode === "connected" ? "extras.browser.connectedBody" : mode === "noHost" ? "extras.browser.noHostBody" : "extras.browser.offBody")}</p></div>
        <span className={`badge ${badge}`}>{t(`extras.browser.status.${mode === "waiting" ? "waiting" : mode === "connected" ? "connected" : mode === "noHost" ? "noHost" : "off"}`)}</span>
      </div>
      {mode === "connected" && <div className={`${R}-actions`}><button className="btn secondary" data-testid="browser-disconnect" onClick={() => void api?.disconnect()}>{t("extras.browser.disconnect")}</button></div>}
      {(mode === "off" || mode === "waiting") && <div className={`${R}-conn-steps`}>
        <div className={`${R}-conn-step`}><span className={`${R}-step-n`}>1</span><div className={`${R}-grow`}><h3>{t("extras.browser.install")}</h3><p>{t("extras.browser.installHelp")}</p></div>
          <button className="btn secondary" data-testid="browser-install" onClick={() => void api?.revealExtension()}><Icon name="download" />{t("extras.browser.install")}</button></div>
        <div className={`${R}-conn-step`}><span className={`${R}-step-n`}>2</span><div className={`${R}-grow`}><h3>{t("extras.browser.pairCode")}</h3>
          {code ? <><p className={`${R}-pair-code`} data-testid="browser-code" aria-label={t("extras.browser.pairCode")}>{code.slice(0, 4)}<span aria-hidden="true">-</span>{code.slice(4)}</p><p>{t("extras.browser.pairHelp", { minutes: PAIRING_MINUTES })}</p></> : <p>{t("extras.browser.offBody")}</p>}</div>
          <div className={`${R}-conn-buttons`}>
            {code && <button className="btn secondary" data-testid="browser-copy" onClick={() => void copy()}><Icon name={copied ? "check" : "copy"} />{t("extras.browser.copy")}</button>}
            <button className="btn primary" data-testid="browser-pair" onClick={() => void api?.pair()}>{t(code ? "extras.browser.pairNew" : "extras.browser.pair")}</button></div></div>
      </div>}
    </section>}
    {state && mode !== "noHost" && <section aria-labelledby="browser-tabs-h">
      <div className={`${R}-section-head`}><h2 id="browser-tabs-h">{t("extras.browser.tabs")}</h2></div>
      {state.tabs.length ? <ul className={`${R}-tabs-list`} data-testid="browser-tabs">{state.tabs.map(tab => <li key={tab.id}>
        <span className={`${R}-tab-icon`}><Icon name="globe" /></span>
        <div className={`${R}-grow`}><strong>{tab.title || tab.url}</strong><span className={`${R}-muted ${R}-tab-url`}>{tab.url}</span></div>
        <button className="btn secondary" data-testid="browser-revoke" aria-label={t("extras.browser.revokeLabel", { title: tab.title || tab.url })} onClick={() => void api?.revoke(tab.id)}>{t("extras.browser.revoke")}</button></li>)}</ul>
        : <Empty icon="globe" title={t(mode === "connected" ? "extras.browser.emptyTitle" : "extras.browser.offTitle")}>{t(mode === "connected" ? "extras.browser.emptyBody" : "extras.browser.offBody")}</Empty>}
    </section>}
    <p className={`${R}-footnote`}><Icon name="shield-check" /> {t("extras.browser.privacy")}</p>
  </Page>;
}
