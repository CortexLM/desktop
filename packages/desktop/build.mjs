// Bundles Electron main and preload with esbuild. Workspace packages are inlined; runtime deps stay external.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const common = { bundle: true, platform: "node", target: "node22", format: "cjs", sourcemap: true, external: ["electron"], logLevel: "info", define: { "import.meta.env": "{}" } };
await build({ ...common, entryPoints: [path.join(dir, "src/main.ts")], outfile: path.join(dir, "dist/main.cjs") });
await build({ ...common, entryPoints: [path.join(dir, "src/preload.ts")], outfile: path.join(dir, "dist/preload.cjs") });
