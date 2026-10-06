import { config } from "zod";

// zod 4 probes `Function("")` to JIT object parsers; the renderer CSP forbids eval, so opt out.
config({ jitless: true });
