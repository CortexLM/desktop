import * as React from "react";
import type { SkillList, SkillView } from "@cortex/schema";
import { api } from "../../api";
import { useT } from "../../i18n";

// Work skills: upload a SKILL.md to the account catalog (producer scans it), then enable it for this Bot.
// Enabling a flagged skill requires acknowledging the stored scan verdict and findings.
export function BotSkills({ epoch, id, owns }: { epoch: string; id: string; owns(): boolean }) {
  const t = useT();
  const [list, setList] = React.useState<SkillList>(), [error, setError] = React.useState<string>(), [busy, setBusy] = React.useState(false);
  const [uploaded, setUploaded] = React.useState<SkillView>(), [review, setReview] = React.useState<SkillView>();
  const mounted = React.useRef(true), sequence = React.useRef(0), input = React.useRef<HTMLInputElement>(null);
  const current = () => mounted.current && owns();
  async function load() {
    const token = ++sequence.current;
    try { const items = await api.workBot.skills(id, epoch); if (current() && token === sequence.current) { setList(items); setError(undefined); } }
    catch { if (current() && token === sequence.current) setError("load"); }
  }
  React.useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; sequence.current++; }; }, [epoch, id]); // eslint-disable-line react-hooks/exhaustive-deps
  const code = (e: unknown) => typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "";
  async function upload(file: File) {
    if (busy) return;
    setBusy(true); setError(undefined); setUploaded(undefined);
    try {
      if (!/\.md$/i.test(file.name) || file.size > 65536) { setError("file"); return; }
      const skill = await api.workBot.skillUpload({ epoch, source: await file.text() });
      if (!current()) return;
      setUploaded(skill); await load();
    } catch (e) { if (current()) setError(code(e) === "conflict" ? "conflict" : code(e) === "invalid_request" ? "invalid" : "upload"); }
    finally { if (current()) setBusy(false); if (input.current) input.current.value = ""; }
  }
  async function toggle(skill: SkillView, enabled: boolean, acknowledge = false) {
    if (busy) return;
    if (enabled && skill.scan_verdict !== "clean" && !acknowledge) { setReview(skill); return; }
    setBusy(true); setError(undefined);
    try {
      await api.workBot.skillEnable(id, skill.slug, enabled ? { epoch, enabled, acknowledged: skill.scan_verdict, findings: skill.scan_findings } : { epoch, enabled });
      if (current()) { setReview(undefined); await load(); }
    } catch (e) { if (current()) setError(code(e) === "invalid_request" ? "scan" : "enable"); }
    finally { if (current()) setBusy(false); }
  }
  return <section className="travail-panel bot-apps" data-testid="bot-skills" aria-labelledby="bot-skills-title">
    <h3 id="bot-skills-title">{t("workBot.skills.title")}</h3>
    <p>{t("workBot.skills.hint")}</p>
    <label className="btn secondary" data-testid="bot-skill-upload-label">{t("workBot.skills.upload")}
      <input ref={input} type="file" accept=".md,text/markdown" data-testid="bot-skill-upload" disabled={busy} hidden onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
    </label>
    {uploaded && <p role="status" className="banner" data-testid="bot-skill-uploaded" data-slug={uploaded.slug} data-verdict={uploaded.scan_verdict}>{t("workBot.skills.uploaded", { name: uploaded.name, verdict: uploaded.scan_verdict })}</p>}
    {error && <p role="alert" className="banner err" data-testid="bot-skill-error" data-error={error}>{t(`workBot.skills.error.${error}`)}</p>}
    {review && <div role="dialog" aria-modal="false" className="banner warn" data-testid="bot-skill-review" data-slug={review.slug}>
      <p>{t("workBot.skills.review", { verdict: review.scan_verdict })}</p>
      <ul>{review.scan_findings.map(f => <li key={f}>{f}</li>)}</ul>
      <button className="btn primary" data-testid="bot-skill-acknowledge" disabled={busy} onClick={() => void toggle(review, true, true)}>{t("workBot.skills.acknowledge")}</button>
      <button className="btn secondary" disabled={busy} onClick={() => setReview(undefined)}>{t("workBot.skills.cancel")}</button>
    </div>}
    {!list ? !error && <p>{t("workBot.skills.loading")}</p> : list.items.length === 0 ? <p data-testid="bot-skills-empty">{t("workBot.skills.empty")}</p> :
      <ul className="bot-app-list">{list.items.map(skill => <li key={skill.slug} data-testid="bot-skill-row" data-slug={skill.slug} data-enabled={String(skill.enabled)} data-verdict={skill.scan_verdict}>
        <strong>{skill.name}</strong> <span>{skill.description}</span> <span className="tag">{skill.scan_verdict}</span>
        <label><input type="checkbox" data-testid="bot-skill-enable" checked={skill.enabled} disabled={busy || skill.owner === "global"} onChange={e => void toggle(skill, e.target.checked)} /> {t("workBot.skills.enable")}</label>
      </li>)}</ul>}
  </section>;
}
