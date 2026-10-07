// Imported first by index.ts: ESM evaluates re-exported submodules before the index body,
// so jitless must be set in its own module to precede every schema initialization.
import { z } from "zod"

z.config({ jitless: true })
