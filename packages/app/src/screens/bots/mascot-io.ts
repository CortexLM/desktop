// Converts between the engine's bot mascot record and the renderer's MascotConfig.
import type { Bot, Mascot as MascotData, ModelRef } from "@cortex/schema";
import { COLORS, DEFAULT_MASCOT, SHAPE_LIST, type MascotConfig, type Eyes, type Mouth, type Shape } from "../../mascot/Mascot";
import { ACCESSORIES, type Slot } from "../../mascot/parts";
import { api } from "../../api";

const EYES: Eyes[] = ["commas", "dots", "ovals", "pixels"];
const MOUTHS: Mouth[] = ["none", "smile", "o"];
const SYMBOL = "symbol:";

export function toConfig(b: Pick<Bot, "name" | "mascot">): MascotConfig {
  const m = b.mascot;
  const slot = (s: Slot) => m.accessories.find((id) => ACCESSORIES.some((a) => a.id === id && a.slot === s));
  const color = m.color.startsWith("#") ? m.color : (COLORS.find(([id]) => id === m.color)?.[1] ?? DEFAULT_MASCOT.color);
  return {
    name: b.name,
    shape: SHAPE_LIST.includes(m.shape as Shape) ? (m.shape as Shape) : DEFAULT_MASCOT.shape,
    color,
    eyes: EYES.includes(m.eyes as Eyes) ? (m.eyes as Eyes) : DEFAULT_MASCOT.eyes,
    mouth: MOUTHS.includes(m.mouth as Mouth) ? (m.mouth as Mouth) : DEFAULT_MASCOT.mouth,
    glasses: slot("glasses"), hat: slot("hat"), extra: slot("extra"),
    symbol: m.accessories.find((a) => a.startsWith(SYMBOL))?.slice(SYMBOL.length),
  };
}

export function toMascot(c: MascotConfig): MascotData {
  return { shape: c.shape, color: c.color, eyes: c.eyes, mouth: c.mouth, accessories: [c.glasses, c.hat, c.extra, c.symbol && SYMBOL + c.symbol].filter((x): x is string => !!x) };
}

/** First model of the first usable provider; null when nothing is configured in Settings → Providers. */
export async function defaultModel(): Promise<ModelRef | null> {
  const ps = await api.providers.list();
  for (const p of ps.filter((p) => p.enabled && (p.hasKey || p.baseURL || p.providerID === "ollama"))) {
    const ms = await api.catalog.models(p.providerID).catch(() => []);
    if (ms[0]) return { providerID: p.providerID, modelID: ms[0].id };
  }
  return null;
}
