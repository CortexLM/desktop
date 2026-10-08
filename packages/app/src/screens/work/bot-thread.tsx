// Bot conversation, iMessage style: bubbles only, typing dots while the Bot works, one quiet line when it waits.
import * as React from "react";
import type { WorkBotSnapshot } from "@cortex/schema";
import { useT } from "../../i18n";
import { Mascot, type MascotConfig } from "../../mascot/Mascot";
import { useDate } from "./common";

type Message = WorkBotSnapshot["messages"][number];
type Job = WorkBotSnapshot["jobs"][number];
type Item = { id: string; mine: boolean; text: string; at: string };

const GAP = 10 * 60_000;

export function BotThread({ snapshot, cfg, approvals, sending, outgoing, onStop }: { snapshot: WorkBotSnapshot; cfg: MascotConfig; approvals?: React.ReactNode; sending?: boolean; outgoing?: string; onStop?: (job: string) => void }) {
  const t = useT(), date = useDate(), end = React.useRef<HTMLDivElement>(null);
  const items: Item[] = [
    ...snapshot.messages.filter(m => !m.dismissed && m.kind !== "confirm" && m.text.trim()).map((m: Message) => ({ id: m.id, mine: m.sender === "user", text: m.text, at: m.at })),
    ...snapshot.jobs.map((j: Job) => ({ id: `job:${j.id}`, mine: true, text: j.goal, at: j.created_at })),
    ...snapshot.jobs.filter(j => j.status === "done" && typeof j.result === "string" && j.result.trim()).map(j => ({ id: `result:${j.id}`, mine: false, text: j.result as string, at: j.created_at })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const running = snapshot.jobs.find(j => j.status === "running"), typing = sending || !!running;
  const waiting = !typing && snapshot.jobs.some(j => j.status === "queued" || j.status === "paused");
  const failed = !typing && !waiting && snapshot.jobs.at(-1)?.status === "failed";
  React.useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [items.length, typing]);
  const stamp = (at: string) => { const n = Date.parse(at); return Number.isNaN(n) ? "" : Date.now() - n < 86_400_000 ? date.time(n) : `${date.date(n)} ${date.time(n)}`; };
  return <div className="bot-thread" data-testid="bot-thread" aria-live="polite">
    {items.map((m, i) => {
      const prev = items[i - 1], next = items[i + 1];
      const gap = !prev || Date.parse(m.at) - Date.parse(prev.at) > GAP;
      const tail = !next || next.mine !== m.mine || Date.parse(next.at) - Date.parse(m.at) > GAP;
      return <React.Fragment key={m.id}>
        {gap && <time className="bot-thread-time" dateTime={m.at}>{stamp(m.at)}</time>}
        {m.mine ? <div className="bot-bubble bot-bubble-me" data-testid="bot-thread-message" data-sender="user">{m.text}</div>
          : <div className="msg-bot-row bot-thread-row" data-testid="bot-thread-message" data-sender="bot">{tail ? <Mascot cfg={cfg} state="idle" size={24} /> : <span className="bot-thread-pad" />}<div className="bot-bubble">{m.text}</div></div>}
      </React.Fragment>;
    })}
    {outgoing && !items.some(m => m.mine && m.text === outgoing) && <div className="bot-bubble bot-bubble-me" data-testid="bot-thread-message" data-sender="user" data-pending="">{outgoing}</div>}
    {approvals}
    {typing && <div className="msg-bot-row bot-thread-row" data-testid="bot-typing" role="status" aria-label={t("workBot.thread.typing", { name: cfg.name })}><Mascot cfg={cfg} state="thinking" size={24} /><div className="bot-bubble bot-bubble-typing"><span className="typing"><i /><i /><i /></span></div>{running && onStop && <button className="bot-thread-stop" data-testid="work-bot-cancel" onClick={() => onStop(running.id)}>{t("workBot.thread.stop")}</button>}</div>}
    {(waiting || failed) && <p className="bot-thread-note" role="status" data-testid="bot-thread-note">{t(failed ? "workBot.thread.failed" : "workBot.thread.waiting", { name: cfg.name })}</p>}
    <div ref={end} />
  </div>;
}
