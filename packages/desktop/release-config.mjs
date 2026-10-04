// Build-time only: never read deployment routing from renderer input or runtime env.
export function releaseConfig(env) {
  const channel = env.CORTEX_RELEASE_CHANNEL ?? "production";
  if (channel !== "production" && channel !== "staging") throw new Error("Invalid release channel");
  if (channel === "production") {
    if (env.CORTEX_STAGING_API_ORIGIN) throw new Error("Staging origin requires staging channel");
    return { channel, origin: "https://api.cortex.foundation" };
  }
  const value = env.CORTEX_STAGING_API_ORIGIN;
  if (!value) throw new Error("Staging API origin is required");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash
    || url.pathname !== "/" || url.hostname.replace(/\.$/, "") === "api.cortex.foundation") {
    throw new Error("Staging requires a non-production HTTPS origin without credentials or a path");
  }
  return { channel, origin: url.origin };
}
