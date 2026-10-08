// Navigation-proof shared fetch: one in-flight request per key, last good value kept for instant reuse.
const inflight = new Map<string, Promise<unknown>>();
const last = new Map<string, unknown>();
export const cached = <T>(key: string) => last.get(key) as T | undefined;
// Forgetting also drops the in-flight load: it can no longer fill the cache or serve later callers.
export const forget = (key?: string) => { if (key) { last.delete(key); inflight.delete(key); } else { last.clear(); inflight.clear(); } };
export function shared<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = inflight.get(key) as Promise<T> | undefined;
  if (hit) return hit;
  const p: Promise<T> = load().then((v) => { if (inflight.get(key) === p) last.set(key, v); return v; })
    .finally(() => { if (inflight.get(key) === p) inflight.delete(key); });
  inflight.set(key, p);
  return p;
}
export const remember = (key: string, value: unknown) => { last.set(key, value); };
