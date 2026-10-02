// node scripts/compare-shots.test.mjs — provenance refusals without starting a browser/server.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { fingerprint, main, readPrevious, readReference, referenceFor, trackAssets } from "./compare-shots.mjs";

const root = fs.mkdtempSync("/tmp/opencode/cortex-compare-test-");
const shots = path.join(root, "shots"), out = path.join(root, "output");
const digest = (value) => createHash("sha256").update(value).digest("hex");
const write = (file, value) => fs.writeFileSync(path.join(root, file), JSON.stringify(value));
try {
  const page = Object.assign(new EventEmitter(), { mainFrame: () => "main" });
  const { assets, drain } = trackAssets(page);
  const headers = Promise.withResolvers(), body = Promise.withResolvers(), started = Promise.withResolvers();
  const request = (url, response) => ({ frame: () => "main", resourceType: () => "font", url: () => url, response: () => response, failure: () => null });
  const response = (url, read) => ({ ok: () => true, status: () => 200, url: () => url, body: read });
  page.emit("request", request("https://preview.test/first.woff2", headers.promise));
  let drained = false;
  const done = drain().then(() => { drained = true; });
  await Promise.resolve(); assert.equal(drained, false, "Wait for outstanding response headers");
  headers.resolve(response("https://preview.test/first.woff2", async () => {
    page.emit("request", request("https://preview.test/second.woff2", Promise.resolve(response("https://preview.test/second.woff2", () => {
      started.resolve(); return body.promise;
    }))));
    return Buffer.from("first font");
  }));
  await started.promise; await Promise.resolve();
  assert.equal(drained, false, "Wait for assets added during the drain");
  body.resolve(Buffer.from("second font")); await done;
  assert.equal(assets.size, 2);
  assert.equal(assets.get("https://preview.test/second.woff2").sha256, digest("second font"));
  page.emit("request", request("https://preview.test/missing.woff2", Promise.resolve(response("https://preview.test/missing.woff2", async () => { throw new Error("No body"); }))));
  await assert.rejects(drain(), (error) => error.message.includes("Asset provenance errors") && error.actual[0].url === "https://preview.test/missing.woff2" && error.actual[0].message.includes("No body"));

  fs.mkdirSync(path.join(root, "src")); fs.mkdirSync(shots);
  fs.writeFileSync(path.join(root, "src/main.ts"), "export const version = 1;\n");
  const sourceFingerprint = digest(`src/main.ts:${digest("export const version = 1;\n")}`);
  assert.deepEqual(fingerprint(root), { sourceFingerprint, sourceFileCount: 1 });
  write("freeze.json", { sourceFingerprint, sourceFileCount: 1, captures: "pending" });
  write("shots/registry.json", { routes: [{ id: "settings", variants: [] }, { id: "home", variants: [] }] });
  const image = Buffer.from("reference bytes are verified before PNG decoding");
  fs.writeFileSync(path.join(shots, "settings-light.png"), image);
  const record = { route: "settings", variant: "", theme: "light", interaction: null, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, capturedAt: "2026-10-02T00:00:00Z", sourceFingerprint, sha256: digest(image), consoleErrors: [] };
  const manifest = { images: { "settings-light.png": record } };
  write("shots/manifest.json", manifest);
  const reference = readReference(shots);
  const screens = [{ id: "settings", variants: [["general", "General", "settings"], ["appearance", "Appearance", "settings-apparence"]] }, { id: "home" }];
  assert.equal(referenceFor({ route: "settings", v: "general", theme: "light" }, screens, reference).file, "settings-light.png");
  assert.equal(referenceFor({ route: "settings", v: "appearance", theme: "light" }, screens, reference).status, "no-design-shot");
  assert.equal(referenceFor({ route: "home", v: "", theme: "light", action: "mode" }, screens, reference).status, "no-design-shot");
  assert.throws(() => referenceFor({ route: "home", v: "", theme: "light" }, screens, reference), /Missing frozen manifest record/);
  const namedReference = { images: { "captured-mode-menu-light.png": { ...record, route: "home", interaction: "menu" } } };
  assert.equal(referenceFor({ route: "home", v: "", theme: "light", action: "mode" }, screens, namedReference).file, "captured-mode-menu-light.png");

  fs.mkdirSync(path.join(root, "review/cmp"), { recursive: true });
  fs.mkdirSync(path.join(root, "public/states"), { recursive: true });
  write("review/cmp/coverage.json", { sourceFingerprint }); write("public/states/index.json", []);
  const artifacts = { manifestSha256: "shots/manifest.json", coverageSha256: "review/cmp/coverage.json", motionIndexSha256: "public/states/index.json" };
  const captures = { status: "passed", ...Object.fromEntries(Object.entries(artifacts).map(([key, file]) => [key, digest(fs.readFileSync(path.join(root, file)))])) };
  write("freeze.json", { sourceFingerprint, sourceFileCount: 1, captures });
  const finalized = readReference(shots);
  for (const [key, file] of Object.entries(artifacts)) {
    assert.equal(finalized.provenance[key], captures[key]);
    const original = fs.readFileSync(path.join(root, file));
    fs.appendFileSync(path.join(root, file), "\n");
    assert.throws(() => readReference(shots), new RegExp(`Finalized capture hash mismatch: ${key}`));
    fs.writeFileSync(path.join(root, file), original);
  }
  delete captures.coverageSha256;
  write("freeze.json", { sourceFingerprint, sourceFileCount: 1, captures });
  assert.throws(() => readReference(shots), /Finalized capture hash mismatch: coverageSha256/);
  write("freeze.json", { sourceFingerprint, sourceFileCount: 1, captures: "pending" });

  fs.writeFileSync(path.join(shots, "settings-light.png"), "tampered");
  await assert.rejects(main(["--shots", shots, "--out", out, "--base", "http://127.0.0.1:1/"]), /Reference image hash mismatch/);
  assert(!fs.existsSync(out));
  fs.writeFileSync(path.join(shots, "settings-light.png"), image);
  record.sourceFingerprint = "stale"; write("shots/manifest.json", manifest);
  assert.throws(() => readReference(shots), /Reference source mismatch/);
  record.sourceFingerprint = sourceFingerprint; write("shots/manifest.json", manifest);
  record.consoleErrors = ["Reference crashed"]; write("shots/manifest.json", manifest);
  assert.throws(() => readReference(shots), /Reference console errors/);
  record.consoleErrors = []; write("shots/manifest.json", manifest);
  fs.writeFileSync(path.join(shots, "orphan-light.png"), image);
  assert.throws(() => readReference(shots), /no manifest record/);
  fs.unlinkSync(path.join(shots, "orphan-light.png"));
  fs.writeFileSync(path.join(root, "src/main.ts"), "changed");
  assert.throws(() => readReference(shots), /Frozen source fingerprint mismatch/);

  fs.mkdirSync(out);
  write("output/report.json", []);
  write("output/provenance.json", { version: 1, reference: reference.provenance, application: { sourceFingerprint: "old-source" } });
  assert.throws(() => readPrevious(out, reference, { sourceFingerprint: "new-source" }, "comparator"), /Cannot merge different application sources/);
  write("output/provenance.json", { version: 1, reference: { ...reference.provenance, sourceFingerprint: "another-freeze" } });
  assert.throws(() => readPrevious(out, reference, {}, "comparator"), /Cannot merge different frozen references/);
  console.log("compare-shots provenance checks passed");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
