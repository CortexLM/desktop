import { expect, it } from "vitest";
import { shared, cached, forget } from "./shared";

it("dedupes in-flight loads and keeps last value", async () => {
  forget();
  let calls = 0;
  const load = async () => { calls++; return calls; };
  const [a, b] = await Promise.all([shared("k", load), shared("k", load)]);
  expect([a, b, calls]).toEqual([1, 1, 1]);
  expect(cached("k")).toBe(1);
  forget("k");
  expect(cached("k")).toBeUndefined();
});

it("forget drops an in-flight load so it can neither fill the cache nor serve later callers", async () => {
  forget();
  let release!: (v: string) => void;
  const old = shared("k", () => new Promise<string>((r) => { release = r; }));
  forget("k");
  const fresh = shared("k", async () => "new");
  expect(fresh).not.toBe(old);
  expect(await fresh).toBe("new");
  release("old");
  expect(await old).toBe("old");
  expect(cached("k")).toBe("new");
});
