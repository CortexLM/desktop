import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { createUpdater, feedURL, type Squirrel } from "../src/updater";
import type { UpdateState } from "@cortex/schema";

class FakeSquirrel extends EventEmitter implements Squirrel {
  feeds: string[] = []; checks = 0; installs = 0; refuseFeed = false;
  setFeedURL(o: { url: string }) { if (this.refuseFeed) throw new Error("Could not get code signature for running application"); this.feeds.push(o.url); }
  checkForUpdates() { this.checks++; }
  quitAndInstall() { this.installs++; }
}
const now = () => new Date("2026-10-06T00:00:00Z");

describe("updater", () => {
  it("validates the feed: https, or http on loopback only, no credentials", () => {
    expect(feedURL(undefined, "darwin", "1.0.0")).toBe("not_configured");
    expect(feedURL("http://updates.example.test/", "darwin", "1.0.0")).toBe("feed_invalid");
    expect(feedURL("https://u:p@updates.example.test/", "darwin", "1.0.0")).toBe("feed_invalid");
    expect(feedURL("https://updates.example.test/feed?x=1", "darwin", "1.0.0")).toBe("feed_invalid");
    expect(feedURL("https://updates.example.test/feed/", "darwin", "1.0.0")).toBe("https://updates.example.test/feed/darwin/1.0.0");
    expect(feedURL("http://127.0.0.1:9000", "darwin", "1.0.0")).toBe("http://127.0.0.1:9000/darwin/1.0.0");
    expect(feedURL("https://updates.example.test/win/", "win32", "1.0.0")).toBe("https://updates.example.test/win/");
  });

  it("walks checking, up-to-date, available, downloading and ready, then installs only when ready", () => {
    const q = new FakeSquirrel();
    const u = createUpdater({ squirrel: q, platform: "darwin", version: "0.0.1", feed: "http://127.0.0.1:9/", now });
    const seen: UpdateState["state"][] = [];
    u.on((s) => seen.push(s.state));
    expect(u.install()).toBe(false);
    expect(u.check().state).toBe("checking");
    q.emit("update-not-available");
    expect(u.status()).toEqual({ state: "up-to-date", current: "0.0.1", checkedAt: "2026-10-06T00:00:00.000Z" });
    u.check(); q.emit("update-available");
    expect(u.check().state).toBe("downloading");
    expect(q.checks).toBe(2);
    q.emit("update-downloaded", {}, "notes", "0.0.2");
    expect(u.status()).toMatchObject({ state: "ready", version: "0.0.2" });
    expect(u.install()).toBe(true);
    expect(q.installs).toBe(1);
    expect(seen).toEqual(["checking", "up-to-date", "checking", "available", "downloading", "ready"]);
  });

  it("reports Squirrel errors and recovers on the next check", () => {
    const q = new FakeSquirrel();
    const u = createUpdater({ squirrel: q, platform: "darwin", version: "0.0.1", feed: "http://127.0.0.1:9/", now });
    u.check(); q.emit("error", new Error("HTTP 500"));
    expect(u.status()).toEqual({ state: "error", current: "0.0.1", code: "check_failed" });
    expect(u.check().state).toBe("checking");
  });

  it("refuses without touching Squirrel when unsupported, unconfigured or unsigned", () => {
    const linux = new FakeSquirrel();
    expect(createUpdater({ squirrel: linux, platform: "linux", version: "1", feed: "https://x.test/" }).check()).toMatchObject({ state: "error", code: "unsupported" });
    expect(linux.feeds).toEqual([]); expect(linux.checks).toBe(0);
    expect(createUpdater({ squirrel: new FakeSquirrel(), platform: "darwin", version: "1", feed: undefined }).status()).toMatchObject({ code: "not_configured" });
    const unsigned = Object.assign(new FakeSquirrel(), { refuseFeed: true });
    const u = createUpdater({ squirrel: unsigned, platform: "darwin", version: "1", feed: "https://x.test/" });
    expect(u.check()).toMatchObject({ state: "error", code: "not_signed" });
    expect(unsigned.checks).toBe(0);
  });
});
