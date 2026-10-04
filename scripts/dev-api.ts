// Dev-only engine server for `vite` in a browser (port 5298, proxied from /api by packages/app/vite.config.ts).
// Keys are kept in memory; Electron uses the OS keychain instead.
import { createCore, memoryCredentials } from "@cortex/core";
import { createServer, listen } from "@cortex/server";

const core = createCore({ dataDir: process.env.CORTEX_DATA_DIR ?? ".cortex-dev", credentials: memoryCredentials(), catalogUrl: process.env.CORTEX_CATALOG_URL });
await core.start();
const { url } = await listen(createServer(core), Number(process.env.PORT ?? 5298));
console.log(`engine listening on ${url}`);
