/**
 * Which product a connected plugin's tools are available to: Cortex Chat,
 * Cortex Bot, or both.
 *
 * The assignment lives on the account's connection, so this module only
 * projects it — it never invents one. The single judgement call is what an
 * answer with no `surfaces` on it means, and the honest reading is "nothing is
 * filtering this connection", which is both surfaces rather than none.
 */

import { PLUGIN_SURFACES, type PluginSurface } from '@cortex-ide/cortex-api';

export type { PluginSurface };
export { PLUGIN_SURFACES };

/**
 * The connection's assignment, in the order the page offers the two surfaces.
 *
 * An absent or empty list is a service that does not filter by surface, which
 * is every surface — showing it as "off everywhere" would describe a
 * connection whose tools are in fact reachable from both products.
 *
 * A list naming only surfaces this client has no switch for comes back empty,
 * which is the truthful answer: the connection is on neither Chat nor Bot here.
 */
export function readPluginSurfaces(
  value: readonly string[] | undefined,
): readonly PluginSurface[] {
  if (!value || value.length === 0) return PLUGIN_SURFACES;
  return PLUGIN_SURFACES.filter((surface) => value.includes(surface));
}

/**
 * The assignment after switching one surface on or off, or `undefined` when
 * that would leave the connection on no surface at all.
 *
 * A plugin on neither Chat nor Bot is connected to nothing, and the way to stop
 * using it is Disconnect — so the caller says that instead of sending a change
 * the service would be right to refuse.
 */
export function togglePluginSurface(
  current: readonly PluginSurface[],
  surface: PluginSurface,
  enabled: boolean,
): readonly PluginSurface[] | undefined {
  const next = PLUGIN_SURFACES.filter((candidate) =>
    candidate === surface ? enabled : current.includes(candidate),
  );
  return next.length === 0 ? undefined : next;
}
