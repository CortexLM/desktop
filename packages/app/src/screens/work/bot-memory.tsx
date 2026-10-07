import * as React from "react";
import { WorkMemoryTier, type WorkMemoryItem } from "@cortex/schema";
import { api } from "../../api";
import { useT } from "../../i18n";

// Owner-scoped producer memory rows. No learning signals or autonomy are inferred from them.
export function BotMemory({ epoch, id, owns }: { epoch: string; id: string; owns(): boolean }) {
  const t = useT();
  const [items, setItems] = React.useState<WorkMemoryItem[]>();
  const [tier, setTier] = React.useState<WorkMemoryItem["tier"]>("profile"), [text, setText] = React.useState("");
  const [error, setError] = React.useState(false), [busy, setBusy] = React.useState(false);
  const mounted = React.useRef(true), pending = React.useRef(false), sequence = React.useRef(0);
  const current = () => mounted.current && owns();
  const limit = tier === "profile" ? 4000 : 500;
  async function load() {
    const token = ++sequence.current;
    try { const rows = await api.workBot.memoryList(id, epoch); if (current() && token === sequence.current) { setItems(rows); setError(false); } }
    catch { if (current() && token === sequence.current) setError(true); }
  }
  React.useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; sequence.current++; }; }, [epoch, id]); // eslint-disable-line react-hooks/exhaustive-deps
  async function mutate(action: () => Promise<void>) {
    if (!current() || pending.current) return;
    pending.current = true; setBusy(true); setError(false);
    try { await action(); if (current()) await load(); }
    catch { if (current()) setError(true); }
    finally { pending.current = false; if (current()) setBusy(false); }
  }
  return <section className="travail-panel bot-memory" data-testid="bot-memory">
    <h2>{t("workBot.memory.title")}</h2><p>{t("workBot.memory.boundary")}</p>
    {error && <div className="banner err" role="alert" data-testid="bot-memory-error">{t("workBot.memory.error")}</div>}
    <form onSubmit={e => { e.preventDefault(); const sent = text; void mutate(async () => { await api.workBot.memoryAdd(id, { epoch, tier, text: sent }); if (current()) setText(v => v === sent ? "" : v); }); }}>
      <label className="field">{t("workBot.memory.tier")}<select className="input" data-testid="bot-memory-tier" value={tier} disabled={busy} onChange={e => setTier(WorkMemoryTier.parse(e.target.value))}>{WorkMemoryTier.options.map(value => <option key={value} value={value}>{t(`workBot.memory.tier.${value}`)}</option>)}</select></label>
      <label className="field">{t("workBot.memory.text")}<textarea className="input" data-testid="bot-memory-text" value={text} maxLength={limit} onChange={e => setText(e.target.value)} /></label>
      <button className="btn primary" data-testid="bot-memory-add" disabled={busy || !text.trim() || [...text.trim()].length > limit}>{t("workBot.memory.add")}</button>
    </form>
    {!items && !error && <p role="status">{t("workBot.loading")}</p>}
    {items && !items.length && <p data-testid="bot-memory-empty">{t("workBot.memory.empty")}</p>}
    {items?.map(item => <article className="bot-apps-row" key={item.id} data-testid="bot-memory-item" data-memory-id={item.id} data-tier={item.tier}>
      <div className="travail-grow"><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{item.text}</p><p className="sub">{t(`workBot.memory.tier.${item.tier}`)} · {new Date(item.at).toLocaleString()}</p></div>
      <button className="btn secondary" data-testid="bot-memory-remove" disabled={busy} onClick={() => void mutate(async () => { await api.workBot.memoryRemove(id, item.id, epoch); })}>{t("workBot.memory.remove")}</button>
    </article>)}
  </section>;
}
