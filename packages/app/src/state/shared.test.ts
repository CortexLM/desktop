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
