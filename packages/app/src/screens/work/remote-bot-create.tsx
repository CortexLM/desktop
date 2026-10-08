// Signed-in Bot creation: guided steps with a live mascot preview, then slide to activate (design bot-new).
import * as React from "react";
import type { WorkBotView } from "@cortex/schema";
import { useNav } from "../../shell/nav";
import { useT } from "../../i18n";
import { Icon, IconBtn } from "../../kit/ui";
import { Mascot } from "../../mascot/Mascot";
import { SlideToActivate } from "../bots/bot";
import { Choice, LOOKS, lookMascot } from "./common";

type Config = { name: string; description: string; label: string; look: WorkBotView["look"]; shape: WorkBotView["shape"]; lead_id?: string };

export function RemoteBotCreate({ bots, ready, error, onCreate }: { bots: WorkBotView[]; ready: boolean; error: boolean; onCreate: (config: Config) => Promise<boolean> }) {
  const t = useT(), { go } = useNav();
  const [step, setStep] = React.useState(0), [typing, setTyping] = React.useState(false);
  const [config, setConfig] = React.useState<Config>({ name: "", description: "", label: "", look: "plum", shape: "dots" });
  const steps = [t("bots.new.step.name"), t("bots.new.step.look"), t("bots.new.step.role"), t("bots.new.step.activate")];
  const shown = config.name.trim() || t("bots.new.yourBot");
  const cfg = lookMascot({ name: config.name, look: config.look });
  return <>
    <div className="content-top"><div className="spacer" /><IconBtn icon="close" label={t("common.close")} onClick={() => go("work-home")} /></div>
    <div className="onb" data-testid="remote-bot-create">
      <div className="steps" aria-label={t("bots.new.stepOf", { n: step + 1, total: steps.length })}>{steps.map((s, i) => <i key={s} className="step" data-current={i === step || undefined} data-done={i < step || undefined} />)}</div>
      <div className="onb-card" key={step}>
        {step === 0 && <>
          <Mascot cfg={cfg} state={typing ? "listening" : "idle"} size={120} track interactive />
          <h1>{t("bots.new.title")}</h1><p>{t("bots.new.intro")}</p>
          <div className="field" style={{ width: "100%" }}><label htmlFor="rbn">{t("bots.new.nameLabel")}</label><input id="rbn" className="input" data-testid="work-bot-name" value={config.name} maxLength={40} onFocus={() => setTyping(true)} onBlur={() => setTyping(false)} onChange={e => setConfig(v => ({ ...v, name: e.target.value }))} /></div>
        </>}
        {step === 1 && <>
          <Mascot cfg={cfg} state="idle" size={120} track interactive />
          <h1>{t("bots.new.lookTitle", { name: shown })}</h1><p>{t("bots.new.colorText")}</p>
          <div style={{ width: "100%" }}><Choice testId="work-bot-look" label={t("workBot.look")} value={config.look} onChange={look => setConfig(v => ({ ...v, look }))} options={LOOKS.map(look => [look, <><Mascot cfg={lookMascot({ name: config.name, look })} size={18} state="idle" />{t(`workBot.look.${look}`)}</>])} /></div>
        </>}
        {step === 2 && <>
          <h1>{t("bots.new.roleTitle", { name: shown })}</h1><p>{t("bots.new.roleText")}</p>
          <div className="field" style={{ width: "100%" }}><label htmlFor="rbl">{t("workBot.label")}</label><input id="rbl" className="input" data-testid="work-bot-label" placeholder={t("bots.new.rolePlaceholder")} value={config.label} maxLength={40} onChange={e => setConfig(v => ({ ...v, label: e.target.value }))} /></div>
          <div className="field" style={{ width: "100%" }}><label htmlFor="rbd">{t("workBot.description")}</label><textarea id="rbd" className="input" data-testid="work-bot-description" placeholder={t("bots.new.instructionsPlaceholder")} value={config.description} maxLength={2000} onChange={e => setConfig(v => ({ ...v, description: e.target.value }))} /></div>
          {bots.length > 0 && <div style={{ width: "100%" }}><Choice testId="work-bot-lead" label={t("workBot.lead")} value={config.lead_id ?? ""} disabled={!ready} onChange={v => setConfig(c => ({ ...c, lead_id: v || undefined }))}
            options={[["", t("workBot.root")], ...bots.map(bot => [bot.id, <><Mascot cfg={lookMascot(bot)} size={18} state="idle" />{bot.name}</>] as [string, React.ReactNode])]} /></div>}
        </>}
        {step === 3 && <>
          <Mascot cfg={cfg} state="waiting" size={120} interactive />
          <h1>{t("bots.new.readyTitle", { name: shown })}</h1><p>{t("bots.new.readyText")}</p>
          {error && <div className="banner err" role="alert" data-testid="work-bot-create-error">{t("bots.error.create")}</div>}
          <SlideToActivate onDone={() => onCreate({ ...config, name: config.name.trim() })} />
        </>}
      </div>
      <div className="onb-foot">
        {step > 0 ? <button className="btn secondary" onClick={() => setStep(step - 1)}>{t("bots.back")}</button> : <span />}
        {step < 3 && <button className="btn primary" data-testid="work-bot-next" disabled={!config.name.trim() || !ready} onClick={() => setStep(step + 1)}>{t("bots.continue")}<Icon name="arrow-right" /></button>}
      </div>
    </div>
  </>;
}
