import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";

const releaseConfig = (env: Record<string, string | undefined>) => JSON.parse(execFileSync(process.execPath, [
  "--input-type=module", "-e",
  'import { releaseConfig } from "./packages/desktop/release-config.mjs"; console.log(JSON.stringify(releaseConfig(JSON.parse(process.argv[1]))));',
  JSON.stringify(env),
], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));

describe("release routing", () => {
  it("embeds staging routing without changing the production discovery identity", async () => {
    const release = releaseConfig({ CORTEX_RELEASE_CHANNEL: "staging", CORTEX_STAGING_API_ORIGIN: "https://staging.example.test" });
    const bundle = await build({
      stdin: { contents: 'import { CLOUD_URL, PRODUCTION_CLOUD_URL } from "./packages/core/src/connection.ts"; console.log(JSON.stringify({cloud: CLOUD_URL, production: PRODUCTION_CLOUD_URL}));', resolveDir: process.cwd() },
      bundle: true, platform: "node", format: "cjs", write: false,
      define: { __CORTEX_CLOUD_ORIGIN__: JSON.stringify(release.origin) },
    });
    const result = execFileSync(process.execPath, ["--input-type=commonjs"], {
      input: bundle.outputFiles[0].text, encoding: "utf8", env: { ...process.env, CORTEX_STAGING_API_ORIGIN: "https://runtime-must-not-win.example.test" },
    });
    expect(JSON.parse(result)).toEqual({ cloud: "https://staging.example.test", production: "https://api.cortex.foundation" });
  });
  it("keeps the production default and seals an explicit staging origin", () => {
    expect(releaseConfig({})).toEqual({ channel: "production", origin: "https://api.cortex.foundation" });
    expect(releaseConfig({ CORTEX_RELEASE_CHANNEL: "staging", CORTEX_STAGING_API_ORIGIN: "https://staging.example.test/" }))
      .toEqual({ channel: "staging", origin: "https://staging.example.test" });
  });
  it.each([undefined, "", "http://staging.example.test", "https://api.cortex.foundation", "https://API.CORTEX.FOUNDATION:443/", "https://api.cortex.foundation./", "https://user:secret@staging.example.test", "https://staging.example.test/api", "https://staging.example.test/?secret=x", "https://staging.example.test/#x"])("refuses unsafe or missing staging origin %s", (origin) => {
    expect(() => releaseConfig({ CORTEX_RELEASE_CHANNEL: "staging", CORTEX_STAGING_API_ORIGIN: origin })).toThrow();
  });
  it("refuses ambiguous production builds and unknown channels", () => {
    expect(() => releaseConfig({ CORTEX_STAGING_API_ORIGIN: "https://staging.example.test" })).toThrow();
    expect(() => releaseConfig({ CORTEX_RELEASE_CHANNEL: "preview" })).toThrow();
  });
});
