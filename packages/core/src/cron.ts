import type { Schedule } from "@cortex/schema"

/** Five-field cron (minute hour day-of-month month day-of-week), local time. `*`, lists, ranges, steps. dow 0-7 (0 and 7 = Sunday). */
export interface Cron {
  minute: Set<number>
  hour: Set<number>
  dom: Set<number>
  month: Set<number>
  dow: Set<number>
  domAny: boolean
  dowAny: boolean
}

const RANGES: [number, number][] = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7],
]

function field(src: string, [lo, hi]: [number, number]): Set<number> {
  const out = new Set<number>()
  for (const item of src.split(",")) {
    const m = /^(\*|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/.exec(item)
    if (!m) throw new Error(`invalid cron field: ${item}`)
    const step = m[4] ? Number(m[4]) : 1
    const a = m[1] === "*" ? lo : Number(m[2])
    const b = m[1] === "*" ? hi : m[3] !== undefined ? Number(m[3]) : m[4] ? hi : a
    if (a < lo || b > hi || a > b || step < 1) throw new Error(`cron field out of range: ${item}`)
    for (let v = a; v <= b; v += step) out.add(v)
  }
  return out
}

export function parseCron(expr: string): Cron {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) throw new Error("cron expression needs 5 fields")
  const [minute, hour, dom, month, dow] = parts.map((p, i) => field(p, RANGES[i]!))
  if (dow!.has(7)) dow!.add(0)
  return { minute: minute!, hour: hour!, dom: dom!, month: month!, dow: dow!, domAny: parts[2] === "*", dowAny: parts[4] === "*" }
}

function dayMatches(c: Cron, d: Date) {
  const dom = c.dom.has(d.getDate())
  const dow = c.dow.has(d.getDay())
  // Vixie semantics: when both are restricted, either matches.
  if (!c.domAny && !c.dowAny) return dom || dow
  return dom && dow
}

/** First matching minute strictly after `after`, or undefined within ~5 years. */
export function nextCron(c: Cron, after: Date): Date | undefined {
  const d = new Date(after.getTime())
  d.setSeconds(0, 0)
  d.setMinutes(d.getMinutes() + 1)
  const limit = after.getTime() + 5 * 366 * 86_400_000
  while (d.getTime() <= limit) {
    if (!c.month.has(d.getMonth() + 1)) {
      d.setMonth(d.getMonth() + 1, 1)
      d.setHours(0, 0, 0, 0)
      continue
    }
    if (!dayMatches(c, d)) {
      d.setDate(d.getDate() + 1)
      d.setHours(0, 0, 0, 0)
      continue
    }
    if (!c.hour.has(d.getHours())) {
      d.setHours(d.getHours() + 1, 0, 0, 0)
      continue
    }
    if (!c.minute.has(d.getMinutes())) {
      d.setMinutes(d.getMinutes() + 1, 0, 0)
      continue
    }
    return d
  }
  return undefined
}

const hm = (t: string) => t.split(":").map(Number) as [number, number]

export function scheduleToCron(s: Schedule): string | undefined {
  if (s.type === "cron") return s.expr
  if (s.type === "daily") {
    const [h, m] = hm(s.time)
    return `${m} ${h} * * *`
  }
  if (s.type === "weekly") {
    const [h, m] = hm(s.time)
    return `${m} ${h} * * ${s.day}`
  }
  return undefined
}

export function nextRun(s: Schedule, after: Date): number | undefined {
  if (s.type === "once") return s.at > after.getTime() ? s.at : undefined
  return nextCron(parseCron(scheduleToCron(s)!), after)?.getTime()
}

export function validateSchedule(s: Schedule): boolean {
  try {
    if (s.type !== "once") parseCron(scheduleToCron(s)!)
    return true
  } catch {
    return false
  }
}
